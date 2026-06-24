import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Alert, NativeModules } from 'react-native';
import { Redirect } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseAuth, firestore, firebaseConfigError } from '@/lib/firebase';
import { theme } from '@/constants/theme';

export default function Index() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'no-auth' | 'no-profile' | 'ready'

  useEffect(() => {
    // Check for updates over the air dynamically to avoid local development crashes
    async function checkOTAUps() {
      if (__DEV__) return;
      try {
        // Pre-check native modules existence before require to completely prevent RedBox warnings
        const hasUpdates = NativeModules.ExpoUpdates || global.ExpoModules?.ExpoUpdates;
        if (!hasUpdates) {
          console.log('[Updates] Native Updates module not present in this client, bypassing.');
          return;
        }

        const Updates = require('expo-updates');
        if (!Updates.isEnabled) return;
        
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            'New Update Available! 🚀',
            'A premium new fashion model update is available. Would you like to reload to apply it immediately?',
            [
              { text: 'Later', style: 'cancel' },
              { 
                text: 'Update Now', 
                onPress: async () => {
                  await Updates.reloadAsync();
                } 
              }
            ]
          );
        }
      } catch (err) {
        console.warn('[Updates] OTA Check bypassed:', err.message);
      }
    }
    checkOTAUps();

    let timeoutId = null;
    let isMounted = true;

    async function initAuthCheck() {
      let hasCachedUser = false;
      try {
        const keys = await AsyncStorage.getAllKeys();
        hasCachedUser = keys.some(key => key.startsWith('firebase:authUser'));
      } catch (e) {
        console.warn('AI: Error checking cached auth user:', e.message);
      }

      if (!isMounted) return;

      // If we have a cached session, give it up to 20 seconds to load and verify.
      // Otherwise, if there is no session, redirect to login in 3 seconds.
      const timeoutDuration = hasCachedUser ? 20000 : 3000;

      timeoutId = setTimeout(() => {
        console.warn(`⚡️ AI: Auth check timed out (${timeoutDuration / 1000}s), forcing login screen.`);
        setStatus('no-auth');
      }, timeoutDuration);
    }
    initAuthCheck();
    
    if (!firebaseAuth) {
      console.error('Firebase Auth not initialized in index.jsx');
      setStatus('no-auth');
      if (timeoutId) clearTimeout(timeoutId);
      return;
    }

    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (timeoutId) clearTimeout(timeoutId);
      console.log('Auth state changed:', user ? 'Logged In' : 'No User');
      if (!user) {
        setStatus('no-auth');
        return;
      }
      // Check profile completeness — try cache first (instant, works offline)
      try {
        const { getDocFromCache } = require('firebase/firestore');
        let snap = null;
        try {
          snap = await getDocFromCache(doc(firestore, 'profiles', user.uid));
        } catch (_) {
          // Cache miss — fall back to network
          snap = await getDoc(doc(firestore, 'profiles', user.uid));
        }
        const data = snap?.data?.();
        const storedUrl = data?.basePhotoUrl || '';
        const isRealUpload =
          storedUrl.includes('firebasestorage.googleapis.com') ||
          storedUrl.startsWith('file://') ||
          (storedUrl.startsWith('http') &&
            !storedUrl.includes('googleusercontent.com') &&
            !storedUrl.includes('accounts.google.com'));

        if (snap?.exists?.() && data?.name && isRealUpload) {
          setStatus('ready');
        } else {
          setStatus('no-profile');
        }
      } catch (e) {
        console.warn('AI: Profile check failed (Offline or Permission issue):', e.message);
        // If Firestore is offline, allow them into the app anyway.
        // They can use the AI Studio even without a cloud profile.
        setStatus('ready');
      }
    });

    return () => {
      isMounted = false;
      unsub();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);


  if (status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.primary }}>
        <ActivityIndicator color="white" size="large" />
      </View>
    );
  }

  if (status === 'no-auth') return <Redirect href="/login" />;
  if (status === 'no-profile') return <Redirect href="/profile-setup" />;
  return <Redirect href="/(tabs)/discover" />;
}