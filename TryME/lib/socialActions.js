/**
 * Shared social actions — download, WhatsApp share, post to community.
 */
import { Alert, Platform, Share, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { incrementUserAura, incrementProfileStats } from '@/lib/community';

// NOTE: expo-sharing native module (ExpoSharing) may not be linked in the dev build.
// We rely solely on React Native's built-in Share API which always works.

export const APP_DOWNLOAD_LINK = 'https://oraneo.space';

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
    const uri = `${FileSystem.cacheDirectory}oraneo_${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' });
    return uri;
  }
  const dl = await FileSystem.downloadAsync(
    imageUrl,
    `${FileSystem.cacheDirectory}oraneo_${Date.now()}.jpg`
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
    `Try on any outfit on YOUR body with oraneo — download free:`,
    APP_DOWNLOAD_LINK,
    `#oraneo #virtualfashion #ootd`,
  ].filter(Boolean).join('\n');
}

/** Short caption used as WhatsApp message alongside the image */
export function buildWhatsAppCaption({ title, brand }) {
  return [
    `✨ My AI try-on look${title ? `: ${title}` : ''}${brand ? ` by ${brand}` : ''}`,
    ``,
    `Download oraneo free 👇`,
    APP_DOWNLOAD_LINK,
  ].filter(Boolean).join('\n');
}

export async function downloadTryOnImage(imageUrl) {
  if (!imageUrl) throw new Error('No image to download');

  let localUri = await compressImageForShare(imageUrl);

  // Apply watermark using react-native-image-marker
  try {
    const MarkerModule = require('react-native-image-marker');
    const Marker = MarkerModule.default || MarkerModule;
    const { Position, ImageFormat } = MarkerModule;

    // Get image dimensions to scale font size dynamically
    let imageWidth = 1080; // default/fallback width from compression
    try {
      const ImageManipulator = require('expo-image-manipulator');
      const info = await ImageManipulator.manipulateAsync(localUri, []);
      if (info.width) imageWidth = info.width;
    } catch (e) {
      console.warn('[socialActions] Failed to get image dimensions, using fallback:', e.message);
    }

    // font size is ~3% of image width (e.g. ~32px for 1080px wide image)
    const fontSize = Math.max(16, Math.min(48, Math.round(imageWidth * 0.03)));

    const markedUri = await Marker.markText({
      backgroundImage: {
        src: localUri,
      },
      watermarkTexts: [
        {
          text: 'styled by 🔍 oraneo',
          position: {
            position: Position.bottomRight,
          },
          style: {
            color: '#FFFFFF',
            fontSize: fontSize,
            fontName: 'Arial-BoldMT',
            shadowStyle: {
              dx: Math.max(1, Math.round(fontSize * 0.06)),
              dy: Math.max(1, Math.round(fontSize * 0.06)),
              radius: Math.max(2, Math.round(fontSize * 0.12)),
              color: '#000000',
            },
          },
        },
      ],
      saveFormat: ImageFormat.jpeg,
      quality: 95,
    });

    // Cleanup the compressed temp image if it's different
    if (localUri !== markedUri && localUri.includes(FileSystem.cacheDirectory)) {
      FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => { });
    }
    localUri = markedUri;
  } catch (err) {
    console.warn('[socialActions] Failed to apply watermark on mobile, saving original:', err.message);
  }

  if (MediaLibrary?.requestPermissionsAsync && MediaLibrary?.saveToLibraryAsync) {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status === 'granted') {
      await MediaLibrary.saveToLibraryAsync(localUri);
      return { saved: true, uri: localUri };
    }
    if (status === 'denied') {
      throw new Error('Photo library permission denied. Enable it in Settings.');
    }
  }

  await Share.share({
    title: 'My oraneo Look',
    url: localUri,
    message: buildShareMessage({}),
  });
  return { saved: false, uri: localUri };
}

/**
 * Share compressed try-on image + app download link.
 * Opens share sheet — pick WhatsApp to send image with caption/link.
 */
export async function shareTryOnWhatsApp({ imageUrl, title, brand, userName }) {
  if (!imageUrl) throw new Error('No image to share');

  const nameTag = userName ? (userName.startsWith('@') ? userName : `@${userName}`) : '@fashionista';
  const textCaption = `Look out ${nameTag} new looks.\n${APP_DOWNLOAD_LINK}`;

  try {
    if (Platform.OS === 'ios') {
      // iOS: Share.share supports both url and message together
      const localUri = await resolveImageToLocalUri(imageUrl);
      await Share.share({
        url: localUri,
        message: textCaption,
      });
    } else {
      // Android: React Native Share with message + URL fallback
      // (expo-sharing native module is not always linked in custom dev builds)
      const shareContent = imageUrl.startsWith('http')
        ? { message: `${textCaption}\n${imageUrl}` }
        : { message: textCaption, url: imageUrl };
      await Share.share(shareContent, { dialogTitle: `Look out ${nameTag} new looks.` });
    }
  } catch (err) {
    console.warn('[socialActions] Share failed, falling back to text only:', err.message);
    await Share.share({
      message: `${textCaption}\n${imageUrl}`,
    });
  }
}

export async function postTryOnToCommunity({ user, profile, card }) {
  if (!user || !firestore) throw new Error('You must be signed in to post.');

  const formattedUserName = formatUserHandle(user, profile?.name || user?.displayName);
  const CAPTION_TEMPLATES = [
    (un, brand, title) => `${un} rocking the ${title} by ${brand}!`,
    (un, brand, title) => `Rate this fit! ${un} in the ${title} from ${brand}.`,
    (un, brand, title) => `Styled with oraneo: ${un} wearing the ${title} by ${brand}.`,
    (un, brand, title) => `New look unlocked! ${un} slays in the ${title}.`,
    (un, brand, title) => `${un} styling the ${title} by ${brand} — cop or drop?`,
  ];

  const template = CAPTION_TEMPLATES[Math.floor(Math.random() * CAPTION_TEMPLATES.length)];
  const caption = template(formattedUserName, card.brand || 'oraneo Brand', card.title || 'Garment');
  const resultImageUrl = await compressImageForFirestore(card.tryOnImageUrl || card.imageUrl);

  let garmentImageUrl = card.productImageUrl || card.imageUrl;
  if (typeof garmentImageUrl === 'number') {
    try {
      const { getCleanBase64 } = require('./ai_engine');
      const { uploadBase64Image } = require('./firebase');
      const b64 = await getCleanBase64(garmentImageUrl, 384, 384, 'fit', 0.80);
      if (b64) {
        const dataUri = b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
        garmentImageUrl = await uploadBase64Image(dataUri, 'garment_thumbs');
      }
    } catch (err) {
      console.warn('[socialActions] Local garment thumb upload failed, using fallback:', err.message);
    }
  }

  await addDoc(collection(firestore, 'community_posts'), {
    userId: user.uid,
    userName: formattedUserName,
    userPhotoUrl: profile?.basePhotoUrl || null,
    resultImageUrl,
    garmentImageUrl: garmentImageUrl || null,
    garmentDesc: card.title || 'Fashion Fit',
    brand: card.brand || 'oraneo Brand',
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
