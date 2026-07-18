import React, { useState, useEffect, useRef } from 'react';
import SwipeDeck from '../components/SwipeDeck';
import MatchAnimation from '../components/MatchAnimation';
import { getCatalogByGender } from '../constants/catalog';
import { firebaseAuth, firestore, firebaseFunctions, storage } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { runVirtualTryOn } from '../lib/ai_engine';
import { httpsCallable } from 'firebase/functions';
import { collection, addDoc, serverTimestamp, doc, onSnapshot, updateDoc, increment, setDoc, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { sendWebNotification, requestNotificationPermission } from '../lib/notifications';
import theme from '../theme';
import { Shirt, Bell, Clock, Zap, Sparkles, Loader, Smartphone, X, ExternalLink } from 'lucide-react';
import { shareTryOnWhatsApp } from '../lib/socialActions';
import { incrementProfileStats } from '../lib/community';

const APP_DOWNLOAD_URL = 'https://expo.dev/accounts/ascendras-organization/projects/tryme/builds/c67c614b-a2f8-4a17-aad9-71acb0169425';
const QR_API_URL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=000000&bgcolor=FFFFFF&data=${encodeURIComponent(APP_DOWNLOAD_URL)}`;

// ────────────────────────────────────────────────────────────────────
// Module-level session cache — survives component unmount/remount (tab switching)
// This is the key fix: React useRefs reset on remount, but module vars don't
// ────────────────────────────────────────────────────────────────────
const _session = {
  batchId: null,       // last loaded batch ID
  picks: null,         // last loaded picks array with generated images
  currentIndex: 0,     // card the user was viewing
  isProcessing: false, // whether generation is currently running
  inFlight: new Set(), // which card indices are in-flight
};

export default function Discover({ profile, onOpenTrialRoom, onOpenCustomTryOn }) {
  const user = firebaseAuth?.currentUser;

  // Restore from session cache immediately (prevents blank state on nav back)
  const [picks, setPicks] = useState(() => _session.picks || []);
  const [currentIndex, setCurrentIndex] = useState(() => _session.currentIndex || 0);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [nextBatchAt, setNextBatchAt] = useState(null);
  const [countdownSecs, setCountdownSecs] = useState(300);
  const [generating, setGenerating] = useState(false);
  // If session has picks already, skip loading screen immediately
  const [initialLoading, setInitialLoading] = useState(!_session.picks || _session.picks.length === 0);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedItem, setMatchedItem] = useState(null);
  const [postingId, setPostingId] = useState(null);
  const [showAppDownload, setShowAppDownload] = useState(false);
  const [recentTryOnUrl, setRecentTryOnUrl] = useState(null);
  const [cachedUserB64, setCachedUserB64] = useState(null);

  const countdownRef = useRef(null);
  // Point refs at the module-level session vars so they survive remounts
  const isProcessingRef = useRef(false);
  const currentBatchIdRef = useRef(_session.batchId); // restore from session!
  const inFlightRef = useRef(_session.inFlight);      // restore from session!

  // Keep session cache in sync whenever picks or currentIndex change
  useEffect(() => { _session.picks = picks; }, [picks]);
  useEffect(() => { _session.currentIndex = currentIndex; }, [currentIndex]);

  useEffect(() => {
    requestNotificationPermission().then(granted => setNotifEnabled(granted));
  }, []);

  // Automatic calendar-day reset of the daily try-on limit
  useEffect(() => {
    if (!user || !firestore || !profile) return;
    const lastReset = profile.tryOnLastResetTime || 0;
    const isNewDay = new Date(lastReset).toDateString() !== new Date().toDateString();
    if (isNewDay) {
      console.log('[Discover] New calendar day detected. Resetting profile daily limit...');
      const profileRef = doc(firestore, 'profiles', user.uid);
      updateDoc(profileRef, {
        tryOnCountToday: 0,
        tryOnLastResetTime: Date.now(),
        tryOnBlockedUntil: null
      }).catch(err => console.warn('[Discover] Reset daily limit failed:', err.message));
    }
  }, [profile, user]);

  // Fetch user's most recent try-on result from profile database
  useEffect(() => {
    if (!user || !firestore) return;
    const q = query(
      collection(firestore, 'tryon_results'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        const docData = snap.docs[0].data();
        setRecentTryOnUrl(docData.resultImageUrl || docData.tryOnImageUrl);
      }
    });
    return () => unsub();
  }, [user]);

  // Prevent body scrolling for the Swipe Deck page to lock it to viewport height
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  // Pre-fetch user photo base64 at 448x600 for faster generation
  useEffect(() => {
    if (!profile?.basePhotoUrl) return;
    const fetchUserB64 = async () => {
      try {
        const { getCleanBase64 } = await import('../lib/ai_engine');
        // 512x640 is the standard VTON resolution for maximum generation accuracy
        const b64 = await getCleanBase64(profile.basePhotoUrl, 512, 640, 'cover', 0.80);
        if (b64) setCachedUserB64(`data:image/jpeg;base64,${b64}`);
      } catch (e) {
        console.warn('[AI] User photo pre-fetch failed:', e.message);
      }
    };
    fetchUserB64();
  }, [profile?.basePhotoUrl]);

  // Automatically replace a failed card with a new random garment from the catalog
  const replaceFailedCard = async (idx, failedItem) => {
    try {
      console.log(`[Discover] Replacing failed card ${idx}: "${failedItem.title}"`);
      const catalog = getCatalogByGender(profile?.gender);

      // Find catalog items not currently in the picks deck to prevent duplicates
      const currentIds = new Set(picks.map(p => p.id));
      const available = catalog.filter(item => !currentIds.has(item.id));

      const docRef = doc(firestore, 'daily_picks', user.uid);
      if (available.length === 0) {
        console.warn('[Discover] No more available catalog items to replace failed card.');
        // Fallback: just remove it from the deck
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          const dbPicks = Array.isArray(data.picks) ? data.picks.filter((_, i) => i !== idx) : [];
          await updateDoc(docRef, { picks: dbPicks });
        }
        return;
      }

      // Pick a random catalog item
      const newItem = available[Math.floor(Math.random() * available.length)];
      console.log(`[Discover] Selected replacement item: "${newItem.title}"`);

      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const dbPicks = Array.isArray(data.picks) ? [...data.picks] : [];
        if (dbPicks[idx]) {
          dbPicks[idx] = {
            id: newItem.id,
            tryOnImageUrl: null
          };
          await updateDoc(docRef, { picks: dbPicks });
          console.log(`[Discover] Successfully updated Firestore with replacement card at index ${idx}`);
        }
      }
    } catch (err) {
      console.error('[Discover] Failed to replace failed card:', err.message);
    }
  };

  // Generates try-on on-demand for a single card index
  const generateTryOnForCard = async (idx, currentPicks = picks) => {
    if (idx >= currentPicks.length) return;
    const item = currentPicks[idx];
    if (!item) return;

    // Only skip if already done (success or failed)
    if (item.generationStatus === 'success' || item.generationStatus === 'failed') return;
    // Prevent concurrent duplicate calls for the same card
    if (inFlightRef.current.has(idx)) return;
    inFlightRef.current.add(idx);

    // Mark as pending (show spinner) only at the moment we actually start generating
    setPicks(prev => prev.map((pick, i) =>
      i === idx ? { ...pick, generationStatus: 'pending' } : pick
    ));

    try {
      const url = await runVirtualTryOn(
        cachedUserB64 || profile?.basePhotoUrl,
        item.imageUrl,
        item.title,
        null,
        false,
        item.category || 'upper_body',
        profile?.gender || 'female'
      );
      if (!url) {
        console.warn(`[Discover] Card ${idx} generation failed (null response). Leaving as retriable.`);
        setPicks(prev => prev.map((pick, i) =>
          i === idx ? { ...pick, tryOnImageUrl: null, generationStatus: 'queued' } : pick
        ));
        inFlightRef.current.delete(idx);
        setInitialLoading(false);
        return;
      }

      const isReal = url !== item.imageUrl;
      inFlightRef.current.delete(idx);

      if (!isReal) {
        console.warn(`[Discover] Card ${idx} try-on is not real. Marking as failed (no replacement).`);
        setPicks(prev => prev.map((pick, i) =>
          i === idx ? { ...pick, tryOnImageUrl: 'failed', generationStatus: 'failed' } : pick
        ));
        setInitialLoading(false);
        // Save the failure state persistently in Firestore to avoid infinite generation loops on reload
        if (user && firestore) {
          (async () => {
            try {
              const docRef = doc(firestore, 'daily_picks', user.uid);
              const snap = await getDoc(docRef);
              if (snap.exists()) {
                const data = snap.data();
                const dbPicks = Array.isArray(data.picks) ? [...data.picks] : [];
                if (dbPicks[idx]) {
                  dbPicks[idx] = { ...dbPicks[idx], tryOnImageUrl: 'failed' };
                  await updateDoc(docRef, { picks: dbPicks });
                  console.log(`[Discover] ✅ Persisted Card ${idx} failure state in Firestore.`);
                }
              }
            } catch (dbErr) {
              console.warn('[Discover] Failed to persist failure state in Firestore:', dbErr.message);
            }
          })();
        }
        return;
      }

      // 1. Show image immediately in UI (data URI for instant display)
      setPicks(prev => prev.map((pick, i) =>
        i === idx ? {
          ...pick,
          tryOnImageUrl: url,
          generationStatus: 'success'
        } : pick
      ));
      setInitialLoading(false);

      // 2. Upload data URI to Firebase Storage in background, then save the
      //    short Storage URL to Firestore daily_picks (avoids 1MB doc limit)
      if (user && firestore && storage && url?.startsWith('data:')) {
        (async () => {
          try {
            const fileName = `${user.uid}_card${idx}_${Date.now()}.jpg`;
            const sRef = ref(storage, `daily_picks/${fileName}`);
            const cleanB64 = url.split('base64,')[1] || url;
            await uploadString(sRef, cleanB64, 'base64', { contentType: 'image/jpeg' });
            const storageUrl = await getDownloadURL(sRef);
            console.log(`[Discover] ✅ Card ${idx} uploaded to Storage:`, storageUrl);

            // Preload the storage URL in the background to prevent any flicker during state transition
            const preloadImg = new Image();
            preloadImg.src = storageUrl;

            // Update picks state to use Storage URL (more stable than data URI)
            setPicks(prev => prev.map((pick, i) =>
              i === idx ? { ...pick, tryOnImageUrl: storageUrl } : pick
            ));

            // Save short Storage URL to Firestore daily_picks (safe, < 500 bytes per card)
            const docRef = doc(firestore, 'daily_picks', user.uid);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              const data = snap.data();
              const dbPicks = Array.isArray(data.picks) ? [...data.picks] : [];
              if (dbPicks[idx]) {
                dbPicks[idx] = { ...dbPicks[idx], tryOnImageUrl: storageUrl };
                await updateDoc(docRef, { picks: dbPicks });
                console.log(`[Discover] ✅ Card ${idx} Storage URL saved to Firestore`);
              }
            }

            // Auto-update wishlist item if already swiped right
            const qWish = query(
              collection(firestore, 'wishlist'),
              where('userId', '==', user.uid),
              where('title', '==', item.title)
            );
            const snapWish = await getDocs(qWish);
            if (!snapWish.empty) {
              const docRefWish = doc(firestore, 'wishlist', snapWish.docs[0].id);
              await updateDoc(docRefWish, { tryOnImageUrl: storageUrl }).catch(() => { });
              console.log(`[Discover] ✅ Updated tryOnImageUrl in wishlist doc for "${item.title}"`);
            }
          } catch (uploadErr) {
            console.warn(`[Discover] Card ${idx} Storage upload failed:`, uploadErr.message);
          }
        })();
      } else if (user && firestore && url && !url.startsWith('data:')) {
        // URL is already a Storage/HTTP URL — save it directly  
        (async () => {
          try {
            const docRef = doc(firestore, 'daily_picks', user.uid);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              const data = snap.data();
              const dbPicks = Array.isArray(data.picks) ? [...data.picks] : [];
              if (dbPicks[idx]) {
                dbPicks[idx] = { ...dbPicks[idx], tryOnImageUrl: url };
                await updateDoc(docRef, { picks: dbPicks });
              }
            }

            // Auto-update wishlist item if already swiped right
            const qWish = query(
              collection(firestore, 'wishlist'),
              where('userId', '==', user.uid),
              where('title', '==', item.title)
            );
            const snapWish = await getDocs(qWish);
            if (!snapWish.empty) {
              const docRefWish = doc(firestore, 'wishlist', snapWish.docs[0].id);
              await updateDoc(docRefWish, { tryOnImageUrl: url }).catch(() => { });
              console.log(`[Discover] ✅ Updated tryOnImageUrl in wishlist doc for "${item.title}"`);
            }
          } catch (err) {
            console.warn('[Discover] Failed to save Storage URL to Firestore:', err.message);
          }
        })();
      }

    } catch (err) {
      console.warn(`[AI] Card ${idx} generation failed:`, err);
      inFlightRef.current.delete(idx);
      setPicks(prev => prev.map((pick, i) =>
        i === idx ? { ...pick, generationStatus: 'failed' } : pick
      ));
      setInitialLoading(false);
    }
  };

  // Generate ALL cards in parallel, but reveal the deck as soon as card 0 is ready
  const processAIClassifications = async (itemsList, batchId) => {
    if (!itemsList || itemsList.length === 0) return itemsList;
    if (isProcessingRef.current && currentBatchIdRef.current === batchId) return itemsList;



    // If ALL picks already have generated images (loaded from Firestore), skip generation
    const allAlreadyGenerated = itemsList.every(item =>
      item.tryOnImageUrl && (item.generationStatus === 'success' || item.generationStatus === 'failed')
    );

    if (allAlreadyGenerated) {
      console.log('[Discover] All picks already generated — skipping generation, showing cached images.');
      currentBatchIdRef.current = batchId;
      _session.batchId = batchId;  // sync to session
      setInitialLoading(false);
      return itemsList;
    }

    isProcessingRef.current = true;
    currentBatchIdRef.current = batchId;
    _session.batchId = batchId; // sync to session so remounts skip generation
    inFlightRef.current.clear();
    const hasAnyCompleted = itemsList.some(item =>
      item.generationStatus === 'success' || item.generationStatus === 'failed'
    );
    if (hasAnyCompleted) {
      setInitialLoading(false);
    }

    // Safety: if card 0 hasn't resolved within 35 seconds, show the deck anyway
    // (prevents infinite loading screen if the API stalls or times out)
    const safetyTimer = setTimeout(() => {
      console.warn('[Discover] Safety timer fired — forcing deck visible after 35s');
      setInitialLoading(false);
    }, 35000);

    // Generate ALL cards sequentially (one by one) to avoid rate limits
    const runGeneration = async () => {
      try {
        for (let i = 0; i < itemsList.length; i++) {
          const item = itemsList[i];
          if (item && (!item.tryOnImageUrl || (item.generationStatus !== 'success' && item.generationStatus !== 'failed'))) {
            console.log(`[Discover] Starting sequential generation for Card ${i}...`);
            try {
              await generateTryOnForCard(i, itemsList);
              clearTimeout(safetyTimer);
              setInitialLoading(false);  // Reveal deck immediately
              sendWebNotification('First outfit ready! ✨', 'Your first AI fit is ready to view.');
            } catch (e) {
              console.warn(`[Discover] Sequential generation failed for card ${i}:`, e.message);
              clearTimeout(safetyTimer);
              setInitialLoading(false);
            }
            
            // Add a cooldown between sequential generations to reset the Vertex AI rate limit
            if (i < itemsList.length - 1) {
              console.log('[Discover] Cooldown for 5 seconds to reset Vertex AI rate limit...');
              await new Promise(r => setTimeout(r, 5000));
            }
          }
        }
      } catch (outerErr) {
        console.error('[Discover] Sequential generation crashed:', outerErr);
      } finally {
        isProcessingRef.current = false;
        // In case the generation completed/failed, ensure we hide loading state if any card is ready
        const hasAnyCompleted = itemsList.some(item =>
          item.generationStatus === 'success' || item.generationStatus === 'failed'
        );
        if (hasAnyCompleted) {
          clearTimeout(safetyTimer);
          setInitialLoading(false);
        }
      }
    };
    runGeneration();

    return itemsList;
  };



  // Listen to Firestore daily_picks
  useEffect(() => {
    if (!user || !firestore || !profile) return;
    const unsub = onSnapshot(doc(firestore, 'daily_picks', user.uid), snap => {
      try {
        if (!snap.exists()) {
          loadGenderCatalog();
          return;
        }
        const data = snap.data();
        const currentPhoto = profile?.basePhotoUrl || null;
        const dbPhoto = data.generatedWithPhotoUrl || null;

        // Invalidate generated images if base photo changed
        if (currentPhoto && dbPhoto && dbPhoto !== currentPhoto) {
          console.log('[Discover] Base photo changed. Invalidating generated images to force regeneration.');
          // Wipe session cache
          _session.picks = null;
          _session.batchId = null;

          let rawPicks = [];
          if (Array.isArray(data.picks)) {
            rawPicks = data.picks;
          } else if (data.picks && typeof data.picks === 'object') {
            rawPicks = Object.keys(data.picks).sort((a, b) => Number(a) - Number(b)).map(k => data.picks[k]);
          }

          const clearedPicks = rawPicks.map(p => ({
            id: p.id,
            tryOnImageUrl: null
          }));

          updateDoc(doc(firestore, 'daily_picks', user.uid), {
            picks: clearedPicks,
            generatedWithPhotoUrl: currentPhoto
          }).catch(err => console.warn('[Discover] Failed to invalidate pics:', err));
          return;
        }

        // Initialize generatedWithPhotoUrl if missing
        if (currentPhoto && !dbPhoto) {
          updateDoc(doc(firestore, 'daily_picks', user.uid), {
            generatedWithPhotoUrl: currentPhoto
          }).catch(() => { });
        }

        let rawPicks = [];
        if (Array.isArray(data.picks)) {
          rawPicks = data.picks;
        } else if (data.picks && typeof data.picks === 'object') {
          rawPicks = Object.keys(data.picks).sort((a, b) => Number(a) - Number(b)).map(k => data.picks[k]);
        }

        const localCooldownKey = `cooldown_${user.uid}`;
        const localCooldown = localStorage.getItem(localCooldownKey);
        if (localCooldown) {
          const nextBatch = Number(localCooldown);
          if (Date.now() < nextBatch) {
            setNextBatchAt(nextBatch);
            setShowDoneModal(true);
            setInitialLoading(false); // Hide overlay so Done modal is visible!
            return;
          } else {
            localStorage.removeItem(localCooldownKey);
          }
        }

        if (rawPicks.length > 0) {
          // Check if the loaded picks match the user's current profile gender
          const gender = (profile?.gender || '').toLowerCase().trim();
          const mismatch = (
            ((gender === 'male' || gender === 'man' || gender === 'men') && !rawPicks[0]?.id?.startsWith('m')) ||
            ((gender === 'female' || gender === 'woman' || gender === 'women') && !rawPicks[0]?.id?.startsWith('wt'))
          );

          if (mismatch) {
            console.log('[Discover] Gender mismatch detected in Firestore picks. Regenerating...');
            loadGenderCatalog();
            return;
          }

          // Build a stable batch ID from the pick IDs so we can detect new batches vs. metadata-only updates
          const batchId = rawPicks.map(p => p.id).join(',');

          const localCatalog = getCatalogByGender(profile?.gender);
          const resolvedPicks = rawPicks.map((p, idx) => {
            const match = localCatalog.find(c => c.id === p.id);

            // Merge with session cache to avoid overwriting generated images on tab switches
            let cachedUrl = null;
            let cachedStatus = null;
            if (_session.batchId === batchId && _session.picks) {
              const cachedPick = _session.picks.find(cp => cp.id === p.id);
              if (cachedPick) {
                cachedUrl = cachedPick.tryOnImageUrl;
                cachedStatus = cachedPick.generationStatus;
              }
            }

            // Load the tryOnImageUrl from Firestore if present, otherwise fall back to session cache
            const tryOnImageUrl = p.tryOnImageUrl || cachedUrl || null;
            const pickData = match
              ? { ...p, imageUrl: match.imageUrl, tryOnImageUrl, brand: match.brand, title: match.title, priceINR: match.priceINR, buyLink: match.buyLink || '', category: match.category || 'upper_body', gender: match.gender }
              : { ...p, tryOnImageUrl };

            const hasImage = tryOnImageUrl && tryOnImageUrl !== 'failed';
            const generationStatus = hasImage
              ? 'success'
              : (tryOnImageUrl === 'failed'
                ? 'failed'
                : (inFlightRef.current.has(idx)
                  ? 'pending'
                  : (cachedStatus && cachedStatus !== 'success' ? cachedStatus : (idx === 0 ? 'pending' : 'queued'))));

            // Preload try-on and catalog images so they render instantly when swiping or discarding
            if (tryOnImageUrl) {
              const img = new Image();
              img.src = tryOnImageUrl;
            }
            if (match?.imageUrl) {
              const img = new Image();
              img.src = match.imageUrl;
            }

            return {
              ...pickData,
              generationStatus
            };
          });

          setPicks(resolvedPicks);
          // Only reset to card 0 if this is a genuinely new batch
          if (currentBatchIdRef.current !== batchId) {
            setCurrentIndex(0);
            _session.currentIndex = 0;
          }
          setInitialLoading(false); // Hide the loading screen immediately once data is resolved
          processAIClassifications(resolvedPicks, batchId);
        } else {
          loadGenderCatalog();
        }
      } catch (err) {
        console.error('[Discover] Error in snapshot listener:', err);
        setInitialLoading(false); // Robust fallback: guarantee loading overlay goes away
      }
    });
    return () => unsub?.();
  }, [user, profile?.gender, profile?.basePhotoUrl]);


  // Load gender catalog and process first item then background items
  // Load gender catalog by writing random picks to Firestore, triggering the snapshot listener
  const loadGenderCatalog = async () => {
    const catalog = getCatalogByGender(profile?.gender);
    const shuffled = [...catalog].sort(() => Math.random() - 0.5).slice(0, 3);

    const initialPicks = shuffled.map(item => ({
      id: item.id,
      tryOnImageUrl: null
    }));

    if (user) {
      localStorage.removeItem(`cooldown_${user.uid}`);
    }

    if (user && firestore) {
      await setDoc(doc(firestore, 'daily_picks', user.uid), {
        status: 'ready',
        picks: initialPicks,
        seenAt: null,
        nextBatchAt: null,
        generatedWithPhotoUrl: profile?.basePhotoUrl || null
      }).catch(err => console.warn('[Discover] loadGenderCatalog setDoc failed:', err));
    }
  };

  // Cooldown countdown timer
  useEffect(() => {
    if (!showDoneModal) return;
    const targetTime = nextBatchAt || (Date.now() + 5 * 60 * 1000);
    clearInterval(countdownRef.current);

    const tick = async () => {
      const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setCountdownSecs(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        setGenerating(true);
        await loadGenderCatalog();
        setGenerating(false);
        setShowDoneModal(false);
        sendWebNotification('New AI Outfits Ready! ✨', 'Your fresh batch of 3 customized outfits is ready to swipe.');
      }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current);
  }, [showDoneModal, nextBatchAt]);

  const handleNextCard = async (current = currentIndex) => {
    let nextIdx = current + 1;
    setCurrentIndex(nextIdx);

    // When all 3 are done, write seenAt and nextBatchAt to trigger the cooldown batch timer page
    if (nextIdx >= 3 || nextIdx >= picks.length) {
      const cooldownTime = Date.now() + 5 * 60 * 1000;
      if (user) {
        localStorage.setItem(`cooldown_${user.uid}`, cooldownTime.toString());
      }
      setNextBatchAt(cooldownTime);
      setShowDoneModal(true);
    }
  };

  const handleSwipeRight = async () => {
    const item = picks[currentIndex];
    if (item && user && firestore) {
      addDoc(collection(firestore, 'wishlist'), {
        userId: user.uid,
        title: item.title,
        brand: item.brand,
        price: item.priceINR || '999',
        productImageUrl: item.imageUrl,
        tryOnImageUrl: item.tryOnImageUrl || item.imageUrl,
        buyLink: item.buyLink || '',
        createdAt: serverTimestamp(),
      }).catch(() => { });
      updateDoc(doc(firestore, 'profiles', user.uid), { auraPoints: increment(10) }).catch(() => { });
      sendWebNotification('Saved to Wishlist! ❤️', `"${item.title}" added to your saved fits.`);
    }
    // Instantly slide to next card for non-blocking swiping UX
    handleNextCard();
  };


  const handleCloseMatch = () => {
    setShowMatch(false);
    setMatchedItem(null);
    handleNextCard();
  };

  const handleTryOnMatch = () => {
    if (matchedItem) {
      onOpenTrialRoom?.(matchedItem);
    }
    setShowMatch(false);
    setMatchedItem(null);
    handleNextCard();
  };

  const handleSwipeLeft = () => {
    handleNextCard();
  };

  // Post try-on image to community feed AND save to tryon_results for profile
  const handlePost = async (item) => {
    if (!item || !user || !firestore) return;
    let imageUrl = item.tryOnImageUrl || item.imageUrl;
    if (!imageUrl) { alert('No try-on image ready to post yet!'); return; }

    setPostingId(item.id);
    try {
      // If the image is still a base64 data URI, upload it to Storage first
      // (Firestore has a 1MB per-document limit, base64 images exceed that)
      if (imageUrl.startsWith('data:')) {
        console.log('[Post] Uploading base64 try-on to Storage before posting…');
        const fileName = `${user.uid}_post_${Date.now()}.jpg`;
        const storageRef = ref(storage, `community-posts/${fileName}`);
        const cleanB64 = imageUrl.split('base64,')[1] || imageUrl;
        await uploadString(storageRef, cleanB64, 'base64', { contentType: 'image/jpeg' });
        imageUrl = await getDownloadURL(storageRef);
        console.log('[Post] ✅ Uploaded to Storage:', imageUrl);

        // Update the local picks state with the Storage URL so future posts don't re-upload
        setPicks(prev => prev.map(p =>
          p.id === item.id ? { ...p, tryOnImageUrl: imageUrl } : p
        ));
      }

      // 1. Save to community_posts
      await addDoc(collection(firestore, 'community_posts'), {
        userId: user.uid,
        userName: profile?.name || user.displayName || '@fashionista',
        userPhotoUrl: profile?.basePhotoUrl || user.photoURL || null,
        rank: profile?.rank || 'Style Rookie',
        brand: item.brand || 'oraneo Brand',
        garmentDesc: item.title || 'Outfit',
        resultImageUrl: imageUrl,
        garmentImageUrl: item.imageUrl,
        caption: `Just tried on "${item.title}" via oraneo! 🔥`,
        buyLink: item.buyLink || '',
        likes: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });

      // 2. Save to tryon_results so it shows on Profile > Try-Ons tab
      await addDoc(collection(firestore, 'tryon_results'), {
        userId: user.uid,
        brand: item.brand || 'oraneo Brand',
        garmentDesc: item.title || 'Outfit',
        resultImageUrl: imageUrl,
        tryOnImageUrl: imageUrl,
        garmentImageUrl: item.imageUrl,
        title: item.title,
        createdAt: serverTimestamp(),
      });

      // 3. Increment profile stats (postCount + tryOnCount) and aura
      await incrementProfileStats(user.uid, { posts: 1, tryOns: 1 });
      await updateDoc(doc(firestore, 'profiles', user.uid), {
        auraPoints: increment(20),
      }).catch(() => { });

      sendWebNotification('Posted to Community! 🎉', `"${item.title}" is now live in the community feed.`);
      alert(`✅ Posted "${item.title}" to Community! +20 Aura Points earned.`);
    } catch (err) {
      console.error('[Discover] handlePost failed:', err);
      alert('Failed to post: ' + err.message);
    } finally {
      setPostingId(null);
    }
  };

  const handleSuperLike = async () => {
    const item = picks[currentIndex];
    if (item && user && firestore) {
      addDoc(collection(firestore, 'wishlist'), {
        userId: user.uid,
        title: item.title,
        brand: item.brand,
        price: item.priceINR || '999',
        productImageUrl: item.imageUrl,
        tryOnImageUrl: item.tryOnImageUrl || item.imageUrl,
        buyLink: item.buyLink || '',
        superLiked: true,
        createdAt: serverTimestamp(),
      }).catch(() => { });
      updateDoc(doc(firestore, 'profiles', user.uid), { auraPoints: increment(50) }).catch(() => { });
      alert(`⭐ Super Liked! "${item.title}" saved! (+50 Aura Points)`);
    }
    handleNextCard();
  };

  const handleBoost = async () => {
    setGenerating(true);
    try {
      if (user && firestore) {
        const profileRef = doc(firestore, 'profiles', user.uid);
        await updateDoc(profileRef, {
          tryOnCountToday: 0,
          tryOnBlockedUntil: null
        }).catch(() => { });
      }
      await loadGenderCatalog();
    } catch (err) {
      console.warn('Boost error:', err.message);
    } finally {
      setGenerating(false);
      setShowDoneModal(false);
      sendWebNotification('⚡ Deck Boosted!', 'Fresh custom outfits generated for you.');
    }
  };

  // Track app download link click in Firestore
  const handleAppDownloadClick = async () => {
    window.open(APP_DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
    if (firestore) {
      try {
        const ref = doc(firestore, 'analytics', 'app_downloads');
        await setDoc(ref, { clicks: increment(1), lastClickAt: serverTimestamp() }, { merge: true });
      } catch (e) {
        console.warn('[Analytics] Failed to track download click:', e.message);
      }
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSignOut = async () => {
    try {
      await signOut(firebaseAuth);
    } catch (err) {
      console.error('[Discover] Signout failed:', err);
    }
  };

  const userPhotoUrl = profile?.basePhotoUrl || user?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80';

  const isLimitBlocked = profile?.tryOnBlockedUntil && Date.now() < profile.tryOnBlockedUntil;

  if (isLimitBlocked) {
    return (
      <div style={{
        background: '#000000',
        minHeight: '100vh',
        padding: '24px 16px',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Decorative elements */}
        <div style={{
          position: 'absolute', top: '10%', left: '-10%', width: '280px', height: '280px',
          borderRadius: '50%', background: 'rgba(196,120,90,0.08)',
          filter: 'blur(40px)', animation: 'float 6s ease-in-out infinite'
        }} />

        <div style={{
          background: 'rgba(196,120,90,0.06)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '32px', padding: '40px 24px',
          border: '1px solid rgba(196,120,90,0.15)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          maxWidth: '360px', width: '90%', position: 'relative', zIndex: 2
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)', border: '2px solid #EF4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.2)'
          }}>
            <Shirt size={32} color="#EF4444" />
          </div>

          <h2 style={{
            fontFamily: 'Outfit, sans-serif', fontSize: '24px', fontWeight: '900',
            color: 'white', marginBottom: '12px', letterSpacing: '-0.3px'
          }}>
            Limit Reached!
          </h2>

          <p style={{
            color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: 1.5,
            marginBottom: '32px', maxWidth: '280px', margin: '0 auto 32px'
          }}>
            An account can only try on 100 looks per single day. Please come back tomorrow or sign out to use another ID!
          </p>

          <button
            className="btn-primary"
            onClick={handleSignOut}
            style={{
              width: '100%', padding: '14px', borderRadius: '18px', fontSize: '15px',
              background: 'linear-gradient(90deg, #E63946, #D62828)',
              border: 'none', color: 'white', fontWeight: '800', cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(230, 57, 70, 0.3)'
            }}
          >
            Sign Out / Switch ID
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#000000',
      height: '100vh',
      width: '100%',
      maxWidth: '480px',
      margin: '0 auto',
      overflow: 'hidden',
      padding: '12px 16px 85px',
      color: 'white',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box'
    }}>


      {/* ════════════════════════════════════════════════════
          FULL-SCREEN "Styling your looks…" LOADING OVERLAY
          Matches the mobile app's immersive dark glassmorphic design
         ════════════════════════════════════════════════════ */}
      {initialLoading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
          background: '#0A0A0C',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeInUp 0.4s ease-out'
        }}>
          {/* Decorative floating circles (matching mobile app) */}
          <div style={{
            position: 'absolute', top: '8%', left: '-10%', width: '280px', height: '280px',
            borderRadius: '50%', background: 'rgba(196,120,90,0.08)',
            filter: 'blur(1px)', animation: 'float 6s ease-in-out infinite'
          }} />
          <div style={{
            position: 'absolute', bottom: '15%', right: '-5%', width: '220px', height: '220px',
            borderRadius: '50%', background: 'rgba(196,120,90,0.06)',
            filter: 'blur(1px)', animation: 'float 8s ease-in-out infinite 1s'
          }} />

          {/* Central glass card */}
          <div style={{
            background: 'rgba(196,120,90,0.08)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '32px', padding: '40px 32px', textAlign: 'center',
            border: '1px solid rgba(196,120,90,0.15)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            maxWidth: '340px', width: '85%', position: 'relative', zIndex: 2
          }}>
            {/* User photo with spinner ring */}
            <div style={{
              width: '110px', height: '140px', borderRadius: '20px',
              overflow: 'hidden', margin: '0 auto 8px',
              border: '3px solid rgba(196,120,90,0.5)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              position: 'relative'
            }}>
              <img
                src={userPhotoUrl}
                alt="You"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* Spinning loader icon overlapping bottom-right of photo */}
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(18,18,20,0.9)', border: `2px solid ${theme.colors.primary}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', margin: '-22px auto 16px', marginLeft: 'calc(50% + 18px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
              <Loader size={16} color={theme.colors.primary} style={{ animation: 'spin 1.2s linear infinite' }} />
            </div>

            {/* "Styling your looks..." title */}
            <h2 style={{
              fontFamily: 'Outfit, sans-serif', fontSize: '22px', fontWeight: '900',
              color: 'white', marginBottom: '14px', letterSpacing: '-0.3px'
            }}>
              Styling your looks...
            </h2>

            {/* Subtitle */}
            <p style={{
              color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: 1.5,
              marginBottom: '24px', maxWidth: '260px', margin: '0 auto 24px'
            }}>
              All 3 outfits are being styled for you.<br />
              First look arrives in ~15 seconds.
            </p>

            {/* Bouncing dots */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: theme.colors.primary, opacity: 0.7,
                animation: 'bounceDot1 1.4s ease-in-out infinite'
              }} />
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: theme.colors.primary, opacity: 0.7,
                animation: 'bounceDot2 1.4s ease-in-out infinite 0.2s'
              }} />
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: theme.colors.primary, opacity: 0.7,
                animation: 'bounceDot3 1.4s ease-in-out infinite 0.4s'
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Top Header Row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px'
      }}>
        {/* User Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${theme.colors.primary}`
        }}>
          <img src={userPhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        {/* Brand Title */}
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px' }}>
          oraneo
        </h1>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={async () => {
              const granted = await requestNotificationPermission();
              setNotifEnabled(granted);
              if (granted) sendWebNotification('Notifications Active ✨', 'Push alerts enabled for outfit drops.');
            }}
            style={{
              background: notifEnabled ? 'rgba(196,120,90,0.2)' : 'rgba(255,255,255,0.12)',
              border: `1px solid ${notifEnabled ? theme.colors.primary : 'rgba(255,255,255,0.2)'}`,
              color: 'white', padding: '6px 10px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer'
            }}
          >
            <Bell size={14} color={notifEnabled ? theme.colors.primary : 'white'} />
          </button>

          <button
            onClick={onOpenCustomTryOn}
            style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              color: 'white', padding: '6px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: '700',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer'
            }}
          >
            <Shirt size={14} color={theme.colors.primaryLight} /> Custom Studio
          </button>
        </div>
      </div>

      {/* Main Swipe Deck — always visible; brief generating banner shows on top */}
      {generating && (
        <div style={{
          textAlign: 'center', padding: '12px', marginBottom: '8px',
          background: 'rgba(196,120,90,0.12)', borderRadius: '16px',
          border: '1px solid rgba(196,120,90,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
        }}>
          <Sparkles size={16} color={theme.colors.primary} style={{ animation: 'spin 1.5s linear infinite' }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: theme.colors.primaryLight }}>
            Preparing 3 fresh AI fits…
          </span>
        </div>
      )}

      {picks.length > 0 && currentIndex < picks.length ? (
        <SwipeDeck
          items={picks}
          currentIndex={currentIndex}
          userPhotoUrl={userPhotoUrl}
          postingId={postingId}
          onTryOn={(item) => onOpenTrialRoom?.(item)}
          onSwipeRight={handleSwipeRight}
          onSwipeLeft={handleSwipeLeft}
          onSuperLike={handleSuperLike}
          onRewind={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          onBoost={handleBoost}
          onSave={handleSwipeRight}
          onShare={(item) => shareTryOnWhatsApp({ imageUrl: item.tryOnImageUrl || item.imageUrl, title: item.title, brand: item.brand })}
          onPost={handlePost}
        />
      ) : (
        <div style={{
          flex: 1, minHeight: 0, maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', textAlign: 'center', padding: '24px', background: '#121212',
          borderRadius: '28px', color: 'white', border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(196,120,90,0.15)', border: `2px solid ${theme.colors.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            {generating ? <Sparkles size={32} color={theme.colors.primary} style={{ animation: 'spin 1.5s linear infinite' }} /> : <Clock size={32} color={theme.colors.primary} />}
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '900', fontFamily: 'Outfit, sans-serif' }}>
            {generating ? 'Generating 3 AI Fits…' : 'Generating Next 3 Looks…'}
          </h2>
          <p style={{ color: '#AAA', marginTop: '8px', marginBottom: '20px', fontSize: '14px', maxWidth: '280px', lineHeight: 1.4 }}>
            {generating ? 'Preparing custom outfits on your model.' : "You've swiped all 3 outfits! Your AI engine is preparing the next custom batch in the background."}
          </p>

          <div style={{
            fontSize: '36px', fontWeight: '900', letterSpacing: '2px', color: theme.colors.primary,
            background: 'rgba(255,255,255,0.06)', padding: '12px 28px', borderRadius: '20px', marginBottom: '20px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {formatTimer(countdownSecs)}
          </div>

          {/* Download App button */}
          <button
            onClick={() => setShowAppDownload(true)}
            style={{
              width: '100%', padding: '11px 16px', borderRadius: '14px', fontSize: '13px', fontWeight: '800',
              background: 'rgba(196,120,90,0.15)', border: `1px solid ${theme.colors.primary}`,
              color: theme.colors.primary, cursor: 'pointer', marginBottom: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <Smartphone size={16} /> 📱 Download the App
          </button>

          <button
            className="btn-primary"
            onClick={handleBoost}
            disabled={generating}
            style={{ width: '100%', padding: '14px', borderRadius: '18px', fontSize: '15px' }}
          >
            <Zap size={18} fill="white" /> {generating ? 'Generating Fresh Looks…' : '⚡ Instant Boost Deck'}
          </button>

          {/* App Download Modal (QR + Link) */}
          {showAppDownload && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 99999,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
            }} onClick={() => setShowAppDownload(false)}>
              <div style={{
                background: '#1A1A1A', borderRadius: '28px', padding: '32px 28px',
                border: '1px solid rgba(196,120,90,0.3)', maxWidth: '320px', width: '100%',
                textAlign: 'center', position: 'relative',
                boxShadow: '0 32px 80px rgba(0,0,0,0.8)'
              }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setShowAppDownload(false)}
                  style={{
                    position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)',
                    border: 'none', color: 'white', borderRadius: '50%', width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                  }}
                ><X size={16} /></button>

                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📱</div>
                <h3 style={{ fontSize: '20px', fontWeight: '900', color: 'white', marginBottom: '4px', fontFamily: 'Outfit, sans-serif' }}>
                  Download oraneo
                </h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>
                  Scan QR or tap the button to get the app
                </p>

                {/* QR Code */}
                <div style={{
                  background: 'white', borderRadius: '16px', padding: '12px', marginBottom: '20px',
                  display: 'inline-block'
                }}>
                  <img
                    src={QR_API_URL}
                    alt="App Download QR Code"
                    width={180} height={180}
                    style={{ display: 'block', borderRadius: '8px' }}
                  />
                </div>

                <button
                  onClick={handleAppDownloadClick}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '16px', fontSize: '14px', fontWeight: '800',
                    background: `linear-gradient(135deg, ${theme.colors.primary}, #D4815A)`,
                    border: 'none', color: 'white', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    boxShadow: `0 8px 24px rgba(196,120,90,0.4)`
                  }}
                >
                  <ExternalLink size={16} /> Open Download Link
                </button>

                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '12px' }}>
                  Powered by Expo • Android & iOS
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {showMatch && matchedItem && (
        <MatchAnimation
          visible={showMatch}
          garment={matchedItem}
          userPhotoUrl={userPhotoUrl}
          onTryOn={handleTryOnMatch}
          onClose={handleCloseMatch}
        />
      )}
    </div>
  );
}
