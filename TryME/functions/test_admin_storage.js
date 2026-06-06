const admin = require('firebase-admin');

// Initialize admin SDK using Application Default Credentials
admin.initializeApp({
  projectId: 'aura-ai-powered-fashion-aura',
  storageBucket: 'aura-ai-powered-fashion-aura.firebasestorage.app'
});

const bucket = admin.storage().bucket();

async function run() {
  console.log("Listing files in bucket...");
  try {
    const [files] = await bucket.getFiles({ prefix: 'base-photos/' });
    console.log(`Found ${files.length} files under base-photos/:`);
    for (const file of files) {
      console.log(`- Name: ${file.name}`);
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;
      console.log(`  Public URL: ${publicUrl}`);
      
      // Let's test fetching it anonymously
      console.log(`  Testing anonymous GET...`);
      try {
        const res = await fetch(publicUrl);
        console.log(`  GET Status: ${res.status}`);
        if (res.status !== 200) {
          const text = await res.text();
          console.log(`  GET Error response: ${text.substring(0, 200)}`);
        }
      } catch (fetchErr) {
        console.error(`  GET failed:`, fetchErr.message);
      }
    }
  } catch (err) {
    console.error("Admin storage error:", err);
  }
}

run();
