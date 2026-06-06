// AI Try-On wrapper — detects which API key is configured and calls the right endpoint.
// Supported: Fashn.ai REST API (recommended) or Replicate IDM-VTON model.
const FASHN_API_KEY = process.env.EXPO_PUBLIC_FASHN_API_KEY;
const REPLICATE_API_KEY = process.env.EXPO_PUBLIC_REPLICATE_API_KEY;
/**
 * Run virtual try-on.
 * @param {string} modelImageUrl  - URL or base64 data URI of the user's full-body photo
 * @param {string} garmentImageUrl - URL of the clothing product image
 * @returns {Promise<string>} - URL of the generated try-on image
 */
export async function runTryOn(modelImageUrl, garmentImageUrl) {
  if (FASHN_API_KEY) {
    const res = await fetch('https://api.fashn.ai/v1/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FASHN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_image: modelImageUrl,
        garment_image: garmentImageUrl,
        category: 'tops', // auto-detect if possible
      }),
    });
    if (!res.ok) throw new Error(`Fashn.ai error: ${res.status}`);
    const data = await res.json();
    const predictionId = data.id;

    // Poll for result
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await fetch(`https://api.fashn.ai/v1/status/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${FASHN_API_KEY}` },
      });
      const pollData = await poll.json();
      if (pollData.status === 'completed') return pollData.output[0];
      if (pollData.status === 'failed') throw new Error('Fashn.ai generation failed');
    }
    throw new Error('Fashn.ai timed out');
  }

  // --- Replicate IDM-VTON fallback ---
  if (REPLICATE_API_KEY) {
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4', // IDM-VTON
        input: {
          human_img: modelImageUrl,
          garm_img: garmentImageUrl,
          garment_des: 'clothing item',
        },
      }),
    });
    if (!res.ok) throw new Error(`Replicate error: ${res.status}`);
    const prediction = await res.json();
    const pollUrl = prediction.urls.get;

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await fetch(pollUrl, {
        headers: { 'Authorization': `Token ${REPLICATE_API_KEY}` },
      });
      const pollData = await poll.json();
      if (pollData.status === 'succeeded') return pollData.output;
      if (pollData.status === 'failed') throw new Error('Replicate generation failed');
    }
    throw new Error('Replicate timed out');
  }
  // --- No API key: simulate with 2s delay ---
  await new Promise(r => setTimeout(r, 2000));
  return garmentImageUrl; // Return clothing image as mock result
}