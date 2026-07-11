import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, Modal,
  Dimensions, ActivityIndicator, Platform, Share, Alert,
  InteractionManager,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc, onSnapshot, collection, addDoc, serverTimestamp, updateDoc, increment, setDoc, Timestamp,
  query, where, getDocs, deleteDoc,
} from 'firebase/firestore';
import { firebaseAuth, firestore, firebaseFunctions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { uploadBase64Image } from '@/lib/firebase';
import { runVirtualTryOn } from '@/lib/ai_engine';
import { postTryOnToCommunity } from '@/lib/socialActions';
import { theme } from '@/constants/theme';
import { StatusBar } from 'expo-status-bar';
import SwipeDeck from '@/components/SwipeDeck';
import CardReveal from '@/components/CardReveal';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

// Configure notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[discover] Notification permission not granted');
      return false;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    return true;
  } catch (err) {
    console.warn('[discover] Error getting notification permission:', err.message);
    return false;
  }
}

async function scheduleBatchNotification(seconds) {
  try {
    const hasPermission = await registerForPushNotificationsAsync();
    if (!hasPermission) return;

    // Cancel any previous scheduled notifications to avoid double delivery
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => { });

    console.log(`[discover] Scheduling local notification in ${seconds}s`);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Your oraneo Looks are Ready! ✨",
        body: "Tap to view your new personalized AI try-on outfits.",
        sound: true,
        data: { screen: 'discover' },
      },
      trigger: {
        seconds: seconds,
        channelId: 'default',
      },
    });
  } catch (err) {
    console.warn('[discover] Failed to schedule notification:', err.message);
  }
}

const { width: W, height: H } = Dimensions.get('window');
const BATCH_SIZE = 3;

export default function DiscoverScreen() {
  const router = useRouter();
  const deckRef = useRef(null);
  const generatingRef = useRef(false);
  const countdownRef = useRef(null);
  const wishlistDocIdsRef = useRef([]);
  const prevBasePhotoRef = useRef(null); // tracks last seen basePhotoUrl to detect changes

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [picks, setPicks] = useState([]);
  const [nextBatchAt, setNextBatchAt] = useState(null);
  const [status, setStatus] = useState('loading');
  const [swipedCount, setSwipedCount] = useState(0);
  const [deckKey, setDeckKey] = useState(0);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [countdownSecs, setCountdownSecs] = useState(0);
  const [profileTimeout, setProfileTimeout] = useState(false);

  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, u => setUser(u));
  }, []);

  useEffect(() => {
    if (!user || !firestore) return;
    return onSnapshot(doc(firestore, 'profiles', user.uid), snap => {
      if (snap.exists()) {
        const data = snap.data();
        const newPhoto = (data.basePhotoUrl || '').split('&t=')[0];
        const prevPhoto = (prevBasePhotoRef.current || '').split('&t=')[0];
        const photoJustChanged = prevBasePhotoRef.current !== null && newPhoto && prevPhoto && newPhoto !== prevPhoto;

        prevBasePhotoRef.current = data.basePhotoUrl || '';
        setProfile(data);
        setStatus(prev => prev === 'loading'
          ? (data.basePhotoUrl ? 'ready' : 'no-photo')
          : prev);

        // Base photo changed — wipe old picks and force fresh generation
        if (photoJustChanged) {
          console.log('[discover] Base photo changed — clearing picks and forcing regeneration');
          setPicks([]);
          setSwipedCount(0);
          setDeckKey(k => k + 1);
          setShowDoneModal(false);
          setNextBatchAt(null);
          setStatus('ready');
          generatingRef.current = false;
        }
      }
    });
  }, [user]);

  useEffect(() => {
    if (profile || profileTimeout) return;
    const t = setTimeout(() => setProfileTimeout(true), 5000);
    return () => clearTimeout(t);
  }, [profile, profileTimeout]);

  useEffect(() => {
    if (!user || !firestore) return;
    // No getIdToken() needed — Firestore handles auth tokens internally
    const unsub = onSnapshot(
      doc(firestore, 'daily_picks', user.uid),
      snap => {
        if (!snap.exists()) {
          setStatus(prev => prev === 'loading' ? 'ready' : prev);
          return;
        }
        const data = snap.data();
        // Include placeholder picks (imageUrl only) — they show a loading state on the card
        // Guard: Firestore converts arrays to maps when dot-notation updates are used.
        // Safely reconstruct an ordered array: prefer native array, otherwise sort map keys numerically.
        let rawPicks;
        if (Array.isArray(data.picks)) {
          rawPicks = data.picks;
        } else if (data.picks && typeof data.picks === 'object') {
          // Map with keys "0", "1", "2" — sort numerically to preserve order
          rawPicks = Object.keys(data.picks)
            .sort((a, b) => Number(a) - Number(b))
            .map(k => data.picks[k]);
        } else {
          rawPicks = [];
        }
        const allPicks = rawPicks.filter(p => p && (p.tryOnImageUrl || p.imageUrl));
        const nextBatch = data.nextBatchAt?.toMillis?.() ?? (data.nextBatchAt?.seconds ? data.nextBatchAt.seconds * 1000 : null);

        // User already saw this batch — show the cooldown done-screen
        if (data.seenAt && data.status === 'ready' && nextBatch && Date.now() < nextBatch) {
          setNextBatchAt(nextBatch);
          setStatus('ready');
          setShowDoneModal(true);  // show cooldown countdown instead of blank screen
          return;
        }

        if (allPicks.length > 0) {
          setPicks(prev => {
            const prevValid = prev.filter(p => p && (p.tryOnImageUrl || p.imageUrl));
            if (prevValid.length === 0) {
              setSwipedCount(0);
              setDeckKey(k => k + 1);
            }
            return rawPicks;
          });
          setNextBatchAt(nextBatch);
          // Show deck even while generating — cards show spinner for unfinished picks
          setStatus(data.status === 'generating' ? 'generating' : 'ready');
        } else if (data.status === 'generating') {
          setStatus('generating');
        } else if (data.status === 'rate_limited') {
          const retryAt = data.retryAt?.toMillis?.() ?? (data.retryAt?.seconds ? data.retryAt.seconds * 1000 : null);
          setNextBatchAt(retryAt);
          setStatus('rate_limited');
        } else {
          setStatus(prev => prev === 'loading' ? 'ready' : prev);
        }
      },
      () => setStatus(prev => prev === 'loading' ? 'ready' : prev)
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (status !== 'ready') return;

    // Check if the loaded picks match the user's current profile gender
    const gender = (profile?.gender || '').toLowerCase().trim();
    const mismatch = picks.length > 0 && (
      ((gender === 'male' || gender === 'man' || gender === 'men') && !picks[0]?.id?.startsWith('m')) ||
      ((gender === 'female' || gender === 'woman' || gender === 'women') && !picks[0]?.id?.startsWith('wt'))
    );

    if (mismatch) {
      console.log('[discover] Gender mismatch detected, clearing picks to trigger fresh batch...');
      // Clear Firestore daily_picks so we get a clean slate for the new gender
      if (user && firestore) {
        const { deleteDoc, doc } = require('firebase/firestore');
        deleteDoc(doc(firestore, 'daily_picks', user.uid)).catch(() => {});
      }
      setPicks([]);
      return;
    }

    const validPicks = picks.filter(p => p && (p.tryOnImageUrl || p.imageUrl));
    if (validPicks.length > 0) return;
    if (!profile?.basePhotoUrl) { setStatus('no-photo'); return; }
    if (generatingRef.current) return;
    triggerGeneration();
  }, [status, picks, profile]);

  useEffect(() => {
    if (!showDoneModal || !nextBatchAt) return;
    clearInterval(countdownRef.current);
    const tick = () => {
      const secs = Math.max(0, Math.ceil((nextBatchAt - Date.now()) / 1000));
      setCountdownSecs(secs);
      if (secs <= 0) {
        clearInterval(countdownRef.current);
        setShowDoneModal(false);
        setPicks([]);
        setStatus('ready');
      }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current);
  }, [showDoneModal, nextBatchAt]);

  // Schedule push notification when cooldown starts
  useEffect(() => {
    if (showDoneModal && nextBatchAt) {
      const delaySecs = Math.max(0, Math.ceil((nextBatchAt - Date.now()) / 1000));
      if (delaySecs > 0) {
        scheduleBatchNotification(delaySecs);
      }
    }
  }, [showDoneModal, nextBatchAt]);

  // Handle notification click to dismiss cooldown modal and refresh picks
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[discover] Notification clicked:', response.notification.request.content.data);
      setShowDoneModal(false);
      setPicks([]);
      setStatus('ready');
    });
    return () => sub.remove();
  }, []);

  const triggerGeneration = async () => {
    if (generatingRef.current) return;
    if (!profile?.basePhotoUrl) { setStatus('no-photo'); return; }
    generatingRef.current = true;
    setStatus('generating');

    try {
      if (!firebaseFunctions) throw new Error('Firebase functions are not configured.');
      const generateDailyPicks = httpsCallable(firebaseFunctions, 'generateDailyPicks');
      await generateDailyPicks({
        basePhotoUrl: profile.basePhotoUrl,
        gender: profile.gender || '',
      });
    } catch (e) {
      console.warn('[discover] Backend generateDailyPicks call failed:', e.message);
      setStatus('error');
    } finally {
      generatingRef.current = false;
    }
  };

  const handleDownload = useCallback(async (card) => {
    const url = card.tryOnImageUrl;
    if (!url) return;
    try {
      const { status: perm } = await MediaLibrary.requestPermissionsAsync();
      if (perm !== 'granted') { Alert.alert('Permission needed', 'Allow media access to save images.'); return; }
      const dest = FileSystem.cacheDirectory + `tryon_${Date.now()}.jpg`;
      await FileSystem.downloadAsync(url, dest);
      await MediaLibrary.saveToLibraryAsync(dest);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved!', 'Look saved to your camera roll.');
    } catch (e) {
      Alert.alert('Error', 'Could not save image.');
    }
  }, []);

  const handleShare = useCallback(async (card) => {
    try {
      await Share.share({
        message: `Check out this AI try-on: ${card.title} by ${card.brand} — styled with oraneo`,
        url: card.tryOnImageUrl || card.imageUrl,
      });
    } catch (e) { }
  }, []);

  const handlePost = useCallback(async (card) => {
    if (!user || !firestore) return;
    try {
      await postTryOnToCommunity({ user, profile, card });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Posted!', 'Your look is now on the community feed.');
    } catch (e) {
      console.warn('[discover] Post to community failed:', e.message);
      Alert.alert('Error', 'Could not post to community.');
    }
  }, [user, profile]);

  const handleSwipeRight = useCallback(async (index, card) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (user && firestore) {
      addDoc(collection(firestore, 'wishlist'), {
        userId: user.uid,
        title: card.title,
        brand: card.brand,
        price: card.priceINR,
        currency: '₹',
        productImageUrl: card.imageUrl,
        tryOnImageUrl: card.tryOnImageUrl || card.imageUrl,
        buyLink: card.buyLink || '',
        createdAt: serverTimestamp(),
      }).then(docRef => {
        wishlistDocIdsRef.current.push({ index, docId: docRef.id });
      }).catch(() => { });
      updateDoc(doc(firestore, 'profiles', user.uid), { auraPoints: increment(10) }).catch(() => { });
    }
    setSwipedCount(c => {
      const next = c + 1;
      if (next >= visiblePicksRef.current.length) {
        updateDoc(doc(firestore, 'daily_picks', user.uid), { seenAt: serverTimestamp() }).catch(() => { });
        setShowDoneModal(true);
      }
      return next;
    });
  }, [user]);

  const handleSwipeLeft = useCallback((index, card) => {
    Haptics.selectionAsync();
    setSwipedCount(c => {
      const next = c + 1;
      if (next >= visiblePicksRef.current.length) {
        updateDoc(doc(firestore, 'daily_picks', user.uid), { seenAt: serverTimestamp() }).catch(() => { });
        setShowDoneModal(true);
      }
      return next;
    });
  }, [user]);

  const handleSwipeUp = useCallback(async (index, card) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (user && firestore) {
      addDoc(collection(firestore, 'wishlist'), {
        userId: user.uid,
        title: card.title,
        brand: card.brand,
        price: card.priceINR,
        currency: '₹',
        productImageUrl: card.imageUrl,
        tryOnImageUrl: card.tryOnImageUrl || card.imageUrl,
        buyLink: card.buyLink || '',
        superLiked: true,
        createdAt: serverTimestamp(),
      }).then(docRef => {
        wishlistDocIdsRef.current.push({ index, docId: docRef.id });
      }).catch(() => { });
      updateDoc(doc(firestore, 'profiles', user.uid), { auraPoints: increment(50) }).catch(() => { });
    }
    Alert.alert('⭐ Super Liked!', `"${card.title}" has been super liked and added to wishlist! (+50 Aura Points)`);
    setSwipedCount(c => {
      const next = c + 1;
      if (next >= visiblePicksRef.current.length) {
        updateDoc(doc(firestore, 'daily_picks', user.uid), { seenAt: serverTimestamp() }).catch(() => { });
        setShowDoneModal(true);
      }
      return next;
    });
  }, [user]);

  const handleRewind = useCallback(async () => {
    if (swipedCount > 0) {
      const prevIdx = swipedCount - 1;
      setSwipedCount(prevIdx);

      const undoneDirection = deckRef.current?.undo();

      if (undoneDirection === 'right' || undoneDirection === 'up') {
        const match = wishlistDocIdsRef.current.find(item => item.index === prevIdx);
        if (match && firestore) {
          deleteDoc(doc(firestore, 'wishlist', match.docId)).catch(() => {});
          wishlistDocIdsRef.current = wishlistDocIdsRef.current.filter(item => item.index !== prevIdx);
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Alert.alert('Nothing to rewind', 'You are already at the first card!');
    }
  }, [swipedCount]);

  const handleBoost = useCallback(() => {
    Alert.alert(
      '⚡ Boost Deck',
      'Boost will bypass the cooldown and instantly generate a fresh batch of 3 custom AI looks. Boost now?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Boost',
          onPress: async () => {
            if (!user || !firestore) return;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            const docRef = doc(firestore, 'daily_picks', user.uid);
            await setDoc(docRef, {
              status: 'ready',
              picks: [],
              seenAt: null,
              nextBatchAt: null
            });

            setPicks([]);
            setSwipedCount(0);
            setShowDoneModal(false);
            setStatus('ready');
          }
        }
      ]
    );
  }, [user]);

  const picksRef = useRef([]);
  const visiblePicksRef = useRef([]);
  // Include placeholder picks (no tryOnImageUrl yet) — card renders a spinner for those
  const visiblePicks = picks.filter(p => p && (p.tryOnImageUrl || p.imageUrl));
  visiblePicksRef.current = visiblePicks;
  // Always keep picksRef in sync so renderCard can read the latest tryOnImageUrl
  picksRef.current = picks;

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Pulsing animation for the generating dots
  const Animated = require('react-native').Animated;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const renderCard = (card) => {
    if (!card) return null;
    // Always read the LATEST pick data via picksRef so live Firestore updates
    // (null → tryOnImageUrl) are reflected even while SwipeDeck holds a stale card reference
    const liveCard = picksRef.current.find(p => p.id === card.id) || card;
    const isGenerating = !liveCard.tryOnImageUrl;
    const placeholderSource = typeof liveCard.imageUrl === 'string'
      ? { uri: liveCard.imageUrl }
      : liveCard.imageUrl;
    return (
      <View style={s.card}>
        {/* CardReveal: shows logo animation when try-on image first arrives */}
        <CardReveal
          tryOnImageUrl={liveCard.tryOnImageUrl}
          placeholderSource={placeholderSource}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Deep gradient: transparent at top, black at bottom 50% */}
        <LinearGradient
          colors={['transparent', 'transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)', '#000']}
          locations={[0, 0.42, 0.62, 0.82, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        {/* AI badge top-right */}
        <View style={s.aiBadge}>
          {isGenerating
            ? <><ActivityIndicator size="small" color="#E8A882" /><Text style={s.aiBadgeText}>GENERATING…</Text></>
            : <><Ionicons name="sparkles" size={12} color="#E8A882" /><Text style={s.aiBadgeText}>AI PICK</Text></>}
        </View>

        {/* All info + actions inside card — glassmorphism floating panel */}
        <View style={s.cardInfoContainer}>
          <BlurView intensity={35} tint="dark" style={s.cardInfoBlur}>
            <Text style={s.cardBrand}>{(liveCard.brand || '').toUpperCase()}</Text>
            <Text style={s.cardTitle} numberOfLines={2}>{liveCard.title}</Text>

            <View style={s.cardRow}>
              <View style={s.priceChip}><Text style={s.priceText}>₹{liveCard.priceINR}</Text></View>
              {liveCard.buyLink ? (
                <Pressable style={s.buyBtn} onPress={() => Linking.openURL(liveCard.buyLink).catch(() => { })}>
                  <Ionicons name="cart-outline" size={14} color="white" />
                  <Text style={s.buyBtnText}>Buy Now</Text>
                </Pressable>
              ) : null}
            </View>

            {!isGenerating && (
              <View style={s.actionBar}>
                <Pressable style={s.actionBarBtn} onPress={() => handleDownload(liveCard)}>
                  <Ionicons name="download-outline" size={16} color="white" />
                  <Text style={s.actionBarLabel}>Save</Text>
                </Pressable>
                <Pressable style={s.actionBarBtn} onPress={() => handleShare(liveCard)}>
                  <Ionicons name="share-outline" size={16} color="white" />
                  <Text style={s.actionBarLabel}>Share</Text>
                </Pressable>
                <Pressable style={s.actionBarBtn} onPress={() => handlePost(liveCard)}>
                  <Ionicons name="paper-plane-outline" size={16} color="white" />
                  <Text style={s.actionBarLabel}>Post</Text>
                </Pressable>
              </View>
            )}
          </BlurView>
        </View>
      </View>
    );
  };

  const profileLoading = !user || (!profile && !profileTimeout);

  if (profileLoading || status === 'loading') {
    return (
      <View style={s.fullCenter}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (status === 'no-photo') {
    return (
      <View style={s.fullCenter}>
        <StatusBar style="dark" />
        <LinearGradient colors={['#FAF7F4', '#F5EDE4']} style={StyleSheet.absoluteFillObject} />
        <Ionicons name="camera-outline" size={52} color={theme.colors.primary} />
        <Text style={s.emptyTitle}>Upload Your Photo First</Text>
        <Text style={s.emptySub}>AI needs a photo of you to generate personalised try-on looks.</Text>
        <Pressable style={s.primaryBtn} onPress={() => router.push('/profile-setup')}>
          <LinearGradient colors={theme.colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtnGrad}>
            <Text style={s.primaryBtnText}>Set Up Profile</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  if (status === 'generating' && visiblePicks.length === 0) {
    return (
      <View style={[s.fullCenter, { backgroundColor: '#0D0D0D' }]}>
        <StatusBar style="light" />
        <LinearGradient colors={['#0D0D0D', '#1A1208']} style={StyleSheet.absoluteFillObject} />
        <View style={[s.glowOrb, { top: H * 0.15, left: W * 0.1 }]} />
        <View style={[s.glowOrb, { bottom: H * 0.2, right: W * 0.05, width: 280, height: 280 }]} />
        <View style={s.genCard}>
          {profile?.basePhotoUrl ? (
            <View style={s.genPhotoWrap}>
              <Image source={{ uri: profile.basePhotoUrl }} style={s.genUserPhoto} resizeMode="cover" />
              <View style={s.genSpinnerWrap}><ActivityIndicator size="small" color="#C4785A" /></View>
            </View>
          ) : <ActivityIndicator size="large" color="#C4785A" />}
          <Text style={s.genTitle}>Styling your looks…</Text>
          <Text style={s.genSub}>All 3 outfits generating in parallel.{'\n'}First look arrives in ~5 seconds.</Text>
          <View style={s.genDots}>
            {[0, 1, 2].map(i => (
              <Animated.View
                key={i}
                style={[s.genDot, {
                  opacity: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: i === 1 ? [1, 0.2] : [0.3 + i * 0.2, 0.8 - i * 0.2],
                  }),
                  transform: [{
                    scale: pulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: i === 1 ? [1, 1.5] : [0.8, 1.2],
                    }),
                  }],
                }]}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (status === 'rate_limited' && visiblePicks.length === 0) {
    const retryMins = nextBatchAt ? Math.max(1, Math.ceil((nextBatchAt - Date.now()) / 60000)) : 15;
    return (
      <View style={s.fullCenter}>
        <StatusBar style="dark" />
        <LinearGradient colors={['#FAF7F4', '#F5EDE4']} style={StyleSheet.absoluteFillObject} />
        <Ionicons name="time-outline" size={52} color={theme.colors.primary} />
        <Text style={s.emptyTitle}>AI is taking a breather ☕</Text>
        <Text style={s.emptySub}>Generation paused briefly. Your looks will be ready in ~{retryMins} minutes. We'll notify you!</Text>
      </View>
    );
  }

  if (status === 'error' && visiblePicks.length === 0) {
    return (
      <View style={s.fullCenter}>
        <StatusBar style="dark" />
        <Ionicons name="alert-circle-outline" size={48} color="#E05C3E" />
        <Text style={s.emptyTitle}>Something went wrong</Text>
        <Pressable style={s.primaryBtn} onPress={() => { generatingRef.current = false; triggerGeneration(); }}>
          <LinearGradient colors={theme.colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtnGrad}>
            <Text style={s.primaryBtnText}>Try Again</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0D0D0D' }]} />
      <SafeAreaView edges={['top']} style={s.headerSafe}>
        <View style={s.header}>
          <Pressable onPress={() => router.push('/(tabs)/profile')} style={s.avatarBtn}>
            {profile?.basePhotoUrl
              ? <Image source={{ uri: profile.basePhotoUrl }} style={s.avatar} />
              : <Ionicons name="person-circle" size={36} color="rgba(255,255,255,0.5)" />}
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.logoText}>oraneo</Text>
          </View>
          <View style={s.batchBadge}>
            <Ionicons name="shirt-outline" size={12} color="#C4785A" />
            <Text style={s.batchBadgeText}>{Math.max(0, visiblePicks.length - swipedCount)}/{BATCH_SIZE}</Text>
          </View>
        </View>
      </SafeAreaView>
      <View style={s.deckWrap}>
        {swipedCount < visiblePicks.length ? (
          <>
            <SwipeDeck
              key={deckKey}
              ref={deckRef}
              cards={visiblePicks}
              renderCard={renderCard}
              onSwipeRight={handleSwipeRight}
              onSwipeLeft={handleSwipeLeft}
              onSwipeUp={handleSwipeUp}
              stackSize={3}
              overlayLabels={{ right: '♥ SAVE', left: '✕ SKIP', up: '⭐ SUPER LIKE' }}
            />
            <View style={s.bottomControlBar}>
              <BlurView intensity={60} tint="dark" style={s.controlPill}>
                <Pressable style={s.rewindBtn} onPress={handleRewind}>
                  <Ionicons name="arrow-undo-outline" size={20} color="#FEDB49" />
                </Pressable>
                <Pressable style={s.nopeBtn} onPress={() => deckRef.current?.swipeLeft()}>
                  <Ionicons name="close-outline" size={32} color="#FF5A5F" />
                </Pressable>
                <Pressable style={s.superLikeBtn} onPress={() => deckRef.current?.swipeUp()}>
                  <Ionicons name="star" size={24} color="#29B6F6" />
                </Pressable>
                <Pressable style={s.heartBtn} onPress={() => deckRef.current?.swipeRight()}>
                  <Ionicons name="heart" size={30} color="#00E676" />
                </Pressable>
                <Pressable style={s.boostBtn} onPress={handleBoost}>
                  <Ionicons name="flash-outline" size={20} color="#A855F7" />
                </Pressable>
              </BlurView>
            </View>
          </>
        ) : null}
      </View>
      {showDoneModal && (
        <View style={[StyleSheet.absoluteFillObject, s.doneScreen]}>
          <LinearGradient colors={['#0D0D0D', '#1A1008']} style={StyleSheet.absoluteFillObject} />
          <View style={s.doneCard}>
            <View style={s.doneIconWrap}><Ionicons name="time-outline" size={48} color="#C4785A" /></View>
            <Text style={s.doneTitle}>You've seen all 3 looks! ✨</Text>
            <Text style={s.doneSub}>Your next batch is being prepared.{'\n'}Check back in:</Text>
            <Text style={s.doneTimer}>{fmt(countdownSecs)}</Text>
            <Text style={s.doneNotifHint}>We'll notify you when they're ready 🔔</Text>
            <Pressable style={s.doneWishlistBtn} onPress={() => router.push('/(tabs)/wishlist')}>
              <LinearGradient colors={theme.colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.doneWishlistBtnGrad}>
                <Ionicons name="heart" size={16} color="white" /><Text style={s.doneWishlistBtnText}>View Saved Looks</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={s.doneCommunityBtn} onPress={() => router.push('/(tabs)/community')}>
              <Text style={s.doneCommunityBtnText}>Browse Community →</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0D0D' },
  fullCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF7F4', gap: 16, padding: 32 },
  headerSafe: { zIndex: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  avatarBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: '#C4785A' },
  avatar: { width: '100%', height: '100%' },
  headerCenter: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  logoText: { fontSize: 24, fontWeight: '900', color: 'white', letterSpacing: 0.5 },
  logoAI: { fontSize: 12, fontWeight: '800', color: '#C4785A', letterSpacing: 1 },
  batchBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(196,120,90,0.15)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(196,120,90,0.3)' },
  batchBadgeText: { fontSize: 12, fontWeight: '800', color: '#C4785A' },
  deckWrap: { flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 0 },
  card: { flex: 1, overflow: 'hidden', backgroundColor: '#111', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.6, shadowRadius: 40, elevation: 20, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderTopColor: 'rgba(255,255,255,0.18)' },
  aiBadge: { position: 'absolute', top: 16, right: 16, zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  aiBadgeText: { color: '#E8A882', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  cardInfoContainer: { position: 'absolute', bottom: 100, left: 16, right: 16, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  cardInfoBlur: { padding: 20, gap: 10 },
  cardBrand: { fontSize: 11, fontWeight: '800', color: '#E8A882', letterSpacing: 3 },
  cardTitle: { fontSize: 24, fontWeight: '900', color: 'white', lineHeight: 30, letterSpacing: -0.3 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceChip: { backgroundColor: '#C4785A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14 },
  priceText: { color: 'white', fontWeight: '900', fontSize: 15 },
  buyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  buyBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  actionBar: { flexDirection: 'row', gap: 8 },
  actionBarBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  actionBarLabel: { color: 'white', fontSize: 13, fontWeight: '700' },
  swipeBtns: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  bottomControlBar: {
    position: 'absolute',
    bottom: 12,
    left: 20,
    right: 20,
    zIndex: 200,
  },
  controlPill: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(15,15,15,0.55)',
  },
  rewindBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderWidth: 1.5,
    borderColor: '#FEDB49',
    shadowColor: '#FEDB49',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  nopeBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderWidth: 1.5,
    borderColor: '#FF5A5F',
    shadowColor: '#FF5A5F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  superLikeBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderWidth: 1.5,
    borderColor: '#29B6F6',
    shadowColor: '#29B6F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  heartBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderWidth: 1.5,
    borderColor: '#00E676',
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  boostBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderWidth: 1.5,
    borderColor: '#A855F7',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  glowOrb: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(196,120,90,0.12)' },
  genCard: { alignItems: 'center', gap: 16, padding: 32, margin: 24, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  genPhotoWrap: { position: 'relative', alignSelf: 'center' },
  genUserPhoto: { width: 90, height: 110, borderRadius: 20, backgroundColor: '#1A1A1A' },
  genSpinnerWrap: { position: 'absolute', bottom: -10, right: -10, backgroundColor: '#0D0D0D', borderRadius: 20, padding: 6, borderWidth: 1.5, borderColor: 'rgba(196,120,90,0.3)' },
  genTitle: { color: 'white', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  genSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  genDots: { flexDirection: 'row', gap: 6 },
  genDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(196,120,90,0.5)' },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: '#2A1F1A', textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#7A6055', textAlign: 'center', lineHeight: 22 },
  primaryBtn: { width: '100%', height: 54, borderRadius: 18, overflow: 'hidden' },
  primaryBtnGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  doneScreen: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  doneCard: { width: '100%', backgroundColor: 'rgba(20,15,10,0.96)', borderRadius: 32, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(196,120,90,0.2)' },
  doneIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(196,120,90,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(196,120,90,0.25)', marginBottom: 4 },
  doneTitle: { fontSize: 22, fontWeight: '900', color: 'white', textAlign: 'center' },
  doneSub: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 22 },
  doneTimer: { fontSize: 52, fontWeight: '900', color: '#C4785A', letterSpacing: 4, fontVariant: ['tabular-nums'], marginVertical: 8 },
  doneNotifHint: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginBottom: 8 },
  doneWishlistBtn: { width: '100%', height: 52, borderRadius: 18, overflow: 'hidden' },
  doneWishlistBtnGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  doneWishlistBtnText: { color: 'white', fontWeight: '800', fontSize: 15 },
  doneCommunityBtn: { paddingVertical: 12 },
  doneCommunityBtnText: { color: 'rgba(255,255,255,0.45)', fontWeight: '600', fontSize: 14 },
});
