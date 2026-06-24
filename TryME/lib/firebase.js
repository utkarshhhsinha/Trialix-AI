import { Platform } from 'react-native';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getReactNativePersistence, 
  initializeAuth, 
  getAuth, 
  browserLocalPersistence,
  connectAuthEmulator
} from 'firebase/auth';
import { initializeFirestore, getFirestore, setLogLevel, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
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
        const persistence = Platform.OS === 'web' 
          ? browserLocalPersistence 
          : getReactNativePersistence(AsyncStorage);
          
        return initializeAuth(firebaseApp, { persistence });
      } catch (e) {
        return getAuth(firebaseApp);
      }
    })()
  : null;

export const firestore = firebaseApp
  ? (() => {
      try {
        const db = initializeFirestore(firebaseApp, {
          // Auto-detect best transport (WebChannel vs long-polling).
          // Avoids the 10s offline error on Android emulators and NAT/VPN setups,
          // without forcing long-polling which can cause issues on some environments.
          experimentalAutoDetectLongPolling: true,
          ignoreUndefinedProperties: true,
        });
        // Suppress verbose WebChannel transport warnings that spam the Metro console.
        setLogLevel('error');
        return db;
      } catch (e) {
        return getFirestore(firebaseApp);
      }
    })()
  : null;
export const storage = firebaseApp ? getStorage(firebaseApp) : null;
export const firebaseFunctions = firebaseApp ? getFunctions(firebaseApp, "us-central1") : null;

if (__DEV__) {
  const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  const useEmulators = process.env.EXPO_PUBLIC_USE_EMULATORS === 'true';

  if (useEmulators) {
    if (firebaseAuth) {
      console.log(`[Firebase] Connecting Auth to local emulator at ${host}:9099`);
      connectAuthEmulator(firebaseAuth, `http://${host}:9099`);
    }
    if (firestore) {
      console.log(`[Firebase] Connecting Firestore to local emulator at ${host}:8080`);
      connectFirestoreEmulator(firestore, host, 8080);
    }
    if (storage) {
      console.log(`[Firebase] Connecting Storage to local emulator at ${host}:9199`);
      connectStorageEmulator(storage, host, 9199);
    }
    if (firebaseFunctions) {
      console.log(`[Firebase] Connecting Functions to local emulator at ${host}:5001`);
      connectFunctionsEmulator(firebaseFunctions, host, 5001);
    }
  }
}

export const uploadBase64Image = async (base64Data, path = 'generations', customFilename = null) => {
  const FileSystem = require('expo-file-system/legacy');
  const token = firebaseAuth?.currentUser ? await firebaseAuth.currentUser.getIdToken() : '';
  const bucketName = firebaseConfig.storageBucket || "aura-ai-powered-fashion-aura.firebasestorage.app";
  
  // Extract base64 part
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 string');
  }
  const b64 = matches[2];
  
  // Write to temporary file
  const tempUri = `${FileSystem.cacheDirectory}temp_upload_${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(tempUri, b64, { encoding: 'base64' });
  
  const filename = customFilename || `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
  const uploadPath = `${path}/${filename}`;
  const encodedPath = encodeURIComponent(uploadPath);
  
  const headers = {
    'Content-Type': 'image/jpeg'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  let activeBucket = bucketName.trim();
  let uploadRes = null;
  let attempt = 1;
  
  while (attempt <= 2) {
    const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(activeBucket).replace(/\./g, '%2E')}/o?uploadType=media&name=${encodedPath}`;
    console.log(`[Firebase REST] Initiating native REST upload (Attempt ${attempt}, bucket: ${activeBucket})...`);
    
    try {
      uploadRes = await FileSystem.uploadAsync(url, tempUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: headers,
      });
      
      if (uploadRes && uploadRes.status === 200) {
        break; // Success!
      }
      
      console.warn(`[Firebase REST] Upload attempt ${attempt} returned status ${uploadRes?.status}: ${uploadRes?.body}`);
    } catch (err) {
      console.warn(`[Firebase REST] Upload attempt ${attempt} caught error:`, err);
    }
    
    // Switch to fallback bucket for attempt 2
    if (attempt === 1) {
      if (activeBucket.endsWith('.firebasestorage.app')) {
        activeBucket = activeBucket.replace('.firebasestorage.app', '.appspot.com');
      } else if (activeBucket.endsWith('.appspot.com')) {
        activeBucket = activeBucket.replace('.appspot.com', '.firebasestorage.app');
      } else {
        // If it does not end with either, try appending .appspot.com
        activeBucket = `${activeBucket}.appspot.com`;
      }
      attempt++;
    } else {
      break;
    }
  }
  
  // Clean up temp file
  await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
  
  if (uploadRes && uploadRes.status === 200) {
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${activeBucket}/o/${encodedPath}?alt=media`;
    console.log('[Firebase REST] SUCCESS! Download URL:', downloadUrl);
    return downloadUrl;
  } else {
    const finalErrBody = uploadRes ? uploadRes.body : 'Network/Communication Error';
    const finalErrStatus = uploadRes ? uploadRes.status : 'Unknown';
    throw new Error(`Firebase REST Upload failed with status ${finalErrStatus}: ${finalErrBody}`);
  }
};

export const firebaseConfigError = isConfigured
  ? null
  : 'Firebase is not configured. Fill EXPO_PUBLIC_FIREBASE_* values in .env and restart Expo.';