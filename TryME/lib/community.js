/**
 * Real-time community feed helpers — Firestore listeners, likes, comments.
 */
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc, setDoc, deleteDoc, addDoc, updateDoc,
  increment, serverTimestamp, where, writeBatch,
  collectionGroup,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { theme } from '@/constants/theme';

function getRankLabel(auraPoints = 0) {
  const ranks = theme.ranks || [];
  let rank = ranks[0]?.label || 'Style Rookie';
  for (const r of ranks) {
    if (auraPoints >= r.minPoints) rank = r.label;
  }
  return rank;
}

export function mapCommunityPost(docSnap, likedByMe = false) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    userId: data.userId,
    brand: data.brand || 'TrialX Brand',
    garmentDesc: data.garmentDesc || 'Fashion Fit',
    resultImageUrl: data.resultImageUrl,
    garmentImageUrl: data.garmentImageUrl || data.resultImageUrl,
    userName: data.userName || `@user_${docSnap.id.slice(0, 4)}`,
    userPhotoUrl: data.userPhotoUrl || null,
    rank: data.rank || 'Style Rookie',
    caption: data.caption || `Tried on ${data.garmentDesc || 'this look'} via TrialX AI!`,
    likes: data.likes || 0,
    commentsCount: data.commentsCount || 0,
    buyLink: data.buyLink || '',
    createdAt: data.createdAt,
    likedByMe,
  };
}

export function subscribeCommunityFeed(onData, onError, limitCount = 30) {
  if (!firestore) return () => { };

  const q = query(
    collection(firestore, 'community_posts'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map(d => mapCommunityPost(d))),
    (err) => {
      console.warn('[community feed]', err.code, err.message);
      onError?.(err);
    }
  );
}

export function subscribeUserCommunityPosts(userId, onData, onError) {
  if (!firestore || !userId) return () => { };

  const q = query(
    collection(firestore, 'community_posts'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map(d => mapCommunityPost(d))),
    (err) => {
      console.warn('[user community posts]', err.code, err.message);
      onError?.(err);
    }
  );
}

export function subscribeUserTryOns(userId, onData, onError) {
  if (!firestore || !userId) return () => { };

  const q = query(
    collection(firestore, 'tryon_results'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.warn('[user tryons]', err.code, err.message);
      onError?.(err);
    }
  );
}

export function subscribeUserProfile(userId, onData, onError) {
  if (!firestore || !userId) return () => { };

  return onSnapshot(
    doc(firestore, 'profiles', userId),
    (snap) => {
      if (snap.exists()) onData({ id: snap.id, ...snap.data() });
      else onData(null);
    },
    (err) => {
      console.warn('[profile listener]', err.code, err.message);
      onError?.(err);
    }
  );
}

export async function isPostLikedByUser(postId, userId) {
  if (!firestore || !userId) return false;
  const likeRef = doc(firestore, 'community_posts', postId, 'likes', userId);
  const snap = await getDoc(likeRef);
  return snap.exists();
}

export function subscribeUserLikes(userId, onData, onError) {
  if (!firestore || !userId) return () => { };

  const q = query(
    collectionGroup(firestore, 'likes'),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const likedPostIds = {};
      snap.docs.forEach((doc) => {
        const postId = doc.ref.parent?.parent?.id;
        if (postId) {
          likedPostIds[postId] = true;
        }
      });
      onData(likedPostIds);
    },
    (err) => {
      console.warn('[subscribeUserLikes]', err.code, err.message);
      onError?.(err);
    }
  );
}

export async function togglePostLike(postId, userId) {
  if (!firestore || !userId) return false;

  const likeRef = doc(firestore, 'community_posts', postId, 'likes', userId);
  const postRef = doc(firestore, 'community_posts', postId);
  const likeSnap = await getDoc(likeRef);
  const batch = writeBatch(firestore);

  if (likeSnap.exists()) {
    batch.delete(likeRef);
    batch.update(postRef, { likes: increment(-1) });
    await batch.commit();
    return false;
  }

  batch.set(likeRef, { userId, createdAt: serverTimestamp() });
  batch.update(postRef, { likes: increment(1) });
  await batch.commit();
  await incrementUserAura(userId, 5);
  return true;
}

export function subscribePostComments(postId, onComments) {
  if (!firestore || !postId) return () => { };

  const q = query(
    collection(firestore, 'community_posts', postId, 'comments'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );

  return onSnapshot(q, (snap) => {
    onComments(snap.docs.map(d => ({
      id: d.id,
      user: d.data().userName || '@user',
      text: d.data().text || '',
      userId: d.data().userId,
      createdAt: d.data().createdAt,
    })));
  });
}

export async function addPostComment(postId, { userId, userName, text }) {
  if (!firestore || !userId || !text?.trim()) return;

  const batch = writeBatch(firestore);
  const commentRef = doc(collection(firestore, 'community_posts', postId, 'comments'));
  batch.set(commentRef, {
    userId,
    userName: userName || '@user',
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
  batch.update(doc(firestore, 'community_posts', postId), {
    commentsCount: increment(1),
  });
  await batch.commit();

  await incrementUserAura(userId, 10);
}

export async function incrementUserAura(userId, amount) {
  if (!firestore || !userId || !amount) return;
  try {
    await updateDoc(doc(firestore, 'profiles', userId), {
      auraPoints: increment(amount),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[incrementUserAura]', err.message);
  }
}

/** Bump profile counters — listeners update UI in real time */
export async function incrementProfileStats(userId, fields = {}) {
  if (!firestore || !userId) return;
  const updates = { updatedAt: serverTimestamp() };
  if (fields.tryOns) updates.tryOnCount = increment(fields.tryOns);
  if (fields.posts) updates.postCount = increment(fields.posts);
  if (Object.keys(updates).length <= 1) return;
  try {
    await updateDoc(doc(firestore, 'profiles', userId), updates);
  } catch (err) {
    console.warn('[incrementProfileStats]', err.message);
  }
}

export { getRankLabel };
