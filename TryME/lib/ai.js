import { encode } from 'base64-arraybuffer';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const VERTEX_PROJECT_ID = process.env.EXPO_PUBLIC_VERTEX_PROJECT_ID;
const VERTEX_REGION = process.env.EXPO_PUBLIC_VERTEX_REGION || 'us-central1';
const VERTEX_API_KEY = process.env.EXPO_PUBLIC_VERTEX_API_KEY;

// ─── Model Versions ───────────────────────────────────────────────────────────
const GEMINI_2_MODEL = 'gemini-2.0-flash-exp'; 
const IMAGEN_MODEL = 'imagen-3.0-generate-001'; 
const STABLE_MODEL = 'gemini-1.5-flash';

// ─────────────────────────────────────────────────────────────────────────────
// 1. VIRTUAL TRY-ON — Multi-Cloud Implementation
// ─────────────────────────────────────────────────────────────────────────────
export async function runVirtualTryOn(humanImgBase64, garmentImageUrl, garmentDesc, onStatus) {
  const base64Data = humanImgBase64.replace(/^data:image\/\w+;base64,/, '');

  // --- VERTEX AI (No Geoblocks, Best for Images) ---
  if (VERTEX_API_KEY && VERTEX_PROJECT_ID) {
    try {
      onStatus?.('Attempting Vertex AI (Imagen 3)...');
      const url = `https://${VERTEX_REGION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT_ID}/locations/${VERTEX_REGION}/publishers/google/models/imagen-3.0-generate-001:predict?key=${VERTEX_API_KEY}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{
            prompt: `Photorealistic virtual try-on: This person wearing a ${garmentDesc}. Studio fashion photography.`
          }]
        })
      });
      const result = await response.json();
      const b64 = result?.predictions?.[0]?.bytesBase64Encoded;
      if (b64) return `data:image/png;base64,${b64}`;
    } catch (e) {
      console.warn('Vertex AI failed:', e.message);
    }
  }

  // --- AI STUDIO TIER 1: Gemini 2.0 ---
  if (GEMINI_API_KEY) {
    try {
      onStatus?.('Attempting AI Studio (Gemini 2.0)...');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_2_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
              { text: `VIRTUAL TRY-ON: Generate a photo of this person wearing the garment: ${garmentDesc}.` }
            ]
          }],
          generationConfig: { responseModalities: ['IMAGE'] }
        })
      });
      const result = await response.json();
      const imagePart = result?.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
      if (imagePart) return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
    } catch (e) {
      console.warn('AI Studio Gemini 2.0 failed:', e.message);
    }
  }

  // --- FINAL FALLBACK: Styling Report ---
  onStatus?.('Regional restriction active. Generating Stylist Report...');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${STABLE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
          { text: `Analyze this garment: "${garmentDesc}". Provide a professional styling report. (Image generation is restricted in this region).` }
        ]
      }]
    })
  });
  const result = await response.json();
  return { isReport: true, text: result?.candidates?.[0]?.content?.parts?.[0]?.text, originalGarment: garmentImageUrl };
}

export async function extractGarmentFromUrl(url) { return null; }
export async function generateImageEmbedding() { return []; }
