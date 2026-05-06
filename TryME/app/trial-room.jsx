import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, ScrollView,
  ActivityIndicator, Alert, Animated, Linking, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase';
import { runVirtualTryOn } from '@/lib/ai_engine';
import { theme } from '@/constants/theme';
import { StatusBar } from 'expo-status-bar';
import Icon from '@/assets/icons';

// Related products for the horizontal slider
const RELATED = [
  { id: 'r1', imageUrl: require('@/assets/images/clothing_1.png') },
  { id: 'r2', imageUrl: require('@/assets/images/clothing_2.png') },
  { id: 'r3', imageUrl: { uri: 'https://images.unsplash.com/photo-1594932224010-70f90145c13b?w=300&q=60' } },
  { id: 'r4', imageUrl: { uri: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=300&q=60' } },
  { id: 'r5', imageUrl: require('@/assets/images/clothing_1.png') },
  { id: 'r6', imageUrl: require('@/assets/images/clothing_2.png') },
];

export default function TrialRoom() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const {
    productId, productTitle, productBrand, productPrice, productCurrency,
    productImageUrl, buyLink, basePhotoUrl
  } = params;

  const [processing, setProcessing] = useState(true);
  const [statusText, setStatusText] = useState('✨ AI dressing you up...');
  const [resultUrl, setResultUrl] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation during processing
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();

    startTryOn().then(() => {
      pulse.stop();
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    });

    return () => pulse.stop();
  }, []);

  const startTryOn = async () => {
    try {
      const garmentUrl = productImageUrl || '';
      const modelUrl = basePhotoUrl || '';
      const result = await runVirtualTryOn(
        modelUrl, 
        garmentUrl, 
        productTitle || 'clothing',
        (status) => setStatusText(status)
      );
      setResultUrl(result);
    } catch (e) {
      Alert.alert('Try-on failed', e.message);
      setResultUrl(productImageUrl || null);
    } finally {
      setProcessing(false);
    }
  };

  const saveToWishlist = async () => {
    const user = firebaseAuth?.currentUser;
    if (!user) return;
    setSaving(true);
    try {
      // Avoid duplicates
      const q = query(
        collection(firestore, 'wishlist'),
        where('userId', '==', user.uid),
        where('productId', '==', productId)
      );
      const existing = await getDocs(q);
      if (!existing.empty) { setSaved(true); return; }

      await addDoc(collection(firestore, 'wishlist'), {
        userId: user.uid,
        productId,
        title: productTitle,
        brand: productBrand,
        price: productPrice,
        currency: productCurrency || '$',
        productImageUrl: productImageUrl || '',
        tryOnImageUrl: resultUrl || '',
        buyLink: buyLink || '',
        createdAt: serverTimestamp(),
      });
      setSaved(true);
      Alert.alert('Saved! ❤️', 'Added to your Wishlist');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const openBuyLink = () => {
    if (!buyLink) return;
    Linking.openURL(buyLink).catch(() => Alert.alert('Cannot open link'));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Icon name="arrowLeft" size={22} color="white" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerBrand}>{productBrand}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{productTitle}</Text>
        </View>
        <Pressable
          style={[styles.heartBtn, saved && styles.heartBtnSaved]}
          onPress={saveToWishlist}
          disabled={saved || saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={saved ? 'white' : theme.colors.primary} />
            : <Icon name="heart" size={22} color={saved ? 'white' : theme.colors.primary} />
          }
        </Pressable>
      </View>

      {/* Main result area */}
      <View style={styles.resultArea}>
        {processing ? (
          <Animated.View style={[styles.processingView, { transform: [{ scale: pulseAnim }] }]}>
            <Image
              source={productImageUrl ? { uri: productImageUrl } : require('../assets/images/clothing_1.png')}
              style={styles.processingImage}
              resizeMode="contain"
            />
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.processingText}>{statusText}</Text>
              <Text style={styles.processingSubText}>This takes a few seconds</Text>
            </View>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.resultView, { opacity: fadeAnim }]}>
            <Image
              source={resultUrl ? { uri: resultUrl } : require('../assets/images/clothing_1.png')}
              style={styles.resultImage}
              resizeMode="cover"
            />
            {/* AI badge */}
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>✨ AI Virtual Try-On</Text>
            </View>
          </Animated.View>
        )}
      </View>

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Price</Text>
            <Text style={styles.priceValue}>{productCurrency || '$'}{Number(productPrice || 0).toFixed(2)}</Text>
          </View>
          <Pressable style={styles.buyBtn} onPress={openBuyLink}>
            <Icon name="share" size={18} color="white" />
            <Text style={styles.buyBtnText}>Buy Now</Text>
          </Pressable>
        </View>

        {/* Related items */}
        <Text style={styles.relatedTitle}>Explore More</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedList}>
          {RELATED.map((item) => (
            <Pressable key={item.id} style={styles.relatedCard}>
              <Image source={item.imageUrl} style={styles.relatedImage} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.4)', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, paddingHorizontal: 16 },
  headerBrand: { fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 2, fontWeight: theme.fonts.bold },
  headerTitle: { fontSize: 16, color: 'white', fontWeight: theme.fonts.bold },
  heartBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  heartBtnSaved: { backgroundColor: theme.colors.primary },
  resultArea: { flex: 1 },
  processingView: { flex: 1 },
  processingImage: { width: '100%', height: '100%' },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 35, 102, 0.7)',
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  processingText: { color: 'white', fontSize: 18, fontWeight: theme.fonts.bold, textAlign: 'center', paddingHorizontal: 20 },
  processingSubText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  resultView: { flex: 1 },
  resultImage: { width: '100%', height: '100%' },
  aiBadge: {
    position: 'absolute', top: 110, left: 20,
    backgroundColor: 'rgba(0, 71, 171, 0.9)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
  },
  aiBadgeText: { color: 'white', fontSize: 13, fontWeight: theme.fonts.bold },
  bottomPanel: {
    backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, paddingBottom: 40,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  priceLabel: { fontSize: 12, color: theme.colors.textLight, fontWeight: theme.fonts.semibold },
  priceValue: { fontSize: 28, fontWeight: theme.fonts.extraBold, color: theme.colors.textDark },
  buyBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 18,
    shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  buyBtnText: { color: 'white', fontSize: 16, fontWeight: theme.fonts.bold },
  relatedTitle: { fontSize: 15, fontWeight: theme.fonts.bold, color: theme.colors.textDark, marginBottom: 12 },
  relatedList: { gap: 10 },
  relatedCard: { width: 64, height: 80, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.gray },
  relatedImage: { width: '100%', height: '100%' },
});
