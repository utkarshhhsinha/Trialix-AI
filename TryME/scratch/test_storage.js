const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadString } = require('firebase/storage');

const firebaseConfig = {
  apiKey: "AIzaSyB9EuogsWeMNyBRFAQi_6rIa4D1rL_Z56Y",
  authDomain: "aura-ai-powered-fashion-aura.firebaseapp.com",
  projectId: "aura-ai-powered-fashion-aura",
  storageBucket: "aura-ai-powered-fashion-aura.appspot.com",
  messagingSenderId: "574679078276",
  appId: "1:574679078276:android:c50439741ecf0df580f9d1",
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

async function test() {
  console.log("Checking upload with appspot.com bucket...");
  try {
    const dummyRef = ref(storage, 'test_dummy.txt');
    console.log("Trying to upload string (unauthenticated, should fail with permission-denied if storage is enabled)...");
    await uploadString(dummyRef, 'Hello World');
    console.log("Upload succeeded!");
  } catch (err) {
    console.error("Storage upload error code:", err.code);
    console.error("Storage upload error message:", err.message);
    console.error("Full error object:", JSON.stringify(err, null, 2));
  }
}

test();
