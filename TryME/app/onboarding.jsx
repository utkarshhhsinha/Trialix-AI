import React, { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import ScreenWrapper from '../components/ScreenWrapper';
import Button from '../components/Button';
import { theme } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { firebaseAuth, firebaseConfigError, firestore, storage } from '../lib/firebase';
import Icon from '../assets/icons';
import { StatusBar } from 'expo-status-bar';

export default function Onboarding() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) router.replace('/login');
  }, [router, user]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to upload your base photo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (res.canceled) return;
    setImageUri(res.assets?.[0]?.uri ?? null);
  };

  const uploadBasePhoto = async () => {
    if (firebaseConfigError || !storage || !firestore) {
      Alert.alert('Firebase not configured', firebaseConfigError ?? 'Missing Firebase instance.');
      return;
    }
    if (!user) return;
    if (!imageUri) {
      Alert.alert('Upload a photo', 'Pick a clear full-body photo first.');
      return;
    }

    try {
      setUploading(true);
      const token = await user.getIdToken();

      let localFileToUpload = imageUri;
      let isTempCompressed = false;

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
        console.warn('[Onboarding] Client compression failed, uploading original:', err.message);
      }

      console.log('Initiating native upload for onboarding:', localFileToUpload);
      
      const bucketOptions = [
        "aura-ai-powered-fashion-aura.firebasestorage.app",
        "aura-ai-powered-fashion-aura.appspot.com",
        "aura-ai-powered-fashion-aura"
      ];

      let successRes = null;
      let finalPath = "";
      let finalBucket = "";

      for (const bucketName of bucketOptions) {
        if (successRes) break;
        const path = encodeURIComponent(`base-photos/${user.uid}.jpg`);
        
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
            console.log(`Onboarding: Trying ${variant.url.split('?')[0]} [Bucket: ${bucketName}]`);
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
            } else {
              console.log(`Onboarding: Failed (${uploadRes.status}): ${uploadRes.body.substring(0, 40)}`);
            }
          } catch (e) {
            console.log(`Onboarding: Error:`, e.message);
          }
        }
      }

      // Clean up compressed temp file
      if (isTempCompressed && localFileToUpload.includes(FileSystem.cacheDirectory)) {
        FileSystem.deleteAsync(localFileToUpload, { idempotent: true }).catch(() => {});
      }

      if (!successRes) {
        throw new Error("Failed to upload base photo to Firebase Storage. Please check your internet connection.");
      }

      const basePhotoUrl = `https://firebasestorage.googleapis.com/v0/b/${finalBucket}/o/${finalPath}?alt=media&t=${Date.now()}`;
      console.log('Onboarding photo uploaded successfully! URL:', basePhotoUrl);

      const profileRef = doc(firestore, 'profiles', user.uid);
      const existing = await getDoc(profileRef);
      await setDoc(
        profileRef,
        {
          id: user.uid,
          email: user.email ?? null,
          displayName: user.displayName ?? null,
          basePhotoUrl,
          createdAt: existing.exists() ? existing.data()?.createdAt ?? serverTimestamp() : serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      router.replace('/swipe');
    } catch (e) {
      Alert.alert(
        'Upload Failed',
        'Firebase Storage is not enabled on this project. Would you like to use a default profile photo to complete your onboarding?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Use Default Photo',
            onPress: async () => {
              setUploading(true);
              try {
                const defaultPhoto = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=450&q=80';
                const profileRef = doc(firestore, 'profiles', user.uid);
                const existing = await getDoc(profileRef);
                await setDoc(
                  profileRef,
                  {
                    id: user.uid,
                    email: user.email ?? null,
                    displayName: user.displayName ?? null,
                    basePhotoUrl: defaultPhoto,
                    createdAt: existing.exists() ? existing.data()?.createdAt ?? serverTimestamp() : serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  },
                  { merge: true }
                );
                router.replace('/swipe');
              } catch (saveErr) {
                Alert.alert('Save failed', saveErr.message);
              } finally {
                setUploading(false);
              }
            }
          }
        ]
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScreenWrapper bg={theme.colors.secondary}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Model Photo</Text>
          <Text style={styles.subtitle}>
            Upload a clear, full-body photo of yourself to begin your virtual trial journey.
          </Text>
        </View>

        <Pressable 
          onPress={pickImage} 
          style={[
            styles.uploadArea,
            imageUri && styles.uploadAreaActive
          ]}
        >
          {imageUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUri }} style={styles.previewImg} />
              <View style={styles.uploadIconFloating}>
                <Icon name="plus" color="white" size={24} />
              </View>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <View style={styles.cameraCircle}>
                <Icon name="camera" color={theme.colors.primary} size={32} strokeWidth={2.5} />
              </View>
              <Text style={styles.uploadTitle}>Tap to upload photo</Text>
              <Text style={styles.uploadSub}>Supported formats: JPG, PNG</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.footer}>
          <Button 
            title="Continue" 
            onPress={uploadBasePhoto} 
            loading={uploading} 
            disabled={!imageUri}
            buttonStyle={styles.continueButton}
          />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 24, 
    justifyContent: 'space-between' 
  },
  header: {
    marginTop: 20,
    gap: 8,
  },
  title: { 
    fontSize: 28, 
    fontWeight: theme.fonts.bold, 
    color: theme.colors.primary 
  },
  subtitle: { 
    fontSize: 16,
    color: theme.colors.textLight,
    lineHeight: 24,
  },
  uploadArea: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: theme.radius.xxxl,
    borderWidth: 2,
    borderColor: 'rgba(75, 56, 50, 0.2)', // Soft umber border
    borderStyle: 'dashed',
    backgroundColor: '#FFFBF0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uploadAreaActive: {
    borderStyle: 'solid',
    borderColor: theme.colors.primary,
    borderWidth: 3,
  },
  placeholderContainer: {
    alignItems: 'center',
    gap: 12,
  },
  cameraCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: theme.fonts.semibold,
    color: theme.colors.primary,
  },
  uploadSub: {
    fontSize: 14,
    color: theme.colors.textLight,
  },
  previewContainer: {
    width: '100%',
    height: '100%',
  },
  previewImg: { 
    width: '100%', 
    height: '100%',
  },
  uploadIconFloating: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  footer: {
    marginBottom: 20,
  },
  continueButton: {
    height: 56,
  }
});