const { initializeApp } = require('firebase/app');
const { initializeFirestore, doc, getDoc } = require('firebase/firestore');

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

async function test() {
  console.log("Connecting to Firestore with experimentalForceLongPolling...");
  try {
    const snap = await getDoc(doc(db, 'profiles', 'nonexistent_test_user_id'));
    console.log("Success! Read document. Exists:", snap.exists());
  } catch (err) {
    console.error("Error reading Firestore:", err);
  }
}

test();
