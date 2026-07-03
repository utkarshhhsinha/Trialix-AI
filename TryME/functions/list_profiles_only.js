const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "aura-ai-powered-fashion-aura"
  });
}
const db = admin.firestore();

async function listAllProfiles() {
  const snap = await db.collection('profiles').get();
  console.log("Total profiles:", snap.size);
  snap.forEach(doc => {
    console.log(`Profile UID: ${doc.id}`);
    console.log("  data:", doc.data());
  });
}

listAllProfiles().catch(console.error);
