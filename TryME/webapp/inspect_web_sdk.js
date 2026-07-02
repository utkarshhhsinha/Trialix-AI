import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB9EuogsWeMNyBRFAQi_6rIa4D1rL_Z56Y",
  authDomain: "aura-ai-powered-fashion-aura.firebaseapp.com",
  projectId: "aura-ai-powered-fashion-aura",
  storageBucket: "aura-ai-powered-fashion-aura.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching profiles from Firestore via Web SDK...");
  const snap = await getDocs(collection(db, 'profiles'));
  console.log("Total profiles:", snap.size);
  snap.forEach(doc => {
    console.log(`UID: ${doc.id}`);
    console.log("Data:", doc.data());
  });
}

run().catch(console.error);
