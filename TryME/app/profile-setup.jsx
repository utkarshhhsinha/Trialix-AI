import React, { useState, useEffect, useRef } from 'react';
import {
  Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity,
  View, Animated, KeyboardAvoidingView, Platform, Pressable
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { firebaseAuth, firestore, storage, firebaseConfigError } from '@/lib/firebase';
import { generateImageEmbedding } from '@/lib/ai_engine'; 
import { theme } from '@/constants/theme';
import { StatusBar } from 'expo-status-bar';
import Icon from '@/assets/icons';

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const STEPS = ['Profile Photo', 'Personal Info', 'Style Preferences'];

export default function ProfileSetup() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [photoMode, setPhotoMode] = useState('gallery'); // 'gallery' | 'url' | 'google'

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [step]);

  useEffect(() => {
    if (!firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, async (u) => {
      if (!u) { router.replace('/login'); return; }
      setUser(u);
      
      // Fetch existing profile from Firestore
      try {
        const snap = await getDoc(doc(firestore, 'profiles', u.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.name) setName(data.name);
          if (data.phone) setPhone(data.phone);
          if (data.gender) setGender(data.gender);
          if (data.basePhotoUrl) {
            setImageUri(data.basePhotoUrl);
            setPhotoMode('google');
            if (data.name) {
              console.log('Profile complete, bypassing setup...');
              router.replace('/(tabs)/discover');
            } else {
              setStep(1);
            }
          }
        } else {
          // Fallback to Auth data if no Firestore profile
          if (u.displayName) setName(u.displayName);
          if (u.photoURL) { setImageUri(u.photoURL); setPhotoMode('google'); }
        }
      } catch (e) {
        console.warn('AI: Could not pre-load cloud profile (Offline or Permission issue). Falling back to Auth data:', e.message);
        // Fallback to Auth data for any error (offline, permission, etc)
        if (u.displayName) setName(u.displayName);
        if (u.photoURL) { 
          setImageUri(u.photoURL); 
          setPhotoMode('google'); 
        }
      }
    });
    return () => unsub();
  }, []);

  const animateToNextStep = (nextStep) => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    setStep(nextStep);
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.2, allowsEditing: true, aspect: [3, 4],
    });
    if (!res.canceled) { setImageUri(res.assets[0].uri); setPhotoMode('gallery'); }
  };
  
  const uploadPhoto = async () => {
    if (!imageUri || photoMode === 'url') return imageUrl || imageUri;
    if (photoMode === 'google') return imageUri; // Google photo URL, no upload needed
    if (!storage) return imageUri; // No storage configured, return local URI

    console.log('Initiating native upload for ProfileSetup:', imageUri);
    const uid = user?.uid || firebaseAuth?.currentUser?.uid || ('guest_' + Date.now());
    
    try {
      const token = await firebaseAuth.currentUser.getIdToken();
      const sdkBucket = storage?.app?.options?.storageBucket;
      
      const bucketOptions = [
        sdkBucket,
        "aura-ai-powered-fashion-aura.firebasestorage.app",
        "aura-ai-powered-fashion-aura.appspot.com",
        "aura-ai-powered-fashion-aura"
      ].filter(Boolean);

      let successRes = null;
      let finalPath = "";
      let finalBucket = "";

      for (const bucketName of bucketOptions) {
        if (successRes) break;
        const path = encodeURIComponent(`base-photos/${uid}.jpg`);
        
        const variations = [
          {
            url: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName).replace(/\./g, '%2E')}/o?uploadType=media&name=${path}`,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'image/jpeg' }
          },
          {
            url: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName).replace(/\./g, '%2E')}/o?name=${path}`,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'image/jpeg' }
          },
          {
            url: `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucketName).replace(/\./g, '%2E')}/o?uploadType=media&name=${path}`,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'image/jpeg' }
          }
        ];

        for (const variant of variations) {
          try {
            console.log(`ProfileSetup: Trying ${variant.url.split('?')[0]} [Bucket: ${bucketName}]`);
            const uploadRes = await FileSystem.uploadAsync(variant.url, imageUri, {
              httpMethod: 'POST',
              uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
              headers: variant.headers,
            });

            if (uploadRes.status === 200) {
              successRes = JSON.parse(uploadRes.body);
              finalPath = path;
              finalBucket = bucketName;
              break;
            } else {
              console.log(`ProfileSetup: Failed (${uploadRes.status}): ${uploadRes.body.substring(0, 40)}`);
            }
          } catch (e) {
            console.log(`ProfileSetup: Error:`, e.message);
          }
        }
      }

      if (successRes) {
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${finalBucket}/o/${finalPath}?alt=media`;
        console.log('Photo uploaded successfully via native fallback! URL:', downloadUrl);
        return downloadUrl;
      } else {
        console.log("Storage upload failed, attempting Firestore Base64 fallback (optimized)...");
        const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
        const base64Length = base64.length;
        
        if (base64Length > 1048487) { // 1MB Firestore limit safety margin
          console.warn(`Photo too large for Firestore (${base64Length} chars). Falling back to placeholder.`);
          return user?.photoURL || ''; 
        }
        
        console.log(`Firestore fallback success: ${base64Length} chars.`);
        return `data:image/jpeg;base64,${base64}`;
      }
    } catch (uploadErr) {
      console.error('Native upload error in ProfileSetup:', uploadErr);
      throw uploadErr;
    }
  };

  const saveProfile = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Please enter your name.'); return; }
    const photoSrc = imageUri || imageUrl;
    if (!photoSrc) { Alert.alert('Required', 'Please add a profile photo.'); return; }

    // For guest mode (no Firebase user), generate a temporary local ID
    let uid = user?.uid || firebaseAuth?.currentUser?.uid;
    
    if (!uid) {
      console.log('No user UID found, checking auth state...');
      if (firebaseAuth?.currentUser) {
        uid = firebaseAuth.currentUser.uid;
      } else {
        // Wait a bit or error out if truly not logged in
        Alert.alert('Authentication required', 'Please wait for your login to complete or try logging in again.');
        return;
      }
    }

    setSaving(true);
    console.log('Profile save started for UID:', uid);
    
    // Safety timeout to prevent infinite hang
    const timeoutId = setTimeout(() => {
      if (saving) {
        setSaving(false);
        Alert.alert('Save Timeout', 'The connection to Firebase is taking too long. Please check your internet and try again.');
      }
    }, 15000);

    try {
      console.log('Uploading photo...');
      let basePhotoUrl = await uploadPhoto();
      // If upload returned null (too large, storage not set up), fall back to Google photo
      if (!basePhotoUrl) {
        basePhotoUrl = user?.photoURL || '';
        console.log('Using fallback photo URL:', basePhotoUrl || '(none)');
      }
      console.log('Photo URL resolved:', basePhotoUrl);
      
      if (!firestore) {
        console.log('Firestore not initialized, skipping DB write.');
        clearTimeout(timeoutId);
        router.replace('/(tabs)/discover');
        return;
      }

      console.log('Generating style embeddings (AI Processing)...');
      let visualEmbedding = null;
      try {
        // Embedgings take ~1-2s - we use the photoSrc (URL or Base64)
        visualEmbedding = await generateImageEmbedding(basePhotoUrl);
      } catch (embErr) {
        console.warn('Embedding generation error (skipping):', embErr);
      }
      
      console.log('Writing to Firestore...');
      await setDoc(doc(firestore, 'profiles', uid), {
        id: uid,
        name: name.trim(),
        email: user?.email || '',
        phone: phone.trim(),
        gender,
        basePhotoUrl: basePhotoUrl || '',
        visualEmbedding: visualEmbedding || [], // Storing the CLIP vector!
        visualProcessed: !!visualEmbedding,
        isGuest: !user,
        photoStoragePath: `base-photos/${uid}.jpg`,
        preferences: {
          gender: gender || 'all',
          sizes: [],
          styles: [],
        },
        wishlistCount: 0,
        tryOnCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      console.log('Profile & AI Embedding success!');
      clearTimeout(timeoutId);
      router.replace('/(tabs)/discover');
    } catch (e) {
      console.error('Save error:', e);
      clearTimeout(timeoutId);
      
      if (e.code === 'permission-denied') {
        console.warn('AI: Permission denied by Firestore. Bypassing save to allow local testing.');
        Alert.alert(
          'Firebase Permissions Restricted',
          'We couldn\'t save your profile to the cloud, but you can still use the app locally for now.\n\nRemember to update your Firestore Rules later!',
          [{ text: 'Continue Anyway', onPress: () => router.replace('/(tabs)/discover') }]
        );
      } else {
        Alert.alert('Save failed', e.message);
      }
    } finally {
      setSaving(false);
    }
  };


  const currentPhoto = imageUri || (imageUrl ? imageUrl : null);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          {STEPS.map((s, i) => (
            <View key={i} style={styles.progressStep}>
              <View style={[styles.progressDot, i <= step && styles.progressDotActive]}>
                {i < step && <Icon name="arrowLeft" size={12} color="white" />}
                {i === step && <View style={styles.progressDotInner} />}
              </View>
              {i < STEPS.length - 1 && (
                <View style={[styles.progressLine, i < step && styles.progressLineActive]} />
              )}
            </View>
          ))}
        </View>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            {/* STEP 0: Photo Upload */}
            {step === 0 && (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Add Your Photo</Text>
                <Text style={styles.stepSub}>This will be used to virtually try on clothes</Text>

                <Pressable onPress={pickFromGallery} style={styles.photoArea}>
                  {currentPhoto ? (
                    <Image source={{ uri: currentPhoto }} style={styles.photoPreview} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Icon name="camera" color={theme.colors.primary} size={36} strokeWidth={2} />
                      <Text style={styles.photoPlaceholderText}>Tap to upload</Text>
                      <Text style={styles.photoPlaceholderSub}>Use a clear full-body photo</Text>
                    </View>
                  )}
                  {currentPhoto && (
                    <View style={styles.photoEditBadge}>
                      <Icon name="edit" color="white" size={16} />
                    </View>
                  )}
                </Pressable>

                <View style={styles.photoOptions}>
                  <TouchableOpacity style={[styles.photoOption, photoMode === 'gallery' && styles.photoOptionActive]} onPress={pickFromGallery}>
                    <Icon name="image" size={18} color={photoMode === 'gallery' ? theme.colors.primary : theme.colors.textLight} />
                    <Text style={[styles.photoOptionText, photoMode === 'gallery' && styles.photoOptionTextActive]}>Gallery</Text>
                  </TouchableOpacity>
                  {user?.photoURL && (
                    <TouchableOpacity
                      style={[styles.photoOption, photoMode === 'google' && styles.photoOptionActive]}
                      onPress={() => { setImageUri(user.photoURL); setPhotoMode('google'); }}
                    >
                      <Icon name="user" size={18} color={photoMode === 'google' ? theme.colors.primary : theme.colors.textLight} />
                      <Text style={[styles.photoOptionText, photoMode === 'google' && styles.photoOptionTextActive]}>Google</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.photoOption, photoMode === 'url' && styles.photoOptionActive]} onPress={() => setPhotoMode('url')}>
                    <Icon name="send" size={18} color={photoMode === 'url' ? theme.colors.primary : theme.colors.textLight} />
                    <Text style={[styles.photoOptionText, photoMode === 'url' && styles.photoOptionTextActive]}>URL</Text>
                  </TouchableOpacity>
                </View>

                {photoMode === 'url' && (
                  <TextInput
                    style={styles.input}
                    placeholder="Paste photo URL..."
                    placeholderTextColor={theme.colors.textLight}
                    value={imageUrl}
                    onChangeText={setImageUrl}
                    onEndEditing={() => { if (imageUrl) setImageUri(imageUrl); }}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                )}
              </View>
            )}

            {/* STEP 1: Personal Info */}
            {step === 1 && (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>About You</Text>
                <Text style={styles.stepSub}>Help us personalize your experience</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <View style={styles.inputContainer}>
                    <Icon name="user" size={18} color={theme.colors.textLight} />
                    <TextInput
                      style={styles.inputField}
                      placeholder="Your name"
                      placeholderTextColor={theme.colors.textLight}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <View style={[styles.inputContainer, styles.inputDisabled]}>
                    <Icon name="mail" size={18} color={theme.colors.textLight} />
                    <TextInput
                      style={styles.inputField}
                      value={user?.email || ''}
                      editable={false}
                      placeholderTextColor={theme.colors.textLight}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <View style={styles.inputContainer}>
                    <Icon name="call" size={18} color={theme.colors.textLight} />
                    <TextInput
                      style={styles.inputField}
                      placeholder="+1 234 567 8900"
                      placeholderTextColor={theme.colors.textLight}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Gender</Text>
                  <View style={styles.genderRow}>
                    {GENDERS.map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.genderChip, gender === g && styles.genderChipActive]}
                        onPress={() => setGender(g)}
                      >
                        <Text style={[styles.genderChipText, gender === g && styles.genderChipTextActive]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* STEP 2: Done */}
            {step === 2 && (
              <View style={[styles.stepContainer, styles.doneContainer]}>
                <View style={styles.doneIcon}>
                  <Icon name="heart" color="white" size={48} />
                </View>
                <Text style={styles.stepTitle}>You're all set!</Text>
                <Text style={styles.stepSub}>
                  Your profile is ready. Start exploring outfits virtually — swipe right to try anything on.
                </Text>
                {currentPhoto && (
                  <Image source={{ uri: currentPhoto }} style={styles.donePhoto} />
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>

        {/* Navigation Buttons */}
        <View style={styles.navButtons}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => animateToNextStep(step - 1)}>
              <Icon name="arrowLeft" size={20} color={theme.colors.textDark} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, saving && styles.nextBtnDisabled]}
            onPress={() => {
              if (step < STEPS.length - 1) {
                animateToNextStep(step + 1);
              } else {
                saveProfile();
              }
            }}
            disabled={saving}
          >
            <Text style={styles.nextBtnText}>{step === STEPS.length - 1 ? (saving ? 'AI Processing...' : 'Start Exploring') : 'Continue'}</Text>
            {!saving && <Icon name="arrowLeft" size={20} color="white" style={{ transform: [{ rotate: '180deg' }] }} />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.secondary, paddingTop: 60 },
  progressContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 40, marginBottom: 40 },
  progressStep: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  progressDot: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 2,
    borderColor: '#EADDCA', justifyContent: 'center', alignItems: 'center', backgroundColor: 'white',
  },
  progressDotActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  progressDotInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'white' },
  progressLine: { flex: 1, height: 2, backgroundColor: '#EADDCA', marginHorizontal: 4 },
  progressLineActive: { backgroundColor: theme.colors.primary },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 20 },
  stepContainer: { gap: 20 },
  stepTitle: { fontSize: 28, fontWeight: theme.fonts.extraBold, color: theme.colors.primary },
  stepSub: { fontSize: 15, color: theme.colors.textLight, lineHeight: 22, marginTop: -8 },
  photoArea: {
    width: 180, height: 180, borderRadius: 90,
    overflow: 'hidden', backgroundColor: '#FFFBF0',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#EADDCA',
    alignSelf: 'center', marginVertical: 20,
  },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center', gap: 10 },
  photoPlaceholderText: { fontSize: 17, fontWeight: theme.fonts.semibold, color: theme.colors.textDark },
  photoPlaceholderSub: { fontSize: 13, color: theme.colors.textLight },
  photoEditBadge: {
    position: 'absolute', bottom: 16, right: 16, width: 40, height: 40,
    borderRadius: 20, backgroundColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  photoOptions: { flexDirection: 'row', gap: 10 },
  backBtn: {
    width: 56, height: 56, borderRadius: 18, borderWidth: 1.5, borderColor: '#EADDCA',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FFFBF0',
  },
  photoOptionActive: { borderColor: theme.colors.primary, backgroundColor: '#FFFBF0' },
  photoOptionText: { fontSize: 13, fontWeight: '600', color: theme.colors.textLight },
  photoOptionTextActive: { color: theme.colors.primary },
  input: {
    borderWidth: 1.5, borderColor: theme.colors.gray, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: theme.colors.textDark,
  },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, fontWeight: theme.fonts.bold, color: theme.colors.textDark, letterSpacing: 0.5 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: '#EADDCA', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFBF0',
  },
  inputDisabled: { backgroundColor: '#F5F5F5', opacity: 0.6 },
  inputField: { flex: 1, fontSize: 15, color: theme.colors.textDark },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genderChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: theme.colors.gray },
  genderChipActive: { borderColor: theme.colors.primary, backgroundColor: '#FFFBF0' },
  genderChipText: { fontSize: 14, color: theme.colors.textLight, fontWeight: theme.fonts.medium },
  genderChipTextActive: { color: theme.colors.primary, fontWeight: theme.fonts.bold },
  doneContainer: { alignItems: 'center', paddingTop: 20 },
  doneIcon: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  donePhoto: { width: 180, height: 220, borderRadius: 24, marginTop: 10 },
  navButtons: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 },
  backBtn: {
    width: 56, height: 56, borderRadius: 18, borderWidth: 1.5, borderColor: theme.colors.gray,
    justifyContent: 'center', alignItems: 'center',
  },
  nextBtn: {
    flex: 1, height: 56, backgroundColor: theme.colors.primary, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8,
    shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  nextBtnDisabled: { opacity: 0.6 },
  nextBtnText: { color: 'white', fontSize: 16, fontWeight: theme.fonts.bold },
});
