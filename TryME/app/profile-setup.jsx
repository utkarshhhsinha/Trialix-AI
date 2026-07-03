import React, { useState, useEffect, useRef } from 'react';
import {
  Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity,
  View, Animated, KeyboardAvoidingView, Platform, Pressable, Dimensions, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseAuth, firestore, storage } from '@/lib/firebase';
import { generateImageEmbedding } from '@/lib/ai_engine';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import OraneoLogo from '@/components/OraneoLogo';

const { width: W } = Dimensions.get('window');
const PHOTO_W = W - 80;
const PHOTO_H = PHOTO_W * 1.25;

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const STEPS = ['Photo', 'About you', 'Ready'];

const STEP_META = [
  { title: 'Upload your trial photo', sub: 'Full-body shot in fitted clothes — this is used for all AI try-ons ✨', emoji: '📸' },
  { title: 'Tell us about you', sub: 'So we can personalize your style feed', emoji: '✨' },
  { title: "You're ready to slay", sub: 'Swipe right on outfits and try them on instantly', emoji: '🔥' },
];

export default function ProfileSetup() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [photoMode, setPhotoMode] = useState('gallery');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [step]);

  useEffect(() => {
    if (!firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, async (u) => {
      if (!u) { router.replace('/login'); return; }
      setUser(u);

      // Pre-fill name from auth provider — but never auto-fill the photo
      // from Google or from an existing profile URL. The user must always
      // upload their own full-body trial photo.
      if (u.displayName) setName(u.displayName);

      try {
        const snap = await getDoc(doc(firestore, 'profiles', u.uid));
        if (snap.exists()) {
          const data = snap.data();
          // Pre-fill text fields from existing profile
          if (data.name) setName(data.name);
          if (data.phone) setPhone(data.phone);
          if (data.gender) setGender(data.gender);

          // If the profile already has a properly uploaded photo (Storage URL),
          // reuse it and skip straight to discover — the user already set up.
          // Never reuse a Google avatar URL (accounts.google.com / googleusercontent.com).
          const storedUrl = data.basePhotoUrl || '';
          const isRealUpload =
            storedUrl.includes('firebasestorage.googleapis.com') ||
            storedUrl.startsWith('file://') ||
            (storedUrl.startsWith('http') &&
              !storedUrl.includes('googleusercontent.com') &&
              !storedUrl.includes('accounts.google.com'));

          if (isRealUpload && data.name) {
            // Profile is complete with a real uploaded photo — go straight to the app
            router.replace('/(tabs)/discover');
          } else if (isRealUpload) {
            // Has a photo but no name yet — jump to step 1
            setImageUri(storedUrl);
            setPhotoMode('gallery');
            setStep(1);
          }
          // Otherwise fall through to step 0 — user must upload a real photo
        }
      } catch (e) {
        // Firestore unavailable — just pre-fill name, leave photo blank
        console.warn('[ProfileSetup] Could not read existing profile:', e.message);
      }
    });
    return () => unsub();
  }, []);

  const animateToNextStep = (nextStep) => {
    fadeAnim.setValue(0);
    slideAnim.setValue(24);
    setStep(nextStep);
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to continue.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [3, 4], base64: true,
    });
    if (!res.canceled) {
      const asset = res.assets[0];
      // Copy to permanent storage immediately — ImagePicker cache is ephemeral on Android
      const permUri = `${FileSystem.documentDirectory}profile_photo_${Date.now()}.jpg`;
      if (asset.base64) {
        await FileSystem.writeAsStringAsync(permUri, asset.base64, { encoding: 'base64' });
      } else {
        await FileSystem.copyAsync({ from: asset.uri, to: permUri });
      }
      setImageUri(permUri);
      setPhotoMode('gallery');
    }
  };

  const uploadPhoto = async () => {
    if (!imageUri || photoMode === 'url') return imageUrl || imageUri;
    // Always upload to Firebase Storage — never return a Google avatar URL directly,
    // since it is a small thumbnail and can expire or be inaccessible by the AI function.
    if (!storage) return imageUri;

    const uid = user?.uid || firebaseAuth?.currentUser?.uid || ('guest_' + Date.now());
    let localFileToUpload = imageUri;
    let isTempCompressed = false;

    try {
      // Compress user image before uploading to Firebase Storage to optimize size
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 1080 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        localFileToUpload = compressed.uri;
        isTempCompressed = true;
      } catch (err) {
        console.warn('[Profile] Client compression failed, uploading original:', err.message);
      }

      const token = await firebaseAuth.currentUser.getIdToken();
      const sdkBucket = storage?.app?.options?.storageBucket;
      const bucketOptions = [
        sdkBucket,
        'aura-ai-powered-fashion-aura.firebasestorage.app',
        'aura-ai-powered-fashion-aura.appspot.com',
        'aura-ai-powered-fashion-aura',
      ].filter(Boolean);

      let successRes = null;
      let finalPath = '';
      let finalBucket = '';

      for (const bucketName of bucketOptions) {
        if (successRes) break;
        const path = encodeURIComponent(`base-photos/${uid}.jpg`);
        const variations = [
          {
            url: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName).replace(/\./g, '%2E')}/o?uploadType=media&name=${path}`,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
          },
        ];

        for (const variant of variations) {
          try {
            const uploadRes = await FileSystem.uploadAsync(variant.url, localFileToUpload, {
              httpMethod: 'POST',
              uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
              headers: variant.headers,
            });
            if (uploadRes.status === 200) {
              successRes = JSON.parse(uploadRes.body);
              finalPath = path;
              finalBucket = bucketName;
              break;
            }
          } catch (_) { /* try next */ }
        }
      }

      // Clean up compressed temp file
      if (isTempCompressed && localFileToUpload.includes(FileSystem.cacheDirectory)) {
        FileSystem.deleteAsync(localFileToUpload, { idempotent: true }).catch(() => {});
      }

      if (successRes) {
        return `https://firebasestorage.googleapis.com/v0/b/${finalBucket}/o/${finalPath}?alt=media&t=${Date.now()}`;
      }

      throw new Error('Failed to upload photo to Firebase Storage. Please check your internet connection.');
    } catch (uploadErr) {
      // Clean up compressed temp file on error
      if (isTempCompressed && localFileToUpload.includes(FileSystem.cacheDirectory)) {
        FileSystem.deleteAsync(localFileToUpload, { idempotent: true }).catch(() => {});
      }
      console.error('Upload error:', uploadErr);
      throw uploadErr;
    }
  };

  const saveProfile = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Please enter your name.'); return; }
    const photoSrc = imageUri || imageUrl;
    if (!photoSrc) { Alert.alert('Required', 'Please add a profile photo.'); return; }

    let uid = user?.uid || firebaseAuth?.currentUser?.uid;
    if (!uid) {
      Alert.alert('Authentication required', 'Please log in again.');
      return;
    }

    setSaving(true);
    const timeoutId = setTimeout(() => {
      setSaving(false);
      Alert.alert('Save Timeout', 'Check your connection and try again.');
    }, 15000);

    try {
      let basePhotoUrl = await uploadPhoto();
      if (!basePhotoUrl) basePhotoUrl = user?.photoURL || '';

      if (!firestore) {
        clearTimeout(timeoutId);
        router.replace('/(tabs)/discover');
        return;
      }

      let visualEmbedding = null;
      try {
        visualEmbedding = await generateImageEmbedding(basePhotoUrl);
      } catch (_) { /* optional */ }

      await setDoc(doc(firestore, 'profiles', uid), {
        id: uid,
        name: name.trim(),
        email: user?.email || '',
        phone: phone.trim(),
        gender,
        basePhotoUrl: basePhotoUrl || '',
        visualEmbedding: visualEmbedding || [],
        visualProcessed: !!visualEmbedding,
        isGuest: !user,
        photoStoragePath: `base-photos/${uid}.jpg`,
        preferences: { gender: gender || 'all', sizes: [], styles: [] },
        wishlistCount: 0,
        tryOnCount: 0,
        auraPoints: 50,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      clearTimeout(timeoutId);
      router.replace('/(tabs)/discover');
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.code === 'permission-denied') {
        Alert.alert(
          'Cloud save restricted',
          'Continue locally for now — update Firestore rules later.',
          [{ text: 'Continue', onPress: () => router.replace('/(tabs)/discover') }]
        );
      } else {
        // Fallback option in case Firebase Storage is not provisioned or active
        Alert.alert(
          'Upload Failed',
          'Firebase Storage is not enabled on this project. Would you like to use a default profile photo to complete your setup?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Use Default Photo',
              onPress: async () => {
                setSaving(true);
                try {
                  const defaultPhoto = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=450&q=80';
                  let visualEmbedding = [];
                  try {
                    visualEmbedding = await generateImageEmbedding(defaultPhoto);
                  } catch (_) {}
                  
                  await setDoc(doc(firestore, 'profiles', uid), {
                    id: uid,
                    name: name.trim(),
                    email: user?.email || '',
                    phone: phone.trim(),
                    gender,
                    basePhotoUrl: defaultPhoto,
                    visualEmbedding: visualEmbedding,
                    visualProcessed: !!visualEmbedding.length,
                    isGuest: !user,
                    photoStoragePath: '',
                    preferences: { gender: gender || 'all', sizes: [], styles: [] },
                    wishlistCount: 0,
                    tryOnCount: 0,
                    auraPoints: 50,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  }, { merge: true });
                  
                  router.replace('/(tabs)/discover');
                } catch (saveErr) {
                  Alert.alert('Save failed', saveErr.message);
                } finally {
                  setSaving(false);
                }
              }
            }
          ]
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (step === 0 && !imageUri && !imageUrl) {
      Alert.alert('Photo required', 'Add a photo so AI can dress you virtually.');
      return;
    }
    if (step === 1 && !name.trim()) {
      Alert.alert('Name required', 'Enter your name to continue.');
      return;
    }
    if (step < STEPS.length - 1) animateToNextStep(step + 1);
    else saveProfile();
  };

  const currentPhoto = imageUri || imageUrl || null;
  const meta = STEP_META[step];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#A05A3E', '#C4785A', '#E8A882']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orb1]} />
      <View style={[styles.orb, styles.orb2]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Top bar */}
          <View style={styles.topBar}>
            {step > 0 ? (
              <Pressable style={styles.backCircle} onPress={() => animateToNextStep(step - 1)}>
                <Ionicons name="chevron-back" size={22} color="white" />
              </Pressable>
            ) : (
              <Pressable
                style={styles.backCircle}
                onPress={async () => {
                  try {
                    if (firebaseAuth) await firebaseAuth.signOut();
                    router.replace('/login');
                  } catch (e) {
                    Alert.alert('Sign Out Error', e.message);
                  }
                }}
              >
                <Ionicons name="log-out-outline" size={22} color="white" />
              </Pressable>
            )}
            <OraneoLogo size={40} showRing={false} />
            <Text style={styles.stepCounter}>{step + 1}/{STEPS.length}</Text>
          </View>

          {/* Progress pills */}
          <View style={styles.progressRow}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.progressPill, i <= step && styles.progressPillActive]} />
            ))}
          </View>

          {/* Hero copy on gradient */}
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>{meta.emoji}</Text>
            <Text style={styles.heroTitle}>{meta.title}</Text>
            <Text style={styles.heroSub}>{meta.sub}</Text>
          </View>

          {/* White sheet — Tinder card */}
          <Animated.View
            style={[
              styles.sheet,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetScroll}
              keyboardShouldPersistTaps="handled"
            >
              {step === 0 && (
                <View style={styles.stepBody}>
                  <Pressable onPress={pickFromGallery} style={styles.photoCard}>
                    {currentPhoto ? (
                      <>
                        <Image source={{ uri: currentPhoto }} style={styles.photoImg} resizeMode="cover" />
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.55)']}
                          style={styles.photoOverlay}
                        />
                        <View style={styles.changePhotoBadge}>
                          <Ionicons name="camera" size={16} color="white" />
                          <Text style={styles.changePhotoText}>Change photo</Text>
                        </View>
                      </>
                    ) : (
                      <View style={styles.photoEmpty}>
                        <View style={styles.photoIconCircle}>
                          <Ionicons name="add" size={36} color="#C4785A" />
                        </View>
                        <Text style={styles.photoEmptyTitle}>Add trial photo</Text>
                        <Text style={styles.photoEmptySub}>Tap to upload from gallery{'\n'}Used for all AI try-ons</Text>
                      </View>
                    )}
                  </Pressable>

                  <View style={styles.sourceRow}>
                    <Pressable
                      style={[styles.sourcePill, photoMode === 'gallery' && styles.sourcePillActive]}
                      onPress={pickFromGallery}
                    >
                      <Ionicons name="images-outline" size={18} color={photoMode === 'gallery' ? '#C4785A' : '#7A6055'} />
                      <Text style={[styles.sourceText, photoMode === 'gallery' && styles.sourceTextActive]}>Gallery</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.sourcePill, photoMode === 'url' && styles.sourcePillActive]}
                      onPress={() => setPhotoMode('url')}
                    >
                      <Ionicons name="link-outline" size={18} color={photoMode === 'url' ? '#C4785A' : '#7A6055'} />
                      <Text style={[styles.sourceText, photoMode === 'url' && styles.sourceTextActive]}>URL</Text>
                    </Pressable>
                  </View>

                  {photoMode === 'url' && (
                    <View style={styles.field}>
                      <Ionicons name="link-outline" size={18} color="#B8A49A" />
                      <TextInput
                        style={styles.input}
                        placeholder="Paste image URL"
                        placeholderTextColor="#B8A49A"
                        value={imageUrl}
                        onChangeText={setImageUrl}
                        onEndEditing={() => { if (imageUrl) setImageUri(imageUrl); }}
                        autoCapitalize="none"
                        keyboardType="url"
                      />
                    </View>
                  )}

                  <View style={styles.tipBox}>
                    <Ionicons name="bulb-outline" size={18} color="#C4785A" />
                    <Text style={styles.tipText}>
                      This photo is used for every AI outfit try-on. Stand straight, good lighting, full body visible, fitted clothes — like a fitting-room selfie.
                    </Text>
                  </View>
                </View>
              )}

              {step === 1 && (
                <View style={styles.stepBody}>
                  <View style={styles.field}>
                    <Ionicons name="person-outline" size={18} color="#B8A49A" />
                    <TextInput
                      style={styles.input}
                      placeholder="Your name"
                      placeholderTextColor="#B8A49A"
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={[styles.field, styles.fieldDisabled]}>
                    <Ionicons name="mail-outline" size={18} color="#B8A49A" />
                    <TextInput
                      style={styles.input}
                      value={user?.email || ''}
                      editable={false}
                      placeholderTextColor="#B8A49A"
                    />
                  </View>

                  <View style={styles.field}>
                    <Ionicons name="call-outline" size={18} color="#B8A49A" />
                    <TextInput
                      style={styles.input}
                      placeholder="Phone (optional)"
                      placeholderTextColor="#B8A49A"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>

                  <Text style={styles.sectionLabel}>I shop for</Text>
                  <View style={styles.genderGrid}>
                    {GENDERS.map((g) => (
                      <Pressable
                        key={g}
                        style={[styles.genderPill, gender === g && styles.genderPillActive]}
                        onPress={() => setGender(g)}
                      >
                        <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>{g}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {step === 2 && (
                <View style={[styles.stepBody, styles.doneBody]}>
                  <View style={styles.doneRing}>
                    {currentPhoto ? (
                      <Image source={{ uri: currentPhoto }} style={styles.donePhoto} resizeMode="cover" />
                    ) : (
                      <Ionicons name="heart" size={48} color="#C4785A" />
                    )}
                  </View>
                  <Text style={styles.doneTitle}>Profile locked in</Text>
                  <Text style={styles.doneSub}>
                    Start swiping outfits — every right swipe runs AI try-on on you.
                  </Text>
                  <View style={styles.perkRow}>
                    {['✨ oraneo', '♥ Wishlist', '🔥 Aura'].map(p => (
                      <View key={p} style={styles.perkChip}>
                        <Text style={styles.perkText}>{p}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* CTA */}
            <View style={styles.ctaWrap}>
              <TouchableOpacity
                style={[styles.ctaBtn, saving && styles.ctaDisabled]}
                onPress={goNext}
                disabled={saving}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#C4785A', '#E8A882']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGrad}
                >
                  {saving ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Text style={styles.ctaText}>
                        {step === STEPS.length - 1 ? 'Start swiping' : 'Continue'}
                      </Text>
                      <Ionicons name="arrow-forward" size={20} color="white" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#C4785A' },
  flex: { flex: 1 },
  safe: { flex: 1 },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  orb1: { width: W * 0.6, height: W * 0.6, top: -W * 0.15, right: -W * 0.1 },
  orb2: { width: W * 0.45, height: W * 0.45, bottom: '38%', left: -W * 0.15 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  backCirclePlaceholder: { width: 40 },
  stepCounter: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '800' },

  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  progressPill: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressPillActive: { backgroundColor: 'white' },

  hero: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 16,
  },
  heroEmoji: { fontSize: 28, marginBottom: 6 },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 0.3,
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 6,
    lineHeight: 20,
    fontWeight: '500',
  },

  sheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 12,
  },
  sheetScroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },
  stepBody: { gap: 16 },

  photoCard: {
    width: PHOTO_W,
    height: PHOTO_H,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FAF7F4',
    borderWidth: 2,
    borderColor: '#EDE0D4',
    borderStyle: 'dashed',
  },
  photoImg: { width: '100%', height: '100%' },
  photoOverlay: { ...StyleSheet.absoluteFillObject },
  changePhotoBadge: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  changePhotoText: { color: 'white', fontSize: 13, fontWeight: '700' },
  photoEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  photoIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#FDF2EC',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#C4785A',
  },
  photoEmptyTitle: { fontSize: 18, fontWeight: '800', color: '#2A1F1A' },
  photoEmptySub: { fontSize: 13, color: '#7A6055', textAlign: 'center' },

  sourceRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FAF7F4',
    borderWidth: 1.5,
    borderColor: '#EDE0D4',
  },
  sourcePillActive: { borderColor: '#C4785A', backgroundColor: '#FDF2EC' },
  sourceText: { fontSize: 13, fontWeight: '700', color: '#7A6055' },
  sourceTextActive: { color: '#C4785A' },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FAF7F4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  fieldDisabled: { opacity: 0.65 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#2A1F1A',
    paddingVertical: 12,
    fontWeight: '500',
  },

  tipBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FDF6EC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDD5B0',
  },
  tipText: { flex: 1, fontSize: 12, color: '#7A6055', lineHeight: 18, fontWeight: '500' },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B8A49A',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  genderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genderPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#EDE0D4',
    backgroundColor: '#FAF7F4',
  },
  genderPillActive: { borderColor: '#C4785A', backgroundColor: '#FDF2EC' },
  genderText: { fontSize: 14, fontWeight: '600', color: '#7A6055' },
  genderTextActive: { color: '#C4785A', fontWeight: '800' },

  doneBody: { alignItems: 'center', paddingVertical: 12 },
  doneRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#C4785A',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDF2EC',
  },
  donePhoto: { width: '100%', height: '100%' },
  doneTitle: { fontSize: 22, fontWeight: '900', color: '#2A1F1A', marginTop: 16 },
  doneSub: {
    fontSize: 14,
    color: '#7A6055',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  perkRow: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
  perkChip: {
    backgroundColor: '#FDF2EC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDD5B0',
  },
  perkText: { fontSize: 12, fontWeight: '700', color: '#C4785A' },

  ctaWrap: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5EDE4',
  },
  ctaBtn: { borderRadius: 28, overflow: 'hidden' },
  ctaGrad: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { color: 'white', fontSize: 17, fontWeight: '900' },
  ctaDisabled: { opacity: 0.65 },
});
