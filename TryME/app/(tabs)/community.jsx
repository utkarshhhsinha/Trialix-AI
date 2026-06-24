/**
 * community.jsx — TrialX AI
 * Real-time community feed from Firestore community_posts.
 * Live likes, comments, WhatsApp share, and gallery download.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Image,
  Dimensions, Alert, Modal, TextInput, KeyboardAvoidingView,
  Platform, Animated, ScrollView, ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import * as Haptics from 'expo-haptics';
import { theme } from '@/constants/theme';
import Icon from '@/assets/icons';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  subscribeCommunityFeed,
  togglePostLike,
  subscribePostComments,
  addPostComment,
  subscribeUserLikes,
} from '@/lib/community';
import {
  downloadTryOnImage,
  shareTryOnWhatsApp,
  formatUserHandle,
} from '@/lib/socialActions';

const { width: W, height: H } = Dimensions.get('window');

const resolveImageSource = (source) => {
  if (!source) return null;
  if (typeof source === 'number') return source;
  if (typeof source === 'string') {
    if (source.startsWith('http') || source.startsWith('data:') || source.startsWith('file://')) {
      return { uri: source };
    }
    const num = Number(source);
    if (!isNaN(num) && source.trim() !== '') {
      return num;
    }
  }
  if (typeof source === 'object' && source.uri) {
    return source;
  }
  return null;
};

export default function Community() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState({});

  const [activePost, setActivePost] = useState(null);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentsUnsubRef = useRef(null);

  const [pointsToast, setPointsToast] = useState(null);
  const toastY = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (!firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, u => setUser(u));
    return () => unsub();
  }, []);

  // Real-time community feed — deferred until tab transition completes
  useEffect(() => {
    if (!user) {
      setFeed([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsub = null;
    const task = InteractionManager.runAfterInteractions(() => {
      unsub = subscribeCommunityFeed(
        (posts) => {
          setFeed(posts);
          setLoading(false);
        },
        () => setLoading(false)
      );
    });
    return () => {
      task.cancel();
      if (unsub) unsub();
    };
  }, [user]);

  // Real-time user likes — deferred until tab transition completes
  useEffect(() => {
    if (!user) {
      setLikedPosts({});
      return;
    }
    let unsub = null;
    const task = InteractionManager.runAfterInteractions(() => {
      unsub = subscribeUserLikes(user.uid, setLikedPosts);
    });
    return () => {
      task.cancel();
      if (unsub) unsub();
    };
  }, [user]);

  // Real-time comments for active post
  useEffect(() => {
    if (commentsUnsubRef.current) {
      commentsUnsubRef.current();
      commentsUnsubRef.current = null;
    }
    if (!activePost?.id || !commentsVisible) {
      setComments([]);
      return;
    }

    commentsUnsubRef.current = subscribePostComments(activePost.id, setComments);
    return () => {
      if (commentsUnsubRef.current) commentsUnsubRef.current();
    };
  }, [activePost?.id, commentsVisible]);

  const triggerPointsToast = (text, points) => {
    setPointsToast({ text, points });
    Animated.sequence([
      Animated.timing(toastY, { toValue: 60, duration: 400, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastY, { toValue: -120, duration: 400, useNativeDriver: true }),
    ]).start(() => setPointsToast(null));
  };

  const handleLike = async (post) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const wasLiked = likedPosts[post.id];

    // Optimistic update
    setLikedPosts(prev => ({ ...prev, [post.id]: !wasLiked }));
    setFeed(prev => prev.map(p =>
      p.id === post.id ? { ...p, likes: wasLiked ? Math.max(0, p.likes - 1) : p.likes + 1 } : p
    ));

    try {
      const nowLiked = await togglePostLike(post.id, user.uid);
      setLikedPosts(prev => ({ ...prev, [post.id]: nowLiked }));
      if (nowLiked) triggerPointsToast('Fit Rated Slay!', 5);
    } catch (err) {
      // Revert on failure
      setLikedPosts(prev => ({ ...prev, [post.id]: wasLiked }));
      setFeed(prev => prev.map(p =>
        p.id === post.id ? { ...p, likes: post.likes } : p
      ));
      Alert.alert('Like Failed', err.message);
    }
  };

  const handleOpenComments = (post) => {
    setActivePost(post);
    setCommentsVisible(true);
  };

  const handleSubmitComment = async () => {
    if (!newCommentText.trim() || !user || !activePost) return;
    setSubmittingComment(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const userName = formatUserHandle(user);
      await addPostComment(activePost.id, {
        userId: user.uid,
        userName,
        text: newCommentText.trim(),
      });
      setNewCommentText('');
      setFeed(prev => prev.map(p =>
        p.id === activePost.id ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p
      ));
      triggerPointsToast('Style Comment Added!', 10);
    } catch (err) {
      Alert.alert('Comment Failed', err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleShare = async (item) => {
    if (!item?.resultImageUrl) {
      Alert.alert('Share Failed', 'No image available for this post.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await shareTryOnWhatsApp({
        imageUrl: item.resultImageUrl,
        title: item.garmentDesc,
        brand: item.brand,
        userName: item.userName,
      });
    } catch (err) {
      Alert.alert('Share Failed', err.message || 'Could not share this look.');
    }
  };

  const handleDownload = async (item) => {
    if (!item?.resultImageUrl) {
      Alert.alert('Download Failed', 'No image available for this post.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { saved } = await downloadTryOnImage(item.resultImageUrl);
      Alert.alert(saved ? 'Saved!' : 'Shared', saved ? 'Image saved to your gallery.' : 'Image shared via system sheet.');
    } catch (err) {
      Alert.alert('Download Failed', err.message || 'Could not save the image.');
    }
  };

  const handleTryOnRedirect = (item) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push('/(tabs)/discover');
  };

  const renderReelItem = ({ item }) => {
    const isLiked = likedPosts[item.id];
    const bgSrc = resolveImageSource(item.resultImageUrl);
    const userSrc = resolveImageSource(item.userPhotoUrl);
    const garmentSrc = resolveImageSource(item.garmentImageUrl);

    return (
      <View style={styles.reelItem}>
        {bgSrc ? (
          <Image source={bgSrc} style={styles.backgroundImage} resizeMode="cover" />
        ) : (
          <View style={[styles.backgroundImage, { backgroundColor: '#1A1512' }]} />
        )}
        <LinearGradient colors={['rgba(42,31,26,0.3)', 'transparent']} style={styles.gradientTop} />
        <LinearGradient colors={['transparent', 'rgba(42,31,26,0.85)']} style={styles.gradientBottom} />

        <View style={styles.actionColumn}>
          <View style={styles.avatarContainer}>
            <Pressable style={styles.avatarWrap} onPress={() => router.push('/(tabs)/profile')}>
              {userSrc ? (
                <Image source={userSrc} style={styles.avatarImg} />
              ) : (
                <Text style={{ fontSize: 18 }}>🪞</Text>
              )}
            </Pressable>
          </View>

          <Pressable style={styles.actionBtn} onPress={() => handleLike(item)}>
            <View style={[styles.iconCircle, isLiked && styles.likedCircle]}>
              <Icon name="heart" size={24} color={isLiked ? '#C4604A' : 'white'} fill={isLiked ? '#C4604A' : 'transparent'} />
            </View>
            <Text style={styles.actionText}>{item.likes ?? 0}</Text>
          </Pressable>

          <Pressable style={styles.actionBtn} onPress={() => handleOpenComments(item)}>
            <View style={styles.iconCircle}>
              <Icon name="comment" size={24} color="white" />
            </View>
            <Text style={styles.actionText}>{item.commentsCount ?? 0}</Text>
          </Pressable>

          <Pressable style={styles.actionBtn} onPress={() => handleShare(item)}>
            <View style={styles.iconCircle}>
              <Ionicons name="share-social-outline" size={24} color="white" />
            </View>
            <Text style={styles.actionText}>Share</Text>
          </Pressable>


        </View>

        <View style={styles.infoContainer}>
          <View style={styles.usernameRow}>
            <Text style={styles.usernameText}>{item.userName || 'Anonymous'}</Text>
            {item.rank ? (
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{item.rank}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.captionText} numberOfLines={2}>{item.caption || ''}</Text>

          <Pressable style={styles.tryOnBanner} onPress={() => handleTryOnRedirect(item)}>
            <View style={styles.tryOnInfo}>
              {garmentSrc ? (
                <Image source={garmentSrc} style={styles.tryOnThumb} />
              ) : (
                <View style={[styles.tryOnThumb, { backgroundColor: '#EDE0D4', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="shirt-outline" size={16} color="#C4785A" />
                </View>
              )}
              <View>
                <Text style={styles.tryOnTitle} numberOfLines={1}>{item.garmentDesc || 'Fashion Look'}</Text>
                <Text style={styles.tryOnBrand}>{(item.brand || '').toUpperCase()}</Text>
              </View>
            </View>
            <LinearGradient colors={['#C4785A', '#E8A882']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tryOnBtn}>
              <Text style={styles.tryOnBtnText}>Try On</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <SafeAreaView edges={['top']} style={styles.floatingHeader}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Community</Text>
          <Text style={styles.headerSubtitle}>Live AI Fits from real users</Text>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color="#C4785A" />
          <Text style={styles.emptyText}>Loading community feed…</Text>
        </View>
      ) : feed.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={56} color="#C4785A" />
          <Text style={styles.emptyTitle}>No posts yet</Text>
          <Text style={styles.emptyText}>Generate a try-on look and tap Post to share with the community.</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/(tabs)/discover')}>
            <Text style={styles.emptyBtnText}>Create Your First Look</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={feed}
          renderItem={renderReelItem}
          keyExtractor={i => i.id}
          pagingEnabled={false}
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={H}
          snapToAlignment="start"
          disableIntervalMomentum={true}
          removeClippedSubviews={true}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          getItemLayout={(_, index) => ({ length: H, offset: H * index, index })}
        />
      )}

      {pointsToast && (
        <Animated.View style={[styles.toastContainer, { transform: [{ translateY: toastY }] }]}>
          <View style={styles.toastCard}>
            <View style={styles.toastPointsCircle}>
              <Text style={styles.toastPointsText}>+{pointsToast.points}</Text>
            </View>
            <View>
              <Text style={styles.toastLabel}>Aura Points Earned!</Text>
              <Text style={styles.toastSub}>{pointsToast.text}</Text>
            </View>
          </View>
        </Animated.View>
      )}

      <Modal visible={commentsVisible} transparent animationType="slide" onRequestClose={() => setCommentsVisible(false)}>
        <Pressable style={styles.commentsOverlay} onPress={() => setCommentsVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.commentsAvoid}>
            <Pressable style={styles.commentsContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Comments ({comments.length})</Text>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.commentsScroll}>
                {comments.map((comment) => (
                  <View key={comment.id} style={styles.commentRow}>
                    <View style={styles.commentAvatar}>
                      <Icon name="user" size={14} color={theme.colors.textSecondary} />
                    </View>
                    <View style={styles.commentTextContent}>
                      <Text style={styles.commentUser}>{comment.user}</Text>
                      <Text style={styles.commentText}>{comment.text}</Text>
                    </View>
                  </View>
                ))}
                {comments.length === 0 && (
                  <Text style={styles.noComments}>Be the first to comment on this fit!</Text>
                )}
              </ScrollView>

              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  value={newCommentText}
                  onChangeText={setNewCommentText}
                  placeholder="Share your thoughts on this fit..."
                  placeholderTextColor={theme.colors.textMuted}
                  selectionColor={theme.colors.primary}
                />
                <Pressable
                  style={styles.commentSendBtn}
                  onPress={handleSubmitComment}
                  disabled={submittingComment}
                >
                  <Text style={styles.commentSendText}>{submittingComment ? '…' : 'Post'}</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: 'white' },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 12, backgroundColor: '#C4785A', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  emptyBtnText: { color: 'white', fontWeight: '800', fontSize: 14 },

  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: 'white', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '700' },

  reelItem: { width: W, height: H, backgroundColor: '#0D0D0D', position: 'relative' },
  backgroundImage: { ...StyleSheet.absoluteFillObject },
  gradientTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 160 },
  gradientBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 280 },

  actionColumn: { position: 'absolute', bottom: 120, right: 14, alignItems: 'center', gap: 18, zIndex: 5 },
  avatarContainer: { position: 'relative', marginBottom: 6 },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: '#C4785A', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  actionBtn: { alignItems: 'center', gap: 4 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(42,31,26,0.36)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  likedCircle: { backgroundColor: 'rgba(255,255,255,0.9)', borderColor: 'white' },
  actionText: { fontSize: 11, fontWeight: '800', color: 'white' },

  infoContainer: { position: 'absolute', bottom: 100, left: 16, right: 80, gap: 8, zIndex: 4 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  usernameText: { color: 'white', fontWeight: '900', fontSize: 16 },
  rankBadge: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(196,154,108,0.2)', borderRadius: 10, borderWidth: 0.5, borderColor: '#EDD5B0' },
  rankText: { fontSize: 9, color: '#C49A6C', fontWeight: '800' },
  captionText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18, fontWeight: '500' },

  tryOnBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 10, width: '100%', marginTop: 8 },
  tryOnInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  tryOnThumb: { width: 36, height: 44, borderRadius: 8, backgroundColor: '#FAF7F4' },
  tryOnTitle: { fontSize: 13, fontWeight: '800', color: '#2A1F1A', flex: 1 },
  tryOnBrand: { fontSize: 9, fontWeight: '800', color: '#C4785A', marginTop: 1, letterSpacing: 0.5 },
  tryOnBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  tryOnBtnText: { color: 'white', fontSize: 12, fontWeight: '800' },

  toastContainer: { position: 'absolute', left: 20, right: 20, zIndex: 100, alignItems: 'center' },
  toastCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 14, borderWidth: 1.5, borderColor: '#EDD5B0' },
  toastPointsCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FDF6EC', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#EDD5B0' },
  toastPointsText: { fontSize: 15, fontWeight: '900', color: '#C49A6C' },
  toastLabel: { fontSize: 13, fontWeight: '800', color: '#2A1F1A' },
  toastSub: { fontSize: 11, fontWeight: '700', color: '#7A6055', marginTop: 1 },

  commentsOverlay: { flex: 1, backgroundColor: 'rgba(42,31,26,0.6)', justifyContent: 'flex-end' },
  commentsAvoid: { width: '100%' },
  commentsContent: { backgroundColor: '#FAF7F4', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20, paddingBottom: Platform.OS === 'ios' ? 44 : 24, height: H * 0.55, borderTopWidth: 1, borderTopColor: '#EDE0D4' },
  sheetHandle: { width: 40, height: 5, backgroundColor: '#EDE0D4', borderRadius: 3, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '900', color: '#2A1F1A', textAlign: 'center', marginBottom: 16 },
  commentsScroll: { flex: 1, marginBottom: 16 },
  commentRow: { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'flex-start' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5EDE4', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: '#EDE0D4' },
  commentTextContent: { flex: 1, gap: 2 },
  commentUser: { fontSize: 12, fontWeight: '800', color: '#2A1F1A' },
  commentText: { fontSize: 13, color: '#7A6055', lineHeight: 18 },
  noComments: { color: '#B8A49A', fontSize: 14, textAlign: 'center', marginTop: 32 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EDE0D4', height: 48 },
  commentInput: { flex: 1, color: '#2A1F1A', fontSize: 14, fontWeight: '500' },
  commentSendBtn: { paddingHorizontal: 12 },
  commentSendText: { color: '#C4785A', fontWeight: '800', fontSize: 14 },
});
