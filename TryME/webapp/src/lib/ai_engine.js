/**
 * ai_engine.js — TrialX AI Engine (v32.0 for Web)
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

    // Helper to resize image using canvas
    const resizeImage = (imgSrc, isCrossOrigin = false) => {
      return new Promise((resolve) => {
        const img = new Image();
        if (isCrossOrigin) {
          img.crossOrigin = 'Anonymous';
        }
        img.onload = () => {
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
        };
        img.onerror = () => {
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

/** Reject results that are just the garment flat-lay or an unchanged base photo (generation failed silently) */
function isValidTryOnResult(resultUrl, garmentUrl, humanB64) {
  if (!resultUrl) return false;
  if (resultUrl === garmentUrl) return false;
  // Data URI too short = probably empty or corrupted
  if (resultUrl.startsWith('data:') && resultUrl.length < 8000) return false;
  // Detect if model returned the original base photo unchanged:
  // If result is a data URI and it is very close in size to the human base64, 
  // AND the garment is clearly different in design, it's likely unchanged.
  if (resultUrl.startsWith('data:') && humanB64 && humanB64.length > 5000) {
    const resultB64 = resultUrl.split('base64,')[1] || '';
    // If the result data is within 2% of the human input length and starts similarly, it's unchanged
    const lenDiff = Math.abs(resultB64.length - humanB64.length);
    const threshold = humanB64.length * 0.03;
    if (lenDiff < threshold && resultB64.slice(0, 100) === humanB64.slice(0, 100)) {
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

  const prompt = `VIRTUAL TRY-ON — OUTPUT STATE SPECIFICATION

The final image you generate must look EXACTLY like this:
• The person from Image 1 (identical face, hair, skin tone, pose, background, lighting)
• Their ${region} clothing has been fully replaced by the garment in Image 2
• ${outputState}

WHAT THE FINAL IMAGE MUST SHOW (✓ = required):
✓ Face, hair, eyes, expression: pixel-perfect match to Image 1 — DO NOT alter
✓ Body pose and hand positions: identical to Image 1
✓ Background and lighting: identical to Image 1
✓ The COMPLETE garment from Image 2 — every colour, print, button, embroidery detail — fitted naturally on the body
✓ Full garment visible from shoulder/waist to hem — not cropped
✓ Bare arms and skin: If the garment in Image 2 is sleeveless, short-sleeved, off-shoulder, or strapless, you MUST completely erase the original long sleeves from the arms and render natural, clean bare skin (arms/shoulders/collarbones).

WHAT MUST NOT APPEAR IN THE OUTPUT (✗ = forbidden):
✗ Any ${stripList} from the original Image 1 — not even partially, not peeking out, not visible underneath
✗ Original sleeves: Any long sleeves, prints, or fabric from the original Image 1 clothing on the arms must be completely removed.
✗ Old clothing hem/skirt: If the person in Image 1 is wearing a long top, kurti, kurta, tunic, or dress, you must completely remove and erase its bottom half/skirt. Keep their original pants/jeans visible without any old clothing layering over them.
✗ Two garments layered on top of each other
✗ The new garment placed OVER existing clothing — remove original first
✗ Any change to the person's face or body

Garment: ${desc || 'the item shown in Image 2'}`;

  return {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { text: '— IMAGE 1: THE PERSON — (replicate this person exactly, only change their clothing)' },
        { inlineData: { mimeType: 'image/jpeg', data: humanB64 } },
        { text: '— IMAGE 2: THE NEW GARMENT — (this exact item replaces the clothing in the region described above)' },
        { inlineData: { mimeType: 'image/jpeg', data: garmentB64 } },
      ],
    }],
    generationConfig: {
      candidateCount: 1,
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.05,
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
    try {
      let finalTryOnUrl = result;
      // If the result is a raw base64 data URI, upload it to Firebase Storage!
      if (result.startsWith('data:')) {
        const path = 'tryon-results';
        const fileName = `${user.uid}_${Date.now()}.jpg`;
        const cleanB64 = result.split('base64,')[1] || result;
        const storageRef = ref(storage, `${path}/${fileName}`);
        await uploadString(storageRef, cleanB64, 'base64', { contentType: 'image/jpeg' });
        finalTryOnUrl = await getDownloadURL(storageRef);
        console.log('[AI] ✅ Uploaded generated try-on to Storage:', finalTryOnUrl);
      }

      let finalGarmentUrl = garmentUrl;
      // If the garment image is a raw base64 data URI, upload it to Firebase Storage as well!
      if (garmentUrl.startsWith('data:')) {
        const path = 'tryon-results';
        const fileName = `${user.uid}_garment_${Date.now()}.jpg`;
        const cleanB64 = garmentUrl.split('base64,')[1] || garmentUrl;
        const storageRef = ref(storage, `${path}/${fileName}`);
        await uploadString(storageRef, cleanB64, 'base64', { contentType: 'image/jpeg' });
        finalGarmentUrl = await getDownloadURL(storageRef);
        console.log('[AI] ✅ Uploaded custom garment to Storage:', finalGarmentUrl);
      }

      await addDoc(collection(firestore, 'tryon_results'), {
        userId: user.uid,
        title: desc || 'AI Outfit',
        imageUrl: finalGarmentUrl,
        tryOnImageUrl: finalTryOnUrl,
        resultImageUrl: finalTryOnUrl,  // profile grid reads resultImageUrl || tryOnImageUrl
        category: category || 'upper_body',
        createdAt: serverTimestamp(),
      });
      console.log('[AI] ✅ Saved try-on result to Firestore tryon_results');
    } catch (dbErr) {
      console.error('[AI] Failed to write tryon result to Firestore:', dbErr);
    }
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
    // Higher resolution for person photo → model sees face/body details clearly → less hallucination
    getCleanBase64(actualHumanInput, 768, 960, 'fit', 0.85),
    // Garment stays at 512x640 (flat-lay product shots don't need more)
    getCleanBase64(garmentHttpUrl, 512, 640, 'fit', 0.80),
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
    const result = await withTimeout(runGen(false), 90000, 'Try-on');
    if (isValidTryOnResult(result, garmentHttpUrl, humanB64)) {
      return result;
    }
    // First attempt produced unchanged/invalid result — retry once with higher temperature
    console.warn('[AI] First attempt invalid — retrying with temperature 0.3…');
    const retry = await withTimeout(runGen(true), 60000, 'Try-on retry');
    if (isValidTryOnResult(retry, garmentHttpUrl, humanB64)) {
      return retry;
    }
    console.warn('[AI] Both attempts invalid — returning null');
    return null;
  } catch (e) {
    console.error('[AI Pipeline Error]:', e.message);
    return null;
  }
}
