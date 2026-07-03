import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, ScrollView,
  ActivityIndicator, Alert, Animated, Linking, Platform, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase';
import { runVirtualTryOn } from '@/lib/ai_engine';
import { theme } from '@/constants/theme';
import { StatusBar } from 'expo-status-bar';
import Icon from '@/assets/icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

let MediaLibrary = null;
try {
  MediaLibrary = require('expo-media-library');
} catch (err) {
  // Suppress warning on load; handled gracefully when saving if unavailable
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── 5 real shirt garments with Flipkart buy links
const GARMENTS = [
  {
    id: 'g1',
    label: 'Solid Casual White Shirt',
    image: require('@/Clothes/Men/shirts/shirt 1.png'),
    buyLink: 'https://www.flipkart.com/rare-rabbit-men-solid-casual-white-shirt/p/itmbdde6a7e14889?pid=SHTHMAQXCGZTYZZD',
  },
  {
    id: 'g2',
    label: 'Solid Casual Dark Blue Shirt',
    image: require('@/Clothes/Men/shirts/shirt 2.png'),
    buyLink: 'https://www.flipkart.com/rare-rabbit-men-solid-casual-dark-blue-shirt/p/itm32007d67b122c?pid=SHTHMAQXB7FTEFBR',
  },
  {
    id: 'g3',
    label: 'Solid Casual Blue Shirt',
    image: require('@/Clothes/Men/shirts/shirt 3.png'),
    buyLink: 'https://www.flipkart.com/rare-rabbit-men-solid-casual-blue-shirt/p/itm84adf30bb6235?pid=SHTHMAQX28HXGWMH',
  },
  {
    id: 'g4',
    label: 'Slim Fit Striped Casual Shirt',
    image: require('@/Clothes/Men/shirts/shirt 4.png'),
    buyLink: 'https://tigc.in/products/men-s-blue-slim-fit-striped-casual-shirt-0525-shstcs-02-02',
  },
  {
    id: 'g5',
    label: 'Blue Striped Slim Fit Shirt',
    image: require('@/Clothes/Men/shirts/shirt 5.png'),
    buyLink: 'https://tigc.in/products/mens-blue-striped-slim-fit-shirt-0824-shstyd-06-02-blue',
  },
];

// Fisher-Yates shuffle → random order every render
function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TrialRoom() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const {
    productId, productTitle, productBrand, productPrice, productCurrency,
    productImageUrl, buyLink, basePhotoUrl,
  } = params;

  const [processing, setProcessing] = useState(true);
  const [statusText, setStatusText] = useState('Getting you dressed up…');
  const [resultUrl, setResultUrl] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Shuffled garment list — stable across re-renders for this session
  const [shuffledGarments] = useState(() => shuffled(GARMENTS));

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();

    startTryOn().then(() => {
      pulse.stop();
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    });

    return () => pulse.stop();
  }, []);

  const startTryOn = async () => {
    const startTime = Date.now();
    try {
      const result = await runVirtualTryOn(
        basePhotoUrl    || '',
        productImageUrl || '',
        productTitle    || 'clothing',
        (s) => setStatusText(s),
      );
      const elapsed = Date.now() - startTime;
      if (elapsed < 2500) {
        await new Promise(r => setTimeout(r, 2500 - elapsed));
      }
      setResultUrl(result);
    } catch (e) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 2500) {
        await new Promise(r => setTimeout(r, 2500 - elapsed));
      }
      // Handle daily limit block — go back to previous screen with a friendly message
      if (e?.isLimitBlock) {
        Alert.alert(
          '⏱ Daily Limit Reached',
          e.message,
          [{ text: 'OK', style: 'default', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Try-on failed', e.message);
        setResultUrl(productImageUrl || null);
      }
    } finally {
      setProcessing(false);
    }
  };

  // ── Download result to camera roll
  const downloadResult = useCallback(async () => {
    if (!resultUrl) return;
    if (!MediaLibrary || !MediaLibrary.requestPermissionsAsync) {
      Alert.alert(
        'Feature Unavailable',
        'Saving to photos is not supported in this version of the app. Please take a screenshot instead.'
      );
      return;
    }
    setDownloading(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to save the image.');
        return;
      }

      let localUri = resultUrl;

      if (resultUrl.startsWith('data:image')) {
        // base64 → file
        const ext  = resultUrl.includes('png') ? 'png' : 'jpg';
        const path = `${FileSystem.cacheDirectory}tryon_result_${Date.now()}.${ext}`;
        const b64  = resultUrl.split('base64,')[1];
        await FileSystem.writeAsStringAsync(path, b64, { encoding: 'base64' });
        localUri = path;
      } else if (resultUrl.startsWith('http')) {
        const path = `${FileSystem.cacheDirectory}tryon_result_${Date.now()}.jpg`;
        const res  = await FileSystem.downloadAsync(resultUrl, path);
        localUri   = res.uri;
      }

      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert('Saved! 📸', 'Image saved to your Photos.');
    } catch (e) {
      Alert.alert('Download failed', e.message);
    } finally {
      setDownloading(false);
    }
  }, [resultUrl]);

  // ── Wishlist save
  const saveToWishlist = async () => {
    const user = firebaseAuth?.currentUser;
    if (!user) return;
    setSaving(true);
    try {
      const q = query(
        collection(firestore, 'wishlist'),
        where('userId', '==', user.uid),
        where('productId', '==', productId),
      );
      const existing = await getDocs(q);
      if (!existing.empty) { setSaved(true); return; }

      let finalTryOnUrl = resultUrl || '';
      if (finalTryOnUrl.startsWith('data:image') && finalTryOnUrl.length > 800000) {
        setProcessing(true);
        setStatusText('Optimizing image for Wishlist…');
        try {
          const tempUri = `${FileSystem.cacheDirectory}temp_tr_compress_${Date.now()}.jpg`;
          const b64Data = finalTryOnUrl.split('base64,')[1];
          await FileSystem.writeAsStringAsync(tempUri, b64Data, { encoding: 'base64' });
          const manipulated = await ImageManipulator.manipulateAsync(
            tempUri,
            [{ resize: { width: 576, height: 768 } }],
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
          );
          await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
          finalTryOnUrl = `data:image/jpeg;base64,${manipulated.base64}`;
        } catch (err) {
          console.warn('[AI] compress failed:', err.message);
        } finally {
          setProcessing(false);
        }
      }

      await addDoc(collection(firestore, 'wishlist'), {
        userId: user.uid,
        productId,
        title:          productTitle,
        brand:          productBrand,
        price:          productPrice,
        currency:       productCurrency || '₹',
        productImageUrl: productImageUrl || '',
        tryOnImageUrl:  finalTryOnUrl,
        buyLink:        buyLink || '',
        createdAt:      serverTimestamp(),
      });
      setSaved(true);
      Alert.alert('Saved! ❤️', 'Added to your Wishlist');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const openLink = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert('Cannot open link'));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ── Header */}
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Icon name="arrowLeft" size={20} color="white" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerBrand}>{productBrand}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{productTitle}</Text>
        </View>
        <Pressable
          style={[styles.iconBtn, styles.heartBtn, saved && styles.heartBtnSaved]}
          onPress={saveToWishlist}
          disabled={saved || saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={saved ? 'white' : theme.colors.primary} />
            : <Icon name="heart" size={20} color={saved ? 'white' : theme.colors.primary} />
          }
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Result / Processing card */}
        <View style={styles.resultCard}>
          {processing ? (
            <Animated.View style={[styles.resultInner, { transform: [{ scale: pulseAnim }] }]}>
              <Image
                source={productImageUrl ? { uri: productImageUrl } : require('../Clothes/Men/shirts_men/1.png')}
                style={styles.resultImage}
                resizeMode="cover"
              />
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="white" />
                <Text style={styles.processingText}>{statusText}</Text>
                <Text style={styles.processingSubText}>This takes a few seconds…</Text>
              </View>
            </Animated.View>
          ) : (
            <Animated.View style={[styles.resultInner, { opacity: fadeAnim }]}>
              <Image
                source={resultUrl ? { uri: resultUrl } : require('../Clothes/Men/shirts_men/1.png')}
                style={styles.resultImage}
                resizeMode="cover"
              />
              {/* AI badge */}
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>✨ oraneo</Text>
              </View>

              {/* Download + Buy row overlaid at bottom */}
              <View style={styles.resultActions}>
                <Pressable
                  style={[styles.resultActionBtn, styles.downloadBtn]}
                  onPress={downloadResult}
                  disabled={downloading}
                >
                  {downloading
                    ? <ActivityIndicator size="small" color="white" />
                    : <>
                        <Icon name="download" size={16} color="white" />
                        <Text style={styles.resultActionText}>Save</Text>
                      </>
                  }
                </Pressable>
                <Pressable
                  style={[styles.resultActionBtn, styles.buyNowBtn]}
                  onPress={() => openLink(buyLink)}
                >
                  <Icon name="share" size={16} color="white" />
                  <Text style={styles.resultActionText}>Buy Now</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}
        </View>

        {/* ── Price row */}
        {!processing && (
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>Price</Text>
              <Text style={styles.priceValue}>
                {productCurrency || '₹'}{Number(productPrice || 0).toLocaleString('en-IN')}
              </Text>
            </View>
            <Pressable style={styles.buyBtn} onPress={() => openLink(buyLink)}>
              <Icon name="share" size={16} color="white" />
              <Text style={styles.buyBtnText}>Shop on Flipkart</Text>
            </Pressable>
          </View>
        )}

        {/* ── Explore More: user's garment first, then 5 shirts randomly */}
        <Text style={styles.sectionTitle}>Explore More Looks</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.garmentList}
        >
          {/* ── Card 0: the product the user is currently trying */}
          <View style={styles.garmentCard}>
            <Image
              source={productImageUrl ? { uri: productImageUrl } : require('../Clothes/Men/shirts_men/1.png')}
              style={styles.garmentImage}
              resizeMode="cover"
            />
            <View style={styles.garmentBadge}>
              <Text style={styles.garmentBadgeText}>Current</Text>
            </View>
            <View style={styles.garmentBtns}>
              <Pressable style={styles.garmentBtn} onPress={() => openLink(buyLink)}>
                <Icon name="share" size={12} color="white" />
              </Pressable>
            </View>
          </View>

          {/* ── Cards 1-5: shuffled shirt garments */}
          {shuffledGarments.map((g) => (
            <View key={g.id} style={styles.garmentCard}>
              <Image source={g.image} style={styles.garmentImage} resizeMode="cover" />
              <View style={styles.garmentLabelWrap}>
                <Text style={styles.garmentLabel} numberOfLines={2}>{g.label}</Text>
              </View>
              <View style={styles.garmentBtns}>
                <Pressable
                  style={styles.garmentBtn}
                  onPress={() => openLink(g.buyLink)}
                >
                  <Icon name="share" size={12} color="white" />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const RESULT_H = SCREEN_H * 0.52;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 58 : 36,
    paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  heartBtn: { backgroundColor: 'rgba(255,255,255,0.9)' },
  heartBtnSaved: { backgroundColor: theme.colors.primary },
  headerCenter: { flex: 1, paddingHorizontal: 14 },
  headerBrand: {
    fontSize: 10, color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2.5, fontWeight: theme.fonts.bold, textTransform: 'uppercase',
  },
  headerTitle: { fontSize: 15, color: 'white', fontWeight: theme.fonts.bold, marginTop: 2 },

  // ── Result card
  resultCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 24,
    overflow: 'hidden',
    height: RESULT_H,
    backgroundColor: '#1A1A22',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 14,
  },
  resultInner: { flex: 1 },
  resultImage: { width: '100%', height: '100%' },

  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(254,60,114,0.82)',
    justifyContent: 'center', alignItems: 'center', gap: 14,
  },
  processingText: {
    color: 'white', fontSize: 17, fontWeight: theme.fonts.bold,
    textAlign: 'center', paddingHorizontal: 24,
  },
  processingSubText: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },

  aiBadge: {
    position: 'absolute', top: 14, left: 14,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20,
  },
  aiBadgeText: { color: 'white', fontSize: 12, fontWeight: theme.fonts.bold },

  resultActions: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    flexDirection: 'row', gap: 10,
  },
  resultActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 13, borderRadius: 16,
  },
  downloadBtn: {
    backgroundColor: 'rgba(10,10,15,0.75)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  buyNowBtn: { backgroundColor: theme.colors.primary },
  resultActionText: { color: 'white', fontSize: 14, fontWeight: theme.fonts.bold },

  // ── Price row
  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginTop: 18, marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  priceLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: theme.fonts.semibold, marginBottom: 2 },
  priceValue: { fontSize: 26, fontWeight: theme.fonts.extraBold, color: 'white' },
  buyBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16,
    shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  buyBtnText: { color: 'white', fontSize: 14, fontWeight: theme.fonts.bold },

  // ── Explore More
  sectionTitle: {
    fontSize: 16, fontWeight: theme.fonts.bold,
    color: 'rgba(255,255,255,0.9)',
    marginHorizontal: 16, marginTop: 24, marginBottom: 12,
  },
  garmentList: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },

  garmentCard: {
    width: 110, borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#1A1A22',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  garmentImage: { width: '100%', height: 140 },
  garmentBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  garmentBadgeText: { color: 'white', fontSize: 9, fontWeight: theme.fonts.bold },
  garmentLabelWrap: {
    paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4, minHeight: 38,
  },
  garmentLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: theme.fonts.semibold },
  garmentBtns: {
    flexDirection: 'row', justifyContent: 'center',
    paddingHorizontal: 8, paddingBottom: 10, paddingTop: 4, gap: 6,
  },
  garmentBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 7, borderRadius: 10,
  },
});