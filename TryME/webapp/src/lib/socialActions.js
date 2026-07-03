import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, getBlob } from 'firebase/storage';
import { firestore, uploadBase64Image, storage } from './firebase';
import { incrementUserAura, incrementProfileStats } from './community';

export const APP_DOWNLOAD_LINK = window.location.origin;

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

export async function downloadTryOnImage(imageUrl) {
  if (!imageUrl) return;
  try {
    let srcUrl = imageUrl;
    let objectUrl = null;

    // 1. If it is a Firebase Storage URL, bypass CORS by downloading through the Storage SDK
    if (imageUrl.includes('firebasestorage.googleapis.com') || imageUrl.includes('storage.googleapis.com')) {
      try {
        const decodedUrl = decodeURIComponent(imageUrl);
        const match = decodedUrl.match(/\/o\/([^?#]+)/);
        if (match && match[1]) {
          const storagePath = match[1];
          const sRef = storageRef(storage, storagePath);
          const blob = await getBlob(sRef);
          objectUrl = URL.createObjectURL(blob);
          srcUrl = objectUrl;
        }
      } catch (storageErr) {
        console.warn('[socialActions] Firebase Storage SDK download failed, falling back to direct fetch:', storageErr.message);
      }
    }

    // 2. If it's still a remote HTTP URL (and not Firebase Storage or if it failed), fetch as blob
    if (srcUrl === imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      try {
        const response = await fetch(imageUrl, { mode: 'cors' });
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        srcUrl = objectUrl;
      } catch (fetchErr) {
        console.warn('[socialActions] Fetch failed, using original imageUrl:', fetchErr.message);
      }
    }

    const img = new Image();
    // Only set crossOrigin if it is a remote absolute URL and not a local blob/data URL
    const isAbsoluteRemote = (srcUrl.startsWith('http://') || srcUrl.startsWith('https://')) && !srcUrl.startsWith(window.location.origin);
    if (isAbsoluteRemote) {
      img.crossOrigin = 'anonymous';
    }
    img.src = srcUrl;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Image failed to load'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Styling the watermark: "styled by 🔍 oraneo"
    // Make size relative to image width so it scales nicely (e.g. 2.8% of image width, min 16px, max 48px)
    const fontSize = Math.max(16, Math.min(48, Math.round(canvas.width * 0.028)));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';

    // Shadow for legibility on all backgrounds
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = Math.max(2, Math.round(fontSize * 0.15));
    ctx.shadowOffsetX = Math.max(1, Math.round(fontSize * 0.08));
    ctx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.08));

    const watermarkText = 'styled by 🔍 oraneo';
    const textWidth = ctx.measureText(watermarkText).width;

    // Bottom-right placement with 3% margin
    const margin = Math.round(canvas.width * 0.03);
    const x = canvas.width - textWidth - margin;
    const y = canvas.height - margin;

    ctx.fillText(watermarkText, x, y);

    // Export and download
    const watermarkedBlob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
    });

    const finalUrl = URL.createObjectURL(watermarkedBlob);
    const link = document.createElement('a');
    link.href = finalUrl;
    link.download = `oraneo_look_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    URL.revokeObjectURL(finalUrl);

    return { saved: true };
  } catch (e) {
    console.error('[socialActions] Failed to add watermark, falling back to direct download:', e);
    // Fallback: direct download using simple link or new window
    try {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `oraneo_look_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { saved: true };
    } catch (err) {
      window.open(imageUrl, '_blank');
      return { saved: false };
    }
  }
}

export async function shareTryOnWhatsApp({ imageUrl, title, brand, userName }) {
  const nameTag = userName ? (userName.startsWith('@') ? userName : `@${userName}`) : '@fashionista';
  const textCaption = `Look out ${nameTag} new looks.\nTry it out: ${APP_DOWNLOAD_LINK}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textCaption)}`;
  window.open(whatsappUrl, '_blank');
}

export async function postTryOnToCommunity({ user, profile, card }) {
  if (!user || !firestore) throw new Error('You must be signed in to post.');

  const formattedUserName = formatUserHandle(user, profile?.name || user?.displayName);
  const CAPTION_TEMPLATES = [
    (un, brand, title) => `${un} rocking the ${title} by ${brand}!`,
    (un, brand, title) => `Rate this fit! ${un} in the ${title} from ${brand}.`,
    (un, brand, title) => `Styled with oraneo: ${un} wearing the ${title} by ${brand}.`,
    (un, brand, title) => `New look unlocked! ${un} slays in the ${title}.`,
  ];

  const template = CAPTION_TEMPLATES[Math.floor(Math.random() * CAPTION_TEMPLATES.length)];
  const caption = template(formattedUserName, card.brand || 'oraneo Brand', card.title || 'Garment');

  let resultImageUrl = card.tryOnImageUrl || card.imageUrl;
  if (resultImageUrl && resultImageUrl.startsWith('data:')) {
    resultImageUrl = await uploadBase64Image(resultImageUrl, 'community_uploads');
  }

  let garmentImageUrl = card.productImageUrl || card.imageUrl;

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
