/**
 * discover.jsx — TrialX AI v5.0
 * ─────────────────────────────────────────────────────────────
 * Dark luxury Tinder-style swipe deck.
 * Right swipe → MATCH animation → AI try-on → result card
 * Left swipe → skip   |   Swipe UP → moodboard
 * Double tap → wishlist burst  |  Long press → details sheet
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, Alert, Share,
  Modal, Dimensions, Animated, ScrollView, Platform, ActivityIndicator,
} from 'react-native';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, doc, getDoc, onSnapshot, query, where, orderBy, limit, updateDoc, increment } from 'firebase/firestore';
import { firebaseAuth, firestore, uploadBase64Image } from '@/lib/firebase';
import { runVirtualTryOn } from '@/lib/ai_engine';
import { incrementProfileStats } from '@/lib/community';
import { downloadTryOnImage, shareTryOnWhatsApp, postTryOnToCommunity } from '@/lib/socialActions';
import { theme } from '@/constants/theme';
import { StatusBar } from 'expo-status-bar';
import SwipeDeck from '@/components/SwipeDeck';
import MatchAnimation from '@/components/MatchAnimation';
import AIGenerationScreen from '@/components/AIGenerationScreen';
import { useRouter } from 'expo-router';
import Icon from '@/assets/icons';
import { Asset } from 'expo-asset';
import { Ionicons } from '@expo/vector-icons';

let MediaLibrary = null;
try {
  MediaLibrary = require('expo-media-library');
} catch (err) {
  // Suppress warning on load; handled gracefully when saving if unavailable
}

const { width: W, height: H } = Dimensions.get('window');

/** Reject garment-only or empty generation results */
function isValidTryOnResult(resultUrl, garmentUrl) {
  if (!resultUrl) return false;
  if (resultUrl === garmentUrl) return false;
  if (typeof resultUrl === 'string' && resultUrl.startsWith('data:') && resultUrl.length < 8000) return false;
  // File URIs (from saved temp files after generation) are always valid
  if (typeof resultUrl === 'string' && resultUrl.startsWith('file://')) return true;
  return true;
}

// ─────────────────────────────────────────────────────────────
// CATALOG — 14 gender-tagged items
// ─────────────────────────────────────────────────────────────
const CATALOG = [
  { id: 'm1', gender: 'male', category: 'upper_body', title: 'Classic Oxford Shirt', brand: 'Zara Man', priceINR: '3,299', matchScore: 92, imageUrl: 'https://images.unsplash.com/photo-1626497764746-6dc36546b388?w=600&q=80', buyLink: 'https://www.zara.com/in/en/man-shirts-l737.html', badge: 'HOT MATCH', badgeColor: '#FE3C72' },
  { id: 'm2', gender: 'male', category: 'upper_body', title: 'Denim Trucker Jacket', brand: "Levi's", priceINR: '8,299', matchScore: 87, imageUrl: 'https://images.unsplash.com/photo-1611312449412-6cefac5dc3e4?w=600&q=80', buyLink: 'https://www.levi.com/IN/en_IN/', badge: 'Trending', badgeColor: '#A855F7' },
  { id: 'm3', gender: 'male', category: 'upper_body', title: 'Slim-Fit Blazer', brand: 'H&M Man', priceINR: '6,599', matchScore: 95, imageUrl: 'https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=600&q=80', buyLink: 'https://www2.hm.com/en_in/men.html', badge: 'Perfect Fit', badgeColor: '#00C853' },
  { id: 'm4', gender: 'male', category: 'lower_body', title: 'Slim Chino Trousers', brand: 'Mango Man', priceINR: '4,599', matchScore: 81, imageUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&q=80', buyLink: 'https://shop.mango.com/in/men' },
  { id: 'm5', gender: 'male', category: 'upper_body', title: 'Graphic Oversized Tee', brand: 'Myntra Studio', priceINR: '1,299', matchScore: 78, imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80', buyLink: 'https://www.myntra.com/t-shirts', badge: 'Your Aura', badgeColor: '#F5C518' },
  { id: 'm6', gender: 'male', category: 'upper_body', title: 'Striped Linen Shirt', brand: 'Fabindia', priceINR: '2,499', matchScore: 84, imageUrl: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&q=80', buyLink: 'https://www.fabindia.com/men-clothing' },
  { id: 'f1', gender: 'female', category: 'dresses', title: 'Floral Midi Dress', brand: 'H&M', priceINR: '4,199', matchScore: 93, imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80', buyLink: 'https://www2.hm.com/en_in/women/products/dresses.html', badge: 'HOT MATCH', badgeColor: '#FE3C72' },
  { id: 'f2', gender: 'female', category: 'upper_body', title: 'Cropped Linen Blazer', brand: 'Zara', priceINR: '7,499', matchScore: 89, imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80', buyLink: 'https://www.zara.com/in/en/woman-blazers-l1045.html', badge: 'Perfect Fit', badgeColor: '#00C853' },
  { id: 'f3', gender: 'female', category: 'upper_body', title: 'Cable Knit Sweater', brand: 'Everlane', priceINR: '6,499', matchScore: 82, imageUrl: 'https://images.unsplash.com/photo-1574164904299-3a102b110380?w=600&q=80', buyLink: 'https://www.everlane.com/collections/womens-sweaters', badge: 'Trending', badgeColor: '#A855F7' },
  { id: 'f4', gender: 'female', category: 'dresses', title: 'Satin Slip Dress', brand: 'ASOS', priceINR: '5,499', matchScore: 91, imageUrl: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&q=80', buyLink: 'https://www.asos.com/women/dresses/', badge: 'Your Aura', badgeColor: '#F5C518' },
  { id: 'f5', gender: 'female', category: 'lower_body', title: 'High-Waist Mom Jeans', brand: "Levi's", priceINR: '5,999', matchScore: 77, imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&q=80', buyLink: 'https://www.levi.com/IN/en_IN/clothing/women/jeans/' },
  { id: 'u1', gender: 'unisex', category: 'upper_body', title: 'Oversized Pastel Hoodie', brand: 'Gap', priceINR: '5,499', matchScore: 85, imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=80', buyLink: 'https://www.gapindia.com/hoodies', badge: 'Trending', badgeColor: '#A855F7' },
  { id: 'u2', gender: 'unisex', category: 'upper_body', title: 'Essential White Tee', brand: 'Uniqlo', priceINR: '1,699', matchScore: 75, imageUrl: 'https://images.unsplash.com/photo-1622445275576-721325763afe?w=600&q=80', buyLink: 'https://www.uniqlo.com/in/' },
];

const RANDOM_SHIRTS = [
  {
    title: 'Checkered Casual Light Blue Shirt',
    brand: 'Snitch',
    priceINR: '1,199',
    buyLink: 'https://dl.flipkart.com/dl/snitch-men-checkered-casual-light-blue-shirt/p/itmfcd5f13009078?pid=SHTH2GGFJTDAVXVA&lid=LSTSHTH2GGFJTDAVXVAQJJ1BX&marketplace=FLIPKART&q=snitch&store=search.flipkart.com&srno=s_1_12&otracker=search&otracker1=search&fm=Search&iid=3d114e53-f9a7-4f2b-a90a-9e92b2e710ef.SHTH2GGFJTDAVXVA.SEARCH&ppt=sp&ppn=sp&ssid=0ar3bnxa2f9cmtq81780041334638&qH=4b726d6ef0a22c1e&ov_redirect=true&ov_redirect=true&_refId=&_appId=CL',
    source: require('@/assets/images/shirt1.png'),
  },
  {
    title: 'Striped Casual Black Shirt',
    brand: 'Snitch',
    priceINR: '1,299',
    buyLink: 'https://dl.flipkart.com/dl/snitch-men-striped-casual-black-shirt/p/itm4c2fe9b0d041e?pid=SHTGSZGJMYFT67TQ&lid=LSTSHTGSZGJMYFT67TQFDJRVN&marketplace=FLIPKART&q=snitch&store=search.flipkart.com&srno=s_1_13&otracker=search&otracker1=search&fm=Search&iid=3d114e53-f9a7-4f2b-a90a-9e92b2e710ef.SHTGSZGJMYFT67TQ.SEARCH&ppt=sp&ppn=sp&qH=4b726d6ef0a22c1e&ov_redirect=true&ov_redirect=true&_refId=&_appId=CL',
    source: require('@/assets/images/shirt2.png'),
  },
  {
    title: 'Printed Casual Purple Shirt',
    brand: 'Rare Rabbit',
    priceINR: '2,499',
    buyLink: 'https://dl.flipkart.com/dl/rare-rabbit-men-printed-casual-purple-shirt/p/itmdc35d454c2b5f?pid=SHTGT6ENXB4DNJ37&lid=LSTSHTGT6ENXB4DNJ37KVHZ3R&hl_lid=&marketplace=FLIPKART&fm=eyJ3dHAiOiJyZWNvIiwicHJwdCI6InBwIiwibWlkIjoicHJvZHVjdFJlY29tbWVuZGF0aW9uL3NpbWlsYXIifQ==&_refId=&_appId=CL',
    source: require('@/assets/images/shirt3.png'),
  },
  {
    title: 'Solid Casual Maroon Shirt',
    brand: 'Snitch',
    priceINR: '1,099',
    buyLink: 'https://dl.flipkart.com/dl/snitch-men-solid-casual-maroon-shirt/p/itm58933d5d0f11d?pid=SHTGWYZRF2JQRTJR&lid=LSTSHTGWYZRF2JQRTJRW6RFCW&hl_lid=&marketplace=FLIPKART&fm=eyJ3dHAiOiJyZWNvIiwicHJwdCI6InBwIiwibWlkIjoicHJvZHVjdFJlY29tbWVuZGF0aW9uL2FzcGVjdFNpbWlsYXIifQ==&_refId=&_appId=CL',
    source: require('@/assets/images/shirt4.png'),
  },
  {
    title: 'Solid Casual Pink Shirt',
    brand: 'Snitch',
    priceINR: '1,199',
    buyLink: 'https://dl.flipkart.com/dl/snitch-men-solid-casual-pink-shirt/p/itm7cbb29a531fe3?pid=SHTGTMWYWBJ9FKMK&lid=LSTSHTGTMWYWBJ9FKMK92POL0&hl_lid=&marketplace=FLIPKART&fm=eyJ3dHAiOiJyZWNvIiwicHJwdCI6InBwIiwibWlkIjoicHJvZHVjdFJlY29tbWVuZGF0aW9uL2FzcGVjdFNpbWlsYXIifQ==&_refId=&_appId=CL',
    source: require('@/assets/images/shirt5.png'),
  },
  {
    title: 'Essential Casual White Tee',
    brand: 'Uniqlo',
    priceINR: '1,699',
    buyLink: 'https://www.uniqlo.com/in/',
    source: require('@/assets/images/clothing_1.png'),
  }
];

const RANDOM_WOMEN_TOPS = [
  {
    title: 'Oversize Striped Shirt',
    brand: 'Zara',
    priceINR: '2,590',
    buyLink: 'https://www.zara.com/in/en/oversize-striped-shirt-p07484107.html?v1=551149568&v2=2546081',
    source: require('../../Clothes/Women/Tops/1sttop.jpg'),
  },
  {
    title: 'Adjustable Spaghetti Strap Floral Print Peplum Top',
    brand: 'Shein',
    priceINR: '1,299',
    buyLink: 'https://www.sheinindia.in/shein-shein-adjustable-spaghetti-strap-floral-print-peplum-top/p/443395655_lpink',
    source: require('../../Clothes/Women/Tops/2ndtop.jpg'),
  },
  {
    title: 'Sleeveless Sweetheart Neck Wrap Style Top',
    brand: 'Shein',
    priceINR: '999',
    buyLink: 'https://www.sheinindia.in/shein-shein-sleeveless-sweetheart-neck-wrap-style-top/p/443394283_offwhite',
    source: require('../../Clothes/Women/Tops/3rdtop.jpg'),
  },
  {
    title: 'Pinstripes Flared Sleeves Shirt in Brown',
    brand: 'Oyela',
    priceINR: '1,499',
    buyLink: 'https://oyela.in/products/pinstripes-flared-sleeves-shirt-in-brown-oy1021-new1?variant=52204024201490&country=IN&currency=INR&utm_medium=product_sync&utm_source=google&utm_content=sag_organic&utm_campaign=sag_organic&utm_source=google_ads&utm_medium=cpc&utm_campaign=%5BADC%5D_SHP_Generic_Product%5B01-09-2025%5D&gad_source=1&gad_campaignid=22975727923&gbraid=0AAAAAptx4jHjj9baphG0d4ClkZF67XPus&gclid=Cj0KCQjwlerQBhDMARIsAB16H-Vgocg6LaAIFgfEOrWl3Zgvnuer5fjLvq1UT8IQZGKQIsqKyzWU2YAaAoEcEALw_wcB',
    source: require('../../Clothes/Women/Tops/4thtop.jpg'),
  },
  {
    title: 'Crop Relaxed Fit Stripes Blue Shirt',
    brand: 'Oyela',
    priceINR: '1,199',
    buyLink: 'https://oyela.in/products/crop-relaxed-fit-stripes-blue-shirt',
    source: require('../../Clothes/Women/Tops/5thtop.jpg'),
  },
  {
    title: 'Lace Trimmed Placket Blouse',
    brand: 'Savana',
    priceINR: '1,899',
    buyLink: 'https://www.savana.com/landing/details/lace-trimmed-placket-blouse-2103162?pgType=1&gad_source=1&utm_campaign=22494845434__&detail_type=dpa&utm_medium=ppc&biz_type=ppc&channel=google&network=x&vid=308&gad_campaignid=22484789250&gclid=Cj0KCQjwlerQBhDMARIsAB16H-XlafTaZxA-CdtKsirdGFCTlDF4LjkoTplGl6mF2Q6FW6msggEP7FAaAnTIEALw_wcB&ad_id=&short_link_uid=F79E0CBBCC7B464C9921E990518122B6&adset_id=&gbraid=0AAAAACeGMbkz6HDnPO1L0y2IUzbQ3gHrh&placement=&keyword=&campaign_id=22494845434&utm_source=google&ucid=6D055FA6260E4973A6239A9B973830F3&short_key=nso15y&utm_content=dpa',
    source: require('../../Clothes/Women/Tops/6thtop.png'),
  },
];

function getFiltered(gender) {
  const g = (gender || '').toLowerCase();
  if (g === 'male') return CATALOG.filter(p => p.gender === 'male' || p.gender === 'unisex');
  if (g === 'female') return CATALOG.filter(p => p.gender === 'female' || p.gender === 'unisex');
  return CATALOG;
}

function getSimilar(garment, products) {
  return products
    .filter(p => p.id !== garment.id && (p.category === garment.category || p.gender === garment.gender))
    .slice(0, 5);
}

// ── STAGE MACHINE
const STAGE = { IDLE: 'idle', MATCH: 'match', GENERATING: 'generating', RESULT: 'result' };

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const router = useRouter();
  const deckRef = useRef(null);

  const [user, setUser] = useState(null);
  const [userGender, setUserGender] = useState('');
  const [userPhoto, setUserPhoto] = useState(null);
  const [userPhotoBase64, setUserPhotoBase64] = useState(null);
  const [auraPoints, setAuraPoints] = useState(0);

  const [products, setProducts] = useState(CATALOG);
  const [deckKey, setDeckKey] = useState(0);

  const sampleGarments = (userGender || '').toLowerCase() === 'female' ? RANDOM_WOMEN_TOPS : RANDOM_SHIRTS;

  const [stage, setStage] = useState(STAGE.IDLE);
  const [currentGarment, setCurrentGarment] = useState(null);
  const [tryOnResult, setTryOnResult] = useState(null);
  const [savedWishlist, setSavedWishlist] = useState(false);
  const [similarItems, setSimilarItems] = useState([]);
  const [resultCards, setResultCards] = useState([]);
  const [resultDeckKey, setResultDeckKey] = useState(0);
  const [resultSwipedCount, setResultSwipedCount] = useState(0);
  const resultDeckRef = useRef(null);

  // Workshop garment state
  const [garmentUri, setGarmentUri] = useState(null);
  const [selectedGarmentSource, setSelectedGarmentSource] = useState(null);
  const [garmentCategory, setGarmentCategory] = useState('upper_body');
  const [recentTryOns, setRecentTryOns] = useState([]);
  const [cooldownSecs, setCooldownSecs] = useState(0);
  const cooldownRef = useRef(null);
  const [backgroundGenerating, setBackgroundGenerating] = useState(false);
  const activeGenerationsRef = useRef(0);
  const [userName, setUserName] = useState('');
  const pregeneratePromiseRef = useRef(null);
  const pregeneratingGarmentIdRef = useRef(null);
  const samplePromisesRef = useRef({});
  const lastRequestTimeRef = useRef(0);
  const queueTimeoutRef = useRef(null);
  const [pregeneratedResultUrl, setPregeneratedResultUrl] = useState(null);
  const [pregeneratingGarmentId, setPregeneratingGarmentId] = useState(null);
  const [cardViewModes, setCardViewModes] = useState({}); // cardId → 'before' | 'after'

  // Result card swipe
  const resultPos = useRef(new Animated.ValueXY()).current;
  const resultRotate = resultPos.x.interpolate({
    inputRange: [-W, 0, W], outputRange: ['-8deg', '0deg', '8deg'], extrapolate: 'clamp',
  });
  const wishlistOpacity = resultPos.x.interpolate({ inputRange: [0, W * 0.22], outputRange: [0, 1], extrapolate: 'clamp' });
  const skipOpacity = resultPos.x.interpolate({ inputRange: [-W * 0.22, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  // Details sheet
  const [showDetails, setShowDetails] = useState(false);
  const [detailsGarment, setDetailsGarment] = useState(null);

  // Garment picker
  const [showPicker, setShowPicker] = useState(false);

  // ── Auth + Profile load
  useEffect(() => {
    if (!firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, u => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !firestore) return;
    let unsub = () => { };
    // Force token refresh before subscribing — fixes permission-denied race
    // where Firestore hasn't received the auth token yet.
    user.getIdToken().then(() => {
      unsub = onSnapshot(
        doc(firestore, 'profiles', user.uid),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            if (d.basePhotoUrl) {
              setUserPhoto(d.basePhotoUrl);
              // Only store as base64 if it's actually a data: URI, not an HTTPS URL
              if (d.basePhotoUrl.startsWith('data:image') && d.basePhotoUrl.includes('base64,')) {
                setUserPhotoBase64(d.basePhotoUrl.split('base64,')[1]);
              }
            }
            if (d.gender) setUserGender(d.gender);
            if (d.auraPoints) setAuraPoints(d.auraPoints);
            if (d.name) setUserName(d.name);
          }
        },
        (err) => console.warn('[profiles listener]', err.code)
      );
    }).catch(e => console.warn('[profiles listener] token refresh failed:', e.message));
    return () => unsub();
  }, [user]);

  const incrementAuraPoints = async (amount) => {
    setAuraPoints(p => p + amount);
    if (user && firestore) {
      try {
        await updateDoc(doc(firestore, 'profiles', user.uid), {
          auraPoints: increment(amount)
        });
      } catch (err) {
        console.warn('Failed to update auraPoints in Firestore:', err.message);
      }
    }
  };

  useEffect(() => {
    const filtered = getFiltered(userGender);
    setProducts(filtered);
    setDeckKey(k => k + 1);
  }, [userGender]);

  // ── Recent Try-Ons (Firestore listener — query by userId so rules can allow it)
  useEffect(() => {
    if (!user || !firestore) return;
    let unsub = () => { };
    try {
      const q = query(
        collection(firestore, 'tryon_results'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(8)
      );
      unsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setRecentTryOns(items);
        },
        (err) => {
          // Silently ignore permission-denied — user may not have any records yet
          if (err.code !== 'permission-denied') {
            console.warn('[recentTryOns listener]', err.code, err.message);
          }
        }
      );
    } catch (e) {
      console.warn('[recentTryOns setup]', e.message);
    }
    return () => unsub();
  }, [user]);

  const startPregenerating = (garment) => {
    if (!garment || !userPhoto) return;
    const targetId = garment.imageUrl || garment.title;

    // Check if we are already pre-generating this exact garment
    if (pregeneratingGarmentIdRef.current === targetId) return;

    setPregeneratingGarmentId(targetId);
    pregeneratingGarmentIdRef.current = targetId;
    setPregeneratedResultUrl(null);

    console.log('[AI] Starting background pre-generation for garment:', garment.title);

    const mainPromise = runVirtualTryOn(
      userPhotoBase64 || userPhoto,
      garment.garmentSource || garment.imageUrl,
      garment.title,
      () => { },
      false,
      garment.category || 'upper_body'
    ).then(resultUrl => {
      if (resultUrl) {
        console.log('[AI] Background pre-generation success for garment:', garment.title);
        setPregeneratedResultUrl(resultUrl);
        return resultUrl;
      }
      return null;
    }).catch(err => {
      console.warn('[AI] Background pre-generation failed for garment:', garment.title, err.message);
      return null;
    });

    pregeneratePromiseRef.current = mainPromise;
  };


  // Workshop pre-generation trigger
  useEffect(() => {
    if (!garmentUri || !userPhoto || stage !== STAGE.IDLE) return;

    const tempGarment = {
      id: 'workshop_temp',
      imageUrl: garmentUri,
      garmentSource: selectedGarmentSource,
      category: garmentCategory,
      title: 'My Uploaded Garment',
      brand: 'TrialX AI',
      priceINR: '—',
      buyLink: '',
    };

    startPregenerating(tempGarment);
    // Do NOT prefetch samples here — burns API quota and causes 429 errors
  }, [garmentUri, selectedGarmentSource, garmentCategory, userPhoto, stage]);

  const generateCardTryOn = async (cardIndex) => {
    const card = resultCards[cardIndex];
    if (!card || card.isGenerating) return;
    if (card.imageUrl !== card.productImageUrl && !card.generationError) return;

    activeGenerationsRef.current += 1;
    setBackgroundGenerating(true);
    lastRequestTimeRef.current = Date.now();
    setResultCards(prev => prev.map((c, idx) =>
      idx === cardIndex ? { ...c, isGenerating: true, generationError: false, rateLimitError: false } : c
    ));

    try {
      console.log(`[AI] On-demand generation starting for sample ${cardIndex}/${resultCards.length}: ${card.title}`);

      let resultUrl = null;

      // 1. Check if there is an active pre-generation promise for this suggested card
      if (cardIndex !== 0 && samplePromisesRef.current[card.title]) {
        console.log(`[AI] Reusing pre-generated suggestion promise for: ${card.title}`);
        resultUrl = await samplePromisesRef.current[card.title];
        delete samplePromisesRef.current[card.title];
      }

      // 2. If not ready or wasn't pre-generated, execute try-on now.
      // Prefer garmentSource (numeric require() asset) over productImageUrl (Metro HTTP URL)
      // to avoid FileSystem.downloadAsync timeouts on local dev-server URLs.
      if (!resultUrl) {
        const garmentInput = card.garmentSource ?? card.productImageUrl;
        resultUrl = await runVirtualTryOn(
          userPhotoBase64 || userPhoto,
          garmentInput,
          card.title,
          () => { },
          false,
          card.category || 'upper_body'
        );
      }

      if (isValidTryOnResult(resultUrl, card.productImageUrl)) {
        console.log(`[AI] On-demand generation success for sample ${cardIndex}: ${card.title}`);

        setResultCards(prev => prev.map((c, idx) =>
          idx === cardIndex ? { ...c, tryOnImageUrl: resultUrl, imageUrl: resultUrl, isGenerating: false, generationError: false } : c
        ));

        let mainFirestoreUrl = resultUrl;
        try {
          const ImageManipulator = require('expo-image-manipulator');
          let sourceUri = resultUrl;
          if (resultUrl.startsWith('data:image')) {
            const matches = resultUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const tempPath = `${FileSystem.cacheDirectory}temp_tryon_fs_${Date.now()}.jpg`;
              await FileSystem.writeAsStringAsync(tempPath, matches[2], { encoding: 'base64' });
              sourceUri = tempPath;
            }
          }
          if (sourceUri.startsWith('file://') || sourceUri.startsWith('/')) {
            const compressed = await ImageManipulator.manipulateAsync(
              sourceUri,
              [{ resize: { width: 450 } }],
              { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );
            mainFirestoreUrl = `data:image/jpeg;base64,${compressed.base64}`;
            if (sourceUri !== resultUrl) {
              await FileSystem.deleteAsync(sourceUri, { idempotent: true }).catch(() => { });
            }
          }
        } catch (err) {
          console.warn('Firestore compression failed', err);
        }

        if (user && firestore) {
          addDoc(collection(firestore, 'tryon_results'), {
            userId: user.uid,
            resultImageUrl: mainFirestoreUrl,
            garmentImageUrl: card.productImageUrl,
            garmentDesc: card.title,
            buyLink: card.buyLink || '',
            brand: card.brand,
            createdAt: serverTimestamp(),
          }).catch(() => { });
          incrementProfileStats(user.uid, { tryOns: 1 }).catch(() => { });
        }
      } else {
        throw new Error('No try-on image returned');
      }
    } catch (err) {
      console.warn(`[AI] On-demand generation failed for sample ${cardIndex} (${card.title}):`, err.message);
      const isRateLimit = err?.isRateLimit || err?.message?.includes('429') || err?.message?.includes('RATE_LIMIT');
      setResultCards(prev => prev.map((c, idx) =>
        idx === cardIndex ? { ...c, isGenerating: false, generationError: true, rateLimitError: isRateLimit } : c
      ));
      if (isRateLimit) {
        Alert.alert('AI Busy', 'Rate limit reached. This card will retry shortly — please wait.');
        // Cooldown timeout: clear rate limit error after 12 seconds to enable retry
        setTimeout(() => {
          setResultCards(prev => prev.map((c, idx) =>
            idx === cardIndex ? { ...c, rateLimitError: false } : c
          ));
        }, 12000);
      }
    } finally {
      activeGenerationsRef.current = Math.max(0, activeGenerationsRef.current - 1);
      setBackgroundGenerating(activeGenerationsRef.current > 0);
    }
  };
 
  const MAX_PARALLEL_CARD_GENS = 2;
 
  // ── Continuously pre-generate all remaining cards sequentially in the background
  useEffect(() => {
    if ((stage !== STAGE.RESULT && stage !== STAGE.GENERATING) || !resultCards.length) {
      if (queueTimeoutRef.current) {
        clearTimeout(queueTimeoutRef.current);
        queueTimeoutRef.current = null;
      }
      return;
    }
 
    if (queueTimeoutRef.current) {
      clearTimeout(queueTimeoutRef.current);
      queueTimeoutRef.current = null;
    }
 
    const generatingCount = resultCards.filter(c => c.isGenerating).length;
    if (generatingCount >= MAX_PARALLEL_CARD_GENS) return;
 
    // Find the first ungenerated card starting from the next index
    let nextIndex = -1;
    for (let i = resultSwipedCount + 1; i < resultCards.length; i++) {
      const card = resultCards[i];
      if (card?.isTryOn && card.imageUrl === card.productImageUrl && !card.isGenerating && !card.rateLimitError && !card.generationError) {
        nextIndex = i;
        break;
      }
    }
 
    if (nextIndex === -1) return;
 
    const now = Date.now();
    const elapsed = now - lastRequestTimeRef.current;
    const MIN_GAP = 500; // small UI gap between card generations
 
    if (elapsed >= MIN_GAP) {
      generateCardTryOn(nextIndex);
    } else {
      queueTimeoutRef.current = setTimeout(() => generateCardTryOn(nextIndex), MIN_GAP - elapsed);
    }
 
    return () => {
      if (queueTimeoutRef.current) clearTimeout(queueTimeoutRef.current);
    };
  }, [resultSwipedCount, stage, resultCards]);

  // ── Right swipe → MATCH
  const handleSwipeRight = useCallback((index, card) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!userPhoto) {
      Alert.alert('Upload Your Photo First 📸', 'Set up your body photo to enable AI try-on.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Set Up', onPress: () => router.push('/profile-setup') }]);
      return;
    }
    setCurrentGarment(card);
    setTryOnResult(null);
    setSavedWishlist(false);
    setStage(STAGE.MATCH);
    startPregenerating(card);
  }, [userPhoto, userPhotoBase64, sampleGarments]);

  const handleSwipeLeft = useCallback(() => {
    Haptics.selectionAsync();
  }, []);

  const handleSwipeUp = useCallback((index, card) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveMoodboard(card);
  }, [user]);

  // ── Moodboard save (swipe up)
  const saveMoodboard = async (card) => {
    if (!user || !firestore) return;
    try {
      await addDoc(collection(firestore, 'wishlist'), {
        userId: user.uid, title: card.title, brand: card.brand,
        price: card.priceINR, currency: '₹',
        productImageUrl: card.imageUrl, tryOnImageUrl: '',
        buyLink: card.buyLink || '', createdAt: serverTimestamp(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) { console.warn('Moodboard save:', e.message); }
  };

  // ── Long press → details
  const handleLongPress = useCallback((card) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setDetailsGarment(card);
    setShowDetails(true);
  }, []);

  // ── 10 themed style variations for the result stack (subtle overlays to keep faces clear and vibrant)
  const STYLE_THEMES = [
    { badge: 'ORIGINAL LOOK ✨', badgeColor: '#C4785A', styleOverlay: null },
    { badge: 'GOLDEN HOUR 🌅', badgeColor: '#F5A623', styleOverlay: 'rgba(245,166,35,0.12)' },
    { badge: 'COOL STUDIO ❄️', badgeColor: '#4A90D9', styleOverlay: 'rgba(74,144,217,0.08)' },
    { badge: 'NOIR CLASSIC 🖤', badgeColor: '#1A1A1A', styleOverlay: 'rgba(0,0,0,0.18)' },
    { badge: 'WARM SUNDOWN ☀️', badgeColor: '#F09030', styleOverlay: 'rgba(255,180,80,0.10)' },
    { badge: 'VINTAGE POLAROID 📸', badgeColor: '#9B7B50', styleOverlay: 'rgba(139,109,56,0.12)' },
    { badge: 'CYBER DRIP ⚡', badgeColor: '#CC00FF', styleOverlay: 'rgba(180,0,255,0.10)' },
    { badge: 'EMERALD COUTURE ✨', badgeColor: '#2D9B6F', styleOverlay: 'rgba(45,155,111,0.08)' },
    { badge: 'CINEMATIC 🎬', badgeColor: '#2A3545', styleOverlay: 'rgba(20,30,50,0.15)' },
    { badge: 'PASTEL DREAM 🌸', badgeColor: '#E8A0C0', styleOverlay: 'rgba(232,160,192,0.10)' },
  ];

  // ── Core generation logic — show animation while first try-on renders
  const runTryOnForGarment = async (garment) => {
    const startAnimTime = Date.now();
    const targetId = garment.imageUrl || garment.title;
    
    // Transition to the AI generation screen (showing the cinematic loader)
    setStage(STAGE.GENERATING);

    const activeSamples = sampleGarments; // Use all 6 recommended items

    // Build initial cards: Card 1 shows the uploaded garment photo with isGenerating: true
    const tryOnCards = [
      {
        id: 'tryon_user_' + Date.now(),
        isTryOn: true,
        imageUrl: garment.imageUrl || '',
        productImageUrl: garment.imageUrl || '',
        garmentSource: garment.garmentSource,
        beforeImageUrl: userPhoto,
        tryOnImageUrl: null,
        category: garment.category || 'upper_body',
        title: garment.title || 'My Uploaded Garment',
        brand: garment.brand || 'TrialX AI',
        priceINR: garment.priceINR || '—',
        buyLink: garment.buyLink || '',
        badge: 'MY LOOK ✨',
        badgeColor: '#FE3C72',
        styleOverlay: null,
        isGenerating: true,
      },
      ...activeSamples.map((item, idx) => {
        const assetUri = Image.resolveAssetSource(item.source).uri;
        return {
          id: 'tryon_rand_' + idx + '_' + Date.now(),
          isTryOn: true,
          imageUrl: assetUri,
          productImageUrl: assetUri,
          // Store the original require() numeric asset ID so getCleanBase64 can resolve
          // it via Asset.fromModule → local file path, avoiding Metro HTTP URL timeouts.
          garmentSource: item.source,
          beforeImageUrl: userPhoto,
          tryOnImageUrl: null,
          category: item.category || 'upper_body',
          title: item.title,
          brand: item.brand,
          priceINR: item.priceINR,
          buyLink: item.buyLink || '',
          badge: 'RECOMMENDED ✨',
          badgeColor: '#C4785A',
          styleOverlay: null,
          isGenerating: false,
        };
      })
    ];

    setResultCards(tryOnCards);
    setCardViewModes({});
    setResultDeckKey(k => k + 1);
    setResultSwipedCount(0);
    setTryOnResult(null);
    resultPos.setValue({ x: 0, y: 0 });

    // Clear any stale sample prefetch promises — only generate on demand now
    samplePromisesRef.current = {};

    // Run try-on API call — show result deck once the first image is ready
    try {
      const runSafeTryOn = async (imageUrl, title, category, garmentSource = null) => {
        try {
          if (!imageUrl && !garmentSource) return null;
          return await runVirtualTryOn(
            userPhotoBase64 || userPhoto,
            garmentSource || imageUrl,
            title, () => { }, false, category
          );
        } catch (err) {
          // Re-throw rate-limit errors — never swallow them or we lose the cooldown signal
          const isRateLimit =
            err?.isRateLimit ||
            err?.message?.includes('RATE_LIMIT_429') ||
            err?.message?.includes('Resource exhausted') ||
            err?.message?.includes('429');
          if (isRateLimit) throw err;
          console.warn(`[TryOn] Failed for ${title}:`, err);
          return null;
        }
      };

      console.log('[TryOn] Checking background pre-generation for user garment...');
      let userTryOnResult = null;

      if (pregeneratingGarmentIdRef.current === targetId && pregeneratePromiseRef.current) {
        console.log('[TryOn] Reusing active background pre-generation promise...');
        const pregenResult = await pregeneratePromiseRef.current;
        pregeneratePromiseRef.current = null;
        pregeneratingGarmentIdRef.current = null;
        if (isValidTryOnResult(pregenResult, garment.imageUrl)) {
          userTryOnResult = pregenResult;
        } else {
          console.warn('[TryOn] Pre-generation returned invalid result — regenerating fresh.');
        }
      }

      if (!userTryOnResult) {
        console.log('[TryOn] Generating user garment try-on now...');
        userTryOnResult = await runSafeTryOn(
          garment.imageUrl,
          garment.title,
          garment.category || 'upper_body',
          garment.garmentSource
        );
      }

      if (!isValidTryOnResult(userTryOnResult, garment.imageUrl)) {
        throw new Error('Could not generate try-on for your uploaded garment.');
      }

      // Update Card 1 (user's garment card) with the try-on result and set isGenerating: false
      setResultCards(prev => prev.map((card, idx) =>
        idx === 0 ? { ...card, tryOnImageUrl: userTryOnResult, imageUrl: userTryOnResult, isGenerating: false } : card
      ));
      setTryOnResult(userTryOnResult);

      const elapsed = Date.now() - startAnimTime;
      if (elapsed < 2500) {
        await new Promise(r => setTimeout(r, 2500 - elapsed));
      }

      setStage(STAGE.RESULT);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      incrementAuraPoints(5);

      // Compress try-on for Firestore (avoids 1MB doc size limit)
      // Handles both data: URIs and file:// URIs (new format from ai_engine.js)
      let mainFirestoreUrl = userTryOnResult;
      try {
        const ImageManipulator = require('expo-image-manipulator');
        let sourceUri = userTryOnResult;
        if (userTryOnResult.startsWith('data:image')) {
          const matches = userTryOnResult.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const tempPath = `${FileSystem.cacheDirectory}temp_tryon_fs_${Date.now()}.jpg`;
            await FileSystem.writeAsStringAsync(tempPath, matches[2], { encoding: 'base64' });
            sourceUri = tempPath;
          }
        }
        if (sourceUri.startsWith('file://') || sourceUri.startsWith('/')) {
          const compressed = await ImageManipulator.manipulateAsync(
            sourceUri,
            [{ resize: { width: 450 } }],
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );
          mainFirestoreUrl = `data:image/jpeg;base64,${compressed.base64}`;
          if (sourceUri !== userTryOnResult) {
            await FileSystem.deleteAsync(sourceUri, { idempotent: true }).catch(() => { });
          }
        }
      } catch (err) {
        console.warn('Firestore compression failed for user garment', err);
      }

      if (user && firestore) {
        addDoc(collection(firestore, 'tryon_results'), {
          userId: user.uid, resultImageUrl: mainFirestoreUrl,
          garmentImageUrl: garment.imageUrl, garmentDesc: garment.title,
          buyLink: garment.buyLink || '', brand: garment.brand,
          createdAt: serverTimestamp(),
        }).catch((err) => console.warn('Firestore addDoc tryon_results failed:', err));
        incrementProfileStats(user.uid, { tryOns: 1 }).catch(() => { });
      }

    } catch (e) {
      const elapsed = Date.now() - startAnimTime;

      // If this is a daily limit block, don't show the result deck — go back to IDLE
      if (e?.isLimitBlock) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setStage(STAGE.IDLE);
        Alert.alert(
          '⏱ Daily Limit Reached',
          e.message,
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      if (elapsed < 2500) {
        await new Promise(r => setTimeout(r, 2500 - elapsed));
      }
      setStage(STAGE.RESULT);
      // Turn off loading spinner for the first card and set generationError: true so it shows a failure state
      setResultCards(prev => prev.map((card, idx) =>
        idx === 0 ? { ...card, isGenerating: false, generationError: true } : card
      ));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const isRateLimit = e?.isRateLimit || e?.message?.includes('RATE_LIMIT_429') || e?.message?.includes('Resource exhausted') || e?.message?.includes('429');
      if (isRateLimit) {
        // Start 60-second countdown — don't let the user spam and worsen the quota window
        let secs = 60;
        setCooldownSecs(secs);
        clearInterval(cooldownRef.current);
        cooldownRef.current = setInterval(() => {
          secs -= 1;
          setCooldownSecs(secs);
          if (secs <= 0) {
            clearInterval(cooldownRef.current);
            setCooldownSecs(0);
          }
        }, 1000);
        Alert.alert(
          'AI Busy 🕒',
          'Rate limit reached. Try-on generation will resume shortly — sit tight!',
          [{ text: 'Got it', style: 'cancel' }]
        );
      } else {
        Alert.alert('Generation Failed 😔', e.message || 'Something went wrong.');
      }
    }
  };

  // ── Legacy handleTryOn kept for MatchAnimation compatibility
  const handleTryOn = async () => runTryOnForGarment(currentGarment);

  const handleSaveLaterFromMatch = () => {
    saveMoodboard(currentGarment);
    setStage(STAGE.IDLE);
  };

  const closeResult = () => {
    resultPos.setValue({ x: 0, y: 0 });
    setStage(STAGE.IDLE);
  };

  const saveWishlist = async (card = null) => {
    if (!user || !firestore) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const targetTitle = card ? card.title : (currentGarment?.title || 'Fashion Item');
      const targetBrand = card ? card.brand : (currentGarment?.brand || 'TrialX AI');
      const targetPrice = card ? card.priceINR : (currentGarment?.priceINR || '0');
      const targetProductImage = card ? (card.productImageUrl || card.imageUrl) : (currentGarment?.imageUrl || '');
      let savedUrl = card ? (card.tryOnImageUrl || card.imageUrl) : (tryOnResult || '');
      const targetBuyLink = card ? card.buyLink : (currentGarment?.buyLink || '');

      // Compress base64/file URI to ensure it fits in Firestore's 1MB limit
      try {
        const ImageManipulator = require('expo-image-manipulator');
        let sourceUri = savedUrl;
        if (savedUrl.startsWith('data:image')) {
          const matches = savedUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const tempPath = `${FileSystem.cacheDirectory}temp_wishlist_${Date.now()}.jpg`;
            await FileSystem.writeAsStringAsync(tempPath, matches[2], { encoding: 'base64' });
            sourceUri = tempPath;
          }
        }
        if (sourceUri.startsWith('file://') || sourceUri.startsWith('/')) {
          const compressed = await ImageManipulator.manipulateAsync(
            sourceUri,
            [{ resize: { width: 450 } }],
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );
          savedUrl = `data:image/jpeg;base64,${compressed.base64}`;
          if (sourceUri !== savedUrl) {
            await FileSystem.deleteAsync(sourceUri, { idempotent: true }).catch(() => { });
          }
        }
      } catch (err) {
        console.warn('Wishlist compression failed', err);
      }

      await addDoc(collection(firestore, 'wishlist'), {
        userId: user.uid, title: targetTitle, brand: targetBrand, price: targetPrice,
        currency: '₹', productImageUrl: targetProductImage,
        tryOnImageUrl: savedUrl, buyLink: targetBuyLink,
        createdAt: serverTimestamp(),
      });
      setSavedWishlist(true);
      incrementAuraPoints(10); // +10 for save
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const handleDownload = async () => {
    if (!tryOnResult) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      let uri = tryOnResult;
      if (tryOnResult.startsWith('data:image')) {
        const b64 = tryOnResult.split('base64,')[1];
        uri = `${FileSystem.cacheDirectory}trialxai_${Date.now()}.jpg`;
        await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' });
      } else if (tryOnResult.startsWith('http')) {
        const dl = await FileSystem.downloadAsync(tryOnResult, `${FileSystem.cacheDirectory}trialxai_${Date.now()}.jpg`);
        uri = dl.uri;
      }
      // file:// URIs can be used directly

      // Save directly to device photos if MediaLibrary is loaded
      if (MediaLibrary && MediaLibrary.requestPermissionsAsync && MediaLibrary.saveToLibraryAsync) {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.saveToLibraryAsync(uri);
          Alert.alert('Saved! 📸', 'Image saved to your Photos.');
          incrementAuraPoints(10);
          return;
        }
      }

      await Share.share({ title: 'My TrialX AI Look ✨', url: uri, message: 'Styled by @trialxai ✨ → https://trialix.app' });
      incrementAuraPoints(10); // +10 for share
    } catch (e) {
      console.warn(e);
      Alert.alert('Download Failed', 'Could not save the image.');
    }
  };

  const getCardTryOnUrl = (card) => card?.tryOnImageUrl || card?.imageUrl;

  const handleResultCardDownload = async (card) => {
    const imageUrl = getCardTryOnUrl(card);
    if (!imageUrl || card?.isGenerating || imageUrl === card?.productImageUrl) {
      Alert.alert('Still generating…', 'Your try-on is being created. Please wait a moment.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { saved } = await downloadTryOnImage(imageUrl);
      Alert.alert(saved ? 'Saved!' : 'Shared', saved ? 'Image saved to your gallery.' : 'Image shared via system sheet.');
      if (saved) incrementAuraPoints(10);
    } catch (err) {
      console.warn(err);
      Alert.alert('Download Failed', 'Could not save the image.');
    }
  };

  const handleWhatsAppShare = async (card) => {
    const imageUrl = getCardTryOnUrl(card);
    if (!imageUrl || card?.isGenerating || imageUrl === card?.productImageUrl) {
      Alert.alert('Still generating…', 'Your try-on is being created. Please wait a moment.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await shareTryOnWhatsApp({ imageUrl, title: card.title, brand: card.brand });
      incrementAuraPoints(5);
    } catch (err) {
      console.warn('[WhatsApp Share]', err);
      Alert.alert('Share Failed', 'Could not share the image. Please try again.');
    }
  };

  const postToCommunity = async (card) => {
    if (!user || !firestore || card?.isGenerating) {
      if (card?.isGenerating) Alert.alert('Still generating…', 'Wait for your try-on to finish first.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await postTryOnToCommunity({
        user,
        profile: { name: userName, basePhotoUrl: userPhoto },
        card,
      });
      Alert.alert('Posted to Community!', 'Your try-on is now live for everyone to see.');
    } catch (err) {
      console.warn('[Community Post Failed]', err.message);
      Alert.alert('Post Failed', err.message || 'Could not post to community.');
    }
  };

  // ── Save a similar product to wishlist
  const saveSimilarToWishlist = async (item) => {
    if (!user || !firestore) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await addDoc(collection(firestore, 'wishlist'), {
        userId: user.uid, title: item.title,
        brand: item.brand, price: item.priceINR,
        currency: '₹', productImageUrl: item.imageUrl,
        tryOnImageUrl: '', buyLink: item.buyLink || '',
        createdAt: serverTimestamp(),
      });
      incrementAuraPoints(5);
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const handleResultSwipeRight = async (index, card) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (card.isTryOn) {
      await saveWishlist(card);
    } else {
      await saveSimilarToWishlist(card);
    }
    setResultSwipedCount(c => c + 1);
  };

  const handleResultSwipeLeft = (index, card) => {
    Haptics.selectionAsync();
    setResultSwipedCount(c => c + 1);
  };

  const activeResultCard = resultCards[resultSwipedCount] || null;

  const showBeforeView = () => {
    if (!activeResultCard) return;
    Haptics.selectionAsync();
    setCardViewModes(m => ({ ...m, [activeResultCard.id]: 'before' }));
  };

  const showAfterView = () => {
    if (!activeResultCard) return;
    Haptics.selectionAsync();
    setCardViewModes(m => ({ ...m, [activeResultCard.id]: 'after' }));
  };

  const activeIsBefore = activeResultCard && cardViewModes[activeResultCard.id] === 'before';

  // ── Render Card inside the Result modal SwipeDeck
  const renderResultCard = (card) => {
    const hasTryOn = card.isTryOn && !card.isGenerating
      && (card.tryOnImageUrl || (card.imageUrl && card.imageUrl !== card.productImageUrl));
    const isBefore = cardViewModes[card.id] === 'before';
    const displayUri = isBefore
      ? (card.beforeImageUrl || userPhoto)
      : (card.tryOnImageUrl || card.imageUrl);

    return (
    <View style={styles.resCard}>
      {/* Blurred background to prevent crop/alignment issues */}
      <Image source={{ uri: displayUri }} style={[StyleSheet.absoluteFillObject, { opacity: 0.5 }]} blurRadius={30} resizeMode="cover" />
      <Image source={{ uri: displayUri }} style={StyleSheet.absoluteFillObject} resizeMode="contain" />
      {card.styleOverlay && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: card.styleOverlay }]} />
      )}
      <LinearGradient colors={['transparent', 'rgba(17,17,17,0.92)']} style={styles.resCardGrad} />

      {card.isGenerating && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <ActivityIndicator size="large" color="#FE3C72" />
          <Text style={{ color: 'white', marginTop: 12, fontSize: 15, fontWeight: '600', letterSpacing: 0.5, textAlign: 'center' }}>
            {card.rateLimitError ? 'AI cooling down… retrying shortly' : 'AI Tailoring... ✨'}
          </Text>
          {!card.rateLimitError && (
            <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 6, fontSize: 12, textAlign: 'center' }}>
              ~4s per look
            </Text>
          )}
        </View>
      )}

      {card.generationError && !card.isGenerating && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <Ionicons name="alert-circle-outline" size={48} color="#E05C3E" style={{ marginBottom: 12 }} />
          <Text style={{ color: 'white', fontSize: 15, fontWeight: '600', letterSpacing: 0.5, textAlign: 'center', marginBottom: 16 }}>
            Try-On Generation Failed
          </Text>
          <Pressable
            style={{
              backgroundColor: '#FE3C72',
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6
            }}
            onPress={() => {
              const cardIdx = resultCards.findIndex(c => c.id === card.id);
              if (cardIdx !== -1) {
                setResultCards(prev => prev.map((c, idx) =>
                  idx === cardIdx ? { ...c, generationError: false, rateLimitError: false } : c
                ));
                generateCardTryOn(cardIdx);
              }
            }}
          >
            <Ionicons name="refresh" size={16} color="white" />
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Retry Generation</Text>
          </Pressable>
        </View>
      )}

      {/* Before / After badge */}
      {hasTryOn && (
        <View style={styles.beforeAfterBadge}>
          <Text style={styles.beforeAfterBadgeText}>{isBefore ? 'BEFORE' : 'AFTER ✨'}</Text>
        </View>
      )}

      {/* Badge */}
      {card.badge && (
        <View style={[styles.resTrendBadge, { backgroundColor: card.badgeColor || '#C4785A' }]}>
          <Text style={styles.resTrendBadgeText}>{card.badge}</Text>
        </View>
      )}

      {/* Card content */}
      <View style={styles.resCardContent}>
        <Text style={styles.resCardBrand}>{card.brand.toUpperCase()}</Text>
        <Text style={styles.resCardTitle}>{card.title}</Text>

        <View style={styles.resCardFooter}>
          <View style={styles.resPriceChip}>
            <Text style={styles.resPriceText}>₹{card.priceINR}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {card.buyLink ? (
              <Pressable
                style={[styles.resBuyPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                onPress={() => Linking.openURL(card.buyLink).catch(() => { })}
              >
                <Ionicons name="cart-outline" size={14} color="white" />
                <Text style={styles.resBuyPillText}>Buy</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.resDownloadPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
              onPress={() => handleResultCardDownload(card)}
              disabled={card.isGenerating}
            >
              <Ionicons name="download-outline" size={14} color="white" />
              <Text style={styles.resDownloadPillText}>Download</Text>
            </Pressable>
            {/* WhatsApp Share */}
            <Pressable
              style={[
                styles.resDownloadPill,
                { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#25D366' }
              ]}
              onPress={() => handleWhatsAppShare(card)}
              disabled={card.isGenerating}
            >
              <Ionicons name="logo-whatsapp" size={14} color="white" />
              <Text style={styles.resDownloadPillText}>Share</Text>
            </Pressable>
            {card.isTryOn ? (
              <Pressable
                style={[styles.resPostPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                onPress={() => postToCommunity(card)}
                disabled={card.isGenerating}
              >
                <Ionicons name="paper-plane-outline" size={14} color="white" />
                <Text style={styles.resPostPillText}>Post</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <Text style={styles.resCardHint}>
          {hasTryOn
            ? 'Swipe ← pass  ·  ♥ wishlist →'
            : card.isTryOn
              ? 'Generating your look…'
              : 'Swipe right to save'}
        </Text>
      </View>
    </View>
    );
  };

  const handleChangeUserPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to choose a model image.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, base64: true });
      if (!res.canceled) {
        const asset = res.assets[0];
        const b64 = asset.base64;
        // Copy to permanent storage immediately — ImagePicker cache is ephemeral on Android
        const permUri = `${FileSystem.documentDirectory}user_photo_${Date.now()}.jpg`;
        if (b64) {
          await FileSystem.writeAsStringAsync(permUri, b64, { encoding: 'base64' });
        } else {
          await FileSystem.copyAsync({ from: asset.uri, to: permUri });
        }
        setUserPhoto(permUri);
        if (b64) setUserPhotoBase64(b64);
      }
    } catch (e) {
      console.warn('Image picker error:', e);
    }
  };

  const handleAvatarPress = () => {
    Alert.alert(
      'Profile Options',
      'What would you like to do?',
      [
        { text: 'Go to Profile', onPress: () => router.push('/(tabs)/profile') },
        { text: 'Change Try-On Photo', onPress: handleChangeUserPhoto },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // ── Workshop: pick garment from gallery
  const handlePickGarment = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to upload a garment.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, base64: true });
      if (!res.canceled) {
        const asset = res.assets[0];
        // Copy to permanent storage immediately — ImagePicker cache is ephemeral on Android
        const permUri = `${FileSystem.documentDirectory}garment_upload_${Date.now()}.jpg`;
        if (asset.base64) {
          await FileSystem.writeAsStringAsync(permUri, asset.base64, { encoding: 'base64' });
        } else {
          await FileSystem.copyAsync({ from: asset.uri, to: permUri });
        }
        setSelectedGarmentSource(null);
        setGarmentUri(permUri);
      }
    } catch (e) {
      console.warn('Picker error:', e);
      Alert.alert('Picker Error', 'Unable to open gallery.');
    }
  };

  // ── Workshop: instantly load a sample garment from local assets
  const handleSelectSample = async (item) => {
    try {
      Haptics.selectionAsync();
      setSelectedGarmentSource(item.source);
      const asset = Asset.fromModule(item.source);
      await asset.downloadAsync();
      const uri = asset.localUri || asset.uri;
      if (uri) setGarmentUri(uri);
    } catch (e) {
      console.warn('Sample load error:', e);
      Alert.alert('Sample Error', 'Could not load the sample garment.');
    }
  };

  // ── Workshop: kick off AI generation
  const handleWorkshopGenerate = () => {
    if (!garmentUri || !userPhoto) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const garment = {
      id: 'workshop_' + Date.now(),
      imageUrl: garmentUri,
      garmentSource: selectedGarmentSource,
      category: garmentCategory,
      title: 'My Uploaded Garment',
      brand: 'TrialX AI',
      priceINR: '—',
      buyLink: '',
    };
    setCurrentGarment(garment);
    runTryOnForGarment(garment);
  };

  // ── Render garment card
  const renderCard = (card) => (
    <Pressable
      style={styles.card}
      onLongPress={() => handleLongPress(card)}
      delayLongPress={500}
    >
      <Image source={{ uri: card.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(42,31,26,0.92)']} style={styles.cardGrad} />

      {/* Match Score */}
      <View style={styles.matchScoreBadge}>
        <Text style={styles.matchScoreNum}>{card.matchScore}%</Text>
        <Text style={styles.matchScoreLabel}>Match</Text>
      </View>

      {/* Badge */}
      {card.badge && (
        <View style={[styles.trendBadge, { backgroundColor: card.badgeColor || '#C4785A' }]}>
          <Text style={styles.trendBadgeText}>{card.badge}</Text>
        </View>
      )}

      {/* Card content */}
      <View style={styles.cardContent}>
        <Text style={styles.cardBrand}>{card.brand.toUpperCase()}</Text>
        <Text style={styles.cardTitle}>{card.title}</Text>

        {/* Social proof */}
        <View style={styles.cardSocialRow}>
          <Icon name="user" size={12} color="rgba(255,255,255,0.6)" />
          <Text style={styles.cardSocial}> People like you wore this</Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.priceChip}>
            <Text style={styles.priceText}>₹{card.priceINR}</Text>
          </View>
          {card.buyLink ? (
            <Pressable
              style={styles.buyPill}
              onPress={() => Linking.openURL(card.buyLink).catch(() => { })}
            >
              <Text style={styles.buyPillText}>🛒 Buy</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.cardHint}>Swipe → to try on  ·  ↑ to wishlist</Text>
      </View>
    </Pressable>
  );

  const genderLabel = userGender === 'Male' ? "Men's" : userGender === 'Female' ? "Women's" : 'All';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* ── HEADER */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Pressable style={styles.headerAvatar} onPress={handleAvatarPress}>
            {userPhoto
              ? <Image source={{ uri: userPhoto }} style={styles.headerAvatarImg} />
              : <Icon name="user" size={20} color={theme.colors.text} />}
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.logoText}>TrialX</Text>
            <Text style={styles.logoAI}>AI</Text>
          </View>
          <View style={styles.headerRight}>
            {/* Aura points */}
            <View style={styles.auraChip}>
              <Ionicons name="sparkles" size={14} color="#C49A6C" style={{ marginRight: 2 }} />
              <Text style={styles.auraText}>{auraPoints}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {!userPhoto ? (
        /* ── SETUP PROMPT */
        <View style={styles.setupWrap}>
          <LinearGradient colors={['#FAF7F4', '#F5EDE4']} style={StyleSheet.absoluteFillObject} />
          <View style={styles.setupCard}>
            <Icon name="camera" size={48} color={theme.colors.primary} />
            <Text style={styles.setupTitle}>Upload Your Photo Once</Text>
            <Text style={styles.setupSub}>
              AI maps your body once. Then every swipe shows exactly how clothes fit on YOU — no re-uploads ever.
            </Text>
            <Pressable style={styles.setupBtn} onPress={() => router.push('/profile-setup')}>
              <LinearGradient colors={theme.colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.setupBtnGrad, { flexDirection: 'row', gap: 6 }]}>
                <Text style={styles.setupBtnText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      ) : (
        /* ── GARMENT UPLOAD WORKSHOP */
        <ScrollView style={styles.workshopScroll} contentContainerStyle={styles.workshopContent} showsVerticalScrollIndicator={false}>

          {/* Body Photo Row */}
          <View style={styles.workshopBodyRow}>
            <View style={styles.workshopBodyThumb}>
              <Image source={{ uri: userPhoto }} style={styles.workshopBodyImg} resizeMode="cover" />
              <LinearGradient colors={['transparent', 'rgba(42,31,26,0.5)']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.workshopBodyLabel}>
                <Text style={styles.workshopBodyLabelText}>AI MODEL 🧍</Text>
              </View>
            </View>
            <View style={styles.workshopBodyInfo}>
              <Text style={styles.workshopBodyTitle}>Your AI Twin</Text>
              <Text style={styles.workshopBodySub}>Upload a garment and generate{"\n"}{sampleGarments.length} unique styled looks instantly.</Text>
              <View style={styles.workshopStyleCount}>
                <Text style={styles.workshopStyleCountNum}>{sampleGarments.length + 1}</Text>
                <Text style={styles.workshopStyleCountLabel}> Style Looks</Text>
              </View>
            </View>
          </View>

          {/* Garment Dropzone */}
          <Pressable style={styles.workshopDropzone} onPress={handlePickGarment}>
            {garmentUri ? (
              <>
                <Image source={{ uri: garmentUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                <LinearGradient colors={['transparent', 'rgba(42,31,26,0.72)']} style={StyleSheet.absoluteFillObject} />
                <View style={styles.workshopDropzoneLoaded}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="checkmark-circle" size={18} color="#6B9E7A" />
                    <Text style={styles.workshopDropzoneLoadedText}>Garment Ready</Text>
                  </View>
                  <Pressable style={[styles.workshopRemoveBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => { setGarmentUri(null); setSelectedGarmentSource(null); }}>
                    <Ionicons name="trash-outline" size={14} color="white" />
                    <Text style={styles.workshopRemoveBtnText}>Remove</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.workshopDropzoneEmpty}>
                <LinearGradient colors={['#FDF2EC', '#FAF7F4']} style={StyleSheet.absoluteFillObject} />
                <Ionicons name="shirt-outline" size={48} color={theme.colors.primary} style={{ marginBottom: 4 }} />
                <Text style={styles.workshopDropzoneTitle}>Upload Garment Photo</Text>
                <Text style={styles.workshopDropzoneSub}>{"Tap to pick a clothing item\nfrom your gallery"}</Text>
                <View style={[styles.workshopDropzoneHint, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                  <Ionicons name="images-outline" size={16} color="white" />
                  <Text style={styles.workshopDropzoneHintText}>Choose from Gallery</Text>
                </View>
              </View>
            )}
          </Pressable>

          {/* Generate Button */}
          <Pressable
            style={[styles.workshopGenBtn, (!garmentUri || cooldownSecs > 0) && styles.workshopGenBtnDisabled]}
            onPress={handleWorkshopGenerate}
            disabled={!garmentUri || cooldownSecs > 0}
          >
            <LinearGradient
              colors={garmentUri && cooldownSecs === 0 ? theme.colors.gradientPrimary : ['#D4C4BB', '#C4B4AA']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.workshopGenBtnGrad, { flexDirection: 'row', gap: 6 }]}
            >
              {cooldownSecs > 0 ? (
                <>
                  <Ionicons name="time-outline" size={18} color="white" />
                  <Text style={styles.workshopGenBtnText}>Retry in {cooldownSecs}s…</Text>
                </>
              ) : garmentUri ? (
                <>
                  <Ionicons name="sparkles" size={18} color="white" />
                  <Text style={styles.workshopGenBtnText}>Generate AI Wear-On Look</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color="white" />
                  <Text style={styles.workshopGenBtnText}>Upload a Garment to Begin</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          {/* ── Quick Start Samples */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeaderTitle}>Quick Start Samples</Text>
                <Text style={styles.sectionHeaderSub}>Tap a garment to instantly load it</Text>
              </View>
              <Ionicons name="shirt-outline" size={18} color="#C4785A" />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={styles.sampleScroll}>
              {sampleGarments.map((item, idx) => (
                <Pressable key={idx} style={styles.sampleCard} onPress={() => handleSelectSample(item)}>
                  <Image source={item.source} style={styles.sampleImg} resizeMode="cover" />
                  <LinearGradient colors={['transparent', 'rgba(42,31,26,0.78)']} style={StyleSheet.absoluteFillObject} />
                  <View style={styles.sampleInfo}>
                    <Text style={styles.sampleBrand}>{item.brand.toUpperCase()}</Text>
                    <Text style={styles.sampleTitle} numberOfLines={2}>{item.title}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* ── Style History */}
          {recentTryOns.length > 0 && (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionHeaderTitle}>Your Style History</Text>
                  <Text style={styles.sectionHeaderSub}>Recent AI try-ons</Text>
                </View>
                <Ionicons name="time-outline" size={18} color="#C4785A" />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sampleScroll}>
                {recentTryOns.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.sampleCard}
                    onPress={() => item.buyLink && Linking.openURL(item.buyLink).catch(() => { })}
                  >
                    <Image source={{ uri: item.resultImageUrl }} style={styles.sampleImg} resizeMode="cover" />
                    <LinearGradient colors={['transparent', 'rgba(42,31,26,0.78)']} style={StyleSheet.absoluteFillObject} />
                    <View style={styles.sampleInfo}>
                      <Text style={styles.sampleBrand}>{(item.brand || 'TRIALX AI').toUpperCase()}</Text>
                      <Text style={styles.sampleTitle} numberOfLines={2}>{item.garmentDesc || 'AI Look'}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

        </ScrollView>
      )}

      {/* ── MATCH ANIMATION */}
      <MatchAnimation
        visible={stage === STAGE.MATCH}
        garment={currentGarment}
        userPhotoUrl={userPhoto}
        onTryOn={handleTryOn}
        onSaveLater={handleSaveLaterFromMatch}
      />

      {/* ── AI GENERATION SCREEN */}
      <AIGenerationScreen
        visible={stage === STAGE.GENERATING}
        garment={currentGarment}
      />

      {/* ── RESULT CARD MODAL — Try-On + Similar Products as Swipeable Deck */}
      <Modal visible={stage === STAGE.RESULT} animationType="slide" presentationStyle="fullScreen">
        <StatusBar style="light" />
        <View style={styles.resultOuter}>
          {/* Header row */}
          <SafeAreaView edges={['top']} style={styles.resultHeaderSafe}>
            <View style={styles.resultTopBar}>
              <Pressable style={styles.resultClose} onPress={closeResult}>
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '800' }}>✕ Close</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={16} color={theme.colors.primary} />
                <Text style={styles.resultTopTitle}>Your Style Stack</Text>
              </View>
              <View style={styles.auraChip}>
                <Ionicons name="sparkles" size={12} color="#C49A6C" style={{ marginRight: 2 }} />
                <Text style={styles.auraText}>+10 Aura</Text>
              </View>
            </View>
          </SafeAreaView>

          {/* Swipe Deck Container */}
          <View style={styles.resultDeckWrap}>
            {resultSwipedCount < resultCards.length ? (
              <SwipeDeck
                key={resultDeckKey}
                ref={resultDeckRef}
                cards={resultCards}
                renderCard={renderResultCard}
                onSwipeRight={handleResultSwipeRight}
                onSwipeLeft={handleResultSwipeLeft}
                stackSize={2}
                overlayLabels={{ right: '♥ WISHLIST', left: '✕ NOPE', up: '♥ SAVE' }}
              />
            ) : (
              <View style={styles.resultAllDone}>
                <Ionicons name="checkmark-done-circle-outline" size={64} color={theme.colors.success} style={{ marginBottom: 12 }} />
                <Text style={styles.resultAllDoneTitle}>All Done!</Text>
                <Text style={styles.resultAllDoneSub}>
                  {"You've swiped all matching recommendations."}
                </Text>
                <Pressable style={styles.resultAllDoneBtn} onPress={closeResult}>
                  <Text style={styles.resultAllDoneBtnText}>Back to Discover</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Tinder-style controls + Before/After toggles */}
          {resultSwipedCount < resultCards.length && (
            <View style={styles.resultControlsWrap}>
              {/* Before / After row */}
              <View style={styles.beforeAfterRow}>
                <Pressable
                  style={[styles.beforeAfterToggle, activeIsBefore && styles.beforeAfterToggleActive]}
                  onPress={showBeforeView}
                >
                  <Ionicons name="chevron-back" size={16} color={activeIsBefore ? '#C4785A' : '#7A6055'} />
                  <Text style={[styles.beforeAfterToggleText, activeIsBefore && styles.beforeAfterToggleTextActive]}>Before</Text>
                </Pressable>

                <View style={styles.swipeDotRow}>
                  <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                    {resultCards.map((_, i) => (
                      <View key={i} style={[styles.swipeDot, i === resultSwipedCount && styles.swipeDotActive]} />
                    ))}
                  </View>
                  <Text style={styles.resDeckHintText}>
                    {resultSwipedCount + 1} / {resultCards.length}
                  </Text>
                </View>

                <Pressable
                  style={[styles.beforeAfterToggle, !activeIsBefore && styles.beforeAfterToggleActive]}
                  onPress={showAfterView}
                >
                  <Text style={[styles.beforeAfterToggleText, !activeIsBefore && styles.beforeAfterToggleTextActive]}>After</Text>
                  <Ionicons name="chevron-forward" size={16} color={!activeIsBefore ? '#C4785A' : '#7A6055'} />
                </Pressable>
              </View>

              {/* Tinder pass / wishlist buttons */}
              <View style={styles.tinderActionRow}>
                <Pressable
                  style={styles.tinderNopeBtn}
                  onPress={() => resultDeckRef.current?.swipeLeft()}
                >
                  <Icon name="x" size={28} color="#E05C3E" />
                </Pressable>

                <Text style={styles.tinderHintText}>Swipe card or tap</Text>

                <Pressable
                  style={styles.tinderHeartBtn}
                  onPress={() => resultDeckRef.current?.swipeRight()}
                >
                  <Icon name="heart" size={28} color="#6B9E7A" fill="#6B9E7A" />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ── GARMENT PICKER SHEET */}
      <Modal visible={showPicker} animationType="slide" transparent presentationStyle="overFullScreen">
        <Pressable style={styles.pickerOverlay} onPress={() => setShowPicker(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Upload Your Garment</Text>
            <Text style={styles.pickerSub}>Pick any clothing from your gallery — TrialX AI will dress it on you.</Text>
            <Pressable style={styles.pickerBtn} onPress={handlePickGarment}>
              <LinearGradient colors={theme.colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.pickerBtnGrad, { flexDirection: 'row', gap: 6 }]}>
                <Ionicons name="images-outline" size={18} color="white" />
                <Text style={styles.pickerBtnText}>Choose from Gallery</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.pickerCancel} onPress={() => setShowPicker(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── DETAILS SHEET */}
      <Modal visible={showDetails} animationType="slide" transparent presentationStyle="overFullScreen">
        <Pressable style={styles.pickerOverlay} onPress={() => setShowDetails(false)}>
          {detailsGarment && (
            <View style={[styles.pickerSheet, { gap: 14 }]}>
              <View style={styles.pickerHandle} />
              <Image source={{ uri: detailsGarment.imageUrl }} style={styles.detailsImg} />
              <View style={styles.detailsMatchRow}>
                <Text style={styles.detailsMatchNum}>{detailsGarment.matchScore}%</Text>
                <Text style={styles.detailsMatchLabel}> AI Match Score</Text>
              </View>
              <Text style={styles.detailsBrand}>{detailsGarment.brand?.toUpperCase()}</Text>
              <Text style={styles.detailsTitle}>{detailsGarment.title}</Text>
              <Text style={styles.detailsPrice}>₹{detailsGarment.priceINR}</Text>
              <Pressable style={styles.pickerBtn} onPress={() => { setShowDetails(false); setTimeout(() => handleSwipeRight(0, detailsGarment), 300); }}>
                <LinearGradient colors={theme.colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.pickerBtnGrad, { flexDirection: 'row', gap: 6 }]}>
                  <Ionicons name="sparkles" size={16} color="white" />
                  <Text style={styles.pickerBtnText}>Try It On</Text>
                </LinearGradient>
              </Pressable>
              {detailsGarment.buyLink ? (
                <Pressable style={[styles.pickerCancel, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => Linking.openURL(detailsGarment.buyLink).catch(() => { })}>
                  <Ionicons name="cart-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.pickerCancelText, { color: theme.colors.primary }]}>Buy on {detailsGarment.brand}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES — Dark Luxury
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F4' },

  // Header
  headerSafe: { backgroundColor: '#FAF7F4' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, height: 58,
    borderBottomWidth: 0.5, borderBottomColor: '#EDE0D4',
  },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#C4785A',
  },
  headerAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  headerCenter: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  logoText: { fontSize: 26, fontWeight: '900', color: '#2A1F1A', letterSpacing: 0.5 },
  logoAI: { fontSize: 13, fontWeight: '800', color: '#C4785A', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  auraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#FDF6EC',
    borderRadius: 20, borderWidth: 1, borderColor: '#EDD5B0',
    gap: 4,
  },
  auraText: { fontSize: 12, fontWeight: '800', color: '#C49A6C' },

  // Setup
  setupWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FAF7F4' },
  setupCard: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 32, padding: 32,
    alignItems: 'center', gap: 16,
    borderWidth: 1, borderColor: '#EDE0D4',
    shadowColor: '#2A1F1A', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08, shadowRadius: 32, elevation: 6,
  },
  setupTitle: { fontSize: 24, fontWeight: '900', color: '#2A1F1A', textAlign: 'center' },
  setupSub: { fontSize: 14, color: '#7A6055', textAlign: 'center', lineHeight: 22 },
  setupBtn: { width: '100%', height: 54, borderRadius: 18, overflow: 'hidden' },
  setupBtnGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  setupBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },

  // Deck
  deckWrap: { flex: 1, paddingTop: 6, justifyContent: 'space-between', paddingBottom: 4 },
  filterRow: { paddingHorizontal: 20, marginBottom: 4, alignItems: 'center' },
  filterBadge: {
    paddingHorizontal: 14, paddingVertical: 5,
    backgroundColor: '#FDF2EC', borderRadius: 20,
    borderWidth: 1, borderColor: '#EEC4AA',
  },
  filterText: { fontSize: 12, fontWeight: '800', color: '#C4785A' },

  // Swipe Card
  card: {
    flex: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: '#FFFFFF',
    shadowColor: '#2A1F1A', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 12,
  },
  cardGrad: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 320 },
  matchScoreBadge: {
    position: 'absolute', top: 14, left: 14,
    backgroundColor: 'rgba(250,247,244,0.92)', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center',
    borderWidth: 1, borderColor: '#EDE0D4',
  },
  matchScoreNum: { fontSize: 18, fontWeight: '900', color: '#6B9E7A' },
  matchScoreLabel: { fontSize: 9, fontWeight: '700', color: '#7A6055', letterSpacing: 1 },
  trendBadge: {
    position: 'absolute', top: 14, right: 14,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
  },
  trendBadgeText: { color: 'white', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },
  cardContent: { position: 'absolute', bottom: 20, left: 20, right: 20, gap: 8 },
  cardBrand: { fontSize: 11, fontWeight: '800', color: '#EEC4AA', letterSpacing: 2.5 },
  cardTitle: { fontSize: 22, fontWeight: '900', color: 'white', textShadowColor: 'rgba(42,31,26,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  cardSocialRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardSocial: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  priceChip: { backgroundColor: '#C4785A', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  priceText: { color: 'white', fontWeight: '800', fontSize: 14 },
  buyPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  buyPillText: { color: 'white', fontWeight: '700', fontSize: 13 },
  cardHint: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 2 },

  // Action Bar
  actionBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 22, paddingVertical: 10,
  },
  abBtn: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#EDE0D4',
  },
  abLarge: { width: 64, height: 64, borderRadius: 32 },
  abCamera: {
    width: 72, height: 72, borderRadius: 36, overflow: 'hidden',
    shadowColor: '#C4785A', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 18, elevation: 10,
  },
  abCameraGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  actionBtnContainer: { alignItems: 'center', gap: 6 },
  actionHintText: { fontSize: 12, fontWeight: '700', color: '#7A6055' },

  // Picker / Details Sheet
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(42,31,26,0.6)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 28, paddingBottom: 48, alignItems: 'center', gap: 12,
    borderTopWidth: 1, borderTopColor: '#EDE0D4',
  },
  pickerHandle: { width: 44, height: 5, backgroundColor: '#EDE0D4', borderRadius: 3, marginBottom: 4 },
  pickerTitle: { fontSize: 22, fontWeight: '900', color: '#2A1F1A' },
  pickerSub: { fontSize: 14, color: '#7A6055', textAlign: 'center', lineHeight: 21 },
  pickerBtn: { width: '100%', height: 54, borderRadius: 18, overflow: 'hidden' },
  pickerBtnGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickerBtnText: { color: 'white', fontWeight: '800', fontSize: 15 },
  pickerCancel: { paddingVertical: 10 },
  pickerCancelText: { color: '#B8A49A', fontWeight: '600', fontSize: 15 },

  detailsImg: { width: 140, height: 180, borderRadius: 20, backgroundColor: '#FAF7F4' },
  detailsMatchRow: { flexDirection: 'row', alignItems: 'baseline' },
  detailsMatchNum: { fontSize: 36, fontWeight: '900', color: '#6B9E7A' },
  detailsMatchLabel: { fontSize: 14, color: '#7A6055', fontWeight: '600' },
  detailsBrand: { fontSize: 11, fontWeight: '800', color: '#C4785A', letterSpacing: 2 },
  detailsTitle: { fontSize: 18, fontWeight: '800', color: '#2A1F1A', textAlign: 'center' },
  detailsPrice: { fontSize: 20, fontWeight: '900', color: '#2A1F1A' },

  // Result screen
  resultOuter: { flex: 1, backgroundColor: '#FAF7F4' },
  resultHeaderSafe: { backgroundColor: '#FAF7F4' },
  resultClose: {
    paddingHorizontal: 12, paddingVertical: 8,
  },
  resultTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#EDE0D4',
  },
  resultTopTitle: { fontSize: 18, fontWeight: '900', color: '#2A1F1A' },

  // Swipe Deck Container inside the modal
  resultDeckWrap: {
    flex: 1,
    paddingTop: 16,
    paddingBottom: 16,
    justifyContent: 'center',
  },

  // Cards inside result deck
  resCard: {
    flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: '#111111',
    shadowColor: '#2A1F1A', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 12,
  },
  resCardGrad: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 280 },
  resTrendBadge: {
    position: 'absolute', top: 16, right: 16,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
  },
  resTrendBadgeText: { color: 'white', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },
  resCardContent: { position: 'absolute', bottom: 20, left: 20, right: 20, gap: 8 },
  resCardBrand: { fontSize: 11, fontWeight: '800', color: '#EEC4AA', letterSpacing: 2.5 },
  resCardTitle: { fontSize: 22, fontWeight: '900', color: 'white', textShadowColor: 'rgba(42,31,26,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  resCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  resPriceChip: { backgroundColor: '#C4785A', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  resPriceText: { color: 'white', fontWeight: '800', fontSize: 14 },
  resBuyPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  resBuyPillText: { color: 'white', fontWeight: '700', fontSize: 13 },
  resDownloadPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12,
    backgroundColor: 'rgba(107,158,122,0.4)',
    borderWidth: 1, borderColor: 'rgba(107,158,122,0.6)',
  },
  resDownloadPillText: { color: 'white', fontWeight: '700', fontSize: 13 },
  resPostPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12,
    backgroundColor: 'rgba(254,60,114,0.45)',
    borderWidth: 1, borderColor: 'rgba(254,60,114,0.7)',
  },
  resPostPillText: { color: 'white', fontWeight: '700', fontSize: 13 },
  resCardHint: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 2 },

  beforeAfterBadge: {
    position: 'absolute', top: 16, left: 16, zIndex: 10,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  beforeAfterBadgeText: { color: 'white', fontWeight: '800', fontSize: 10, letterSpacing: 1 },

  resultControlsWrap: {
    paddingHorizontal: 24, paddingBottom: 32, paddingTop: 8, gap: 16,
  },
  beforeAfterRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  beforeAfterToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F5EDE4', borderWidth: 1.5, borderColor: '#EDE0D4',
    minWidth: 90, justifyContent: 'center',
  },
  beforeAfterToggleActive: {
    backgroundColor: '#FFF8F4', borderColor: '#C4785A',
  },
  beforeAfterToggleText: { fontSize: 13, fontWeight: '800', color: '#7A6055' },
  beforeAfterToggleTextActive: { color: '#C4785A' },
  tinderActionRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28,
  },
  tinderNopeBtn: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: 'white', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(224,92,62,0.35)',
    shadowColor: '#E05C3E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  tinderHeartBtn: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: 'white', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(107,158,122,0.35)',
    shadowColor: '#6B9E7A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  tinderHintText: { fontSize: 11, fontWeight: '700', color: '#B8A49A' },
  swipeDotRow: { alignItems: 'center', gap: 6 },
  swipeDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#D4C4BA',
  },
  swipeDotActive: { backgroundColor: '#C4785A', width: 18 },
  resDeckHintText: { fontSize: 11, fontWeight: '700', color: '#B8A49A', marginTop: 2 },

  // All caught up finished view
  resultAllDone: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  resultAllDoneEmoji: { fontSize: 48, marginBottom: 8 },
  resultAllDoneTitle: { fontSize: 24, fontWeight: '900', color: '#2A1F1A' },
  resultAllDoneSub: { fontSize: 14, color: '#7A6055', textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  resultAllDoneBtn: {
    backgroundColor: '#C4785A', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24,
    shadowColor: '#C4785A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16,
  },
  resultAllDoneBtnText: { color: 'white', fontWeight: '800', fontSize: 15 },

  // ── Workshop UI styles
  workshopScroll: { flex: 1 },
  workshopContent: { padding: 20, gap: 20, paddingBottom: 40 },

  workshopBodyRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  workshopBodyThumb: {
    width: 88, height: 120, borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#EDE0D4', position: 'relative',
  },
  workshopBodyImg: { width: '100%', height: '100%' },
  workshopBodyLabel: {
    position: 'absolute', bottom: 6, left: 0, right: 0, alignItems: 'center',
  },
  workshopBodyLabelText: { color: 'white', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  workshopBodyInfo: { flex: 1, gap: 6 },
  workshopBodyTitle: { fontSize: 22, fontWeight: '900', color: '#2A1F1A' },
  workshopBodySub: { fontSize: 13, color: '#7A6055', lineHeight: 19 },
  workshopStyleCount: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 4 },
  workshopStyleCountNum: { fontSize: 30, fontWeight: '900', color: '#C4785A' },
  workshopStyleCountLabel: { fontSize: 11, fontWeight: '700', color: '#B8A49A' },

  workshopDropzone: {
    height: 230, borderRadius: 28, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#EDE0D4', backgroundColor: '#FDF7F4',
    shadowColor: '#2A1F1A', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, shadowRadius: 20, elevation: 4,
  },
  workshopDropzoneEmpty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, overflow: 'hidden',
  },
  workshopDropzoneIcon: { fontSize: 44, marginBottom: 4 },
  workshopDropzoneTitle: { fontSize: 18, fontWeight: '900', color: '#2A1F1A' },
  workshopDropzoneSub: { fontSize: 13, color: '#7A6055', textAlign: 'center', lineHeight: 20 },
  workshopDropzoneHint: {
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#C4785A', borderRadius: 14,
  },
  workshopDropzoneHintText: { color: 'white', fontWeight: '800', fontSize: 13 },
  workshopDropzoneLoaded: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  workshopDropzoneLoadedText: { color: 'white', fontWeight: '900', fontSize: 15 },
  workshopRemoveBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  workshopRemoveBtnText: { color: 'white', fontWeight: '700', fontSize: 12 },


  workshopGenBtn: { height: 60, borderRadius: 20, overflow: 'hidden' },
  workshopGenBtnDisabled: { opacity: 0.55 },
  workshopGenBtnGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  workshopGenBtnText: { color: 'white', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },

  // ── Quick Start & Style History sections
  sectionWrap: { gap: 12 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeaderTitle: { fontSize: 17, fontWeight: '900', color: '#2A1F1A' },
  sectionHeaderSub: { fontSize: 12, color: '#B8A49A', fontWeight: '600', marginTop: 2 },
  sampleScroll: { gap: 12, paddingVertical: 4 },
  sampleCard: {
    width: 130, height: 170, borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDE0D4',
    shadowColor: '#2A1F1A', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  sampleImg: { width: '100%', height: '100%', position: 'absolute' },
  sampleInfo: { position: 'absolute', bottom: 10, left: 10, right: 10 },
  sampleBrand: { fontSize: 8, fontWeight: '800', color: '#EEC4AA', letterSpacing: 1.5, marginBottom: 2 },
  sampleTitle: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', lineHeight: 15 },
});