import { initializeApp, getApps } from 'firebase/app';
import { getReactNativePersistence, initializeAuth, getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';



const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};


const isConfigured =
  !!firebaseConfig.apiKey &&
  !!firebaseConfig.projectId &&
  !!firebaseConfig.appId &&
  !!firebaseConfig.storageBucket;


export const firebaseApp = isConfigured
  ? getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

export const firebaseAuth = firebaseApp
  ? (() => {
      try {
        return initializeAuth(firebaseApp, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      } catch (e) {
        // Already initialized (e.g. hot reload) — reuse existing instance
        return getAuth(firebaseApp);
      }
    })()
  : null;

export const firestore = firebaseApp
  ? initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    })
  : null;
export const storage = firebaseApp ? getStorage(firebaseApp) : null;

export const firebaseConfigError = isConfigured
  ? null
  : 'Firebase is not configured. Fill EXPO_PUBLIC_FIREBASE_* values in .env and restart Expo.';

