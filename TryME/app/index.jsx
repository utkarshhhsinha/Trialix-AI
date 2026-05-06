import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firestore, firebaseConfigError } from '@/lib/firebase';
import { theme } from '@/constants/theme';

export default function Index() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'no-auth' | 'no-profile' | 'ready'

  useEffect(() => {
    // Timeout fallback after 10 seconds for slow networks
    const timeout = setTimeout(() => {
      if (status === 'loading') {
        console.warn('Auth check timed out, falling back to login');
        setStatus('no-auth');
      }
    }, 10000);


    if (!firebaseAuth) {
      console.error('Firebase Auth not initialized in index.jsx');
      setStatus('no-auth');
      clearTimeout(timeout);
      return;
    }

    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      clearTimeout(timeout);
      console.log('Auth state changed:', user ? 'Logged In' : 'No User');
      if (!user) {
        setStatus('no-auth');
        return;
      }
      // Check profile completeness
      try {
        const snap = await getDoc(doc(firestore, 'profiles', user.uid));
        const data = snap.data();
        if (snap.exists() && data?.name && data?.basePhotoUrl) {
          setStatus('ready');
        } else {
          setStatus('no-profile');
        }
      } catch (e) {
        console.warn('AI: Profile check failed (Offline or Permission issue):', e.message);
        // CRITICAL FIX: If Firestore is offline, allow them into the app anyway
        // They can use the AI Studio even if we can't load their cloud profile.
        setStatus('ready');
      }
    });

    return () => {
      unsub();
      clearTimeout(timeout);
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