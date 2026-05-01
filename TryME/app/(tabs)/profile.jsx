import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, ScrollView,
  Alert, TextInput, ActivityIndicator, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { firebaseAuth, firestore, storage } from '../../lib/firebase';
import { generateImageEmbedding } from '../../lib/ai';
import { theme } from '@/constants/theme';
import { StatusBar } from 'expo-status-bar';
import Icon from '../../assets/icons';

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [imageUri, setImageUri] = useState(null);

  useEffect(() => {
    if (!firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, async (u) => {
      if (!u) { router.replace('/login'); return; }
      setUser(u);
      const snap = await getDoc(doc(firestore, 'profiles', u.uid));
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setName(data.name || '');
        setPhone(data.phone || '');
        setGender(data.gender || '');
        setImageUri(data.basePhotoUrl || null);
      }
    });
    return () => unsub();
  }, []);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.2, allowsEditing: true, aspect: [1, 1],
    });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  };

  const saveProfile = async () => {
    const currentUser = firebaseAuth?.currentUser;
    if (!currentUser) {
      Alert.alert('Authentication required', 'Please wait for your login to complete or try logging in again.');
      return;
    }
    setSaving(true);
    try {
      let photoUrl = profile?.basePhotoUrl;
      // Upload new photo if changed and it's a local file
      if (imageUri && imageUri !== profile?.basePhotoUrl && imageUri.startsWith('file://')) {
        console.log('Initiating native upload for profile update:', imageUri);
        
        const token = await firebaseAuth.currentUser.getIdToken();
        const sdkBucket = storage?.app?.options?.storageBucket;
        console.log('Firebase SDK reports bucket:', sdkBucket);
        
        // Try these bucket names in order
        const bucketOptions = [
          sdkBucket,
          "aura-ai-powered-fashion-aura.firebasestorage.app",
          "aura-ai-powered-fashion-aura.appspot.com",
          "aura-ai-powered-fashion-aura"
        ].filter(Boolean);

        let success = false;
        for (const bucketName of bucketOptions) {
          if (success) break;
          
          const path = encodeURIComponent(`base-photos/${currentUser.uid}.jpg`);
          
          // Endpoint variations
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
              console.log(`Trying native upload: ${variant.url.split('?')[0]} [Bucket: ${bucketName}]`);
              const uploadRes = await FileSystem.uploadAsync(variant.url, imageUri, {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
                headers: variant.headers,
              });

              if (uploadRes.status === 200) {
                photoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${path}?alt=media`;
                console.log(`SUCCESS with bucket ${bucketName}!`);
                success = true;
                break;
              } else {
                console.log(`Failed (${uploadRes.status}): ${uploadRes.body.substring(0, 40)}`);
              }
            } catch (err) {
              console.log(`Error:`, err.message);
            }
          }
        }

        if (!success) {
          console.log("Storage upload failed, attempting Firestore Base64 fallback (optimized)...");
          const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
          const base64Length = base64.length;
          
          if (base64Length > 1048487) { // 1MB Firestore limit safety margin
            console.warn(`Photo too large for Firestore (${base64Length} chars). Keeping existing photo.`);
            photoUrl = profile?.basePhotoUrl || '';
            success = true;
          } else {
            console.log(`Firestore fallback success: ${base64Length} chars.`);
            photoUrl = `data:image/jpeg;base64,${base64}`;
            success = true;
          }
        }
      }

      console.log('Generating AI Style Profile (Embeddings)...');
      let visualEmbedding = profile?.visualEmbedding || [];
      // Only regenerate if photo changed
      if (photoUrl !== profile?.basePhotoUrl) {
        try {
          visualEmbedding = await generateImageEmbedding(photoUrl);
        } catch (e) { console.log('AI Error:', e); }
      }

      const updated = { 
        name, 
        phone, 
        gender, 
        basePhotoUrl: photoUrl, 
        visualEmbedding: visualEmbedding || [],
        updatedAt: serverTimestamp() 
      };
      await setDoc(doc(firestore, 'profiles', user.uid), updated, { merge: true });
      setProfile(prev => ({ ...prev, ...updated }));
      setEditing(false);
    } catch (e) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          await signOut(firebaseAuth);
          router.replace('/login');
        }
      },
    ]);
  };

  const photoSrc = imageUri ? { uri: imageUri } : null;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable onPress={() => editing ? saveProfile() : setEditing(true)} style={styles.editBtn} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={theme.colors.primary} /> : (
              <Text style={styles.editBtnText}>{editing ? 'Save' : 'Edit'}</Text>
            )}
          </Pressable>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <Pressable onPress={editing ? pickPhoto : null}>
            <View style={styles.avatarRing}>
              {photoSrc
                ? <Image source={photoSrc} style={styles.avatar} />
                : <Icon name="user" size={48} color={theme.colors.primary} />
              }
            </View>
            {editing && (
              <View style={styles.avatarEditBadge}>
                <Icon name="camera" size={16} color="white" />
              </View>
            )}
          </Pressable>
          <Text style={styles.avatarName}>{profile?.name || 'Your Name'}</Text>
          <Text style={styles.avatarEmail}>{user?.email}</Text>
        </View>

        {/* Info section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Info</Text>

          <InfoRow
            label="Name" icon="user" value={name} editing={editing}
            onChangeText={setName} placeholder="Your name"
          />
          <InfoRow
            label="Phone" icon="call" value={phone} editing={editing}
            onChangeText={setPhone} placeholder="+1 234 567 8900"
            keyboardType="phone-pad"
          />
          <View style={styles.infoRow}>
            <Icon name="location" size={18} color={theme.colors.textLight} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
          </View>
        </View>

        {editing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gender</Text>
            <View style={styles.genderRow}>
              {GENDERS.map((g) => (
                <Pressable
                  key={g}
                  style={[styles.genderChip, gender === g && styles.genderChipActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.genderChipText, gender === g && styles.genderChipTextActive]}>{g}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          <Pressable style={styles.actionRow} onPress={() => router.push('/(tabs)/wishlist')}>
            <View style={styles.actionIcon}>
              <Icon name="heart" size={20} color={theme.colors.primary} />
            </View>
            <Text style={styles.actionText}>My Wishlist</Text>
            <Icon name="arrowLeft" size={18} color={theme.colors.textLight} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          <Pressable style={styles.actionRow} onPress={() => router.push('/profile-setup')}>
            <View style={styles.actionIcon}>
              <Icon name="camera" size={20} color={theme.colors.primary} />
            </View>
            <Text style={styles.actionText}>Update Model Photo</Text>
            <Icon name="arrowLeft" size={18} color={theme.colors.textLight} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          <Pressable style={[styles.actionRow, styles.signOutRow]} onPress={handleSignOut}>
            <View style={[styles.actionIcon, styles.signOutIcon]}>
              <Icon name="logout" size={20} color="#FF3B30" />
            </View>
            <Text style={[styles.actionText, styles.signOutText]}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, icon, value, editing, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={18} color={theme.colors.textLight} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        {editing ? (
          <TextInput
            style={styles.infoInput}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textLight}
            keyboardType={keyboardType || 'default'}
          />
        ) : (
          <Text style={styles.infoValue}>{value || '—'}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.secondary },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 10,
  },
  headerTitle: { fontSize: 28, fontWeight: theme.fonts.extraBold, color: theme.colors.textDark },
  editBtn: {
    paddingHorizontal: 18, paddingVertical: 8,
    backgroundColor: theme.colors.primary, borderRadius: 12,
  },
  editBtnText: { color: 'white', fontWeight: theme.fonts.bold, fontSize: 15 },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatarRing: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#FFFBF0', overflow: 'hidden',
    borderWidth: 3, borderColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatar: { width: '100%', height: '100%' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 32, height: 32,
    borderRadius: 16, backgroundColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'white',
  },
  avatarName: { fontSize: 22, fontWeight: theme.fonts.extraBold, color: theme.colors.textDark, marginTop: 12 },
  avatarEmail: { fontSize: 14, color: theme.colors.textLight, marginTop: 4 },
  section: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: 'white',
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#EADDCA',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontSize: 13, fontWeight: theme.fonts.bold, color: theme.colors.textLight, letterSpacing: 1, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: theme.colors.textLight, fontWeight: theme.fonts.semibold, letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: theme.colors.textDark, fontWeight: theme.fonts.medium, marginTop: 2 },
  infoInput: { fontSize: 15, color: theme.colors.textDark, paddingVertical: 0, marginTop: 2, borderBottomWidth: 1, borderBottomColor: theme.colors.primary },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genderChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: theme.colors.gray },
  genderChipActive: { borderColor: theme.colors.primary, backgroundColor: '#FFFBF0' },
  genderChipText: { fontSize: 13, color: theme.colors.textLight },
  genderChipTextActive: { color: theme.colors.primary, fontWeight: theme.fonts.bold },
  actionsSection: {
    marginHorizontal: 20, marginBottom: 40, backgroundColor: 'white',
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: '#EADDCA',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFFBF0',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#EADDCA',
  },
  actionText: { flex: 1, fontSize: 15, fontWeight: theme.fonts.semibold, color: theme.colors.textDark },
  signOutRow: { borderBottomWidth: 0 },
  signOutIcon: { backgroundColor: '#FFF1F1' },
  signOutText: { color: '#FF3B30' },
});
