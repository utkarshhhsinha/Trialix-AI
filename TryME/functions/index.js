const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

// helper to assert that the try-on result is valid
function isValidTryOnResult(resultUrl, garmentUrl) {
  if (!resultUrl) return false;
  if (resultUrl === garmentUrl) return false;
  if (resultUrl.startsWith("data:") && resultUrl.length < 8000) return false;
  return true;
}

// Vertex AI logic matching client implementation (billed to Google Cloud credits)
async function runGeminiFast(firebaseKey, projectId, humanB64, garmentB64, desc, category) {
  const replacementRule = category === 'lower_body'
    ? 'Replace ONLY the pants/skirt/shorts with the garment in Image 2. Keep the upper body outfit exactly as in Image 1.'
    : category === 'dress' || category === 'dresses'
      ? 'Replace the ENTIRE outfit (both top and bottom) with the dress in Image 2. Remove all previous clothing completely.'
      : 'Replace ONLY the shirt/top/jacket with the garment in Image 2. Keep the pants/skirt exactly as in Image 1.';

  const shortPrompt = `VIRTUAL TRY-ON: You are an expert AI fashion designer. Put the garment from Image 2 onto the person in Image 1.
1. The person's face, hair, skin tone, body shape, pose, and background MUST remain identical to Image 1.
2. ${replacementRule}
3. CRITICAL: Completely erase, remove, and replace the existing ${category === 'lower_body' ? 'lower body' : category === 'dress' || category === 'dresses' ? 'full body' : 'upper body'} clothing. Do NOT layer over old clothes. No double collars, double necklines, or double sleeves.
4. If the new garment has shorter sleeves than the original, COMPLETELY erase the original sleeves and show natural bare arms.
5. Transfer the exact garment colors, patterns, textures, logos, branding, and text from Image 2. Do NOT simplify or omit any detail.
6. CRITICAL: Do NOT return the person unchanged. You MUST apply the garment from Image 2.
7. Output a 3:4 portrait (768x1024). Center the person with full head, shoulders, and torso visible.
Garment: ${desc}`;

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [
        { text: shortPrompt },
        { text: 'IMAGE 1 — THE PERSON (wear the clothes on this person):' },
        { inlineData: { mimeType: 'image/jpeg', data: humanB64 } },
        { text: 'IMAGE 2 — THE GARMENT (put this item of clothing on the person):' },
        { inlineData: { mimeType: 'image/jpeg', data: garmentB64 } },
      ],
    }],
    generationConfig: {
      candidateCount: 1,
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.15,
    },
  };

  const vertexUrl = `https://firebasevertexai.googleapis.com/v1beta/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.5-flash-image:generateContent?key=${firebaseKey}`;

  logger.log("[AI Backend] Requesting gemini-2.5-flash-image generation...");
  const res = await fetch(vertexUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (res.status === 429) {
    throw new HttpsError("resource-exhausted", "Vertex AI API Rate limit exceeded. Try again in a minute.");
  }

  const responseText = await res.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (err) {
    throw new HttpsError("internal", `Vertex AI response was not valid JSON: ${responseText.slice(0, 200)}`);
  }

  if (!res.ok) {
    const errorMsg = data?.error?.message || `HTTP ${res.status}`;
    throw new HttpsError("failed-precondition", `Vertex AI returned error: ${errorMsg}`);
  }

  const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (imagePart?.inlineData?.data) {
    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
  }

  const textPart = data.candidates?.[0]?.content?.parts?.find(p => p.text);
  if (textPart?.text) {
    throw new HttpsError("internal", `Vertex AI returned text instead of image: "${textPart.text.slice(0, 120)}"`);
  }

  const finishReason = data.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    throw new HttpsError("aborted", `Vertex AI generation blocked: ${finishReason}`);
  }

  throw new HttpsError("internal", "Vertex AI returned no image candidate data");
}

// Google AI Studio logic matching client implementation (free-tier developer fallback)
async function runGeminiStudio(apiKey, humanB64, garmentB64, desc, category) {
  const replacementRule = category === 'lower_body'
    ? 'Replace ONLY the pants/skirt/shorts with the garment in Image 2. Keep the upper body outfit exactly as in Image 1.'
    : category === 'dress' || category === 'dresses'
      ? 'Replace the ENTIRE outfit (both top and bottom) with the dress in Image 2. Remove all previous clothing completely.'
      : 'Replace ONLY the shirt/top/jacket with the garment in Image 2. Keep the pants/skirt exactly as in Image 1.';

  const shortPrompt = `VIRTUAL TRY-ON: You are an expert AI fashion designer. Put the garment from Image 2 onto the person in Image 1.
1. The person's face, hair, skin tone, body shape, pose, and background MUST remain identical to Image 1.
2. ${replacementRule}
3. CRITICAL: Completely erase, remove, and replace the existing ${category === 'lower_body' ? 'lower body' : category === 'dress' || category === 'dresses' ? 'full body' : 'upper body'} clothing. Do NOT layer over old clothes. No double collars, double necklines, or double sleeves.
4. If the new garment has shorter sleeves than the original, COMPLETELY erase the original sleeves and show natural bare arms.
5. Transfer the exact garment colors, patterns, textures, logos, branding, and text from Image 2. Do NOT simplify or omit any detail.
6. CRITICAL: Do NOT return the person unchanged. You MUST apply the garment from Image 2.
7. Output a 3:4 portrait (768x1024). Center the person with full head, shoulders, and torso visible.
Garment: ${desc}`;

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [
        { text: shortPrompt },
        { text: 'IMAGE 1 — THE PERSON (wear the clothes on this person):' },
        { inlineData: { mimeType: 'image/jpeg', data: humanB64 } },
        { text: 'IMAGE 2 — THE GARMENT (put this item of clothing on the person):' },
        { inlineData: { mimeType: 'image/jpeg', data: garmentB64 } },
      ],
    }],
    generationConfig: {
      candidateCount: 1,
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.15,
    },
  };

  const studioUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

  logger.log("[AI Backend] Requesting Gemini Studio image generation...");
  const res = await fetch(studioUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  const responseText = await res.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (err) {
    throw new HttpsError("internal", `Gemini Studio response was not valid JSON: ${responseText.slice(0, 200)}`);
  }

  if (!res.ok) {
    const errorMsg = data?.error?.message || `HTTP ${res.status}`;
    throw new HttpsError("failed-precondition", `Gemini Studio returned error: ${errorMsg}`);
  }

  const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (imagePart?.inlineData?.data) {
    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
  }

  throw new HttpsError("internal", "Gemini Studio returned no image candidate data");
}

exports.generateTryOn = onCall({
  cors: true
}, async (request) => {
  // Ensure the caller is authenticated in production
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called by an authenticated user.");
  }

  const { humanB64, garmentB64, desc, category } = request.data;
  if (!humanB64 || !garmentB64) {
    throw new HttpsError("invalid-argument", "Missing required parameters humanB64 or garmentB64");
  }

  try {
    const fs = require('fs');
    const path = require('path');
    const scratchDir = '/Users/utkarshsinha/.gemini/antigravity-ide/brain/d8b6dd5d-2fc2-4c3d-b069-aa5e417df0f5/scratch';
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
    fs.writeFileSync(path.join(scratchDir, 'last_human.jpg'), Buffer.from(humanB64, 'base64'));
    fs.writeFileSync(path.join(scratchDir, 'last_garment.jpg'), Buffer.from(garmentB64, 'base64'));
    logger.log("[AI Backend] Saved debug images to scratch directory.");
  } catch (debugErr) {
    logger.error("[AI Backend] Failed to save debug images:", debugErr);
  }

  const firebaseKey = process.env.FB_API_KEY;
  const projectId = process.env.VERTEX_PROJECT_ID || "aura-ai-powered-fashion-aura";
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!firebaseKey) {
    throw new HttpsError("failed-precondition", "Backend FB_API_KEY is not configured in environment variables.");
  }

  try {
    logger.log("[AI Backend] Launching Vertex AI (credits-based) generation...");
    const outputDataUri = await runGeminiFast(firebaseKey, projectId, humanB64, garmentB64, desc || "fashion garment", category);
    if (isValidTryOnResult(outputDataUri, garmentB64)) {
      return { tryOnImageUrl: outputDataUri };
    }
    throw new HttpsError("internal", "The Vertex AI model finished successfully, but the output image was invalid.");
  } catch (err) {
    logger.warn("[AI Backend] Vertex AI generation failed:", err.message);

    // Fall back to Google AI Studio for any error (e.g., billing, dunning, or model/project access restrictions)
    if (geminiApiKey) {
      try {
        logger.log("[AI Backend] Routing to Google AI Studio fallback...");
        const outputDataUri = await runGeminiStudio(geminiApiKey, humanB64, garmentB64, desc || "fashion garment", category);
        if (isValidTryOnResult(outputDataUri, garmentB64)) {
          return { tryOnImageUrl: outputDataUri };
        }
      } catch (studioErr) {
        logger.error("[AI Backend] Gemini Studio fallback failed:", studioErr);
      }
    }

    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err.message || "An unexpected error occurred during Vertex AI image generation.");
  }
});

exports.shareLook = onRequest({ cors: true }, (req, res) => {
  const imageUrl = req.query.image || '';
  const desc = req.query.desc || 'AI-Powered Virtual Fashion Try-On';
  const brand = req.query.brand || 'TrialX';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Open Graph Meta Tags for Social Previews (WhatsApp, iMessage, etc.) -->
  <meta property="og:title" content="TrialX AI - Live AI Try-On Feed" />
  <meta property="og:description" content="Look: ${desc} ${brand ? 'by ' + brand : ''}. Style any outfit in seconds!" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://trialix.app/share" />
  
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="TrialX AI - Live AI Try-On Feed" />
  <meta name="twitter:description" content="Look: ${desc} ${brand ? 'by ' + brand : ''}." />
  <meta name="twitter:image" content="${imageUrl}" />

  <title>TrialX AI - Try-On Look</title>
  
  <!-- Modern Typography -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --bg-color: #0D0D0D;
      --card-bg: rgba(255, 255, 255, 0.03);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #C4785A;
      --primary-gradient: linear-gradient(135deg, #C4785A 0%, #E8A882 100%);
      --text: #FFFFFF;
      --text-muted: rgba(255, 255, 255, 0.6);
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg-color);
      color: var(--text);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      overflow-x: hidden;
      padding: 24px;
      position: relative;
    }

    /* Vibrant ambient background glow */
    body::before {
      content: '';
      position: absolute;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(196, 120, 90, 0.15) 0%, transparent 70%);
      top: 15%;
      left: 10%;
      z-index: 0;
    }
    body::after {
      content: '';
      position: absolute;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(232, 168, 130, 0.12) 0%, transparent 70%);
      bottom: 10%;
      right: 5%;
      z-index: 0;
    }

    .container {
      max-width: 440px;
      width: 100%;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .logo-container {
      margin-bottom: 24px;
      text-align: center;
    }
    
    .logo-text {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.5px;
      background: var(--primary-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 600;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    .look-card {
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 28px;
      padding: 16px;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
      margin-bottom: 32px;
      transition: transform 0.4s ease;
    }

    .image-wrapper {
      width: 100%;
      aspect-ratio: 3/4;
      border-radius: 20px;
      overflow: hidden;
      position: relative;
      background: #1A1A1A;
    }

    .look-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.6s ease;
    }

    .look-card:hover .look-image {
      transform: scale(1.03);
    }

    .look-info {
      margin-top: 16px;
      padding: 0 8px;
    }

    .garment-title {
      font-size: 18px;
      font-weight: 800;
      color: var(--text);
      line-height: 1.3;
    }

    .garment-brand {
      font-size: 12px;
      font-weight: 800;
      color: var(--primary);
      text-transform: uppercase;
      margin-top: 4px;
      letter-spacing: 0.5px;
    }

    .cta-button {
      width: 100%;
      background: var(--primary-gradient);
      color: #FFFFFF;
      font-family: inherit;
      font-size: 16px;
      font-weight: 800;
      border: none;
      border-radius: 18px;
      padding: 16px 24px;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      box-shadow: 0 8px 20px rgba(196, 120, 90, 0.25);
      transition: all 0.3s ease;
      display: inline-block;
    }

    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(196, 120, 90, 0.4);
    }

    .cta-button:active {
      transform: translateY(1px);
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-container">
      <h1 class="logo-text">TrialX AI</h1>
      <p class="subtitle">Virtual Trial Room</p>
    </div>
    
    <div class="look-card">
      <div class="image-wrapper">
        <img class="look-image" src="\${imageUrl || 'https://via.placeholder.com/768x1024'}" alt="AI Style Try-On" />
      </div>
      <div class="look-info">
        <h2 class="garment-title">\${desc}</h2>
        <p class="garment-brand">\${brand}</p>
      </div>
    </div>
    
    <a href="https://trialix.app" class="cta-button">Download TrialX App</a>
  </div>
</body>
</html>`;
  res.status(200).send(html);
});
