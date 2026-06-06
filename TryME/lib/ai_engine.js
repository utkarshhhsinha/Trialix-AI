/**
 * ai_engine.js — Multi-Phase AI Orchestrator (v30.0)
 * Primary: Replicate IDM-VTON (if key set) → most accurate virtual try-on
 * Fallback: Gemini 2.5 Flash Image / Nano Banana via paid EXPO_PUBLIC_GEMINI_API_KEY
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { encode } from 'base64-arraybuffer';
import { firebaseFunctions, firestore, firebaseAuth } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const FIREBASE_API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const VERTEX_PROJECT_ID = process.env.EXPO_PUBLIC_VERTEX_PROJECT_ID || 'aura-ai-powered-fashion-aura';

const VERTEX_TEXT_URL = `https://firebasevertexai.googleapis.com/v1beta/projects/${VERTEX_PROJECT_ID}/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent?key=${FIREBASE_API_KEY}`;
export const TRYON_TARGET_MS = 4000; // UX target — fast path + pregen

let _tryOnQueueTail = Promise.resolve();
let _quotaBlockedUntil = 0;

function withTimeout(promise, ms, label = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function enqueueTryOn(fn) {
  const next = _tryOnQueueTail.then(async () => {
    const wait = _quotaBlockedUntil - Date.now();
    if (wait > 0) {
      console.log(`[AI] Quota cooldown — waiting ${Math.round(wait / 1000)}s...`);
      await new Promise(r => setTimeout(r, wait));
    }
    return await fn();
  }, () => fn());
  _tryOnQueueTail = next.catch(() => { });
  return next;
}

const SYSTEM_PROMPTS = {
  FASHION_ANALYSIS: `Extract core fashion concepts from the image. Output strictly as a JSON object: 
  {
    "short_desc": "3-5 word name",
    "vton_prompt": "highly detailed description for AI fitting focusing on fabric texture, pattern, and fit",
    "category": "upper_body/lower_body/dress",
    "fitting_type": "tucked/untucked/cropped",
    "style_notes": "one sentence advice"
  }
  Output ONLY raw JSON. No markdown.`,
};

export async function extractGarmentFromUrl(productUrl) {
  try {
    if (!productUrl || !productUrl.startsWith('http')) return productUrl;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(productUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,xml;q=0.9,image/webp,*/*;q=0.8',
      }
    });

    clearTimeout(timeoutId);

    if (res.headers.get('content-type')?.startsWith('image/')) return productUrl;

    const html = await res.text();
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogMatch && !ogMatch[1].includes('logo')) return ogMatch[1];

    const flipkartMatch = html.match(/https:\/\/rukminim[0-9].flixcart.com\/image\/[^"'\s>]+/i);
    if (flipkartMatch) return flipkartMatch[0];

    const amazonMatch = html.match(/"large":"([^"]+)"/i) || html.match(/"hiRes":"([^"]+)"/i);
    if (amazonMatch) return amazonMatch[1];

    return productUrl;
  } catch (e) {
    console.warn('[AI] Link resolution failed:', e.message);
    return productUrl;
  }
}

/** Resize preserving aspect ratio (best for Gemini) or fixed stretch (IDM-VTON) */
async function getCleanBase64(input, width = 768, height = 1024, mode = 'fit', quality = 0.70) {
  try {
    if (!input) return '';

    let localUri = input;

    if (typeof input === 'number') {
      try {
        const { Asset } = require('expo-asset');
        const asset = Asset.fromModule(input);
        // If the asset URI points to the Metro dev server (localhost/127.0.0.1/192.168.x.x etc),
        // we bypass native downloadAsync because native code fails to resolve/download localhost URLs,
        // resulting in a corrupt/empty file in the cache.
        if (asset.uri && isMetroAssetUrl(asset.uri)) {
          localUri = asset.uri;
        } else {
          if (!asset.localUri) await asset.downloadAsync();
          localUri = asset.localUri || asset.uri || '';
        }
      } catch (err) {
        console.warn('[AI] expo-asset resolution failed, falling back to resolveAssetSource:', err.message);
        const { Image } = require('react-native');
        localUri = Image.resolveAssetSource(input)?.uri || '';
      }
    } else if (typeof input === 'object' && input?.uri) {
      localUri = input.uri;
    }

    if (typeof localUri !== 'string') throw new Error(`Invalid image input: ${typeof localUri}`);

    // Self-healing: if the local cached file path is corrupt, missing, or 0 bytes, fallback to HTTP Metro URL
    if (localUri.startsWith('file://') || localUri.startsWith('content://')) {
      try {
        const info = await FileSystem.getInfoAsync(localUri);
        if (!info.exists || info.size === 0) {
          console.warn(`[AI] Local file is empty or missing: ${localUri}. Falling back to resolveAssetSource HTTP...`);
          if (typeof input === 'number') {
            const { Image } = require('react-native');
            localUri = Image.resolveAssetSource(input)?.uri || '';
          }
        }
      } catch (err) {
        console.warn('[AI] Failed to verify local file info:', err.message);
      }
    }

    const isRawBase64 = localUri.length > 1000 && !localUri.startsWith('http') && !localUri.startsWith('file://') && !localUri.startsWith('content://') && !localUri.startsWith('assets-library://');

    if (localUri.startsWith('data:') || localUri.includes('base64,') || isRawBase64) {
      const b64Part = localUri.includes('base64,') ? localUri.split('base64,')[1] : localUri;
      const tempPath = `${FileSystem.cacheDirectory}temp_b64_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(tempPath, b64Part, { encoding: 'base64' });
      localUri = tempPath;
    } else if (localUri.startsWith('http')) {
      const isDevAsset = isMetroAssetUrl(localUri);

      if (isDevAsset) {
        console.log('[AI] Dev-asset URL detected in getCleanBase64, using fetch download...');
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const response = await fetch(localUri, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          
          const arrayBuffer = await response.arrayBuffer();
          const base64Data = encode(arrayBuffer);
          const tempPath = `${FileSystem.cacheDirectory}temp_dev_asset_${Date.now()}.jpg`;
          await FileSystem.writeAsStringAsync(tempPath, base64Data, { encoding: 'base64' });
          localUri = tempPath;
        } catch (err) {
          console.warn('[AI] Failed to fetch dev-asset via HTTP fetch:', err.message);
          // Fallback to FileSystem.downloadAsync just in case
          const tempPath = `${FileSystem.cacheDirectory}temp_dl_${Date.now()}.jpg`;
          const dl = await FileSystem.downloadAsync(localUri, tempPath);
          localUri = dl.uri;
        }
      } else {
        console.log('[AI] Downloading remote image natively:', localUri.slice(0, 80));
        const tempPath = `${FileSystem.cacheDirectory}temp_dl_${Date.now()}.jpg`;
        const dl = await FileSystem.downloadAsync(localUri, tempPath, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
            'Accept': 'image/jpeg,image/png,image/webp,image/*,*/*;q=0.8',
          }
        });
        localUri = dl.uri;
      }
    } else if (!localUri.startsWith('file://') && !localUri.startsWith('content://') && !localUri.startsWith('assets-library://')) {
      localUri = `file://${localUri}`;
    }

    // NOTE: Some bundled PNG assets cached as ExponentAsset-*.png fail with
    // ImageManipulator.manipulateAsync (Context.renderAsync rejection on Android).
    // For those paths, fall back to reading the file directly as base64.
    let base64Result = null;
    try {
      const initialInfo = await ImageManipulator.manipulateAsync(localUri, []);
      const origWidth = initialInfo.width;
      const origHeight = initialInfo.height;

      let targetWidth = width;
      let targetHeight = height;
      const maxDim = 400; // Smaller = faster API processing & smaller payloads

      if (origWidth && origHeight) {
        if (origWidth > origHeight) {
          targetWidth = Math.min(origWidth, maxDim);
          targetHeight = Math.round((origHeight * targetWidth) / origWidth);
        } else {
          targetHeight = Math.min(origHeight, maxDim);
          targetWidth = Math.round((origWidth * targetHeight) / origHeight);
        }
      } else {
        // Fallback when dimensions can't be determined: cap at maxDim
        targetWidth = Math.min(width, maxDim);
        targetHeight = Math.min(height, maxDim);
      }

      const manipulated = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: targetWidth, height: targetHeight } }],
        { compress: 0.60, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      base64Result = manipulated.base64;
    } catch (manipErr) {
      // Fallback: read file directly as base64 (works for bundled PNG assets)
      console.warn('[AI] ImageManipulator failed, using raw base64 fallback:', manipErr.message);
      base64Result = await FileSystem.readAsStringAsync(
        localUri.startsWith('file://') ? localUri : `file://${localUri}`,
        { encoding: 'base64' }
      );
    }

    // Cleanup temp files
    if (localUri.includes(FileSystem.cacheDirectory)) {
      FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => { });
    }

    return base64Result;
  } catch (e) {
    console.warn('[AI] Image optimization failed:', e.message);
    return '';
  }
}

/** Reject results that are just the garment flat-lay (generation failed silently) */
function isValidTryOnResult(resultUrl, garmentUrl) {
  if (!resultUrl) return false;
  if (resultUrl === garmentUrl) return false;
  // Data URIs must be substantial (real try-ons are large base64 strings)
  if (resultUrl.startsWith('data:') && resultUrl.length < 8000) return false;
  // File URIs (from saved temp files) are always valid if they differ from garment URL
  if (resultUrl.startsWith('file://')) return true;
  return true;
}

// Client-side image generation has been securely moved to the backend Firebase Cloud Function.

export async function identifyGarmentFromImage(imageUrl) {
  try {
    if (!FIREBASE_API_KEY) return null;

    const imageBase64 = await getCleanBase64(imageUrl, 384, 384, 'fit', 0.70);
    if (!imageBase64) return null;

    const res = await fetch(VERTEX_TEXT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: SYSTEM_PROMPTS.FASHION_ANALYSIS },
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          ]
        }],
        generationConfig: { temperature: 0.1 },
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.warn('[AI] Garment analysis skipped:', e.message);
    return null;
  }
}

function formatRemainingTime(ms) {
  const hours = Math.floor(ms / (3600 * 1000));
  const mins = Math.ceil((ms % (3600 * 1000)) / (60 * 1000));
  return `${hours}h ${mins.toString().padStart(2, '0')}m`;
}

export async function runVirtualTryOn(humanInput, garmentUrl, desc, onStatus, forceGemini = false, category = 'upper_body', options = {}) {
  const fast = options.fast !== false; // default fast for ~4s target
  const user = firebaseAuth?.currentUser;
  
  if (user && firestore) {
    const profileRef = doc(firestore, 'profiles', user.uid);
    try {
      const snap = await getDoc(profileRef);
      if (snap.exists()) {
        const data = snap.data();
        const now = Date.now();
        
        // 1. Check if user is currently blocked under the 12-hour block timer
        if (data.tryOnBlockedUntil && now < data.tryOnBlockedUntil) {
          const remainingMs = data.tryOnBlockedUntil - now;
          const timeStr = formatRemainingTime(remainingMs);
          const err = new Error(`Limit reached. Try-on is blocked. Please wait ${timeStr} before trying on more outfits.`);
          err.isLimitBlock = true;
          throw err;
        }

        // 2. Check if the 24-hour daily cycle has reset
        let tryOnCountToday = data.tryOnCountToday || 0;
        let tryOnLastResetTime = data.tryOnLastResetTime || now;
        
        if (now - tryOnLastResetTime >= 24 * 3600 * 1000) {
          tryOnCountToday = 0;
          tryOnLastResetTime = now;
          await updateDoc(profileRef, {
            tryOnCountToday: 0,
            tryOnLastResetTime: now
          });
        }

        // 3. Check if they have already hit the 10 limit (and need to start the 12-hour block)
        if (tryOnCountToday >= 10) {
          const blockedUntil = now + 12 * 3600 * 1000;
          await updateDoc(profileRef, {
            tryOnBlockedUntil: blockedUntil
          });
          const err = new Error(`You have used your 10 try-ons for today. Trial is locked for 12 hours.`);
          err.isLimitBlock = true;
          throw err;
        }
      }
    } catch (e) {
      if (e.isLimitBlock) throw e;
      console.warn('[AI Quota Check] Failed to check Firestore limit, allowing try-on:', e.message);
    }
  }

  // Actually run the try-on implementation
  const result = await enqueueTryOn(() => _runVirtualTryOnImpl(humanInput, garmentUrl, desc, onStatus, forceGemini, category, fast));

  // Increment tryOnCountToday after successful generation
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
        
        // If they just hit the limit of 10, start the 12-hour block immediately
        if (tryOnCountToday >= 10) {
          updates.tryOnBlockedUntil = now + 12 * 3600 * 1000;
        }
        
        await updateDoc(profileRef, updates);
      }
    } catch (e) {
      console.warn('[AI Quota Increment] Failed to update Firestore try-on stats:', e.message);
    }
  }

  return result;
}

// ── Dev server / Metro asset URL detector (192.168.x.x:8081, 172.x.x.x:8081, localhost:8081, etc.)
function isMetroAssetUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('unstable_path=') || (url.includes(':8081') && (
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('192.168.') ||
    url.includes('172.') ||
    url.includes('10.')
  ));
}

async function _runVirtualTryOnImpl(humanInput, garmentUrl, desc, onStatus, forceGemini = false, category = 'upper_body', fast = true) {
  const start = Date.now();
  onStatus?.('Preparing…');

  const PLACEHOLDER = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=1000&auto=format&fit=crop';
  const imgW = fast ? 384 : 768;

  // Skip product-link resolution for local Metro dev server URLs — they are already direct image URLs.
  // Fetching a Metro asset URL as HTML will always time out.
  const isUrlString = typeof garmentUrl === 'string' && garmentUrl.startsWith('http');
  const garmentResolved = isUrlString && !isMetroAssetUrl(garmentUrl)
    ? await withTimeout(extractGarmentFromUrl(garmentUrl), 1500, 'Link').catch(() => garmentUrl)
    : garmentUrl;

  const garmentHttpUrl = garmentResolved || PLACEHOLDER;

  const isGeneric = !desc || desc.toLowerCase().includes('my uploaded') || desc.toLowerCase() === 'clothing' || desc.toLowerCase() === 'garment' || desc.toLowerCase() === 'fashion garment';

  // Run image optimizations and Gemini fashion analysis in parallel.
  // Analysis is only run for generic user uploads and is capped at 5 seconds to prevent pipeline timeouts.
  // Note: identifyGarmentFromImage is also skipped for Metro assets since we know these are pre-labelled sample garments.
  const [humanB64, garmentB64, analysis] = await Promise.all([
    getCleanBase64(humanInput, imgW, imgW, 'fit', 0.70),
    getCleanBase64(garmentHttpUrl, imgW, imgW, 'fit', 0.70),
    isGeneric && typeof garmentHttpUrl === 'string' && !isMetroAssetUrl(garmentHttpUrl)
      ? withTimeout(identifyGarmentFromImage(garmentHttpUrl), 5000, 'Fashion analysis').catch(() => null)
      : Promise.resolve(null),
  ]);

  if (!humanB64 || !garmentB64) throw new Error('Failed to read photos.');

  onStatus?.('Generating…');

  // Refine prompt description and category from fashion analysis
  let enhancedDesc = desc || 'fashion garment';
  let resolvedCategory = category;

  if (analysis) {
    console.log('[AI] Fashion Analysis resolved details:', JSON.stringify(analysis));
    const isGenericDesc = !desc || desc.toLowerCase().includes('my uploaded') || desc.toLowerCase() === 'clothing' || desc.toLowerCase() === 'garment' || desc.toLowerCase() === 'fashion garment';

    if (isGenericDesc && analysis.vton_prompt) {
      enhancedDesc = analysis.vton_prompt;
    } else if (analysis.vton_prompt) {
      enhancedDesc = `${desc} - ${analysis.vton_prompt}`;
    }

    if (analysis.category) {
      resolvedCategory = analysis.category;
    }
  }

  const runGen = async () => {
    if (!firebaseFunctions) {
      throw new Error('Firebase Functions is not configured/initialized.');
    }
    const generateTryOn = httpsCallable(firebaseFunctions, 'generateTryOn');
    const response = await generateTryOn({
      humanB64,
      garmentB64,
      desc: enhancedDesc,
      category: resolvedCategory,
      forceGemini,
    });
    if (response?.data?.tryOnImageUrl) {
      return response.data.tryOnImageUrl;
    }
    throw new Error('No try-on image returned from backend Cloud Function.');
  };

  const result = await withTimeout(runGen(), 90000, 'Try-on');

  if (!isValidTryOnResult(result, garmentHttpUrl)) {
    throw new Error('Invalid try-on result. Please retry.');
  }

  // Convert data: URI to a local file:// URI for reliable React Native Image rendering.
  // Large inline base64 data URIs (>500KB) can cause silent rendering failures on Android.
  let finalResult = result;
  try {
    if (result.startsWith('data:')) {
      const matches = result.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches[2]) {
        const tempPath = `${FileSystem.cacheDirectory}tryon_result_${Date.now()}.jpg`;
        await FileSystem.writeAsStringAsync(tempPath, matches[2], { encoding: 'base64' });
        finalResult = tempPath;
        console.log('[AI] Result saved to local file:', tempPath);
      }
    }
  } catch (saveErr) {
    console.warn('[AI] Could not save result to file, using data URI:', saveErr.message);
    finalResult = result; // Fall back to data URI
  }

  console.log(`[AI] Total pipeline ${((Date.now() - start) / 1000).toFixed(1)}s`);
  return finalResult;
}

export async function generateImageEmbedding() { return []; }
