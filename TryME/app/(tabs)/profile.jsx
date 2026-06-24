/**
 * profile.jsx — TrialX AI
 * Instagram + Pinterest style profile with cozy warm pastel theme.
 * Separate wishlist and try-on moodboards, emoji-free clean SVGs.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, ScrollView,
  Alert, TextInput, ActivityIndicator, Platform,
  Dimensions, FlatList, Share,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseAuth, firestore, uploadBase64Image } from '@/lib/firebase';
import { theme } from '@/constants/theme';
import { StatusBar } from 'expo-status-bar';
import Icon from '@/assets/icons';
import { Ionicons } from '@expo/vector-icons';
import { subscribeUserProfile, subscribeUserCommunityPosts, subscribeUserTryOns, getRankLabel } from '@/lib/community';
import { downloadTryOnImage, shareTryOnWhatsApp, APP_DOWNLOAD_LINK } from '@/lib/socialActions';
import * as Haptics from 'expo-haptics';

const { width: W } = Dimensions.get('window');
const GRID_ITEM_W = (W - 48) / 2;
const GRID_PAGE_SIZE = 6;

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [imageUri, setImageUri] = useState(null);
  
  // Stats & Collections
  const [communityPosts, setCommunityPosts] = useState([]);
  const [tryOnItems, setTryOnItems] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('tryon'); // 'tryon' | 'community'
  const [tryOnVisibleCount, setTryOnVisibleCount] = useState(GRID_PAGE_SIZE);
  const [communityVisibleCount, setCommunityVisibleCount] = useState(GRID_PAGE_SIZE);

  const [auraPoints, setAuraPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [profileTryOnCount, setProfileTryOnCount] = useState(0);
  const [profilePostCount, setProfilePostCount] = useState(0);

  useEffect(() => {
    if (!firebaseAuth) return;
    const unsubAuth = onAuthStateChanged(firebaseAuth, async u => {
      if (!u) { router.replace('/login'); return; }
      setUser(u);
    });
    return () => unsubAuth();
  }, []);

  // Real-time profile + collections
  useEffect(() => {
    if (!user || !firestore) return;

    let unsubProfile = () => { };
    let unsubCommunity = () => { };
    let unsubTryOns = () => { };

    user.getIdToken().then(() => {
      unsubProfile = subscribeUserProfile(user.uid, (d) => {
        if (d) {
          setProfile(d);
          setName(d.name || '');
          setPhone(d.phone || '');
          setGender(d.gender || '');
          setImageUri(d.basePhotoUrl || null);
          setAuraPoints(typeof d.auraPoints === 'number' ? d.auraPoints : 0);
          setStreak(typeof d.streak === 'number' ? d.streak : 0);
          setProfileTryOnCount(typeof d.tryOnCount === 'number' ? d.tryOnCount : 0);
          setProfilePostCount(typeof d.postCount === 'number' ? d.postCount : 0);
        }
      });

      unsubCommunity = subscribeUserCommunityPosts(user.uid, (posts) => {
        setCommunityPosts(posts);
        setCommunityVisibleCount(GRID_PAGE_SIZE);
      });

      unsubTryOns = subscribeUserTryOns(user.uid, (items) => {
        setTryOnItems(items);
        setTryOnVisibleCount(GRID_PAGE_SIZE);
      });
    }).catch(e => console.warn('[profile subscriptions] token refresh failed:', e.message));

    return () => {
      unsubProfile();
      unsubCommunity();
      unsubTryOns();
    };
  }, [user]);

  const showItemActions = (item, type = 'tryon') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      item.garmentDesc || item.caption || 'Your Look',
      'What would you like to do?',
      [
        {
          text: 'Share on WhatsApp',
          onPress: async () => {
            try {
              await shareTryOnWhatsApp({
                imageUrl: item.resultImageUrl,
                title: item.garmentDesc || item.caption,
                brand: item.brand,
              });
            } catch (_) { Alert.alert('Share Failed', 'Could not share.'); }
          },
        },
        {
          text: 'Download to Gallery',
          onPress: async () => {
            try {
              const { saved } = await downloadTryOnImage(item.resultImageUrl);
              Alert.alert(saved ? 'Saved!' : 'Shared', saved ? 'Saved to your gallery.' : 'Shared via system sheet.');
            } catch (_) { Alert.alert('Download Failed', 'Could not save image.'); }
          },
        },
        type === 'tryon' && item.buyLink ? {
          text: 'Buy Garment',
          onPress: () => Linking.openURL(item.buyLink).catch(() => { }),
        } : null,
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean)
    );
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.2, allowsEditing: true, aspect: [1, 1] });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  };

  const pickAndUpdateBasePhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to choose a model image.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, base64: true });
      if (!res.canceled) {
        setSaving(true);
        const uri = res.assets[0].uri;
        setImageUri(uri);
        let photoUrl = uri;
        if (res.assets[0].base64) {
          photoUrl = `data:image/jpeg;base64,${res.assets[0].base64}`;
        } else {
          const rawB64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
          photoUrl = `data:image/jpeg;base64,${rawB64}`;
        }

        let uploadedUrl = '';
        try {
          uploadedUrl = await uploadBase64Image(photoUrl, 'base-photos', `${user.uid}.jpg`);
        } catch (storageErr) {
          console.warn('Storage upload failed, trying base64 fallback in Firestore:', storageErr.message);
          if (photoUrl.length <= 1048487) {
            uploadedUrl = photoUrl;
          } else {
            throw new Error('Image too large. Please select a smaller photo or check connection.');
          }
        }

        await setDoc(doc(firestore, 'profiles', user.uid), {
          basePhotoUrl: uploadedUrl,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        setProfile(prev => ({ ...prev, basePhotoUrl: uploadedUrl }));
        setImageUri(uploadedUrl);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Updated ✨', 'Your try-on photo is live — new looks use it instantly.');
      }
    } catch (e) {
      Alert.alert('Upload Failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleShareProfile = async () => {
    try {
      const handle = (profile?.name || user?.email?.split('@')[0] || 'stylist').replace(/\s+/g, '');
      await Share.share({
        message: `Check out my TrialX AI style profile @${handle}\n${APP_DOWNLOAD_LINK}`,
        url: APP_DOWNLOAD_LINK,
      });
    } catch (_) { /* dismissed */ }
  };

  const handleStylePreferences = () => {
    setEditing(true);
    Haptics.selectionAsync();
  };

  const saveProfile = async () => {
    if (!firebaseAuth?.currentUser) { Alert.alert('Not signed in'); return; }
    setSaving(true);
    try {
      let photoUrl = profile?.basePhotoUrl || imageUri;
      if (imageUri && imageUri !== profile?.basePhotoUrl && (imageUri.startsWith('file://') || imageUri.startsWith('content://'))) {
        const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        try {
          photoUrl = await uploadBase64Image(dataUrl, 'base-photos', `${firebaseAuth.currentUser.uid}.jpg`);
        } catch (storageErr) {
          console.warn('Storage upload failed, trying base64 fallback in Firestore:', storageErr.message);
          if (dataUrl.length <= 1048487) {
            photoUrl = dataUrl;
          } else {
            throw new Error('Image too large to save. Check your connection.');
          }
        }
      }
      const updated = { name, phone, gender, basePhotoUrl: photoUrl };
      setProfile(prev => ({ ...prev, ...updated }));
      setEditing(false);
      await setDoc(doc(firestore, 'profiles', user.uid), {
        ...updated,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      Alert.alert('Profile Saved ✨');
    } catch (e) { Alert.alert('Save failed', e.message); }
    finally { setSaving(false); }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(firebaseAuth); router.replace('/login'); } },
    ]);
  };

  const rank = getRankLabel(auraPoints);
  const triesCount = Math.max(tryOnItems.length, profileTryOnCount);
  const postsCount = Math.max(communityPosts.length, profilePostCount);
  const visibleTryOns = tryOnItems.slice(0, tryOnVisibleCount);
  const visibleCommunity = communityPosts.slice(0, communityVisibleCount);

  const renderCommunityItem = ({ item }) => (
    <Pressable style={styles.gridCard} onLongPress={() => showItemActions(item, 'community')}>
      <Image source={{ uri: item.resultImageUrl || item.garmentImageUrl }} style={styles.gridImage} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(42,31,26,0.8)']} style={styles.gridGrad} />
      <View style={styles.gridBadge}>
        <Text style={styles.gridBadgeText}>Post</Text>
      </View>
      <View style={styles.gridInfo}>
        <Text style={styles.gridBrand} numberOfLines={1}>{(item.brand || 'COMMUNITY').toUpperCase()}</Text>
        <Text style={styles.gridTitle} numberOfLines={1}>{item.caption || item.garmentDesc}</Text>
      </View>
    </Pressable>
  );

  const renderTryOnItem = ({ item }) => (
    <Pressable
      style={styles.gridCard}
      onPress={() => item.buyLink && Linking.openURL(item.buyLink).catch(() => { })}
      onLongPress={() => showItemActions(item, 'tryon')}
    >
      <Image source={{ uri: item.resultImageUrl }} style={styles.gridImage} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(42,31,26,0.8)']} style={styles.gridGrad} />
      <View style={styles.gridBadge}>
        <Text style={styles.gridBadgeText}>AI Fit</Text>
      </View>
      <View style={styles.gridInfo}>
        <Text style={styles.gridBrand} numberOfLines={1}>{item.brand?.toUpperCase()}</Text>
        <Text style={styles.gridTitle} numberOfLines={1}>{item.garmentDesc}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Decorative Background Orbs */}
      <View style={[styles.orb, styles.orb1]} />
      <View style={[styles.orb, styles.orb2]} />
      
      {/* ── HEADER NAVIGATION */}
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Style ID</Text>
          <Pressable style={styles.editBtn} onPress={() => editing ? saveProfile() : setEditing(true)} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <>
                <Ionicons name={editing ? "checkmark" : "create-outline"} size={14} color="#C4785A" />
                <Text style={styles.editBtnText}>{editing ? 'Save' : 'Edit'}</Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── INSTAGRAM PROFILE CARD */}
        <View style={styles.heroSection}>
          <View style={styles.profileRow}>
            {/* Avatar on the Left */}
            <Pressable style={styles.avatarContainer} onPress={editing ? pickPhoto : null}>
              <View style={styles.avatarBorder}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.avatarImg} />
                ) : (
                  <Icon name="user" size={32} color={theme.colors.textSecondary} />
                )}
              </View>
              {editing && (
                <View style={styles.avatarEditOverlay}>
                  <Ionicons name="camera" size={12} color="white" />
                </View>
              )}
            </Pressable>

            {/* Horizontal Stats columns on Right */}
            <View style={styles.statsCard}>
              <View style={styles.statCol}>
                <Text style={styles.statValue}>{triesCount}</Text>
                <Text style={styles.statLabel}>Tries</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statValue}>{postsCount}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statValue}>🔥 {streak}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statValue}>{auraPoints}</Text>
                <Text style={styles.statLabel}>Aura</Text>
              </View>
            </View>
          </View>

          {/* Biography and tags */}
          <View style={styles.bioContainer}>
            <Text style={styles.profileName}>{profile?.name || 'Create ID Name'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            
            {/* Rank Badge - Premium gradient styling */}
            <LinearGradient
              colors={['#C4785A', '#E8A882']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.rankBadge}
            >
              <Icon name="sparkles" size={10} color="white" />
              <Text style={styles.rankText}>{rank}</Text>
            </LinearGradient>

            {/* Aesthetic statement */}
            <Text style={styles.bioText}>
              Vibe matcher mapping confidence. {postsCount} community posts · {triesCount} try-ons · {auraPoints} aura.
            </Text>
          </View>
        </View>

        {/* ── TOKENS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Style Wallet</Text>
          <View style={styles.tokenRow}>
            {[
              { iconName: 'sparkles', label: 'Aura Points', value: auraPoints, color: '#C4785A', bg: '#FDF2EC', gradient: ['#FFFFFF', '#FDF2EC'] },
              { iconName: 'location', label: 'Drip Coins', value: 125, color: '#C49A6C', bg: '#FDF6EC', gradient: ['#FFFFFF', '#FDF6EC'] },
              { iconName: 'heart', label: 'Style Creds', value: 48, color: '#6B9E7A', bg: '#EDF7EF', gradient: ['#FFFFFF', '#EDF7EF'] },
            ].map(t => (
              <View key={t.label} style={styles.tokenCard}>
                <LinearGradient
                  colors={t.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.tokenGradientContainer}
                >
                  {/* Top thin accent bar */}
                  <View style={[styles.tokenAccentBar, { backgroundColor: t.color }]} />
                  
                  <View style={styles.tokenCardContent}>
                    <View style={[styles.tokenIconCircle, { backgroundColor: t.bg }]}>
                      <Icon name={t.iconName} size={14} color={t.color} />
                    </View>
                    <Text style={styles.tokenValue}>{t.value}</Text>
                    <Text style={styles.tokenLabel}>{t.label.toUpperCase()}</Text>
                  </View>
                </LinearGradient>
              </View>
            ))}
          </View>
        </View>

        {/* ── PERSONAL INFO FIELD (edit mode only) */}
        {editing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Style Account Details</Text>
            <View style={styles.infoForm}>
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput style={styles.textInput} value={name} onChangeText={setName} placeholder="Your display name" />
              </View>
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput style={styles.textInput} value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
              </View>
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>Gender</Text>
                <View style={styles.genderRow}>
                  {['Male', 'Female'].map((g) => (
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
            </View>
          </View>
        )}

        {/* ── PINTEREST SUB-TABS SELECTOR */}
        <View style={styles.subTabsContainer}>
          <Pressable
            style={[styles.subTabButton, activeSubTab === 'tryon' && styles.subTabActive]}
            onPress={() => setActiveSubTab('tryon')}
          >
            <Icon name="image" size={16} color={activeSubTab === 'tryon' ? '#C4785A' : '#7A6055'} />
            <Text style={[styles.subTabText, activeSubTab === 'tryon' && styles.subTabActiveText]}>Try-Ons ({triesCount})</Text>
          </Pressable>
          <Pressable
            style={[styles.subTabButton, activeSubTab === 'community' && styles.subTabActive]}
            onPress={() => setActiveSubTab('community')}
          >
            <Icon name="video" size={16} color={activeSubTab === 'community' ? '#C4785A' : '#7A6055'} />
            <Text style={[styles.subTabText, activeSubTab === 'community' && styles.subTabActiveText]}>Community ({postsCount})</Text>
          </Pressable>
        </View>

        {/* Grid Lists (Separate subtabs) */}
        <View style={styles.gridContainer}>
          {activeSubTab === 'community' ? (
            <>
              <FlatList
                data={visibleCommunity}
                renderItem={renderCommunityItem}
                keyExtractor={i => i.id}
                numColumns={2}
                scrollEnabled={false}
                contentContainerStyle={styles.gridList}
                columnWrapperStyle={styles.gridRow}
                ListEmptyComponent={() => (
                  <View style={styles.gridEmpty}>
                    <Text style={styles.emptyText}>{"You haven't posted to the Community yet."}</Text>
                  </View>
                )}
              />
              {communityPosts.length > communityVisibleCount && (
                <Pressable
                  style={styles.seeMoreBtn}
                  onPress={() => setCommunityVisibleCount(c => c + GRID_PAGE_SIZE)}
                >
                  <Text style={styles.seeMoreText}>
                    See more ({communityPosts.length - communityVisibleCount} left)
                  </Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              <FlatList
                data={visibleTryOns}
                renderItem={renderTryOnItem}
                keyExtractor={i => i.id}
                numColumns={2}
                scrollEnabled={false}
                contentContainerStyle={styles.gridList}
                columnWrapperStyle={styles.gridRow}
                ListEmptyComponent={() => (
                  <View style={styles.gridEmpty}>
                    <Text style={styles.emptyText}>{"You haven't run any AI Try-Ons yet."}</Text>
                  </View>
                )}
              />
              {tryOnItems.length > tryOnVisibleCount && (
                <Pressable
                  style={styles.seeMoreBtn}
                  onPress={() => setTryOnVisibleCount(c => c + GRID_PAGE_SIZE)}
                >
                  <Text style={styles.seeMoreText}>
                    See more ({tryOnItems.length - tryOnVisibleCount} left)
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Options</Text>
          <View style={styles.actionsCard}>
            {[
              { ionicon: 'sparkles-outline', label: 'Generate Custom Try-On', onPress: () => router.push('/custom-tryon') },
              { ionicon: 'camera-outline', label: 'Upload Try-On Photo', onPress: pickAndUpdateBasePhoto },
              { ionicon: 'color-wand-outline', label: 'Recalibrate AI Twin', onPress: pickAndUpdateBasePhoto },
              { ionicon: 'options-outline', label: 'Style Preferences', onPress: handleStylePreferences },
              { ionicon: 'share-social-outline', label: 'Share Profile Link', onPress: handleShareProfile },
            ].map((a, i) => (
              <Pressable key={a.label} style={[styles.actionRow, i === 4 && styles.actionRowLast]} onPress={a.onPress}>
                <View style={[styles.actionIconCircle, i === 0 && styles.actionIconCirclePrimary]}>
                  <Ionicons name={a.ionicon} size={16} color={i === 0 ? '#C4785A' : '#7A6055'} />
                </View>
                <Text style={[styles.actionText, i === 0 && styles.actionTextPrimary]}>{a.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#B8A49A" />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Sign Out */}
        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={16} color="#C4604A" />
          <Text style={styles.signOutText}>Sign Out Account</Text>
        </Pressable>

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F4' },
  safeHeader: { backgroundColor: 'transparent' },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, height: 56,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#2A1F1A', letterSpacing: 0.5 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 1, borderColor: '#EDE0D4',
    shadowColor: '#2A1F1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  editBtnText: { color: '#C4785A', fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },

  scrollContent: { paddingTop: 16 },

  // Decorative Background Orbs
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: W * 0.6, height: W * 0.6,
    top: -W * 0.15, right: -W * 0.1,
    backgroundColor: 'rgba(238, 196, 170, 0.18)',
  },
  orb2: {
    width: W * 0.45, height: W * 0.45,
    bottom: '45%', left: -W * 0.15,
    backgroundColor: 'rgba(237, 213, 176, 0.15)',
  },

  // Hero Card
  heroSection: {
    paddingHorizontal: 20, paddingBottom: 16,
  },
  profileRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  avatarContainer: { position: 'relative' },
  avatarBorder: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2, borderColor: '#C4785A',
    padding: 3,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FAF7F4',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 40 },
  avatarEditOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#C4785A', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FAF7F4',
  },
  statsCard: {
    flexDirection: 'row', flex: 1, justifyContent: 'space-around', alignItems: 'center',
    marginLeft: 16, backgroundColor: '#FFFFFF', borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 8,
    borderWidth: 1, borderColor: '#EDE0D4',
    shadowColor: '#2A1F1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statDivider: {
    width: 1, height: 24, backgroundColor: '#F5EDE4',
  },
  statCol: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '900', color: '#2A1F1A' },
  statLabel: { fontSize: 11, color: '#7A6055', fontWeight: '700', marginTop: 2 },

  // Bio
  bioContainer: { marginTop: 14, gap: 5 },
  profileName: { fontSize: 20, fontWeight: '900', color: '#2A1F1A' },
  profileEmail: { fontSize: 12, color: '#B8A49A', fontWeight: '600' },
  rankBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, alignSelf: 'flex-start',
    marginTop: 4,
  },
  rankText: { fontSize: 10, fontWeight: '800', color: 'white', textTransform: 'uppercase', letterSpacing: 0.5 },
  bioText: { fontSize: 13, color: '#7A6055', lineHeight: 18, marginTop: 4 },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#B8A49A', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },

  // Wallet Tokens
  tokenRow: { flexDirection: 'row', gap: 10 },
  tokenCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE0D4',
    overflow: 'hidden',
    shadowColor: '#2A1F1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  tokenGradientContainer: {
    flex: 1,
    width: '100%',
  },
  tokenAccentBar: {
    height: 3,
    width: '100%',
  },
  tokenCardContent: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
  },
  tokenIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2A1F1A',
    lineHeight: 26,
    marginTop: 2,
  },
  tokenLabel: {
    fontSize: 9,
    color: '#7A6055',
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
  },

  // Edit details form
  infoForm: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 12,
    borderWidth: 1, borderColor: '#EDE0D4',
  },
  inputField: { gap: 4 },
  inputLabel: { fontSize: 11, color: '#7A6055', fontWeight: '800', letterSpacing: 0.5 },
  textInput: {
    color: '#2A1F1A', fontSize: 14, fontWeight: '600',
    borderBottomWidth: 1, borderBottomColor: '#EDE0D4',
    paddingVertical: 4,
  },

  // Pinterest sub-tabs
  subTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0E6DD',
    borderRadius: 24,
    padding: 4,
    marginHorizontal: 20,
    marginTop: 24,
  },
  subTabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 20,
  },
  subTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#2A1F1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  subTabText: { fontSize: 13, color: '#7A6055', fontWeight: '700' },
  subTabActiveText: { color: '#2A1F1A', fontWeight: '800' },

  // Grid
  gridContainer: { padding: 16 },
  gridList: { paddingBottom: 10 },
  gridRow: { gap: 12, marginBottom: 12 },
  gridCard: {
    width: GRID_ITEM_W, height: GRID_ITEM_W * 1.35, borderRadius: 16,
    overflow: 'hidden', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#EDE0D4',
    shadowColor: '#2A1F1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  gridImage: { ...StyleSheet.absoluteFillObject },
  gridGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%' },
  gridInfo: { position: 'absolute', bottom: 10, left: 10, right: 10 },
  gridBrand: { fontSize: 8, fontWeight: '800', color: '#EEC4AA', letterSpacing: 1 },
  gridTitle: { fontSize: 11, fontWeight: '700', color: 'white' },
  gridEmpty: { paddingVertical: 44, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#B8A49A', fontSize: 13, fontWeight: '600' },
  seeMoreBtn: {
    marginTop: 8, marginBottom: 4, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDE0D4', alignItems: 'center',
  },
  seeMoreText: { fontSize: 14, fontWeight: '800', color: '#C4785A' },
  gridBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(42, 31, 26, 0.45)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
  },
  gridBadgeText: { fontSize: 8, fontWeight: '800', color: 'white', letterSpacing: 0.5, textTransform: 'uppercase' },

  // Settings
  actionsCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: '#EDE0D4',
    shadowColor: '#2A1F1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIconCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F5EDE4', alignItems: 'center', justifyContent: 'center',
  },
  actionIconCirclePrimary: {
    backgroundColor: '#FDE8DC',
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#F7F0EB',
  },
  actionRowLast: { borderBottomWidth: 0 },
  actionText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#2A1F1A' },
  actionTextPrimary: { color: '#C4785A' },

  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 32,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#FDF5F2',
    gap: 8,
  },
  signOutText: { color: '#C4604A', fontWeight: '800', fontSize: 14 },
  genderRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  genderChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#EDE0D4', backgroundColor: '#FFFFFF' },
  genderChipActive: { borderColor: '#C4785A', backgroundColor: '#FDF2EC' },
  genderChipText: { fontSize: 13, color: '#7A6055', fontWeight: '600' },
  genderChipTextActive: { color: '#C4785A', fontWeight: '800' },
});