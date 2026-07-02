import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  browserLocalPersistence,
  setPersistence,
  GoogleAuthProvider
} from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "AIzaSyB9EuogsWeMNyBRFAQi_6rIa4D1rL_Z56Y",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "aura-ai-powered-fashion-aura.firebaseapp.com",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "aura-ai-powered-fashion-aura",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "aura-ai-powered-fashion-aura.firebasestorage.app",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "574679078276",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "1:574679078276:android:c50439741ecf0df580f9d1",
};

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {});

export const googleProvider = new GoogleAuthProvider();

export const firestore = getFirestore(firebaseApp);
setLogLevel('error');

export const storage = getStorage(firebaseApp);
export const firebaseFunctions = getFunctions(firebaseApp, "us-central1");

export const uploadBase64Image = async (base64Data, path = 'generations', customFilename = null) => {
  try {
    const filename = customFilename || `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const storageRef = ref(storage, `${path}/${filename}`);
    
    // Upload base64 string
    await uploadString(storageRef, base64Data, 'data_url');
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (err) {
    console.warn('[Firebase Storage Web] Upload failed, falling back:', err.message);
    return base64Data;
  }
};