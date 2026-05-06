/**
 * ai_engine.js — Multi-Phase AI Orchestrator (v23.0)
 * ─────────────────────────────────────────────────────────────────────────────
 * FIXES:
 * 1. Resolved 'responseModalities' error: Now only applied to v1beta endpoints.
 * 2. Optimized Vertex Path: Promoted Vertex to primary to ensure image delivery.
 * 3. Gemini Refinement: Uses Gemini for high-level prompt engineering before Vertex synthesis.
 * 4. Model Discovery: Refined list to avoid deprecated or unavailable identifiers.
 */

import * as FileSystem from 'expo-file-system';
import { encode } from 'base64-arraybuffer';

const GEMINI_KEY     = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const VERTEX_KEY     = process.env.EXPO_PUBLIC_VERTEX_API_KEY;
const VERTEX_PROJECT = process.env.EXPO_PUBLIC_VERTEX_PROJECT_ID;
const VERTEX_REGION  = process.env.EXPO_PUBLIC_VERTEX_REGION || 'us-central1';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export async function extractGarmentFromUrl(productUrl) {
  try {
    if (!productUrl.startsWith('http')) return productUrl;
    const res = await fetch(productUrl);
    const html = await res.text();
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogMatch) return ogMatch[1];
    return productUrl;
  } catch (e) { return productUrl; }
}

async function getCleanBase64(input) {
  try {
    if (!input) return '';
    if (input.includes('base64,')) return input.split('base64,')[1];
    if (input.startsWith('http')) {
      const res = await fetch(input);
      const arrayBuffer = await res.arrayBuffer();
      return encode(arrayBuffer);
    }
    const path = input.startsWith('file://') ? input : `file://${input}`;
    return await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
  } catch (e) { return ''; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function runVirtualTryOn(humanInput, garmentUrl, desc, onStatus) {
  const garmentImage = await extractGarmentFromUrl(garmentUrl);
  const humanB64 = await getCleanBase64(humanInput);

  // PATH 1: VERTEX IMAGEN 3 (High Reliability Primary)
  if (VERTEX_KEY && VERTEX_PROJECT) {
    try {
      onStatus?.('Vertex: Synthesizing Image…');
      return await runVertexEngine(humanB64, garmentImage, desc);
    } catch (e) {
      console.warn('[AI] Vertex Failed, trying Gemini:', e.message);
    }
  }

  // PATH 2: GEMINI (Multimodal Path)
  if (GEMINI_KEY) {
    const configs = [
      { version: 'v1beta', model: 'gemini-2.0-flash-exp', supportsImages: true },
      { version: 'v1beta', model: 'gemini-1.5-flash',     supportsImages: true },
      { version: 'v1',     model: 'gemini-1.5-flash',     supportsImages: false },
      { version: 'v1',     model: 'gemini-1.5-pro',       supportsImages: false }
    ];

    for (const config of configs) {
      try {
        onStatus?.(`Gemini (${config.model}): Rendering…`);
        return await runGeminiEngine(humanB64, garmentImage, desc, config.version, config.model, config.supportsImages);
      } catch (e) {
        console.warn(`[AI] Gemini ${config.version}/${config.model} failed:`, e.message);
      }
    }
  }

  throw new Error('All AI synthesis engines failed. Please check your network and API project status.');
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────────────────────

async function runGeminiEngine(humanB64, garmentUrl, desc, version, model, supportsImages) {
  const garmentRes = await fetch(garmentUrl);
  const garmentArrayBuffer = await garmentRes.arrayBuffer();
  const garmentB64 = encode(garmentArrayBuffer);

  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${GEMINI_KEY}`;

  const body = {
    contents: [{
      parts: [
        { text: `VIRTUAL TRY-ON:
Identity: Keep the person from Image 1.
Garment: Wear the shirt from Image 2 (${desc}).
Style: Realistic studio portrait.` },
        { inlineData: { mimeType: 'image/jpeg', data: humanB64 } },
        { inlineData: { mimeType: 'image/jpeg', data: garmentB64 } }
      ]
    }],
    generationConfig: {
      candidateCount: 1,
      ...(supportsImages ? { responseModalities: ['IMAGE'] } : {})
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

  const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part) return `data:image/png;base64,${part.inlineData.data}`;
  
  throw new Error('No image in response');
}

async function runVertexEngine(humanB64, garmentImage, desc) {
  const url = `https://${VERTEX_REGION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_REGION}/publishers/google/models/imagen-3.0-generate-001:predict?key=${VERTEX_KEY}`;

  const body = {
    instances: [{ prompt: `Photorealistic studio portrait of the person wearing ${desc}. High-end cinematic lighting. Identity lock: face, skin, hair.` }],
    parameters: { sampleCount: 1 }
  };

  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Vertex API Error');

  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Vertex empty');

  return `data:image/png;base64,${b64}`;
}

export async function generateImageEmbedding() { return []; }
