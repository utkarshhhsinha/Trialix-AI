/**
 * Shared social actions — download, WhatsApp share, post to community.
 */
import { Alert, Platform, Share, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { incrementUserAura, incrementProfileStats } from '@/lib/community';

export const APP_DOWNLOAD_LINK = 'https://trialix.app';

let MediaLibrary = null;
try {
  MediaLibrary = require('expo-media-library');
} catch (_) { /* optional */ }

export function formatUserHandle(user, profileName) {
  if (profileName) {
    const handle = profileName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (handle) return `@${handle}`;
  }
  if (user?.displayName) {
    const handle = user.displayName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (handle) return `@${handle}`;
  }
  if (user?.email) {
    const handle = user.email.split('@')[0].trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (handle) return `@${handle}`;
  }
  return '@fashionista';
}

export async function resolveImageToLocalUri(imageUrl) {
  if (!imageUrl) throw new Error('No image to share');
  // Already a local file — return directly
  if (imageUrl.startsWith('file://') || imageUrl.startsWith('/')) {
    return imageUrl;
  }
  if (imageUrl.startsWith('data:image')) {
    const b64 = imageUrl.split('base64,')[1];
    const uri = `${FileSystem.cacheDirectory}trialxai_${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' });
    return uri;
  }
  const dl = await FileSystem.downloadAsync(
    imageUrl,
    `${FileSystem.cacheDirectory}trialxai_${Date.now()}.jpg`
  );
  return dl.uri;
}

/** Compress image to a shareable local JPEG file (~800px, good for WhatsApp) */
export async function compressImageForShare(imageUrl) {
  const localUri = await resolveImageToLocalUri(imageUrl);
  try {
    const ImageManipulator = require('expo-image-manipulator');
    const compressed = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 1080 } }],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG }
    );
    if (localUri.includes(FileSystem.cacheDirectory)) {
      FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => { });
    }
    return compressed.uri;
  } catch (err) {
    console.warn('[socialActions] share compression failed:', err.message);
    return localUri;
  }
}

export async function compressImageForFirestore(imageUrl) {
  // Handle both data: URIs and file:// URIs
  if (!imageUrl) return imageUrl;
  try {
    const ImageManipulator = require('expo-image-manipulator');
    let sourceUri = imageUrl;
    if (imageUrl.startsWith('data:image')) {
      const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) return imageUrl;
      const tempPath = `${FileSystem.cacheDirectory}temp_compress_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(tempPath, matches[2], { encoding: 'base64' });
      sourceUri = tempPath;
    }
    if (!sourceUri.startsWith('file://') && !sourceUri.startsWith('/')) return imageUrl;
    const compressed = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: 450 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (sourceUri !== imageUrl) {
      await FileSystem.deleteAsync(sourceUri, { idempotent: true }).catch(() => { });
    }
    return `data:image/jpeg;base64,${compressed.base64}`;
  } catch (err) {
    console.warn('[socialActions] compression failed:', err.message);
    return imageUrl;
  }
}

export function buildShareMessage({ title, brand }) {
  return [
    `✨ Check out my AI try-on look!`,
    title ? `👕 ${title}` : null,
    brand ? `by ${brand}` : null,
    ``,
    `Try on any outfit on YOUR body with TrialX AI — download free:`,
    APP_DOWNLOAD_LINK,
    `#trialxai #virtualfashion #ootd`,
  ].filter(Boolean).join('\n');
}

/** Short caption used as WhatsApp message alongside the image */
export function buildWhatsAppCaption({ title, brand }) {
  return [
    `✨ My AI try-on look${title ? `: ${title}` : ''}${brand ? ` by ${brand}` : ''}`,
    ``,
    `Download TrialX AI free 👇`,
    APP_DOWNLOAD_LINK,
  ].filter(Boolean).join('\n');
}

export async function downloadTryOnImage(imageUrl) {
  if (!imageUrl) throw new Error('No image to download');

  const compressedUri = await compressImageForShare(imageUrl);

  if (MediaLibrary?.requestPermissionsAsync && MediaLibrary?.saveToLibraryAsync) {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status === 'granted') {
      await MediaLibrary.saveToLibraryAsync(compressedUri);
      return { saved: true, uri: compressedUri };
    }
    if (status === 'denied') {
      throw new Error('Photo library permission denied. Enable it in Settings.');
    }
  }

  await Share.share({
    title: 'My TrialX AI Look',
    url: compressedUri,
    message: buildShareMessage({}),
  });
  return { saved: false, uri: compressedUri };
}

/**
 * Share compressed try-on image + app download link.
 * Opens share sheet — pick WhatsApp to send image with caption/link.
 */
export async function shareTryOnWhatsApp({ imageUrl, title, brand }) {
  if (!imageUrl) throw new Error('No image to share');

  const shareUrl = `https://trialix.app/share?image=${encodeURIComponent(imageUrl)}&desc=${encodeURIComponent(title || 'AI Style Look')}&brand=${encodeURIComponent(brand || 'TrialX')}`;
  const caption = `Check out my AI try-on look on TrialX AI! 👕\n\n${shareUrl}`;
  const waUrl = `whatsapp://send?text=${encodeURIComponent(caption)}`;

  try {
    const canOpen = await Linking.canOpenURL(waUrl);
    if (canOpen) {
      await Linking.openURL(waUrl);
      return;
    }
  } catch (err) {
    console.warn('[socialActions] Direct WhatsApp failed:', err.message);
  }

  // Fallback to system share sheet
  await Share.share({
    title: 'TrialX AI Look',
    message: caption,
  });
}

export async function postTryOnToCommunity({ user, profile, card }) {
  if (!user || !firestore) throw new Error('You must be signed in to post.');

  const formattedUserName = formatUserHandle(user, profile?.name || user?.displayName);
  const CAPTION_TEMPLATES = [
    (un, brand, title) => `${un} rocking the ${title} by ${brand}!`,
    (un, brand, title) => `Rate this fit! ${un} in the ${title} from ${brand}.`,
    (un, brand, title) => `Styled with TrialX AI: ${un} wearing the ${title} by ${brand}.`,
    (un, brand, title) => `New look unlocked! ${un} slays in the ${title}.`,
    (un, brand, title) => `${un} styling the ${title} by ${brand} — cop or drop?`,
  ];

  const template = CAPTION_TEMPLATES[Math.floor(Math.random() * CAPTION_TEMPLATES.length)];
  const caption = template(formattedUserName, card.brand || 'TrialX Brand', card.title || 'Garment');
  const resultImageUrl = await compressImageForFirestore(card.tryOnImageUrl || card.imageUrl);

  await addDoc(collection(firestore, 'community_posts'), {
    userId: user.uid,
    userName: formattedUserName,
    userPhotoUrl: profile?.basePhotoUrl || null,
    resultImageUrl,
    garmentImageUrl: card.productImageUrl || card.imageUrl,
    garmentDesc: card.title || 'Fashion Fit',
    brand: card.brand || 'TrialX Brand',
    buyLink: card.buyLink || '',
    caption,
    likes: 0,
    commentsCount: 0,
    createdAt: serverTimestamp(),
  });

  await Promise.all([
    incrementUserAura(user.uid, 15),
    incrementProfileStats(user.uid, { posts: 1 }),
  ]);
  return caption;
}
