const { initializeApp } = require('firebase/app');
const { initializeFirestore, collection, query, where, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyB9EuogsWeMNyBRFAQi_6rIa4D1rL_Z56Y",
  authDomain: "aura-ai-powered-fashion-aura.firebaseapp.com",
  projectId: "aura-ai-powered-fashion-aura",
  storageBucket: "aura-ai-powered-fashion-aura.firebasestorage.app",
  messagingSenderId: "574679078276",
  appId: "1:574679078276:android:c50439741ecf0df580f9d1",
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
});

async function check() {
  console.log("Searching for profiles with name 'Kishu'...");
  try {
    const q = query(collection(db, 'profiles'), where('name', '==', 'Kishu'));
    const snap = await getDocs(q);
    if (snap.empty) {
      console.log("No profile found with name 'Kishu'. Let's search all profiles...");
      const allSnap = await getDocs(collection(db, 'profiles'));
      console.log(`Found ${allSnap.size} total profiles:`);
      allSnap.forEach(d => {
        console.log(`- ID: ${d.id}, Name: ${d.data().name}, basePhotoUrl: ${d.data().basePhotoUrl}`);
      });
    } else {
      console.log(`Found ${snap.size} matching profiles:`);
      snap.forEach(d => {
        console.log(`ID: ${d.id}`);
        console.log("Data:", JSON.stringify(d.data(), null, 2));
      });
    }
  } catch (err) {
    console.error("Error searching profiles:", err);
  }
}

check();
