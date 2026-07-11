import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './firebase';

const REVIEWS_COLLECTION = 'reviews';

/**
 * Fetch approved reviews, most recent first, up to maxCount.
 * Falls back to a simple query if the composite index isn't ready yet.
 */
export async function getReviews(maxCount = 20) {
  // Try the full compound query first (requires composite index)
  try {
    const q = query(
      collection(firestore, REVIEWS_COLLECTION),
      where('approved', '==', true),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  } catch (err) {
    console.warn('[Reviews] Compound query failed, trying simple query:', err.message);
  }

  // Fallback: simple query without orderBy (works without composite index)
  try {
    const q = query(
      collection(firestore, REVIEWS_COLLECTION),
      where('approved', '==', true),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('[Reviews] getReviews error:', err.message);
    return [];
  }
}

/**
 * Submit a new review to Firestore.
 */
export async function submitReview({ uid, name, location, rating, body }) {
  const docRef = await addDoc(collection(firestore, REVIEWS_COLLECTION), {
    uid,
    name,
    location: location || 'India',
    rating,
    body,
    approved: true,
    createdAt: serverTimestamp(),
  });
  return { id: docRef.id, uid, name, location, rating, body };
}

/**
 * Check if a user has already submitted a review.
 */
export async function hasUserReviewed(uid) {
  try {
    const q = query(
      collection(firestore, REVIEWS_COLLECTION),
      where('uid', '==', uid),
      limit(1)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (err) {
    return false;
  }
}
