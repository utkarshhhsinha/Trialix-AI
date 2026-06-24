const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

// ── Garment catalog (server-side copy — only imageUrl needed)
const GARMENT_CATALOG = [
  { id: 'm1', title: 'Classic Oxford Shirt', brand: 'Zara Man', priceINR: '3,299', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1626497764746-6dc36546b388?w=600&q=80', buyLink: 'https://www.zara.com/in/en/man-shirts-l737.html', gender: 'male' },
  { id: 'm2', title: 'Denim Trucker Jacket', brand: "Levi's", priceINR: '8,299', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1611312449412-6cefac5dc3e4?w=600&q=80', buyLink: 'https://www.levi.com/IN/en_IN/', gender: 'male' },
  { id: 'm3', title: 'Slim-Fit Blazer', brand: 'H&M Man', priceINR: '6,599', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=600&q=80', buyLink: 'https://www2.hm.com/en_in/men.html', gender: 'male' },
  { id: 'm5', title: 'Graphic Oversized Tee', brand: 'Myntra Studio', priceINR: '1,299', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80', buyLink: 'https://www.myntra.com/t-shirts', gender: 'male' },
  { id: 'm6', title: 'Striped Linen Shirt', brand: 'Fabindia', priceINR: '2,499', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&q=80', buyLink: 'https://www.fabindia.com/men-clothing', gender: 'male' },
  // ── Women's tops (19 items)
  { id: 'wt1', title: 'Green Floral Peplum Top', brand: 'Rain & Rainbow', priceINR: '699', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80', buyLink: 'https://rainandrainbow.com/products/green-floral-printed-sleeveless-peplum-pure-cotton-top?variant=50380853510447&country=IN&currency=INR', gender: 'female' },
  { id: 'wt2', title: 'Purple Dress', brand: 'Tokyo Talkies', priceINR: '999', category: 'dresses', imageUrl: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&q=80', buyLink: 'https://www.limeroad.com/purple-dress-tokyo-talkies-p22470795?imgIdx=0&src_id=merge_feed_story__3&reference_story_id=69f9cac2c95a470722a438c1', gender: 'female' },
  { id: 'wt3', title: 'Marham Bell Sleeves Kurti', brand: 'Evara', priceINR: '1,299', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&q=80', buyLink: 'https://evara.me/products/marham-bell-sleeves-kurti?variant=46413089046699&country=IN&currency=INR', gender: 'female' },
  { id: 'wt4', title: 'Pastel Pink Chikankari Kurta', brand: 'Shanaya', priceINR: '1,499', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4d29?w=600&q=80', buyLink: 'https://shanaya.in/Pastel-Pink-Georgette-Chikankari-Embroidery-Kurta-With-Pant--/catalogue/e0jmeHw3/BEwXaj2Y', gender: 'female' },
  { id: 'wt5', title: 'Cream Floral Kurta Set', brand: 'Vastrakaala', priceINR: '1,899', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80', buyLink: 'https://vastrakaala.com/products/cream-floral-printed-kurta-set-with-matching-dupatta-copy?currency=INR&country=IN&variant=51707841675583', gender: 'female' },
  { id: 'wt6', title: 'Green Floral Empire Top', brand: 'Rain & Rainbow', priceINR: '599', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80', buyLink: 'https://rainandrainbow.com/products/women-green-floral-printed-pure-cotton-empire-tops?variant=49987890512175&country=IN&currency=INR', gender: 'female' },
  { id: 'wt7', title: 'Poshak Mal White Kurta Set', brand: 'Bullion Knot', priceINR: '2,199', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1622445275576-721325763afe?w=600&q=80', buyLink: 'https://www.bullionknot.com/products/poshak-mal-cotton-white-kurta-set?variant=44980776698032&country=IN&currency=INR', gender: 'female' },
  { id: 'wt8', title: 'Grace in Ivory Kurti Set', brand: 'Jaipur Kurta', priceINR: '2,499', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1574164904299-3a102b110380?w=600&q=80', buyLink: 'https://jaipurkurta.com/products/grace-in-ivory-minimalist-elegance-kurti-set?variant=43579451048029&country=IN&currency=INR', gender: 'female' },
  { id: 'wt9', title: 'Grace in Ivory Minimalist Kurti', brand: 'Jaipur Kurta', priceINR: '2,499', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=80', buyLink: 'https://jaipurkurta.com/products/grace-in-ivory-minimalist-elegance-kurti-set?variant=43579451048029&country=IN&currency=INR', gender: 'female' },
  { id: 'wt10', title: 'Animal Print Kurta with Palazzos', brand: 'Lookmark', priceINR: '1,599', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&q=80', buyLink: 'https://www.myntra.com/kurta-sets/lookmark/lookmark-women-animal-printed-regular-a-line-calf-length-kurta-with-palazzos/34018371/buy', gender: 'female' },
  { id: 'wt11', title: 'Print Crop Top', brand: 'Moda Rapido', priceINR: '799', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&q=80', buyLink: 'https://www.myntra.com/tops/moda+rapido/moda-rapido-print-crop-top/42428516/buy', gender: 'female' },
  { id: 'wt12', title: 'Bow Top', brand: 'Savana', priceINR: '1,099', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80', buyLink: 'https://www.savana.com/details/bow-top-1781682?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=25&skcPGs=293870-393317', gender: 'female' },
  { id: 'wt13', title: 'Placket Blouse', brand: 'Savana', priceINR: '999', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&q=80', buyLink: 'https://www.savana.com/details/placket-blouse-2130912?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=2&skcPGs=350587-453870', gender: 'female' },
  { id: 'wt14', title: 'Lace Trimmed Wrap Top', brand: 'Savana', priceINR: '1,199', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&q=80', buyLink: 'https://www.savana.com/details/lace-trimmed-wrap-top-1987182?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=16&skcPGs=326547-433777', gender: 'female' },
  { id: 'wt15', title: 'Asymmetric Top', brand: 'Savana', priceINR: '899', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&q=80', buyLink: 'https://www.savana.com/details/asymmetric-top-1998762?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&skcPGs=328549-430305&vid=318', gender: 'female' },
  { id: 'wt16', title: 'Draped Top', brand: 'Savana', priceINR: '849', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80', buyLink: 'https://www.savana.com/details/draped-top-1602882?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=6&skcPGs=266174-413087', gender: 'female' },
  { id: 'wt17', title: 'Draped Top (Alt)', brand: 'Savana', priceINR: '849', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&q=80', buyLink: 'https://www.savana.com/details/draped-top-1602882?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=6&skcPGs=266174-413087', gender: 'female' },
  { id: 'wt18', title: 'Sequin Embroidered Tank Top', brand: 'Savana', priceINR: '1,499', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80', buyLink: 'https://www.savana.com/details/sequin-embroidered-tank-top-2096502?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&skcPGs=367590-470053&vid=1', gender: 'female' },
  { id: 'wt19', title: 'Gathered Top', brand: 'Savana', priceINR: '949', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80', buyLink: 'https://www.savana.com/details/gathered-top-1801422?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=3&skcPGs=307652-406989', gender: 'female' },
  // ── Legacy female items
  { id: 'f1', title: 'Floral Midi Dress', brand: 'H&M', priceINR: '4,199', category: 'dresses', imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80', buyLink: 'https://www2.hm.com/en_in/women/products/dresses.html', gender: 'female' },
  { id: 'f2', title: 'Cropped Linen Blazer', brand: 'Zara', priceINR: '7,499', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80', buyLink: 'https://www.zara.com/in/en/woman-blazers-l1045.html', gender: 'female' },
  { id: 'f3', title: 'Cable Knit Sweater', brand: 'Everlane', priceINR: '6,499', category: 'upper_body', imageUrl: 'https://images.unsplash.com/photo-1574164904299-3a102b110380?w=600&q=80', buyLink: 'https://www.everlane.com/collections/womens-sweaters', gender: 'female' },
  { id: 'f4', title: 'Satin Slip Dress', brand: 'ASOS', priceINR: '5,499', category: 'dresses', imageUrl: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&q=80', buyLink: 'https://www.asos.com/women/dresses/', gender: 'female' },
];

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function urlToBase64(url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

// Upload a data: URI to Firebase Storage and return a public download URL
async function uploadDataUri(dataUri, path) {
  const bucket = admin.storage().bucket();
  const matches = dataUri.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid data URI');
  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const file = bucket.file(`${path}.${ext}`);
  await file.save(buffer, { metadata: { contentType: mimeType } });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${file.name}`;
}

// ── generateDailyPicks: parallel generation — all 3 run at once, each pick streams to Firestore as it resolves
exports.generateDailyPicks = onCall({ cors: true, invoker: "public", timeoutSeconds: 540 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated.");

  const uid = request.auth.uid;
  const db = admin.firestore();
  const docRef = db.collection('daily_picks').doc(uid);

  // Return cached batch if still valid
  const existing = await docRef.get();
  if (existing.exists) {
    const data = existing.data();
    const now = Date.now();
    const nextBatchAt = data.nextBatchAt?.toMillis?.() || 0;
    if (data.status === 'ready' && data.picks?.length > 0 && now < nextBatchAt) {
      // If the user uploaded a new base photo, skip the cache and regenerate
      const incomingPhoto = (request.data?.basePhotoUrl || '').split('&t=')[0];
      const storedPhoto = (data.basePhotoUrl || '').split('&t=')[0];
      const photoChanged = incomingPhoto && storedPhoto && incomingPhoto !== storedPhoto;
      if (!photoChanged) {
        return { status: 'cached' };
      }
      logger.log(`[generateDailyPicks] Base photo changed — bypassing cache and regenerating for uid=${uid}`);
    }
    // Already generating — don't double-trigger
    if (data.status === 'generating' && now < (data.startedAt?.toMillis?.() || 0) + 300000) {
      return { status: 'generating' };
    }
    // Rate limited — don't retry until retryAt
    if (data.status === 'rate_limited') {
      const retryAt = data.retryAt?.toMillis?.() || 0;
      if (Date.now() < retryAt) return { status: 'rate_limited', retryAt };
    }
  }

  const { basePhotoUrl, gender } = request.data || {};
  let humanPhotoUrl = basePhotoUrl;
  let userGender = gender || '';

  // Always re-read profile from Firestore to get the authoritative gender —
  // the client-passed value may be stale or missing.
  const profileSnap = await db.collection('profiles').doc(uid).get();
  if (!profileSnap.exists) throw new HttpsError("not-found", "Profile not found.");
  const profile = profileSnap.data();

  if (!humanPhotoUrl) {
    if (!profile.basePhotoUrl) throw new HttpsError("failed-precondition", "No base photo.");
    humanPhotoUrl = profile.basePhotoUrl;
  }
  // Prefer the stored gender; only fall back to client-passed value if not set
  userGender = (profile.gender || gender || '').toLowerCase().trim();

  // Map display labels ('Female', 'Male', 'Non-binary') → catalog keys
  const GENDER_MAP = { female: 'female', male: 'male', 'non-binary': 'unisex', 'prefer not to say': 'unisex' };
  const normalizedGender = GENDER_MAP[userGender] || userGender;

  // Strict gender filter — NEVER mix male garments into a female session or vice-versa.
  // 'unisex' items are only shown when gender is explicitly non-binary / unset.
  let catalog;
  if (normalizedGender === 'female') {
    catalog = GARMENT_CATALOG.filter(g => g.gender === 'female');
  } else if (normalizedGender === 'male') {
    catalog = GARMENT_CATALOG.filter(g => g.gender === 'male');
  } else {
    // non-binary / prefer not to say / unset → unisex + both
    catalog = GARMENT_CATALOG.filter(g => g.gender === 'unisex');
    if (catalog.length < 3) catalog = GARMENT_CATALOG;
  }

  // Safety net — should never happen if catalog is populated correctly
  if (catalog.length < 3) {
    logger.warn(`[generateDailyPicks] Catalog too small for gender="${normalizedGender}", using full catalog`);
    catalog = GARMENT_CATALOG;
  }

  const garments = pickRandom(catalog, 3);
  const nextBatchAt = Date.now() + 5 * 60 * 1000;

  // Write generating state with placeholder picks so client shows cards immediately
  const placeholderPicks = garments.map(g => ({ ...g, tryOnImageUrl: null }));
  await docRef.set({
    status: 'generating',
    picks: placeholderPicks,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    nextBatchAt: admin.firestore.Timestamp.fromMillis(nextBatchAt),
    basePhotoUrl: humanPhotoUrl,  // stored so future calls can detect photo changes
    uid,
  });

  const firebaseKey = process.env.FB_API_KEY;
  const projectId = process.env.VERTEX_PROJECT_ID || "aura-ai-powered-fashion-aura";

  // Pre-fetch the user photo and ALL garment images in parallel before generation starts.
  // This eliminates sequential fetch latency inside each generateOnePick call.
  let humanB64;
  let garmentB64s;
  try {
    [humanB64, ...garmentB64s] = await Promise.all([
      humanPhotoUrl.startsWith('data:')
        ? Promise.resolve(humanPhotoUrl.split('base64,')[1])
        : urlToBase64(humanPhotoUrl),
      ...garments.map(g => urlToBase64(g.imageUrl)),
    ]);
  } catch (e) {
    await docRef.update({ status: 'error' });
    throw new HttpsError("internal", "Failed to load photos: " + e.message);
  }

  // Helper: send FCM notification if user has a token
  async function sendFCM(title, body) {
    try {
      const profileSnap = await db.collection('profiles').doc(uid).get();
      const fcmToken = profileSnap.data()?.fcmToken;
      if (fcmToken) {
        await admin.messaging().send({
          token: fcmToken,
          notification: { title, body },
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        });
      }
    } catch (e) { logger.warn('[generateDailyPicks] FCM failed:', e.message); }
  }

  // Generate one pick — garmentB64 is pre-fetched, so no network call inside the retry loop.
  // maxRetries reduced to 2 for speed; retry wait cut to 800ms flat.
  async function generateOnePick(garment, garmentB64, index, maxRetries = 2) {
    const geminiApiKey = process.env.GEMINI_API_KEY || firebaseKey;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let dataUri;
        try {
          logger.log(`[generateDailyPicks] Pick ${index + 1} Attempt ${attempt} calling Vertex AI...`);
          dataUri = await runGeminiFast(firebaseKey, projectId, humanB64, garmentB64, garment.title, garment.category);
        } catch (fastErr) {
          logger.warn(`[generateDailyPicks] Pick ${index + 1} Attempt ${attempt} Vertex AI failed: ${fastErr.message}`);
          if (geminiApiKey) {
            logger.log(`[generateDailyPicks] Pick ${index + 1} Attempt ${attempt} trying Google AI Studio fallback...`);
            dataUri = await runGeminiStudio(geminiApiKey, humanB64, garmentB64, garment.title, garment.category);
          } else {
            throw fastErr;
          }
        }

        if (isValidTryOnResult(dataUri, garment.imageUrl)) {
          const storageUrl = await uploadDataUri(dataUri, `daily_picks/${uid}/${Date.now()}_${index}`);
          return { ...garment, tryOnImageUrl: storageUrl, generatedAt: Date.now() };
        }
        throw new Error("Invalid try-on image returned");
      } catch (e) {
        logger.warn(`[generateDailyPicks] Pick ${index + 1} Attempt ${attempt} failed: ${e.message}`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 800));
        }
      }
    }

    // All attempts failed — show garment image as fallback so the deck doesn't break
    logger.error(`[generateDailyPicks] Pick ${index + 1} completely failed. Falling back to garment image.`);
    return { ...garment, tryOnImageUrl: garment.imageUrl, generatedAt: Date.now() };
  }

  // Run all 3 in parallel — each streams to Firestore as it resolves
  const picks = [...placeholderPicks];

  await Promise.all(garments.map(async (garment, i) => {
    const result = await generateOnePick(garment, garmentB64s[i], i);
    picks[i] = result;
    logger.log(`[generateDailyPicks] pick ${i + 1}/3 done (tryOn=${!!result.tryOnImageUrl}): ${garment.title}`);
    // Write the FULL picks array each time — avoids Firestore converting array → map
    // when dot-notation updates like picks.0 / picks.1 are used.
    await docRef.update({ picks: [...picks], status: 'generating' });
  }));

  // Mark ready — even if some picks have null tryOnImageUrl (client shows garment image fallback)
  await docRef.update({ status: 'ready', picks });

  // Notify user their looks are ready
  await sendFCM('✨ Your looks are ready!', 'Swipe 3 fresh AI outfits picked just for you.');

  return { status: 'ready' };
});

// helper to assert that the try-on result is valid
function isValidTryOnResult(resultUrl, garmentUrl) {
  if (!resultUrl) return false;
  if (resultUrl === garmentUrl) return false;
  if (resultUrl.startsWith("data:") && resultUrl.length < 8000) return false;
  return true;
}

// Vertex AI logic matching client implementation (billed to Google Cloud credits)
async function runGeminiFast(firebaseKey, projectId, humanB64, garmentB64, desc, category) {
  const bodyPart = category === 'lower_body' ? 'lower body (pants/skirt/shorts)'
    : (category === 'dress' || category === 'dresses') ? 'entire body (full outfit)'
    : 'upper body (top/shirt/kurta/jacket)';

  const keepPart = category === 'lower_body' ? 'Keep the upper body clothing exactly as-is.'
    : (category === 'dress' || category === 'dresses') ? 'Remove ALL existing clothing top and bottom.'
    : 'Keep the lower body (pants/skirt) exactly as-is.';

  const prompt = `You are a professional virtual try-on AI. Your ONLY job is to dress the person in Image 1 with the exact garment shown in Image 2.

TASK: Replace the ${bodyPart} clothing on the person with the garment from Image 2.

STRICT RULES — follow every rule exactly:
- PRESERVE: Face, hair, skin tone, body shape, hands, pose, background, lighting — keep pixel-perfect.
- REPLACE: Completely remove and replace the existing ${bodyPart} clothing with the garment from Image 2.
- ${keepPart}
- GARMENT ACCURACY: Copy the exact colors, print, pattern, texture, embroidery, and cut of the garment in Image 2. Do not simplify or omit any detail.
- NO LAYERING: Do not place the new garment over the old one. Erase the original clothes first, then render the new garment naturally on the body.
- NO ARTIFACTS: Do not add circles, dots, lines, annotations, UI elements, or any markings. Output is a clean photograph only.
- SLEEVES: If the new garment has shorter sleeves, show natural bare arms — do not leave old sleeve fabric showing.
- OUTPUT: Photo-realistic portrait, 3:4 ratio. Person centered, head to mid-thigh visible.

Garment name: ${desc}

CRITICAL: The output MUST show the person wearing the garment from Image 2. If you cannot apply it, you have failed. Do not return the original image unchanged.`;

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [
        { text: 'IMAGE 1 — PERSON (apply the garment onto this person):' },
        { inlineData: { mimeType: 'image/jpeg', data: humanB64 } },
        { text: 'IMAGE 2 — GARMENT (dress the person in exactly this item):' },
        { inlineData: { mimeType: 'image/jpeg', data: garmentB64 } },
        { text: prompt },
      ],
    }],
    generationConfig: {
      candidateCount: 1,
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.5,
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
  const bodyPart = category === 'lower_body' ? 'lower body (pants/skirt/shorts)'
    : (category === 'dress' || category === 'dresses') ? 'entire body (full outfit)'
    : 'upper body (top/shirt/kurta/jacket)';

  const keepPart = category === 'lower_body' ? 'Keep the upper body clothing exactly as-is.'
    : (category === 'dress' || category === 'dresses') ? 'Remove ALL existing clothing top and bottom.'
    : 'Keep the lower body (pants/skirt) exactly as-is.';

  const prompt = `You are a professional virtual try-on AI. Your ONLY job is to dress the person in Image 1 with the exact garment shown in Image 2.

TASK: Replace the ${bodyPart} clothing on the person with the garment from Image 2.

STRICT RULES — follow every rule exactly:
- PRESERVE: Face, hair, skin tone, body shape, hands, pose, background, lighting — keep pixel-perfect.
- REPLACE: Completely remove and replace the existing ${bodyPart} clothing with the garment from Image 2.
- ${keepPart}
- GARMENT ACCURACY: Copy the exact colors, print, pattern, texture, embroidery, and cut of the garment in Image 2. Do not simplify or omit any detail.
- NO LAYERING: Do not place the new garment over the old one. Erase the original clothes first, then render the new garment naturally on the body.
- NO ARTIFACTS: Do not add circles, dots, lines, annotations, UI elements, or any markings. Output is a clean photograph only.
- SLEEVES: If the new garment has shorter sleeves, show natural bare arms — do not leave old sleeve fabric showing.
- OUTPUT: Photo-realistic portrait, 3:4 ratio. Person centered, head to mid-thigh visible.

Garment name: ${desc}

CRITICAL: The output MUST show the person wearing the garment from Image 2. If you cannot apply it, you have failed. Do not return the original image unchanged.`;

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [
        { text: 'IMAGE 1 — PERSON (apply the garment onto this person):' },
        { inlineData: { mimeType: 'image/jpeg', data: humanB64 } },
        { text: 'IMAGE 2 — GARMENT (dress the person in exactly this item):' },
        { inlineData: { mimeType: 'image/jpeg', data: garmentB64 } },
        { text: prompt },
      ],
    }],
    generationConfig: {
      candidateCount: 1,
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.5,
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
  cors: true,
  invoker: "public"
}, async (request) => {
  // Ensure the caller is authenticated in production
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called by an authenticated user.");
  }

  const { humanB64, garmentB64, desc, category } = request.data;
  if (!humanB64 || !garmentB64) {
    throw new HttpsError("invalid-argument", "Missing required parameters humanB64 or garmentB64");
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

exports.shareLook = onRequest({ cors: true, invoker: "public" }, (req, res) => {
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
