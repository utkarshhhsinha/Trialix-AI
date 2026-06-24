/**
 * upload_clothes.js
 * One-time script: uploads local clothing images to Firebase Storage
 * and prints the public download URLs for use in functions/index.js.
 *
 * Run from TryME root: node scripts/upload_clothes.js
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ── Init with service-account or application default credentials ─────────────
// We use the same project id from functions/.env
const PROJECT_ID = 'aura-ai-powered-fashion-aura';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket: `${PROJECT_ID}.appspot.com`,
});

const bucket = admin.storage().bucket();

// ── Image directories ────────────────────────────────────────────────────────
const MEN_SHIRTS_DIR   = path.join(__dirname, '..', 'Clothes', 'Men', 'shirts_men');
const WOMEN_TOPS_DIR   = path.join(__dirname, '..', 'Clothes', 'Women', 'Tops');

async function uploadFile(localPath, storagePath) {
  const ext = path.extname(localPath).toLowerCase();
  const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  const contentType = mimeMap[ext] || 'image/jpeg';

  const file = bucket.file(storagePath);
  await file.save(fs.readFileSync(localPath), { metadata: { contentType } });
  await file.makePublic();

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  return publicUrl;
}

async function uploadDir(dirPath, storagePrefix, label) {
  const files = fs.readdirSync(dirPath).filter(f => /\.(png|jpe?g|webp)$/i.test(f));
  console.log(`\n── Uploading ${files.length} ${label} ──`);
  const results = [];
  for (const filename of files) {
    const localPath = path.join(dirPath, filename);
    const storagePath = `${storagePrefix}/${filename}`;
    try {
      const url = await uploadFile(localPath, storagePath);
      results.push({ filename, url });
      console.log(`  ✔ ${filename}`);
      console.log(`    ${url}`);
    } catch (e) {
      console.error(`  ✗ ${filename}: ${e.message}`);
    }
  }
  return results;
}

async function main() {
  console.log('Uploading clothing catalog to Firebase Storage...\n');
  const menResults   = await uploadDir(MEN_SHIRTS_DIR,  'catalog/men/shirts',   'men\'s shirts');
  const womenResults = await uploadDir(WOMEN_TOPS_DIR,  'catalog/women/tops',   'women\'s tops');

  console.log('\n\n══ COPY THESE URLs INTO functions/index.js ══\n');
  console.log('// ── MEN\'S SHIRTS ──');
  menResults.forEach((r, i) => {
    console.log(`  // ${r.filename}`);
    console.log(`  imageUrl: '${r.url}',`);
  });
  console.log('\n// ── WOMEN\'S TOPS ──');
  womenResults.forEach((r, i) => {
    console.log(`  // ${r.filename}`);
    console.log(`  imageUrl: '${r.url}',`);
  });

  console.log('\n✅ Upload complete!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
