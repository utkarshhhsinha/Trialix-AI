const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const jpeg = require("jpeg-js");

if (!admin.apps.length) admin.initializeApp();

// ── Garment catalog (server-side copy)
const GARMENT_CATALOG = [
  { id: 'm1', title: 'Striped Formal Blue Shirt', brand: 'Arrow', priceINR: '2,299', category: 'upper_body', imageUrl: '/clothes/men/shirt_1.png', buyLink: 'https://dl.flipkart.com/dl/arrow-men-striped-formal-blue-shirt/p/itm841d0f1b080b5?pid=SHTH562ZZZUASAP4&lid=LSTSHTH562ZZZUASAP4XLTBGG&marketplace=FLIPKART&q=mens+shirts&store=clo/ash/axc/mmk&srno=s_1_12&otracker=search&otracker1=search&fm=Search&iid=en_466mtm31ulngWMmNRkwpf7FcmIeupNYSfUeiDqpnoclC3cF0zRpFaMKm3VyhpzGv40n90zY78i1LOJzSslDuptWlIFuVM3oDZCWrybBVqWAeoRf8toT9hRh6WHXRxPML&ppt=sp&ppn=sp&ssid=hggjaf20t60q8glc1782995521394&qH=101e209a16ec881b&ov_redirect=true&_refId=&_appId=CL', gender: 'male' },
  { id: 'm2', title: 'Solid Formal Green Shirt', brand: 'Arrow', priceINR: '2,499', category: 'upper_body', imageUrl: '/clothes/men/shirt_2.png', buyLink: 'https://dl.flipkart.com/dl/arrow-men-solid-formal-green-shirt/p/itm49fdde235c895?pid=SHTHE25FY4VZGHYP&lid=LSTSHTHE25FY4VZGHYPB02M3D&hl_lid=&marketplace=FLIPKART&fm=eyJ3dHAiOiJyZWNvIiwicHJwdCI6InBwIiwibWlkIjoicHJvZHVjdFJlY29tbWVuZGF0aW9uL3NpbWlsYXIifQ==&_refId=&_appId=CL', gender: 'male' },
  { id: 'm3', title: 'Checkered Casual Blue Shirt', brand: 'The Souled Store', priceINR: '1,799', category: 'upper_body', imageUrl: '/clothes/men/shirt_3.png', buyLink: 'https://dl.flipkart.com/dl/souled-store-men-checkered-casual-blue-shirt/p/itm78b3ed96b53d9?pid=SHTHZBZAJWFVRZNZ&lid=LSTSHTHZBZAJWFVRZNZVTV7RO&marketplace=FLIPKART&q=shirts+for+men+&store=clo/ash/axc/mmk&srno=s_1_30&otracker=search&otracker1=search&fm=Search&iid=6a772444-5bb4-4c11-9f5c-a41c9dc862e0.SHTHZBZAJWFVRZNZ.SEARCH&ppt=sp&ppn=sp&ssid=kg8yapcxkx3kn37k1782995709428&qH=765b7aa0bb0beefa&ov_redirect=true&_refId=&_appId=CL', gender: 'male' },
  { id: 'm4', title: 'Checkered Casual Light Blue Shirt', brand: 'The Souled Store', priceINR: '1,899', category: 'upper_body', imageUrl: '/clothes/men/shirt_4.png', buyLink: 'https://dl.flipkart.com/dl/souled-store-men-checkered-casual-light-blue-shirt/p/itmfcc5c00242042?pid=SHTHZD9UXMF9EDST&lid=LSTSHTHZD9UXMF9EDSTUCCHBJ&hl_lid=&marketplace=FLIPKART&fm=eyJ3dHAiOiJyZWNvIiwicHJwdCI6InBwIiwibWlkIjoicHJvZHVjdFJlY29tbWVuZGF0aW9uL3NpbWlsYXIifQ==&_refId=&_appId=CL', gender: 'male' },
  { id: 'm5', title: 'Solid Casual Yellow Shirt', brand: 'U.S. Polo Assn.', priceINR: '2,199', category: 'upper_body', imageUrl: '/clothes/men/shirt_5.png', buyLink: 'https://dl.flipkart.com/dl/u-s-polo-assn-men-solid-casual-yellow-shirt/p/itmaf7964764f9ba?pid=SHTGJ5VZXQSNU8S8&lid=LSTSHTGJ5VZXQSNU8S8XTP2UD&marketplace=FLIPKART&q=shirts+for+men+&store=clo/ash/axc/mmk&srno=s_1_34&otracker=search&otracker1=search&fm=Search&iid=6a772444-5bb4-4c11-9f5c-a41c9dc862e0.SHTGJ5VZXQSNU8S8.SEARCH&ppt=sp&ppn=sp&ssid=kg8yapcxkx3kn37k1782995709428&qH=765b7aa0bb0beefa&ov_redirect=true&_refId=&_appId=CL', gender: 'male' },
  { id: 'm6', title: 'Solid Casual Brown Shirt', brand: 'U.S. Polo Assn.', priceINR: '2,399', category: 'upper_body', imageUrl: '/clothes/men/shirt_6.png', buyLink: 'https://dl.flipkart.com/dl/u-s-polo-assn-men-solid-casual-brown-shirt/p/itm1f6a030ed9c9a?pid=SHTGKYXPSA85RSNF&lid=LSTSHTGKYXPSA85RSNFAC9KLN&hl_lid=&marketplace=FLIPKART&fm=eyJ3dHAiOiJyZWNvIiwicHJwdCI6InBwIiwibWlkIjoicHJvZHVjdFJlY29tbWVuZGF0aW9uL3NpbWlsYXIifQ==&_refId=&_appId=CL', gender: 'male' },
  { id: 'm7', title: 'Solid Casual Dark Brown Shirt', brand: 'U.S. Polo Assn.', priceINR: '2,299', category: 'upper_body', imageUrl: '/clothes/men/shirt_7.png', buyLink: 'https://dl.flipkart.com/dl/u-s-polo-assn-men-solid-casual-brown-shirt/p/itm67929225562cb?pid=SHTHB4SVSKFGZFHF&lid=LSTSHTHB4SVSKFGZFHFV1PVEB&hl_lid=&marketplace=FLIPKART&fm=eyJ3dHAiOiJyZWNvIiwicHJwdCI6InBwIiwibWlkIjoicHJvZHVjdFJlY29tbWVuZGF0aW9uL3NpbWlsYXIifQ==&_refId=&_appId=CL', gender: 'male' },
  { id: 'm8', title: 'Solid Casual Grey Shirt', brand: 'Rare Rabbit', priceINR: '2,799', category: 'upper_body', imageUrl: '/clothes/men/shirt_8.png', buyLink: 'https://dl.flipkart.com/dl/rare-rabbit-men-solid-casual-grey-shirt/p/itm3e5e30e57b349?pid=SHTHMAQXDHHWACTH&lid=LSTSHTHMAQXDHHWACTHSWZCNY&marketplace=FLIPKART&q=mens+shirts&store=clo/ash/axc/mmk&srno=s_1_14&otracker=search&otracker1=search&fm=Search&iid=e14a92ff-9f0e-4e6a-a59d-5d6606b5dd55.SHTHMAQXDHHWACTH.SEARCH&ppt=sp&ppn=sp&qH=101e209a16ec881b&ov_redirect=true&_refId=&_appId=CL', gender: 'male' },
  { id: 'm9', title: 'Printed Straight Kurta', brand: 'Manyavar', priceINR: '2,999', category: 'upper_body', imageUrl: '/clothes/men/kurta_1.png', buyLink: 'https://dl.flipkart.com/dl/diwas-manyavar-men-printed-straight-kurta/p/itm883654bbe887f?pid=KTAHDNT8BSQDRMVC&lid=LSTKTAHDNT8BSQDRMVCIIO428&marketplace=FLIPKART&q=kurta+for+men&store=clo/cfv/cib/jks&srno=s_1_2&otracker=search&otracker1=search&fm=Search&iid=en_xHLtr389GlnWxT9vw4NMbxxIg5TSMVU26XFPg3xpcwDxB71O03k2pPFQSs0NYTvlzEs5a-PumP3ZJhV5Sw7UBQUHLSogkPwwg2qEww12zCXSc0Eu70dQsgXqsS2tyvZF&ppt=sp&ppn=sp&ssid=23okcgagryybrabk1782995815480&qH=dca85cb44dee308e&ov_redirect=true&_refId=&_appId=CL', gender: 'male' },
  { id: 'm10', title: 'Embroidered Straight Kurta', brand: 'House of Pataudi', priceINR: '3,299', category: 'upper_body', imageUrl: '/clothes/men/kurta_2.png', buyLink: 'https://dl.flipkart.com/dl/house-pataudi-men-embroidered-straight-kurta/p/itm76a08a10766d1?pid=KTAHNMGSGD4DYJEF&lid=LSTKTAHNMGSGD4DYJEF3EKT9B&marketplace=FLIPKART&q=kurta+for+men&store=clo/cfv/cib/jks&srno=s_1_9&otracker=search&otracker1=search&fm=Search&iid=03323654-4185-4b74-b8f7-306bfe7ddcd5.KTAHNMGSGD4DYJEF.SEARCH&ppt=sp&ppn=sp&qH=dca85cb44dee308e&ov_redirect=true&_refId=&_appId=CL', gender: 'male' },
  { id: 'm11', title: 'Self-Design Straight Kurta', brand: 'Manyavar', priceINR: '3,199', category: 'upper_body', imageUrl: '/clothes/men/kurta_3.png', buyLink: 'https://dl.flipkart.com/dl/diwas-manyavar-men-self-design-straight-kurta/p/itmc54b52c9b1721?pid=KTAHANZPFJYYTE9V&lid=LSTKTAHANZPFJYYTE9VYBOLQI&marketplace=FLIPKART&q=kurta+for+men&store=clo/cfv/cib/jks&srno=s_1_11&otracker=search&otracker1=search&fm=Search&iid=en_xHLtr389GlnWxT9vw4NMbxxIg5TSMVU26XFPg3xpcwBuDizuya9tekWUbwn7hZAH-uVutICOGzKzjwACumUK7soV-NeA8mPUKz20_ob3cp9gMeWLCFkQTtmKQBqwABMr&ppt=sp&ppn=sp&qH=dca85cb44dee308e&ov_redirect=true&_refId=&_appId=CL', gender: 'male' },
  { id: 'm12', title: 'Printed Straight Kurta', brand: 'House of Sanskruti', priceINR: '2,599', category: 'upper_body', imageUrl: '/clothes/men/kurta_4.png', buyLink: 'https://dl.flipkart.com/dl/house-sanskruti-men-printed-straight-kurta/p/itm2261d60a44fb4?pid=KTAHE6G3MW4NHWSJ&lid=LSTKTAHE6G3MW4NHWSJHDFSV9&marketplace=FLIPKART&q=kurta+for+men&store=clo/cfv/cib/jks&srno=s_1_25&otracker=search&otracker1=search&fm=Search&iid=03323654-4185-4b74-b8f7-306bfe7ddcd5.KTAHE6G3MW4NHWSJ.SEARCH&ppt=sp&ppn=sp&qH=dca85cb44dee308e&ov_redirect=true&_refId=&_appId=CL', gender: 'male' },
  // ── Women's tops (19 items)
  { id: 'wt1', title: 'Green Floral Peplum Top', brand: 'Rain & Rainbow', priceINR: '699', category: 'upper_body', imageUrl: '/clothes/women/top1.png', tryOnImageUrl: '/clothes/women/tryon_top1.png', buyLink: 'https://rainandrainbow.com/products/green-floral-printed-sleeveless-peplum-pure-cotton-top?variant=50380853510447&country=IN&currency=INR', gender: 'female' },
  { id: 'wt2', title: 'Purple Dress', brand: 'Tokyo Talkies', priceINR: '999', category: 'dresses', imageUrl: '/clothes/women/top2.png', tryOnImageUrl: '/clothes/women/tryon_purple_dress.png', buyLink: 'https://www.limeroad.com/purple-dress-tokyo-talkies-p22470795?imgIdx=0&src_id=merge_feed_story__3&reference_story_id=69f9cac2c95a470722a438c1', gender: 'female' },
  { id: 'wt3', title: 'Marham Bell Sleeves Kurti', brand: 'Evara', priceINR: '1,299', category: 'upper_body', imageUrl: '/clothes/women/top3.png', tryOnImageUrl: '/clothes/women/tryon_top3.png', buyLink: 'https://evara.me/products/marham-bell-sleeves-kurti?variant=46413089046699&country=IN&currency=INR', gender: 'female' },
  { id: 'wt4', title: 'Pastel Pink Chikankari Kurta', brand: 'Shanaya', priceINR: '1,499', category: 'upper_body', imageUrl: '/clothes/women/top4.png', tryOnImageUrl: '/clothes/women/tryon_pink_kurta.png', buyLink: 'https://shanaya.in/Pastel-Pink-Georgette-Chikankari-Embroidery-Kurta-With-Pant--/catalogue/e0jmeHw3/BEwXaj2Y', gender: 'female' },
  { id: 'wt5', title: 'Cream Floral Kurta Set', brand: 'Vastrakaala', priceINR: '1,899', category: 'upper_body', imageUrl: '/clothes/women/top5.png', tryOnImageUrl: '/clothes/women/tryon_top5.png', buyLink: 'https://vastrakaala.com/products/cream-floral-printed-kurta-set-with-matching-dupatta-copy?currency=INR&country=IN&variant=51707841675583', gender: 'female' },
  { id: 'wt6', title: 'Green Floral Empire Top', brand: 'Rain & Rainbow', priceINR: '599', category: 'upper_body', imageUrl: '/clothes/women/top6.png', tryOnImageUrl: '/clothes/women/tryon_top6.png', buyLink: 'https://rainandrainbow.com/products/women-green-floral-printed-pure-cotton-empire-tops?variant=49987890512175&country=IN&currency=INR', gender: 'female' },
  { id: 'wt7', title: 'Poshak Mal White Kurta Set', brand: 'Bullion Knot', priceINR: '2,199', category: 'upper_body', imageUrl: '/clothes/women/top7.png', tryOnImageUrl: '/clothes/women/tryon_top7.png', buyLink: 'https://www.bullionknot.com/products/poshak-mal-cotton-white-kurta-set?variant=44980776698032&country=IN&currency=INR', gender: 'female' },
  { id: 'wt8', title: 'Grace in Ivory Kurti Set', brand: 'Jaipur Kurta', priceINR: '2,499', category: 'upper_body', imageUrl: '/clothes/women/top8.png', tryOnImageUrl: '/clothes/women/tryon_ivory_kurti.png', buyLink: 'https://jaipurkurta.com/products/grace-in-ivory-minimalist-elegance-kurti-set?variant=43579451048029&country=IN&currency=INR', gender: 'female' },
  { id: 'wt9', title: 'Grace in Ivory Minimalist Kurti', brand: 'Jaipur Kurta', priceINR: '2,499', category: 'upper_body', imageUrl: '/clothes/women/top9.png', tryOnImageUrl: '/clothes/women/tryon_ivory_kurti.png', buyLink: 'https://jaipurkurta.com/products/grace-in-ivory-minimalist-elegance-kurti-set?variant=43579451048029&country=IN&currency=INR', gender: 'female' },
  { id: 'wt10', title: 'Animal Print Kurta with Palazzos', brand: 'Lookmark', priceINR: '1,599', category: 'upper_body', imageUrl: '/clothes/women/top10.png', buyLink: 'https://www.myntra.com/kurta-sets/lookmark/lookmark-women-animal-printed-regular-a-line-calf-length-kurta-with-palazzos/34018371/buy', gender: 'female' },
  { id: 'wt11', title: 'Print Crop Top', brand: 'Moda Rapido', priceINR: '799', category: 'upper_body', imageUrl: '/clothes/women/top11.png', buyLink: 'https://www.myntra.com/tops/moda+rapido/moda-rapido-print-crop-top/42428516/buy', gender: 'female' },
  { id: 'wt12', title: 'Bow Top', brand: 'Savana', priceINR: '1,099', category: 'upper_body', imageUrl: '/clothes/women/top12.png', buyLink: 'https://www.savana.com/details/bow-top-1781682?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=25&skcPGs=293870-393317', gender: 'female' },
  { id: 'wt13', title: 'Placket Blouse', brand: 'Savana', priceINR: '999', category: 'upper_body', imageUrl: '/clothes/women/top13.png', buyLink: 'https://www.savana.com/details/placket-blouse-2130912?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=2&skcPGs=350587-453870', gender: 'female' },
  { id: 'wt14', title: 'Lace Trimmed Wrap Top', brand: 'Savana', priceINR: '1,199', category: 'upper_body', imageUrl: '/clothes/women/top14.png', buyLink: 'https://www.savana.com/details/lace-trimmed-wrap-top-1987182?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=16&skcPGs=326547-433777', gender: 'female' },
  { id: 'wt15', title: 'Asymmetric Top', brand: 'Savana', priceINR: '899', category: 'upper_body', imageUrl: '/clothes/women/top15.png', buyLink: 'https://www.savana.com/details/asymmetric-top-1998762?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&skcPGs=328549-430305&vid=318', gender: 'female' },
  { id: 'wt16', title: 'Draped Top', brand: 'Savana', priceINR: '849', category: 'upper_body', imageUrl: '/clothes/women/top16.png', buyLink: 'https://www.savana.com/details/draped-top-1602882?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=6&skcPGs=266174-413087', gender: 'female' },
  { id: 'wt17', title: 'Draped Top (Alt)', brand: 'Savana', priceINR: '849', category: 'upper_body', imageUrl: '/clothes/women/top17.png', buyLink: 'https://www.savana.com/details/draped-top-1602882?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=6&skcPGs=266174-413087', gender: 'female' },
  { id: 'wt18', title: 'Sequin Embroidered Tank Top', brand: 'Savana', priceINR: '1,499', category: 'upper_body', imageUrl: '/clothes/women/top18.png', buyLink: 'https://www.savana.com/details/sequin-embroidered-tank-top-2096502?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&skcPGs=367590-470053&vid=1', gender: 'female' },
  { id: 'wt19', title: 'Gathered Top', brand: 'Savana', priceINR: '949', category: 'upper_body', imageUrl: '/clothes/women/top19.png', tryOnImageUrl: '/clothes/women/tryon_top1.png', buyLink: 'https://www.savana.com/details/gathered-top-1801422?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=3&skcPGs=307652-406989', gender: 'female' },
];

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function getAbsoluteUrl(url) {
  if (!url) return '';
  if (url.startsWith('/')) {
    return `https://aura-ai-powered-fashion-aura.web.app${url}`;
  }
  if (url.includes('localhost:5173')) {
    return url.replace(/https?:\/\/localhost:5173/, 'https://aura-ai-powered-fashion-aura.web.app');
  }
  return url;
}

async function urlToBase64(url) {
  const absoluteUrl = getAbsoluteUrl(url);
  const res = await fetch(absoluteUrl);
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

  const firebaseKey = process.env.FB_API_KEY || process.env.GEMINI_API_KEY || "AIzaSyB9EuogsWeMNyBRFAQi_6rIa4D1rL_Z56Y";
  const projectId = process.env.VERTEX_PROJECT_ID || "aura-ai-powered-fashion-aura";


  // Pre-fetch the user photo and garment images in parallel before generation starts.
  // We ALWAYS generate a personalized try-on — catalog tryOnImageUrl values are stock
  // model photos and must never be served as the user's personalized result.
  let humanB64;
  let garmentB64s = [];
  try {
    humanB64 = humanPhotoUrl.startsWith('data:')
      ? humanPhotoUrl.split('base64,')[1]
      : await urlToBase64(humanPhotoUrl);
    garmentB64s = await Promise.all(garments.map(async (g) => {
      return urlToBase64(g.imageUrl);
    }));
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
  // Increased to 3 retries to handle validation failures. Retry with higher temperature if validation fails.
  async function generateOnePick(garment, garmentB64, index, maxRetries = 3) {
    const geminiApiKey = process.env.GEMINI_API_KEY || firebaseKey;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let dataUri;
        const useHighTemp = attempt > 1; // Increase temperature on retry for more creative changes
        
        try {
          logger.log(`[generateDailyPicks] Pick ${index + 1} Attempt ${attempt} calling Vertex AI${useHighTemp ? ' (high temp)' : ''}...`);
          dataUri = await runGeminiFast(firebaseKey, projectId, humanB64, garmentB64, garment.title, garment.category, useHighTemp);
        } catch (fastErr) {
          logger.warn(`[generateDailyPicks] Pick ${index + 1} Attempt ${attempt} Vertex AI failed: ${fastErr.message}`);
          if (geminiApiKey) {
            logger.log(`[generateDailyPicks] Pick ${index + 1} Attempt ${attempt} trying Google AI Studio fallback...`);
            dataUri = await runGeminiStudio(geminiApiKey, humanB64, garmentB64, garment.title, garment.category, useHighTemp);
          } else {
            throw fastErr;
          }
        }

        if (isValidTryOnResult(dataUri, garment.imageUrl, humanB64, garmentB64)) {
          const storageUrl = await uploadDataUri(dataUri, `daily_picks/${uid}/${Date.now()}_${index}`);
          logger.log(`[generateDailyPicks] ✅ Pick ${index + 1} validated and uploaded`);
          return { ...garment, tryOnImageUrl: storageUrl, generatedAt: Date.now() };
        }
        logger.warn(`[generateDailyPicks] ❌ Pick ${index + 1} Attempt ${attempt} validation failed — AI returned original/invalid image`);
        throw new Error("Invalid try-on image returned — AI did not modify the original");
      } catch (e) {
        logger.warn(`[generateDailyPicks] Pick ${index + 1} Attempt ${attempt} failed: ${e.message}`);
        if (attempt < maxRetries) {
          const backoff = 1000 + (attempt * 500); // Progressive backoff: 1.5s, 2s
          await new Promise(r => setTimeout(r, backoff));
        }
      }
    }

    // All attempts failed — DON'T show fallback, skip this pick entirely
    // This forces a new pick to be generated next time instead of showing garment image
    logger.error(`[generateDailyPicks] Pick ${index + 1} completely failed after ${maxRetries} attempts. Skipping this pick.`);
    return null; // Return null so caller can filter it out
  }

  // Run all 3 sequentially to prevent concurrent requests from hitting the Vertex AI 429 rate limit
  const picks = [...placeholderPicks];

  for (let i = 0; i < garments.length; i++) {
    const garment = garments[i];
    logger.log(`[generateDailyPicks] Starting sequential pick ${i + 1}/3: ${garment.title}`);
    
    const result = await generateOnePick(garment, garmentB64s[i], i);
    if (result) {
      picks[i] = result;
      logger.log(`[generateDailyPicks] pick ${i + 1}/3 done (tryOn=${!!result.tryOnImageUrl}): ${garment.title}`);
      await docRef.update({ picks: [...picks], status: 'generating' });
    } else {
      logger.error(`[generateDailyPicks] pick ${i + 1}/3 returned null — skipping`);
    }

    // Add a 2.5 second cooldown between calls to reset the Vertex AI request rate quota
    if (i < garments.length - 1) {
      logger.log(`[generateDailyPicks] Cooldown for 2.5s to prevent 429...`);
      await new Promise(r => setTimeout(r, 2500));
    }
  }

  // Filter out null picks (failed validations)
  const validPicks = picks.filter(p => p !== null && p.tryOnImageUrl);
  
  if (validPicks.length === 0) {
    logger.error('[generateDailyPicks] All picks failed validation. Marking as error.');
    await docRef.update({ status: 'error', picks: [] });
    throw new HttpsError('internal', 'All AI generations failed validation — no valid try-ons produced');
  }

  // Mark ready with only valid picks
  await docRef.update({ status: 'ready', picks: validPicks });

  // Notify user their looks are ready
  await sendFCM('✨ Your looks are ready!', 'Swipe 3 fresh AI outfits picked just for you.');

  return { status: 'ready' };
});

// helper to assert that the try-on result is valid
function isValidTryOnResult(resultUrl, garmentUrl, humanB64 = null, garmentB64 = null) {
  if (!resultUrl) {
    console.warn('[AI Validation] ❌ No result URL');
    return false;
  }

  // Self-heal: extract garment base64 if it was passed in place of garmentUrl
  let resolvedGarmentB64 = garmentB64;
  if (!resolvedGarmentB64 && garmentUrl && garmentUrl.length > 1000 && !garmentUrl.startsWith('http') && !garmentUrl.startsWith('/') && !garmentUrl.startsWith('data:')) {
    resolvedGarmentB64 = garmentUrl;
  } else if (!resolvedGarmentB64 && garmentUrl && garmentUrl.startsWith('data:')) {
    resolvedGarmentB64 = garmentUrl.split('base64,')[1] || '';
  }

  if (resultUrl === garmentUrl) {
    console.warn('[AI Validation] ❌ Result matches garment URL');
    return false;
  }
  if (resultUrl.startsWith("data:") && resultUrl.length < 8000) {
    console.warn('[AI Validation] ❌ Data URI too small');
    return false;
  }
  
  // 🔥 CRITICAL: Visual similarity comparison using jpeg-js (decodes and samples pixel grids)
  if (resultUrl.startsWith('data:image') && humanB64 && humanB64.length > 1000) {
    try {
      const resultB64 = resultUrl.split('base64,')[1] || '';
      
      const humanBuf = Buffer.from(humanB64, 'base64');
      const resultBuf = Buffer.from(resultB64, 'base64');

      // Only run decoded pixel comparison if both buffers are valid JPEGs
      if (humanBuf[0] === 0xFF && humanBuf[1] === 0xD8 && resultBuf[0] === 0xFF && resultBuf[1] === 0xD8) {
        const humanDecoded = jpeg.decode(humanBuf, { useTArray: true });
        const resultDecoded = jpeg.decode(resultBuf, { useTArray: true });

        let totalDistHuman = 0;
        let count = 0;

        const getPixel = (decoded, xPct, yPct) => {
          const x = Math.floor(xPct * (decoded.width - 1));
          const y = Math.floor(yPct * (decoded.height - 1));
          const idx = (y * decoded.width + x) * 4;
          return {
            r: decoded.data[idx],
            g: decoded.data[idx + 1],
            b: decoded.data[idx + 2]
          };
        };

        // Sample a 9x9 grid (81 points) across the visual frame
        for (let gx = 1; gx <= 9; gx++) {
          const xPct = gx / 10;
          for (let gy = 1; gy <= 9; gy++) {
            const yPct = gy / 10;

            const p1 = getPixel(humanDecoded, xPct, yPct);
            const p2 = getPixel(resultDecoded, xPct, yPct);

            const dR = p1.r - p2.r;
            const dG = p1.g - p2.g;
            const dB = p1.b - p2.b;
            const dist = Math.sqrt(dR*dR + dG*dG + dB*dB);

            totalDistHuman += dist;
            count++;
          }
        }

        const avgDistHuman = totalDistHuman / count;
        console.log(`[AI Validation] Average visual distance from Human Photo: ${avgDistHuman.toFixed(2)}`);

        // If the average distance is less than 12.0, the images are visually almost identical
        if (avgDistHuman < 12.0) {
          console.warn(`[AI Validation] ❌ Rejected: Average visual distance from Human is only ${avgDistHuman.toFixed(2)} — AI returned unmodified original image.`);
          return false;
        }

        // Compare visual similarity against garment/product photo
        if (resolvedGarmentB64 && resolvedGarmentB64.length > 1000) {
          const garmentBuf = Buffer.from(resolvedGarmentB64, 'base64');
          if (garmentBuf[0] === 0xFF && garmentBuf[1] === 0xD8) {
            const garmentDecoded = jpeg.decode(garmentBuf, { useTArray: true });
            let totalDistGarment = 0;

            for (let gx = 1; gx <= 9; gx++) {
              const xPct = gx / 10;
              for (let gy = 1; gy <= 9; gy++) {
                const yPct = gy / 10;

                const p1 = getPixel(garmentDecoded, xPct, yPct);
                const p2 = getPixel(resultDecoded, xPct, yPct);

                const dR = p1.r - p2.r;
                const dG = p1.g - p2.g;
                const dB = p1.b - p2.b;
                const dist = Math.sqrt(dR*dR + dG*dG + dB*dB);

                totalDistGarment += dist;
              }
            }

            const avgDistGarment = totalDistGarment / count;
            console.log(`[AI Validation] Average visual distance from Garment Photo: ${avgDistGarment.toFixed(2)}`);

            if (avgDistGarment < 12.0) {
              console.warn(`[AI Validation] ❌ Rejected: Average visual distance from Garment is only ${avgDistGarment.toFixed(2)} — AI returned unmodified product photo.`);
              return false;
            }
          }
        }
      } else {
        // Fallback: binary check if not both JPEGs
        const lenDiff = Math.abs(resultB64.length - humanB64.length);
        const threshold = humanB64.length * 0.02;
        if (lenDiff < threshold && resultB64.slice(0, 500) === humanB64.slice(0, 500)) {
          console.warn('[AI Validation] ❌ Rejected: Fallback binary comparison matches original');
          return false;
        }
      }
    } catch (err) {
      console.warn('[AI Validation] Visual distance check failed:', err.message);
      // Fallback: simple length check
      const resultB64 = resultUrl.split('base64,')[1] || '';
      if (Math.abs(resultB64.length - humanB64.length) < humanB64.length * 0.01) {
        return false;
      }
    }
  }
  
  console.log('[AI Validation] ✅ Result passed all checks');
  return true;
}

async function runGeminiFast(firebaseKey, projectId, humanB64, garmentB64, title, category, useHighTemp = false) {
  const geminiApiKey = process.env.GEMINI_API_KEY || firebaseKey;
  if (geminiApiKey) {
    try {
      logger.log(`[AI Backend] runGeminiFast trying Google AI Studio first...`);
      return await runGeminiStudio(geminiApiKey, humanB64, garmentB64, title, category, useHighTemp);
    } catch (studioErr) {
      logger.warn(`[AI Backend] runGeminiFast Google AI Studio failed: ${studioErr.message}`);
    }
  }
  return runVertexAI(humanB64, garmentB64, title, category, projectId, useHighTemp);
}

async function runGeminiStudio(geminiApiKey, humanB64, garmentB64, title, category, useHighTemp = false) {
  const isLowerBody = category === 'lower_body';
  const isDress = category === 'dress' || category === 'dresses';

  const region = isLowerBody ? 'lower body (below waist)'
    : isDress ? 'entire body (top + bottom)'
      : 'upper body (torso and arms)';

  const stripList = isLowerBody
    ? 'pants, trousers, palazzos, skirt, leggings, or any bottom garment'
    : isDress
      ? 'any clothing at all — kurti, top, saree, dupatta, lehenga, palazzos, jeans — everything'
      : 'kurti, kurta, top, shirt, blouse, saree blouse, jacket, dupatta, or any upper-body garment';

  const outputState = isLowerBody
    ? `The person is wearing their original top, but their bottom garment has been completely replaced by the item from Image 2.`
    : isDress
      ? `The person is wearing ONLY the dress from Image 2. No other clothing is visible.`
      : `The person is wearing ONLY the garment from Image 2 on their upper body. Their lower half is unchanged from Image 1.`;

  const prompt = `VIRTUAL TRY-ON AI — YOU MUST GENERATE A NEW IMAGE. DO NOT RETURN THE ORIGINAL.

CRITICAL RULES:
1. TARGET AREA: Replace the person's ${region} clothing completely.
2. ERASE OLD CLOTHES FIRST: The original ${stripList} in Image 1 must be 100% REMOVED before drawing the new garment.
3. NO LAYERING: Do NOT blend or overlay. The old clothes must disappear completely.
4. DRAW NEW GARMENT: Apply the EXACT garment from Image 2 onto the person's body. Match its color, pattern, fabric, fit perfectly.
5. EXPOSE SKIN: If Image 2 shows bare arms/shoulders/neck, the person's skin MUST be visible there. Erase old sleeves/necklines.
6. PRESERVE FACE: Keep face, hair, pose, background 100% identical to Image 1.
7. ADD WATERMARK: Place a subtle text watermark "styled by 🔍 oraneo" in the bottom-right corner (small, elegant, semi-transparent).
8. VALIDATE OUTPUT: The output image MUST look visibly different from Image 1. The clothing MUST have changed. DO NOT return Image 1 unmodified.

Garment: ${title || 'item shown in Image 2'}

IF YOU CANNOT PERFORM THE SWAP, DO NOT RETURN IMAGE 1. Generate a visibly different result or fail.
Output: Ultra-realistic 4K portrait with watermark "styled by 🔍 oraneo"`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${geminiApiKey}`;

  const requestBody = {
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
      temperature: useHighTemp ? 0.7 : 0.25, // Higher temp on retry to force different output
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (imagePart?.inlineData?.data) {
    return `data:${imagePart.inlineData.mimeType || 'image/jpeg'};base64,${imagePart.inlineData.data}`;
  }
  throw new Error('Google AI Studio returned no image data');
}


// Vertex AI logic matching client implementation (billed to Google Cloud credits)
/**
 * getGCPAccessToken — fetches a short-lived OAuth2 access token from the GCP metadata server.
 * This works in any Cloud Functions/Cloud Run environment without needing an API key.
 * The service account must have the "Vertex AI User" role in IAM.
 */
async function getGCPAccessToken() {
  const metaUrl = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
  const res = await fetch(metaUrl, { headers: { 'Metadata-Flavor': 'Google' } });
  if (!res.ok) throw new Error(`Metadata server error: ${res.status}`);
  const json = await res.json();
  return json.access_token;
}

/**
 * runVertexAI — calls Vertex AI using the Cloud Function's service account token.
 * Model: gemini-2.0-flash (supports image output via responseModalities).
 * Endpoint: us-central1-aiplatform.googleapis.com (standard Vertex AI REST API)
 */
async function runVertexAI(humanB64, garmentB64, desc, category, projectId, useHighTemp = false) {
  const isLowerBody = category === 'lower_body';
  const isDress = category === 'dress' || category === 'dresses';

  const region = isLowerBody ? 'lower body (below waist)'
    : isDress ? 'entire body (top + bottom)'
      : 'upper body (torso and arms)';

  const stripList = isLowerBody
    ? 'pants, trousers, palazzos, skirt, leggings, or any bottom garment'
    : isDress
      ? 'any clothing at all — kurti, top, saree, dupatta, lehenga, palazzos, jeans — everything'
      : 'kurti, kurta, top, shirt, blouse, saree blouse, jacket, dupatta, or any upper-body garment';

  const outputState = isLowerBody
    ? `The person is wearing their original top, but their bottom garment has been completely replaced by the item from Image 2.`
    : isDress
      ? `The person is wearing ONLY the dress from Image 2. No other clothing is visible.`
      : `The person is wearing ONLY the garment from Image 2 on their upper body. Their lower half is unchanged from Image 1.`;

  const prompt = `VIRTUAL TRY-ON — CRITICAL CLOTHING SWAP INSTRUCTIONS:
1. TARGET AREA: Replace the person's ${region} clothing.
2. REMOVE OLD CLOTHING: The original shirt/top the person is wearing in Image 1 (including its patterns, colors, collar, and sleeves) must be 100% REMOVED and ERASED.
3. NO BLENDING/LAYERING: Do NOT merge, blend, overlay, or layer the garment from Image 2 over the original clothing. The original clothing must be completely gone, not showing underneath or around the new garment.
4. DRAW NEW GARMENT: Draw the exact garment from Image 2 onto the person's body. Ensure its color, fabric, fit, and style are identical to Image 2.
5. EXPOSE BARE SKIN: If the garment in Image 2 is sleeveless, short-sleeved, or has a different neckline, the person's arms, shoulders, and chest must be shown as bare skin, completely erasing the original sleeves and neckline.
6. PRESERVE IDENTITY: Keep the face, hair, smile, head, pose, background, and lighting of the person in Image 1 100% identical and unchanged.
7. NO DUPLICATES: Do NOT include any second person, model, or face from Image 2.

Garment: ${desc || 'item in Image 2'}
Output: Ultra-realistic, pixel-perfect 4K fashion portrait.`;

  const requestBody = {
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
      temperature: useHighTemp ? 0.7 : 0.25, // Higher temp on retry to force different output
    },
  };

  const project = projectId || process.env.VERTEX_PROJECT_ID || 'aura-ai-powered-fashion-aura';
  const location = 'us-central1';

  const models = [
    'gemini-2.5-flash-image',
  ];


  // Get OAuth2 token from GCP metadata server (uses the Cloud Function's service account)
  logger.log('[AI Backend] Fetching GCP OAuth2 access token from metadata server...');
  const accessToken = await getGCPAccessToken();
  logger.log('[AI Backend] Got access token ✓');

  for (const model of models) {
    const vertexUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
    logger.log(`[AI Backend] → Calling Vertex AI: ${model}...`);

    let attempts = 0;
    let success = false;
    let res;
    while (attempts < 3 && !success) {
      res = await fetch(vertexUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (res.status === 429) {
        attempts++;
        const backoff = attempts * 2000;
        logger.warn(`[AI Backend] ${model} rate limited (429). Retrying in ${backoff / 1000}s (attempt ${attempts}/3)...`);
        await new Promise(r => setTimeout(r, backoff));
      } else {
        success = true;
      }
    }

    if (res.status === 429) {
      logger.error(`[AI Backend] ${model} failed after 3 retries due to 429 rate limit.`);
      continue;
    }

    const responseText = await res.text();
    let data;
    try { data = JSON.parse(responseText); } catch (e) {
      logger.warn(`[AI Backend] ${model} returned non-JSON: ${responseText.slice(0, 200)}`);
      continue;
    }

    if (!res.ok) {
      logger.warn(`[AI Backend] ${model} error: ${data?.error?.message || `HTTP ${res.status}`}`);
      continue;
    }

    const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (imagePart?.inlineData?.data) {
      logger.log(`[AI Backend] ✅ Image generated successfully with ${model}`);
      return `data:${imagePart.inlineData.mimeType || 'image/jpeg'};base64,${imagePart.inlineData.data}`;
    }

    const textPart = data.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart?.text) {
      logger.warn(`[AI Backend] ${model} returned text: "${textPart.text.slice(0, 120)}"`);
      continue;
    }

    const finishReason = data.candidates?.[0]?.finishReason;
    logger.warn(`[AI Backend] ${model} returned no image. finishReason=${finishReason}`);
  }

  throw new HttpsError('internal', 'All Vertex AI models failed to generate an image.');
}

exports.generateTryOn = onCall({
  cors: true,
  invoker: "public",
  concurrency: 80,           // Each instance handles 80 concurrent requests
  minInstances: 2,           // 2 warm instances always ready (no cold starts)
  maxInstances: 100,         // Scale to 100 × 80 = 8,000 concurrent requests
  timeoutSeconds: 120,       // Allow 2 minutes for generation
  memory: '1GiB'             // Required for base64 image processing
}, async (request) => {
  let { humanB64, garmentB64, humanUrl, garmentUrl, desc, category } = request.data || {};

  if (!humanB64 && humanUrl) {
    try {
      humanB64 = await urlToBase64(humanUrl);
    } catch (e) {
      throw new HttpsError("invalid-argument", "Failed to resolve humanUrl to base64: " + e.message);
    }
  }
  if (!garmentB64 && garmentUrl) {
    try {
      garmentB64 = await urlToBase64(garmentUrl);
    } catch (e) {
      throw new HttpsError("invalid-argument", "Failed to resolve garmentUrl to base64: " + e.message);
    }
  }

  if (!humanB64 || !garmentB64) {
    throw new HttpsError("invalid-argument", "Missing required parameters humanB64/humanUrl or garmentB64/garmentUrl");
  }

  const projectId = process.env.VERTEX_PROJECT_ID || 'aura-ai-powered-fashion-aura';
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.FB_API_KEY;

  let outputDataUri = null;
  let lastErr = null;

  // PRIMARY: Vertex AI gemini-2.5-flash-image (GCP credits, scalable)
  try {
    logger.log('[AI Backend] PRIMARY: Vertex AI gemini-2.5-flash-image...');
    outputDataUri = await runVertexAI(humanB64, garmentB64, desc || 'fashion garment', category, projectId);
    if (outputDataUri && isValidTryOnResult(outputDataUri, garmentB64, humanB64)) {
      return { tryOnImageUrl: outputDataUri };
    }
  } catch (err) {
    logger.warn('[AI Backend] Vertex AI gemini-2.5-flash-image failed:', err.message);
    lastErr = err;
  }

  // FALLBACK: Try Google AI Studio gemini-2.0-flash-preview-image-generation
  if (geminiApiKey) {
    try {
      logger.log('[AI Backend] FALLBACK: Google AI Studio gemini-2.0-flash-preview-image-generation...');
      outputDataUri = await runGeminiStudio(geminiApiKey, humanB64, garmentB64, desc || 'fashion garment', category);
      if (outputDataUri && isValidTryOnResult(outputDataUri, garmentB64, humanB64)) {
        return { tryOnImageUrl: outputDataUri };
      }
    } catch (studioErr) {
      logger.warn('[AI Backend] Google AI Studio failed:', studioErr.message);
      lastErr = studioErr;
    }
  }

  // All models failed — return null (not an error) so caller can gracefully skip this pick
  logger.error('[AI Backend] All models failed. Returning null tryOnImageUrl.');
  return { tryOnImageUrl: null };
});


exports.shareLook = onRequest({ cors: true, invoker: "public" }, (req, res) => {
  const imageUrl = req.query.image || '';
  const desc = req.query.desc || 'AI-Powered Virtual Fashion Try-On';
  const brand = req.query.brand || 'oraneo';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Open Graph Meta Tags for Social Previews (WhatsApp, iMessage, etc.) -->
  <meta property="og:title" content="oraneo - Live AI Try-On Feed" />
  <meta property="og:description" content="Look: ${desc} ${brand ? 'by ' + brand : ''}. Style any outfit in seconds!" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://oraneo.space/share" />
  
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="oraneo - Live AI Try-On Feed" />
  <meta name="twitter:description" content="Look: ${desc} ${brand ? 'by ' + brand : ''}." />
  <meta name="twitter:image" content="${imageUrl}" />

  <title>oraneo - Try-On Look</title>
  
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
      <h1 class="logo-text">oraneo</h1>
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
    
    <a href="https://oraneo.space" class="cta-button">Download oraneo App</a>
  </div>
</body>
</html>`;
  res.status(200).send(html);
});
