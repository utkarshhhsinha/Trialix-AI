/**
 * custom-tryon.jsx — TrialX AI
 * Manual try-on generator accessible from Profile Settings.
 * User picks a garment image + uses their saved base photo → AI generates a try-on.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, ScrollView,
  ActivityIndicator, Alert, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase';
import { runVirtualTryOn } from '@/lib/ai_engine';

const { width: W } = Dimensions.get('window');
const RESULT_W = W - 48;
const RESULT_H = RESULT_W * (4 / 3);

const CATEGORIES = [
  { key: 'upper_body', label: 'Top / Shirt', icon: 'shirt-outline' },
  { key: 'lower_body', label: 'Pants / Skirt', icon: 'grid-outline' },
  { key: 'dress',      label: 'Full Dress',   icon: 'woman-outline' },
];

export default function CustomTryOn() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [basePhotoUrl, setBasePhotoUrl] = useState(null);
  const [garmentUri, setGarmentUri] = useState(null);
  const [garmentName, setGarmentName] = useState('');
  const [category, setCategory] = useState('upper_body');
  const [resultUri, setResultUri] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [saved, setSaved] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, async (u) => {
      setUser(u);
      if (u && firestore) {
        try {
          const snap = await getDoc(doc(firestore, 'profiles', u.uid));
          if (snap.exists()) setBasePhotoUrl(snap.data().basePhotoUrl || null);
        } catch (_) {}
      }
    });
  }, []);

  const startPulse = () => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
  };

  const pickGarment = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to choose a garment image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!res.canceled) {
      setGarmentUri(res.assets[0].uri);
      setGarmentName(res.assets[0].fileName || 'My Garment');
      setResultUri(null);
      setSaved(false);
      Haptics.selectionAsync();
    }
  };

  const handleGenerate = async () => {
    if (!basePhotoUrl) {
      Alert.alert('No Try-On Photo', 'Please upload a full-body photo in your Profile settings first.');
      return;
    }
    if (!garmentUri) {
      Alert.alert('No Garment', 'Please upload a garment image to try on.');
      return;
    }

    setGenerating(true);
    setResultUri(null);
    setSaved(false);
    setStatusText('Preparing\u2026');
    startPulse();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await runVirtualTryOn(
        basePhotoUrl,
        garmentUri,
        garmentName || 'fashion garment',
        (s) => setStatusText(s),
        false,
        category,
      );
      setResultUri(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      if (e?.isLimitBlock) {
        Alert.alert('\u23f1 Daily Limit', e.message);
      } else {
        Alert.alert('Generation Failed', e.message || 'Something went wrong. Please try again.');
      }
    } finally {
      stopPulse();
      setGenerating(false);
      setStatusText('');
    }
  };

  const handleSave = async () => {
    if (!resultUri) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow media access to save images.');
        return;
      }
      let localPath = resultUri;
      if (resultUri.startsWith('data:')) {
        const b64 = resultUri.split('base64,')[1];
        localPath = `${FileSystem.cacheDirectory}custom_tryon_${Date.now()}.jpg`;
        await FileSystem.writeAsStringAsync(localPath, b64, { encoding: 'base64' });
      }
      await MediaLibrary.saveToLibraryAsync(localPath);
      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved! \ud83c\udf89', 'Your AI try-on look has been saved to your camera roll.');
    } catch (e) {
      Alert.alert('Error', 'Could not save image.');
    }
  };

  const handleReset = () => {
    setGarmentUri(null);
    setGarmentName('');
    setResultUri(null);
    setSaved(false);
    Haptics.selectionAsync();
  };

  return (
    <View style={s.root}>
      <StatusBar style="dark" />

      <SafeAreaView edges={['top']} style={s.safeTop}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#2A1F1A" />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.headerTitle}>Custom Try-On</Text>
            <Text style={s.headerSub}>Upload a garment and get AI-fitted \u2728</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Your Try-On Photo */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>YOUR TRY-ON PHOTO</Text>
          <View style={s.photoRow}>
            {basePhotoUrl ? (
              <View style={s.basePhotoWrap}>
                <Image source={{ uri: basePhotoUrl }} style={s.basePhoto} resizeMode="cover" />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.45)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={s.basePhotoLabel}>
                  <Ionicons name="checkmark-circle" size={14} color="#6BE87A" />
                  <Text style={s.basePhotoLabelText}>Ready</Text>
                </View>
              </View>
            ) : (
              <Pressable style={s.noPhotoCard} onPress={() => router.back()}>
                <Ionicons name="person-circle-outline" size={40} color="#C4785A" />
                <Text style={s.noPhotoText}>No photo yet</Text>
                <Text style={s.noPhotoSub}>Upload one in Profile \u2192 Account Options</Text>
              </Pressable>
            )}
            <View style={s.photoArrow}>
              <Ionicons name="add-outline" size={26} color="#C4785A" />
            </View>
            {/* Garment mini-preview or placeholder */}
            {garmentUri ? (
              <View style={s.basePhotoWrap}>
                <Image source={{ uri: garmentUri }} style={s.basePhoto} resizeMode="cover" />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.4)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={s.basePhotoLabel}>
                  <Ionicons name="shirt-outline" size={12} color="#EEC4AA" />
                  <Text style={s.basePhotoLabelText}>Garment</Text>
                </View>
              </View>
            ) : (
              <View style={[s.basePhotoWrap, s.garmentPlaceholder]}>
                <Ionicons name="shirt-outline" size={28} color="#D4B8AE" />
                <Text style={s.garmentPlaceholderText}>Garment</Text>
              </View>
            )}
          </View>
        </View>

        {/* Garment Upload */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>GARMENT IMAGE</Text>
          <Pressable
            style={[s.garmentUploadCard, garmentUri && s.garmentUploaded]}
            onPress={garmentUri ? handleReset : pickGarment}
          >
            {garmentUri ? (
              <>
                <Image source={{ uri: garmentUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.6)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={s.garmentOverlay}>
                  <Ionicons name="refresh-circle-outline" size={22} color="white" />
                  <Text style={s.garmentOverlayText}>Tap to change</Text>
                </View>
              </>
            ) : (
              <>
                <View style={s.uploadIconCircle}>
                  <Ionicons name="image-outline" size={28} color="#C4785A" />
                </View>
                <Text style={s.uploadTitle}>Upload Garment</Text>
                <Text style={s.uploadSub}>Photo of a shirt, dress, pants \u2014 anything to try on</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Category selector */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>CLOTHING TYPE</Text>
          <View style={s.categoryRow}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                style={[s.categoryChip, category === c.key && s.categoryChipActive]}
                onPress={() => { setCategory(c.key); Haptics.selectionAsync(); }}
              >
                <Ionicons
                  name={c.icon}
                  size={15}
                  color={category === c.key ? '#FFFFFF' : '#7A6055'}
                />
                <Text style={[s.categoryChipText, category === c.key && s.categoryChipTextActive]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Generate button */}
        <Pressable
          style={[s.generateBtn, (!basePhotoUrl || !garmentUri || generating) && s.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={!basePhotoUrl || !garmentUri || generating}
        >
          {generating ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={s.generateBtnText}>{statusText || 'Generating\u2026'}</Text>
            </>
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <Text style={s.generateBtnText}>Generate Try-On</Text>
            </>
          )}
        </Pressable>

        {/* Result */}
        {(resultUri || generating) && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>YOUR LOOK</Text>
            {generating ? (
              <Animated.View style={[s.resultPlaceholder, { transform: [{ scale: pulseAnim }] }]}>
                <ActivityIndicator size="large" color="#C4785A" />
                <Text style={s.generatingText}>{statusText || 'Generating your look\u2026'}</Text>
                <Text style={s.generatingSubText}>This takes 20\u201360 seconds</Text>
              </Animated.View>
            ) : resultUri ? (
              <View style={s.resultCard}>
                <Image
                  source={{ uri: resultUri }}
                  style={s.resultImage}
                  resizeMode="cover"
                />
                <View style={s.aiBadge}>
                  <Ionicons name="sparkles" size={11} color="#E8A882" />
                  <Text style={s.aiBadgeText}>TrialX AI</Text>
                </View>
                <View style={s.resultActions}>
                  <Pressable
                    style={[s.resultActionBtn, saved && s.resultActionBtnSaved]}
                    onPress={handleSave}
                  >
                    <Ionicons
                      name={saved ? 'checkmark-circle' : 'download-outline'}
                      size={18}
                      color={saved ? '#6BE87A' : '#FFFFFF'}
                    />
                    <Text style={s.resultActionText}>{saved ? 'Saved!' : 'Save to Gallery'}</Text>
                  </Pressable>
                  <Pressable style={s.resultActionBtnSecondary} onPress={handleGenerate}>
                    <Ionicons name="refresh-outline" size={18} color="#C4785A" />
                    <Text style={s.resultActionTextSecondary}>Retry</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF7F4' },
  safeTop: { backgroundColor: '#FAF7F4' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#EDE0D4',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F0E8E0', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#2A1F1A' },
  headerSub: { fontSize: 12, color: '#B8A49A', fontWeight: '600', marginTop: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 24 },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: '#B8A49A', letterSpacing: 1.5, marginBottom: 12,
  },

  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photoArrow: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FDE8DC',
    alignItems: 'center', justifyContent: 'center',
  },
  basePhotoWrap: {
    width: 100, height: 130, borderRadius: 18, overflow: 'hidden',
    shadowColor: '#2A1F1A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 4,
    backgroundColor: '#EDE0D4', alignItems: 'center', justifyContent: 'center',
  },
  basePhoto: { width: '100%', height: '100%' },
  basePhotoLabel: {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  basePhotoLabelText: { fontSize: 11, fontWeight: '800', color: '#6BE87A' },
  garmentPlaceholder: { backgroundColor: '#F0E8E0' },
  garmentPlaceholderText: { fontSize: 11, fontWeight: '700', color: '#D4B8AE', marginTop: 4 },

  noPhotoCard: {
    flex: 1, height: 110, borderRadius: 18,
    backgroundColor: '#FFF5EE', borderWidth: 1.5, borderColor: '#EDE0D4', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  noPhotoText: { fontSize: 14, fontWeight: '800', color: '#C4785A' },
  noPhotoSub: { fontSize: 11, color: '#B8A49A', fontWeight: '600', textAlign: 'center', paddingHorizontal: 16 },

  garmentUploadCard: {
    height: 180, borderRadius: 22, backgroundColor: '#FFF5EE',
    borderWidth: 1.5, borderColor: '#EDE0D4', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden',
  },
  garmentUploaded: { borderStyle: 'solid', borderColor: 'transparent', borderWidth: 0 },
  garmentOverlay: {
    position: 'absolute', bottom: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
  },
  garmentOverlayText: { color: 'white', fontWeight: '700', fontSize: 13 },
  uploadIconCircle: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#FDE8DC',
    alignItems: 'center', justifyContent: 'center',
  },
  uploadTitle: { fontSize: 16, fontWeight: '800', color: '#2A1F1A' },
  uploadSub: { fontSize: 12, color: '#B8A49A', fontWeight: '600', textAlign: 'center', paddingHorizontal: 24 },

  categoryRow: { flexDirection: 'row', gap: 10 },
  categoryChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 11, borderRadius: 16,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#EDE0D4',
  },
  categoryChipActive: { backgroundColor: '#C4785A', borderColor: '#C4785A' },
  categoryChipText: { fontSize: 11, fontWeight: '700', color: '#7A6055' },
  categoryChipTextActive: { color: '#FFFFFF' },

  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#C4785A', paddingVertical: 17, borderRadius: 22, marginBottom: 28,
    shadowColor: '#C4785A', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  generateBtnDisabled: { backgroundColor: '#D4B8AE', shadowOpacity: 0 },
  generateBtnText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },

  resultPlaceholder: {
    height: RESULT_H * 0.5, borderRadius: 22, backgroundColor: '#F0E8E0',
    alignItems: 'center', justifyContent: 'center', gap: 14,
    borderWidth: 1, borderColor: '#EDE0D4',
  },
  generatingText: { fontSize: 15, fontWeight: '800', color: '#2A1F1A' },
  generatingSubText: { fontSize: 12, color: '#B8A49A', fontWeight: '600' },

  resultCard: {
    width: RESULT_W, height: RESULT_H, borderRadius: 24, overflow: 'hidden',
    shadowColor: '#2A1F1A', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14, shadowRadius: 20, elevation: 8,
  },
  resultImage: { width: '100%', height: '100%' },
  aiBadge: {
    position: 'absolute', top: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  aiBadgeText: { fontSize: 11, fontWeight: '800', color: '#E8A882' },
  resultActions: {
    position: 'absolute', bottom: 20, left: 20, right: 20, flexDirection: 'row', gap: 10,
  },
  resultActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(196,120,90,0.92)', paddingVertical: 13, borderRadius: 16,
  },
  resultActionBtnSaved: { backgroundColor: 'rgba(42,31,26,0.65)' },
  resultActionText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  resultActionBtnSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(250,247,244,0.95)', paddingVertical: 13, paddingHorizontal: 18,
    borderRadius: 16, borderWidth: 1.5, borderColor: '#C4785A',
  },
  resultActionTextSecondary: { fontSize: 13, fontWeight: '800', color: '#C4785A' },
});
