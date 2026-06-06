const fetch = require('node-fetch');

const KEY_1 = "AIzaSyB9EuogsWeMNyBRFAQi_6rIa4D1rL_Z56Y"; // from .env
const KEY_2 = "AIzaSyA3EaFrDAqKqGF7XJJ7NG4mjULmIWDjEDY"; // from google-services.json
const PROJECT_ID = "aura-ai-powered-fashion-aura";

async function testKey(key, label) {
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    });
    const data = await res.json();
    console.log(`[${label}] Status: ${res.status}`);
    if (data.error) {
      console.log(`[${label}] Error: ${data.error.message}`);
    } else {
      console.log(`[${label}] Success!`);
    }
  } catch (err) {
    console.error(`[${label}] Failed:`, err.message);
  }
}

async function run() {
  await testKey(KEY_1, "KEY_1 (.env)");
  await testKey(KEY_2, "KEY_2 (google-services.json)");
}

run();
