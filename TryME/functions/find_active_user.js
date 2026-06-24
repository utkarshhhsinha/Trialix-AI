const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'aura-ai-powered-fashion-aura'
});

const db = admin.firestore();

async function run() {
  const uids = ['BoeM07Z7kiTJRY0k1GzKBaBMk0I3', 'UC5PeHZQ7OSdnLdnxJwQTgeItbB2'];
  for (const uid of uids) {
    console.log(`\nChecking user ID: ${uid}...`);
    try {
      const docSnap = await db.collection('profiles').doc(uid).get();
      if (docSnap.exists) {
        const data = docSnap.data();
        console.log(`Name: ${data.name}`);
        console.log(`Aura Points: ${data.auraPoints}`);
        console.log(`Gender: ${data.gender}`);
      } else {
        console.log(`Profile does not exist.`);
      }
      
      const picksSnap = await db.collection('daily_picks').doc(uid).get();
      if (picksSnap.exists) {
        const data = picksSnap.data();
        console.log(`Daily Picks Status: ${data.status}`);
        console.log(`Daily Picks nextBatchAt: ${data.nextBatchAt ? data.nextBatchAt.toDate() : 'none'}`);
        console.log(`Daily Picks seenAt: ${data.seenAt ? data.seenAt.toDate() : 'none'}`);
      } else {
        console.log(`No daily picks document.`);
      }
    } catch (err) {
      console.error(`Error checking user ${uid}:`, err.message);
    }
  }
}

run();
