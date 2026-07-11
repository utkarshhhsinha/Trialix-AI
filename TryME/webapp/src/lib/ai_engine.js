/**
 * ai_engine.js — oraneo Engine (v32.0 for Web)
 *
 * PRIMARY:  Google AI Studio (generativelanguage.googleapis.com)
 *           Model: gemini-2.0-flash-preview-image-generation
 *           Key:   VITE_GEMINI_API_KEY  (preferred) or VITE_FIREBASE_API_KEY
 *
 * FALLBACK: Firebase Cloud Function generateTryOn (server-side, same model)
 */

import { firebaseFunctions, firestore, firebaseAuth, storage } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, getBlob, uploadString, getDownloadURL } from 'firebase/storage';

// Keys — prefer a dedicated Gemini key, fall back to the Firebase web API key
const GEMINI_API_KEY =
  import.meta.env?.VITE_GEMINI_API_KEY ||
  import.meta.env?.VITE_FIREBASE_API_KEY ||
  'AIzaSyB9EuogsWeMNyBRFAQi_6rIa4D1rL_Z56Y';

// Google AI Studio endpoint (no Cloud Run / IAM needed, works from browser)
const GEMINI_IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_API_KEY}`;

// Vertex AI endpoint as secondary direct-call option
const VERTEX_PROJECT_ID = import.meta.env?.VITE_VERTEX_PROJECT_ID || 'aura-ai-powered-fashion-aura';
const VERTEX_IMAGE_URL = `https://firebasevertexai.googleapis.com/v1beta/projects/${VERTEX_PROJECT_ID}/locations/us-central1/publishers/google/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`;

export const TRYON_TARGET_MS = 4000;
export const DAILY_TRYON_LIMIT = 100;
export const TRYON_BLOCK_DURATION_MS = 12 * 3600 * 1000; // 12 hours

let _quotaBlockedUntil = 0;
let _directCallsBlocked = false;

async function checkQuotaCooldown() {
  const wait = _quotaBlockedUntil - Date.now();
  if (wait > 0) {
    console.log(`[AI] Quota cooldown — waiting ${Math.round(wait / 1000)}s...`);
    await new Promise(r => setTimeout(r, wait));
  }
}

function withTimeout(promise, ms, label = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function extractGarmentFromUrl(productUrl) {
  return productUrl;
}

/** Optimized client-side base64 generator for Web */
export async function getCleanBase64(input, width = 512, height = 640, mode = 'fit', quality = 0.80) {
  try {
    if (!input) return '';
    let url = typeof input === 'string' ? input : (input?.uri || '');

    // Check LocalStorage cache first
    const cacheKey = `b64_${url}`;
    if (!url.startsWith('data:')) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (e) { }
    }

    if (url.startsWith('/')) {
      url = window.location.origin + url;
    }

    // Helper to cache base64 securely
    const saveToCache = (b64Data) => {
      if (!b64Data || url.startsWith('data:')) return;
      try {
        localStorage.setItem(cacheKey, b64Data);
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
          console.log('[AI Cache] Quota exceeded. Cleaning up old cache entries...');
          try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (key && key.startsWith('b64_')) {
                localStorage.removeItem(key);
              }
            }
            localStorage.setItem(cacheKey, b64Data);
          } catch (retryErr) {
            console.warn('[AI Cache] Failed to clear and save base64 to cache:', retryErr);
          }
        }
      }
    };

    // Helper to resize image using canvas with a 6-second timeout safeguard
    const resizeImage = (imgSrc, isCrossOrigin = false) => {
      return new Promise((resolve) => {
        const img = new Image();
        const timeout = setTimeout(() => {
          console.warn('[AI Canvas] resizeImage timed out for:', imgSrc.slice(0, 100));
          img.src = '';
          resolve('');
        }, 6000);

        if (isCrossOrigin) {
          img.crossOrigin = 'Anonymous';
        }
        img.onload = () => {
          clearTimeout(timeout);
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // Clear with white background (standard for JPEGs)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);

            const imgWidth = img.width || width;
            const imgHeight = img.height || height;

            if (mode === 'fit') {
              const scale = Math.min(width / imgWidth, height / imgHeight);
              const x = (width - imgWidth * scale) / 2;
              const y = (height - imgHeight * scale) / 2;
              ctx.drawImage(img, x, y, imgWidth * scale, imgHeight * scale);
            } else {
              ctx.drawImage(img, 0, 0, width, height);
            }

            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            const base64 = dataUrl.split('base64,')[1] || '';
            resolve(base64);
          } catch (canvasErr) {
            console.error('[AI Canvas] canvas draw failed:', canvasErr.message);
            resolve('');
          }
        };
        img.onerror = () => {
          clearTimeout(timeout);
          resolve('');
        };
        img.src = imgSrc;
      });
    };

    // 1. If it's already a data URI, resize it directly using image canvas
    if (url.startsWith('data:image')) {
      const resizedBase64 = await resizeImage(url, false);
      if (resizedBase64) return resizedBase64;
      // Fallback if resizing failed for some reason
      const parts = url.split('base64,');
      return parts[1] || parts[0];
    }

    // 1.5 If it is a Firebase Storage URL, bypass CORS by downloading through the Storage SDK
    if (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com')) {
      try {
        const decodedUrl = decodeURIComponent(url);
        const match = decodedUrl.match(/\/o\/([^?#]+)/);
        if (match && match[1]) {
          const storagePath = match[1];
          const storageRef = ref(storage, storagePath);
          const blob = await getBlob(storageRef);
          const blobUrl = URL.createObjectURL(blob);
          const base64 = await resizeImage(blobUrl, false);
          URL.revokeObjectURL(blobUrl);
          if (base64) {
            saveToCache(base64);
            return base64;
          }
        }
      } catch (storageErr) {
        console.warn('[AI] Firebase Storage SDK download failed, falling back to direct fetch:', storageErr.message);
      }
    }

    // 2. Fetch the image to bypass CORS and avoid tainted canvas
    try {
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const base64 = await resizeImage(blobUrl, false);
        URL.revokeObjectURL(blobUrl);
        if (base64) {
          saveToCache(base64);
          return base64;
        }
      }
    } catch (fetchErr) {
      console.warn('[AI] Fetch failed for image URL, using crossOrigin fallback:', url, fetchErr.message);
    }

    // 3. Fallback: load directly using Image with crossOrigin (may fail if CORS is not configured)
    const fallbackBase64 = await resizeImage(url, true);
    if (fallbackBase64) {
      saveToCache(fallbackBase64);
      return fallbackBase64;
    }

    return '';
  } catch (e) {
    console.error('[AI] getCleanBase64 error:', e);
    return '';
  }
}

async function isValidTryOnResult(resultUrl, garmentUrl, humanB64, humanInput, garmentB64 = null) {
  if (!resultUrl) return false;
  if (resultUrl === garmentUrl) return false;
  if (humanInput && resultUrl === humanInput) {
    console.warn('[AI] ⚠ Result is identical to input human photo URL — treating as failed generation');
    return false;
  }
  // Data URI too short = probably empty or corrupted
  if (resultUrl.startsWith('data:') && resultUrl.length < 8000) return false;

  // Self-heal: resolve garment base64
  let resolvedGarmentB64 = garmentB64;
  if (!resolvedGarmentB64 && garmentUrl && garmentUrl.length > 1000 && !garmentUrl.startsWith('http') && !garmentUrl.startsWith('/') && !garmentUrl.startsWith('data:')) {
    resolvedGarmentB64 = garmentUrl;
  } else if (!resolvedGarmentB64 && garmentUrl && garmentUrl.startsWith('data:')) {
    resolvedGarmentB64 = garmentUrl.split('base64,')[1] || '';
  }

  // 🔥 Visual similarity comparison using browser Canvas API (detects identical/unmodified outputs)
  if (resultUrl && (humanB64 || (humanInput && humanInput.startsWith('data:')))) {
    try {
      const srcHuman = humanB64 ? `data:image/jpeg;base64,${humanB64}` : humanInput;
      const srcResult = resultUrl;

      // 1. Compare against Human Base Photo
      const distHuman = await new Promise((resolve) => {
        const img1 = new Image();
        const img2 = new Image();
        let loaded = 0;

        const checkDist = () => {
          try {
            const canvas1 = document.createElement('canvas');
            const canvas2 = document.createElement('canvas');
            canvas1.width = 16;
            canvas1.height = 16;
            canvas2.width = 16;
            canvas2.height = 16;

            const ctx1 = canvas1.getContext('2d');
            const ctx2 = canvas2.getContext('2d');

            ctx1.drawImage(img1, 0, 0, 16, 16);
            ctx2.drawImage(img2, 0, 0, 16, 16);

            const data1 = ctx1.getImageData(0, 0, 16, 16).data;
            const data2 = ctx2.getImageData(0, 0, 16, 16).data;

            let totalDist = 0;
            for (let i = 0; i < data1.length; i += 4) {
              const dR = data1[i] - data2[i];
              const dG = data1[i+1] - data2[i+1];
              const dB = data1[i+2] - data2[i+2];
              totalDist += Math.sqrt(dR*dR + dG*dG + dB*dB);
            }

            const avg = totalDist / (data1.length / 4);
            resolve(avg);
          } catch (err) {
            console.warn('[AI Validation] Canvas comparison failed (possibly tainted canvas):', err.message);
            resolve(999);
          }
        };

        img1.crossOrigin = 'anonymous';
        img2.crossOrigin = 'anonymous';

        img1.onload = () => { loaded++; if (loaded === 2) checkDist(); };
        img2.onload = () => { loaded++; if (loaded === 2) checkDist(); };
        img1.onerror = () => resolve(999);
        img2.onerror = () => resolve(999);

        img1.src = srcHuman;
        img2.src = srcResult;
      });

      console.log(`[AI Validation] Client visual RGB distance from Human: ${distHuman.toFixed(2)}`);
      if (distHuman < 12.0) {
        console.warn(`[AI Validation] ❌ Rejected visually (distance from Human: ${distHuman.toFixed(2)}) — unmodified photo returned.`);
        return false;
      }

      // 2. Compare against Garment Catalog Photo
      if (resolvedGarmentB64 && resolvedGarmentB64.length > 1000) {
        const srcGarment = `data:image/jpeg;base64,${resolvedGarmentB64}`;
        const distGarment = await new Promise((resolve) => {
          const img1 = new Image();
          const img2 = new Image();
          let loaded = 0;

          const checkDist = () => {
            try {
              const canvas1 = document.createElement('canvas');
              const canvas2 = document.createElement('canvas');
              canvas1.width = 16;
              canvas1.height = 16;
              canvas2.width = 16;
              canvas2.height = 16;

              const ctx1 = canvas1.getContext('2d');
              const ctx2 = canvas2.getContext('2d');

              ctx1.drawImage(img1, 0, 0, 16, 16);
              ctx2.drawImage(img2, 0, 0, 16, 16);

              const data1 = ctx1.getImageData(0, 0, 16, 16).data;
              const data2 = ctx2.getImageData(0, 0, 16, 16).data;

              let totalDist = 0;
              for (let i = 0; i < data1.length; i += 4) {
                const dR = data1[i] - data2[i];
                const dG = data1[i+1] - data2[i+1];
                const dB = data1[i+2] - data2[i+2];
                totalDist += Math.sqrt(dR*dR + dG*dG + dB*dB);
              }

              const avg = totalDist / (data1.length / 4);
              resolve(avg);
            } catch (err) {
              console.warn('[AI Validation] Garment canvas comparison failed:', err.message);
              resolve(999);
            }
          };

          img1.crossOrigin = 'anonymous';
          img2.crossOrigin = 'anonymous';

          img1.onload = () => { loaded++; if (loaded === 2) checkDist(); };
          img2.onload = () => { loaded++; if (loaded === 2) checkDist(); };
          img1.onerror = () => resolve(999);
          img2.onerror = () => resolve(999);

          img1.src = srcGarment;
          img2.src = srcResult;
        });

        console.log(`[AI Validation] Client visual RGB distance from Garment: ${distGarment.toFixed(2)}`);
        if (distGarment < 12.0) {
          console.warn(`[AI Validation] ❌ Rejected visually (distance from Garment: ${distGarment.toFixed(2)}) — unmodified garment photo returned.`);
          return false;
        }
      }

    } catch (e) {
      console.warn('[AI Validation] Visual similarity check error:', e.message);
    }
  }

  // Fallback: binary check
  if (resultUrl.startsWith('data:') && humanB64 && humanB64.length > 5000) {
    const resultB64 = resultUrl.split('base64,')[1] || '';
    const lenDiff = Math.abs(resultB64.length - humanB64.length);
    const threshold = humanB64.length * 0.08; // 8% tolerance — reject near-identical outputs
    if (lenDiff < threshold && resultB64.slice(0, 200) === humanB64.slice(0, 200)) {
      console.warn('[AI] ⚠ Result appears identical to input photo — treating as failed generation');
      return false;
    }
  }
  return true;
}

/**
 * buildTryOnRequest — shared request body for all Gemini image generation calls
 */
function buildTryOnRequest(humanB64, garmentB64, desc, category) {
  const isLowerBody = category === 'lower_body';
  const isDress = category === 'dress' || category === 'dresses';

  // Which body region gets replaced
  const region = isLowerBody ? 'lower body (below waist)'
    : isDress ? 'entire body (top + bottom)'
      : 'upper body (torso and arms)';

  // What must NOT be visible from original outfit
  const stripList = isLowerBody
    ? 'pants, trousers, palazzos, skirt, leggings, or any bottom garment'
    : isDress
      ? 'any clothing at all — kurti, top, saree, dupatta, lehenga, palazzos, jeans — everything'
      : 'kurti, kurta, top, shirt, blouse, saree blouse, jacket, dupatta, or any upper-body garment';

  // Concise output-state description
  const outputState = isLowerBody
    ? `The person is wearing their original top, but their bottom garment has been completely replaced by the item from Image 2.`
    : isDress
      ? `The person is wearing ONLY the dress from Image 2. No other clothing is visible.`
      : `The person is wearing ONLY the garment from Image 2 on their upper body. Their lower half is unchanged from Image 1.`;

  const prompt = `You are a virtual try-on AI. Your task is to generate a photorealistic image of the PERSON from Image 1 wearing the GARMENT from Image 2.

STEP-BY-STEP INSTRUCTIONS:
1. Look at Image 1: this is the PERSON. Memorize their face, hair, skin tone, body shape, pose, and background. DO NOT change anything about them except their clothing.
2. Look at Image 2: this is ONLY the GARMENT to be worn. Ignore any model or person shown in Image 2 — use ONLY the garment itself.
3. Remove the person's existing ${stripList} completely from the ${region}. The original clothing must be 100% removed and erased.
4. NO BLENDING/LAYERING: Do NOT merge, blend, overlay, or layer the garment from Image 2 over the original clothing. The original clothing must be completely gone, not showing underneath or around the new garment.
5. Dress the person from Image 1 in the exact garment from Image 2: same color, same print, same fabric texture, same design details.
6. ${outputState}
7. Ensure natural fit, correct drape, realistic lighting and shadows matching Image 1's lighting.
8. Output ONLY the single person from Image 1 wearing the new garment. Same pose, same background, same face — only the ${region} clothing changes.

Garment name: ${desc || 'item shown in Image 2'}

CRITICAL: The output MUST visually look different from Image 1. The ${region} clothing MUST be replaced. If you cannot do the swap, still output the person with a clearly different garment.
Output: one photorealistic portrait image, high quality, no text, no borders.`;

  return {
    contents: [{
      role: 'user',
      parts: [
        { text: 'Image 1 — PERSON (preserve everything except clothing):' },
        { inlineData: { mimeType: 'image/jpeg', data: humanB64 } },
        { text: 'Image 2 — GARMENT ONLY (use only the garment, ignore any model in this image):' },
        { inlineData: { mimeType: 'image/jpeg', data: garmentB64 } },
        { text: prompt },
      ],
    }],
    generationConfig: {
      candidateCount: 1,
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.1,
    },
  };
}


/** Parse a Gemini generateContent response and extract the image data URI */
function extractImageFromResponse(data, source) {
  const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (imagePart?.inlineData?.data) {
    console.log(`[AI] ✅ Image received from ${source}`);
    return `data:${imagePart.inlineData.mimeType || 'image/jpeg'};base64,${imagePart.inlineData.data}`;
  }

  const textPart = data.candidates?.[0]?.content?.parts?.find(p => p.text);
  if (textPart?.text) {
    throw new Error(`${source} returned text instead of image: "${textPart.text.slice(0, 120)}"`);
  }

  const finishReason = data.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== 'STOP') {
    throw new Error(`${source} generation blocked: ${finishReason}`);
  }

  throw new Error(`${source} returned no image.`);
}

/**
 * runGeminiStudioDirect — calls Google AI Studio directly from the browser.
 * Model: gemini-2.0-flash-preview-image-generation (confirmed image output support)
 */
async function runGeminiStudioDirect(humanB64, garmentB64, desc, category) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');

  const requestBody = buildTryOnRequest(humanB64, garmentB64, desc, category);
  console.log('[AI] → Calling Google AI Studio (gemini-2.0-flash-preview-image-generation)…');

  const res = await fetch(GEMINI_IMAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (res.status === 429) {
    const err = new Error('Google AI Studio rate limit reached. Try again in a minute.');
    err.isRateLimit = true;
    throw err;
  }

  const responseText = await res.text();
  let data;
  try { data = JSON.parse(responseText); } catch {
    throw new Error(`Google AI Studio response not valid JSON: ${responseText.slice(0, 300)}`);
  }

  if (!res.ok) {
    const errMsg = data?.error?.message || `HTTP ${res.status}`;
    console.error('[AI] Google AI Studio error response:', JSON.stringify(data?.error || data).slice(0, 400));
    throw new Error(`Google AI Studio: ${errMsg}`);
  }

  return extractImageFromResponse(data, 'Google AI Studio');
}

/**
 * runVertexDirect — calls Firebase Vertex AI directly from the browser (secondary).
 */
async function runVertexDirect(humanB64, garmentB64, desc, category) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');

  const requestBody = buildTryOnRequest(humanB64, garmentB64, desc, category);
  console.log('[AI] → Calling Vertex AI (gemini-2.0-flash-preview-image-generation)…');

  const res = await fetch(VERTEX_IMAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (res.status === 429) {
    const err = new Error('Vertex AI rate limit reached.');
    err.isRateLimit = true;
    throw err;
  }

  const responseText = await res.text();
  let data;
  try { data = JSON.parse(responseText); } catch {
    throw new Error(`Vertex AI response not valid JSON: ${responseText.slice(0, 300)}`);
  }

  if (!res.ok) {
    const errMsg = data?.error?.message || `HTTP ${res.status}`;
    console.error('[AI] Vertex AI error response:', JSON.stringify(data?.error || data).slice(0, 400));
    throw new Error(`Vertex AI: ${errMsg}`);
  }

  return extractImageFromResponse(data, 'Vertex AI');
}

function formatRemainingTime(ms) {
  const totalMinutes = Math.ceil(ms / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins.toString().padStart(2, '0')}m`;
}

export async function runVirtualTryOn(humanInput, garmentUrl, desc, onStatus, forceGemini = false, category = 'upper_body', options = {}) {
  const user = firebaseAuth?.currentUser;

  if (user && firestore) {
    const profileRef = doc(firestore, 'profiles', user.uid);
    try {
      const snap = await getDoc(profileRef);
      if (snap.exists()) {
        const data = snap.data();
        const now = Date.now();
        const lastReset = data.tryOnLastResetTime || 0;
        const isNewDay = new Date(lastReset).toDateString() !== new Date().toDateString();

        if (isNewDay) {
          await updateDoc(profileRef, {
            tryOnCountToday: 0,
            tryOnLastResetTime: now,
            tryOnBlockedUntil: null
          }).catch(() => { });
          data.tryOnCountToday = 0;
          data.tryOnBlockedUntil = null;
        }

        if (data.tryOnBlockedUntil && now < data.tryOnBlockedUntil) {
          const currentCount = data.tryOnCountToday || 0;
          if (currentCount < DAILY_TRYON_LIMIT) {
            await updateDoc(profileRef, { tryOnBlockedUntil: null }).catch(() => { });
          } else {
            const remainingMs = data.tryOnBlockedUntil - now;
            const timeStr = formatRemainingTime(remainingMs);
            const err = new Error(`Limit reached. Please wait ${timeStr} before trying on more outfits.`);
            err.isLimitBlock = true;
            err.blockedUntil = data.tryOnBlockedUntil;
            throw err;
          }
        }
      }
    } catch (e) {
      if (e.isLimitBlock) throw e;
    }
  }

  const result = await checkQuotaCooldown().then(() =>
    _runVirtualTryOnImpl(humanInput, garmentUrl, desc, onStatus, forceGemini, category)
  );

  if (result && result !== garmentUrl && user && firestore) {
    // Fire-and-forget: upload to Storage + save to Firestore in background
    // Do NOT await — return result URL immediately for fastest UX
    (async () => {
      try {
        let finalTryOnUrl = result;
        if (result.startsWith('data:')) {
          const path = 'tryon-results';
          const fileName = `${user.uid}_${Date.now()}.jpg`;
          const cleanB64 = result.split('base64,')[1] || result;
          const storageRef = ref(storage, `${path}/${fileName}`);
          await uploadString(storageRef, cleanB64, 'base64', { contentType: 'image/jpeg' });
          finalTryOnUrl = await getDownloadURL(storageRef);
          console.log('[AI] ✅ Uploaded generated try-on to Storage (background):', finalTryOnUrl);
        }

        let finalGarmentUrl = garmentUrl;
        if (garmentUrl.startsWith('data:')) {
          const path = 'tryon-results';
          const fileName = `${user.uid}_garment_${Date.now()}.jpg`;
          const cleanB64 = garmentUrl.split('base64,')[1] || garmentUrl;
          const storageRef = ref(storage, `${path}/${fileName}`);
          await uploadString(storageRef, cleanB64, 'base64', { contentType: 'image/jpeg' });
          finalGarmentUrl = await getDownloadURL(storageRef);
        }

        await addDoc(collection(firestore, 'tryon_results'), {
          userId: user.uid,
          title: desc || 'AI Outfit',
          imageUrl: finalGarmentUrl,
          tryOnImageUrl: finalTryOnUrl,
          resultImageUrl: finalTryOnUrl,
          category: category || 'upper_body',
          createdAt: serverTimestamp(),
        });
        console.log('[AI] ✅ Saved try-on result to Firestore (background)');
      } catch (dbErr) {
        console.error('[AI] Background save failed:', dbErr);
      }
    })();
  }

  if (user && firestore) {
    const profileRef = doc(firestore, 'profiles', user.uid);
    try {
      const snap = await getDoc(profileRef);
      if (snap.exists()) {
        const data = snap.data();
        const now = Date.now();
        let tryOnCountToday = (data.tryOnCountToday || 0) + 1;
        let updates = {
          tryOnCountToday: tryOnCountToday,
          tryOnLastResetTime: data.tryOnLastResetTime || now
        };
        if (tryOnCountToday >= DAILY_TRYON_LIMIT) {
          updates.tryOnBlockedUntil = now + TRYON_BLOCK_DURATION_MS;
        }
        await updateDoc(profileRef, updates).catch(() => { });
      }
    } catch (e) { }
  }

  return result;
}

async function _runVirtualTryOnImpl(humanInput, garmentUrl, desc, onStatus, forceGemini = false, category = 'upper_body') {
  onStatus?.('Preparing…');

  // Never use a default/placeholder model — we need the real user photo
  let actualHumanInput = humanInput;
  let garmentHttpUrl = garmentUrl;

  if (typeof actualHumanInput === 'string' && actualHumanInput.startsWith('/')) {
    actualHumanInput = window.location.origin + actualHumanInput;
  }
  if (typeof garmentHttpUrl === 'string' && garmentHttpUrl.startsWith('/')) {
    garmentHttpUrl = window.location.origin + garmentHttpUrl;
  }

  if (!actualHumanInput) {
    console.error('[AI] ❌ No user photo provided — cannot generate try-on');
    return null; // Return null so caller knows it genuinely failed (not fallback)
  }

  const [humanB64, garmentB64] = await Promise.all([
    // Reduced to 384x512 (exact 3:4) to reduce pixel count by 40% for sub-5s generation speed
    getCleanBase64(actualHumanInput, 384, 512, 'fit', 0.80),
    // Garment matches 384x512 for faster upload and processing
    getCleanBase64(garmentHttpUrl, 384, 512, 'fit', 0.80),
  ]);

  console.log(`[AI] Base64 — human: ${humanB64?.length || 0} chars, garment: ${garmentB64?.length || 0} chars`);

  const humanB64Valid = humanB64 && humanB64.length > 5000;
  const garmentB64Valid = garmentB64 && garmentB64.length > 1000;

  if (!humanB64Valid) {
    console.warn(`[AI] ⚠ Human photo base64 too small (${humanB64?.length || 0} chars) — CORS block or missing photo.`);
  }

  onStatus?.('Generating your look…');

  const runGen = async (retryHighTemp = false) => {
    // ── PRIMARY: Google AI Studio direct browser call
    if (humanB64Valid && garmentB64Valid && !_directCallsBlocked) {
      try {
        const reqBody = buildTryOnRequest(humanB64, garmentB64, desc, category);
        // On retry, slightly increase temperature for more creative replacement
        if (retryHighTemp) reqBody.generationConfig.temperature = 0.3;
        const res = await fetch(GEMINI_IMAGE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
        });
        if (res.status === 429) { const e = new Error('Rate limit'); e.isRateLimit = true; throw e; }

        const responseText = await res.text();
        let data;
        try { data = JSON.parse(responseText); } catch { throw new Error('Invalid JSON response'); }
        if (!res.ok) {
          const errMsg = data?.error?.message || `HTTP ${res.status}`;
          // 403 Forbidden or 400 indicates API restrictions or invalid keys — block future direct calls
          if (res.status === 403 || res.status === 400) {
            console.warn('[AI] Direct API key restricted. Blocking direct calls for this session.');
            _directCallsBlocked = true;
          }
          throw new Error(errMsg);
        }

        const dataUri = extractImageFromResponse(data, 'Google AI Studio');
        if (dataUri) return dataUri;
      } catch (studioErr) {
        if (studioErr.isRateLimit) throw studioErr;
        console.warn('[AI] Google AI Studio direct failed:', studioErr.message);
        if (studioErr.message.includes('Failed to fetch') || studioErr.message.includes('NetworkError')) {
          _directCallsBlocked = true;
        }
      }

      // ── SECONDARY: Vertex AI direct browser call
      if (!_directCallsBlocked) {
        try {
          const dataUri = await runVertexDirect(humanB64, garmentB64, desc, category);
          if (dataUri) return dataUri;
        } catch (vertexErr) {
          if (vertexErr.isRateLimit) throw vertexErr;
          console.warn('[AI] Vertex AI direct failed:', vertexErr.message);
          if (vertexErr.message.includes('Forbidden') || vertexErr.message.includes('403') || vertexErr.message.includes('Failed to fetch')) {
            _directCallsBlocked = true;
          }
        }
      }
    } else {
      console.log('[AI] Skipping direct calls (CORS blocked or direct calls disabled). Routing to Cloud Function...');
    }

    // ── FALLBACK: Firebase Cloud Function (server-side, no CORS issues)
    if (firebaseFunctions) {
      console.log('[AI] → Calling Cloud Function generateTryOn…');
      try {
        const generateTryOn = httpsCallable(firebaseFunctions, 'generateTryOn');
        const response = await generateTryOn({
          humanB64: humanB64Valid ? humanB64 : undefined,
          garmentB64: garmentB64Valid ? garmentB64 : undefined,
          humanUrl: actualHumanInput,
          garmentUrl: garmentHttpUrl,
          desc,
          category,
          forceGemini,
        });
        if (response?.data?.tryOnImageUrl) return response.data.tryOnImageUrl;
        console.warn('[AI] Cloud Function returned no tryOnImageUrl');
      } catch (cfErr) {
        console.error('[AI] Cloud Function failed:', cfErr.message);
      }
    }

    // All paths failed — return null (not garmentUrl) so UI can show real error state
    return null;
  };

  try {
    const result = await withTimeout(runGen(false), 35000, 'Try-on');
    if (await isValidTryOnResult(result, garmentHttpUrl, humanB64, actualHumanInput, garmentB64)) {
      return result;
    }
    // Result invalid — return null without retrying to avoid doubling wait time
    console.warn('[AI] Attempt produced invalid result — returning null (no retry for speed)');
    return null;
  } catch (e) {
    console.error('[AI Pipeline Error]:', e.message);
    return null;
  }
}
