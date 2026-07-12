/**
 * ai_engine.js — oraneo Engine (v33.0 for Web)
 *
 * PRIMARY:  Firebase Cloud Function generateTryOn (server-side Vertex AI)
 *           Model: gemini-2.0-flash-exp (confirmed Vertex AI image generation model)
 *           Direct browser calls are blocked (403 API key restriction).
 *
 * RETRY:    Up to 2 retries on Cloud Function with exponential backoff (5s → 10s)
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

// Google AI Studio endpoint — kept for reference but blocked by API key restrictions
const GEMINI_IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_API_KEY}`;

// Vertex AI endpoint — gemini-2.5-flash-image confirmed available in Vertex AI Model Garden
const VERTEX_PROJECT_ID = import.meta.env?.VITE_VERTEX_PROJECT_ID || 'aura-ai-powered-fashion-aura';
const VERTEX_IMAGE_URL = `https://firebasevertexai.googleapis.com/v1beta/projects/${VERTEX_PROJECT_ID}/locations/us-central1/publishers/google/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`;

export const TRYON_TARGET_MS = 4000;
export const DAILY_TRYON_LIMIT = 100;
export const TRYON_BLOCK_DURATION_MS = 12 * 3600 * 1000; // 12 hours

let _quotaBlockedUntil = 0;
// Direct browser API calls are blocked — the API key has referrer restrictions causing 403.
// Route all traffic through the Cloud Function which uses server-side Vertex AI credentials.
const _directCallsBlocked = true;

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
              const dG = data1[i + 1] - data2[i + 1];
              const dB = data1[i + 2] - data2[i + 2];
              totalDist += Math.sqrt(dR * dR + dG * dG + dB * dB);
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
                const dG = data1[i + 1] - data2[i + 1];
                const dB = data1[i + 2] - data2[i + 2];
                totalDist += Math.sqrt(dR * dR + dG * dG + dB * dB);
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

  const stripList = isLowerBody
    ? 'pants, trousers, palazzos, skirt, leggings, or any bottom garment'
    : isDress
      ? 'any clothing at all — kurti, top, saree, dupatta, lehenga, palazzos, jeans — everything'
      : 'kurti, kurta, top, shirt, blouse, saree blouse, jacket, dupatta, or any upper-body garment';

  const prompt = `# Virtual Try-On Prompt Template

Edit this photo (Image 1) by replacing the person's current outfit with the garment shown in Image 2: ${desc || 'this item'}.

STRICT PRESERVATION (do not change):
- Keep the exact same face, facial features, expression, and skin tone.
- Keep the exact same body type, body proportions, height, and build — do not slim, bulk up, elongate, or reshape the body in any way.
- Keep the exact same pose, stance, and camera angle.
- Keep the exact same hairstyle and hair color.
- Keep the exact same background, lighting direction, and shadow pattern.
- Keep any visible skin (arms, neck, midriff, legs) at the same tone and texture as the original photo — do not smooth, retouch, or airbrush the skin.
- Keep accessories not related to the outfit change (glasses, watch, footwear) unless the new outfit logically requires a change.

GARMENT CHANGE (what to change):
- Remove the current clothing entirely: the person's original ${stripList} in Image 1 must be 100% REMOVED and ERASED before drawing the new garment. Do NOT layer or overlay.
- Replace it with the exact garment from Image 2: match its color, pattern, fabric texture, and fit perfectly.
- Drape the new garment naturally over the person's actual body shape — follow real fabric physics: creases, folds, and stretch should match how this specific fabric would sit on this specific body and pose.
- Match the garment's shadows and highlights to the existing light source in the photo so it looks like it was photographed in the same room.
- Render any newly exposed or newly covered skin/limbs realistically and consistently with the rest of the body's tone and lighting.

CONTEXT / MOOD:
- The result should look like a real photo taken in a fitting-room mirror — natural, unedited, candid.
- Do not add makeup, jewelry, or styling that wasn't in the original.
- Resolution and photo quality should match the original image.

OUTPUT: A single photorealistic image, same aspect ratio and framing as Image 1.`;

  return {
    contents: [{
      role: 'user',
      parts: [
        { text: 'IMAGE 1 (The Person to Edit):' },
        { inlineData: { mimeType: 'image/jpeg', data: humanB64 } },
        { text: 'IMAGE 2 (The Garment to Apply):' },
        { inlineData: { mimeType: 'image/jpeg', data: garmentB64 } },
        { text: prompt },
      ],
    }],
    generationConfig: {
      candidateCount: 1,
      responseModalities: ['IMAGE'],
      temperature: 0.35,
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

  const runGen = async () => {
    // Direct browser calls are blocked (403 API key restriction) — go straight to Cloud Function.
    console.log('[AI] Routing to Cloud Function generateTryOn (server-side Vertex AI)...');

    if (!firebaseFunctions) {
      console.error('[AI] Firebase Functions not initialized.');
      return null;
    }

    // ── Cloud Function with exponential backoff retry (handles Vertex AI 429s)
    const CF_MAX_RETRIES = 2;
    const CF_BACKOFF_BASE_MS = 5000; // 5s → 10s

    for (let attempt = 0; attempt <= CF_MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoff = CF_BACKOFF_BASE_MS * attempt;
        console.log(`[AI] Cloud Function retry ${attempt}/${CF_MAX_RETRIES} — waiting ${backoff / 1000}s...`);
        await new Promise(r => setTimeout(r, backoff));
      }

      console.log(`[AI] → Calling Cloud Function generateTryOn (attempt ${attempt + 1})...`);
      try {
        const generateTryOn = httpsCallable(firebaseFunctions, 'generateTryOn', { timeout: 120000 });
        const response = await generateTryOn({
          humanB64: humanB64Valid ? humanB64 : undefined,
          garmentB64: garmentB64Valid ? garmentB64 : undefined,
          humanUrl: actualHumanInput,
          garmentUrl: garmentHttpUrl,
          desc,
          category,
          forceGemini,
        });

        if (response?.data?.tryOnImageUrl) {
          console.log(`[AI] ✅ Cloud Function succeeded on attempt ${attempt + 1}`);
          return response.data.tryOnImageUrl;
        }

        // Cloud Function returned null — server-side Vertex AI was rate-limited
        console.warn(`[AI] Cloud Function returned no image (attempt ${attempt + 1}) — server-side rate limit.`);
        if (attempt === CF_MAX_RETRIES) break;

      } catch (cfErr) {
        const isRetryable =
          cfErr.code === 'functions/resource-exhausted' ||
          cfErr.code === 'functions/unavailable' ||
          cfErr.code === 'functions/deadline-exceeded' ||
          cfErr.message?.includes('rate') ||
          cfErr.message?.includes('429') ||
          cfErr.message?.includes('503');

        console.error(`[AI] Cloud Function failed (attempt ${attempt + 1}): ${cfErr.message}`);
        if (!isRetryable || attempt === CF_MAX_RETRIES) break;
      }
    }

    return null;
  };

  try {
    // 90s covers: first attempt (35s) + retry 1 (5s backoff + 35s) + retry 2 (10s backoff + 35s)
    const result = await withTimeout(runGen(), 90000, 'Try-on');
    if (await isValidTryOnResult(result, garmentHttpUrl, humanB64, actualHumanInput, garmentB64)) {
      return result;
    }
    console.warn('[AI] Result failed validation — returning null.');
    return null;
  } catch (e) {
    console.error('[AI Pipeline Error]:', e.message);
    return null;
  }
}