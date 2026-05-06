import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  Image, ActivityIndicator, Platform, Alert, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Animated, { FadeIn, FadeInDown, Layout, SlideInRight } from 'react-native-reanimated';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

import { firebaseAuth, firestore } from '@/lib/firebase';
import { extractGarmentFromUrl, runVirtualTryOn } from '@/lib/ai_engine';
import Icon from '@/assets/icons';
import { theme } from '@/constants/theme';
import { StatusBar } from 'expo-status-bar';

const STAGES = { IDLE: 'idle', EXTRACTING: 'extracting', TRYON: 'tryon', DONE: 'done', ERROR: 'error' };

export default function AIStudio() {
  const [user, setUser] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [userPhotoBase64, setUserPhotoBase64] = useState(null);
  const [storeLink, setStoreLink] = useState('');
  
  const [stage, setStage] = useState(STAGES.IDLE);
  const [statusMsg, setStatusMsg] = useState('');
  
  const [garmentData, setGarmentData] = useState(null); 
  const [result, setResult] = useState(null);

  // WebView Scraper State
  const [webViewUrl, setWebViewUrl] = useState(null);
  const extractTimeoutRef = useRef(null);

  useEffect(() => {
    if (!firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, u => setUser(u));
    return () => unsub();
  }, []);

  // Cleanup timeout
  useEffect(() => {
    return () => clearTimeout(extractTimeoutRef.current);
  }, []);

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to use this feature.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.6,
    });
    if (!res.canceled) {
      const uri = res.assets[0].uri;
      setUserPhoto(uri);
      try {
        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setUserPhotoBase64(`data:image/jpeg;base64,${b64}`);
      } catch (e) {
        console.warn('Could not read photo as Base64:', e);
      }
    }
  };

  const fetchProduct = async () => {
    const link = storeLink.trim();
    if (!link) {
      Alert.alert('No Link', 'Please paste a store link or image URL first.');
      return;
    }

    setStage(STAGES.EXTRACTING);
    setStatusMsg('Extracting product via native browser...');
    setGarmentData(null);
    setResult(null);
    setWebViewUrl(null);

    // Bypass for direct images
    if (link.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i)) {
      setGarmentData({ imageUrl: link, garmentDesc: 'Custom Image', price: 'Unknown' });
      setStage(STAGES.IDLE);
      return;
    }

    // Start WebView extraction
    setWebViewUrl(link);
    
    // Safety timeout: 15 seconds to extract
    clearTimeout(extractTimeoutRef.current);
    extractTimeoutRef.current = setTimeout(() => {
      if (webViewUrl) {
        setStage(STAGES.ERROR);
        setStatusMsg('Timed out trying to read the page. Try pasting the direct Image URL.');
        setWebViewUrl(null);
      }
    }, 15000);
  };

  // The Javascript we inject into the hidden WebView
  const INJECTED_JAVASCRIPT = `
    setTimeout(function() {
      try {
        // --- 1. TITLE EXTRACTION ---
        var ogTitle = document.querySelector('meta[property="og:title"]');
        var titleElem = document.querySelector('h1, #productTitle, .B_NuCI, .product-title-word-break');
        var title = ogTitle ? ogTitle.content : (titleElem ? titleElem.innerText : document.title);
        
        // --- 2. IMAGE EXTRACTION (Prioritizing product-specific selectors) ---
        var imgUrl = null;
        
        // Amazon specific selectors
        var amazonImg = document.querySelector('#landingImage, #main-image, #imgBlkFront, .a-dynamic-image');
        // Flipkart specific selectors
        var flipkartImg = document.querySelector('img[src*="flipkart.com/image"], ._396cs4, ._2r_T1_');
        
        if (amazonImg) {
          imgUrl = amazonImg.getAttribute('data-old-hires') || amazonImg.getAttribute('data-a-dynamic-image') || amazonImg.src;
          // data-a-dynamic-image is a JSON string of URLs, we take the first key
          if (imgUrl && imgUrl.startsWith('{')) {
            try {
              var keys = Object.keys(JSON.parse(imgUrl));
              imgUrl = keys[keys.length - 1]; // Usually the largest one is last
            } catch(e) {}
          }
        } else if (flipkartImg) {
          imgUrl = flipkartImg.src;
        }
        
        // Fallback to OG Image if not found yet or if it looks generic
        if (!imgUrl || imgUrl.includes('amazon_logo') || imgUrl.includes('social_share')) {
           var ogImg = document.querySelector('meta[property="og:image"]');
           if (ogImg && ogImg.content && !ogImg.content.includes('amazon_logo') && !ogImg.content.includes('social_share')) {
             imgUrl = ogImg.content;
           }
        }
        
        // Final fallback to any large-ish image
        if (!imgUrl) {
          var allImgs = Array.from(document.querySelectorAll('img'));
          var bestImg = allImgs.find(i => i.width > 150 && i.height > 150 && !i.src.includes('logo') && !i.src.includes('banner'));
          if (bestImg) imgUrl = bestImg.src;
        }
        
        // --- 3. PRICE EXTRACTION ---
        var bodyText = document.body.innerText;
        var priceMatch = bodyText.match(/(₹|Rs\\.?|\\$)\\s?[0-9,]+(\\.[0-9]{2})?/i);
        var price = priceMatch ? priceMatch[0] : "Check site";
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          success: true,
          imageUrl: imgUrl,
          garmentDesc: title.trim(),
          price: price
        }));
      } catch(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ success: false, error: e.toString() }));
      }
    }, 5000); 
    true;
  `;

  const onWebViewMessage = (event) => {
    clearTimeout(extractTimeoutRef.current); // Stop timeout timer
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.success && data.imageUrl) {
        setGarmentData({
          imageUrl: data.imageUrl,
          garmentDesc: data.garmentDesc || 'Clothing item',
          price: data.price || 'N/A'
        });
        setStage(STAGES.IDLE);
        setWebViewUrl(null);
      } else {
        throw new Error('Could not find image');
      }
    } catch (e) {
      setStage(STAGES.ERROR);
      setStatusMsg('Could not detect the product structure on this page. Try finding a direct image link.');
      setWebViewUrl(null);
    }
  };

  const startTryOn = async () => {
    if (!userPhoto || !garmentData?.imageUrl) {
      Alert.alert('Missing Info', 'Please upload your photo and extract a product first.');
      return;
    }

    setStage(STAGES.TRYON);
    setStatusMsg('AI is generating your virtual look...');
    try {
      const outputUrl = await runVirtualTryOn(
        userPhotoBase64,
        garmentData.imageUrl,
        garmentData.garmentDesc,
        (msg) => setStatusMsg(msg)
      );

      setResult(outputUrl);
      setStage(STAGES.DONE);
      setStatusMsg('Your virtual look is ready!');

      if (user && firestore) {
        addDoc(collection(firestore, 'tryon_results'), {
          userId: user.uid,
          // We don't save the full Base64 to Firestore because it's too large (>1MB)
          // In a production app, you would upload this to Firebase Storage first.
          garmentImageUrl: garmentData.imageUrl,
          garmentDesc: garmentData.garmentDesc,
          storeLink: storeLink.trim(),
          createdAt: serverTimestamp(),
        }).catch(e => console.log('Firestore save error (Data too large, but image displayed):', e));
      }
    } catch (e) {
      setStage(STAGES.ERROR);
      setStatusMsg(e.message);
      Alert.alert('Generation Failed', e.message);
    }
  };

  const reset = () => {
    setStage(STAGES.IDLE);
    setStatusMsg('');
    setResult(null);
    setGarmentData(null);
    setStoreLink('');
    setWebViewUrl(null);
    clearTimeout(extractTimeoutRef.current);
  };

  const isLoading = stage === STAGES.EXTRACTING || stage === STAGES.TRYON;
  const canExtract = storeLink.trim().length > 0 && !isLoading;
  const canTryOn = !!userPhoto && !!garmentData && !isLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>AI Studio</Text>
              <Text style={styles.subtitle}>Upload your photo, fetch a product, and see the fit instantly.</Text>
            </View>
            {(result || stage === STAGES.ERROR) && (
              <Pressable style={styles.newBtn} onPress={reset}>
                <Text style={styles.newBtnText}>+ New</Text>
              </Pressable>
            )}
          </Animated.View>

          {/* Hidden Extractor Browser */}
          {webViewUrl && (
            <WebView 
              source={{ uri: webViewUrl }}
              style={{ width: 0, height: 0, opacity: 0 }}
              injectedJavaScript={INJECTED_JAVASCRIPT}
              onMessage={onWebViewMessage}
              userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          )}

          {/* Step 1: Photo */}
          <View style={styles.stepRow}>
            <View style={styles.stepBadge}><Text style={styles.stepNum}>1</Text></View>
            <Text style={styles.stepLabel}>Your Photo</Text>
          </View>
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <Pressable style={styles.uploadBox} onPress={handlePickImage}>
              {userPhoto ? (
                <>
                  <Image source={{ uri: userPhoto }} style={styles.previewImg} />
                  <BlurView intensity={30} style={styles.editOverlay}>
                    <Icon name="camera" size={16} color="white" />
                    <Text style={styles.editText}>Change Photo</Text>
                  </BlurView>
                </>
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <View style={styles.iconCircle}>
                    <Icon name="camera" size={34} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.uploadText}>Tap to upload</Text>
                  <Text style={styles.uploadHint}>Use a clear full-body photo for best results</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* Step 2: Store Link & Extract */}
          <View style={styles.stepRow}>
            <View style={styles.stepBadge}><Text style={styles.stepNum}>2</Text></View>
            <Text style={styles.stepLabel}>Paste Product Link</Text>
          </View>
          
          <View style={styles.inputWrapper}>
            <Icon name="send" size={18} color={theme.colors.textLight} />
            <TextInput
              style={styles.input}
              placeholder="Amazon, Flipkart, Zara..."
              placeholderTextColor={theme.colors.textLight + '80'}
              value={storeLink}
              onChangeText={(txt) => {
                setStoreLink(txt);
                if (garmentData) setGarmentData(null);
              }}
              autoCapitalize="none"
              keyboardType="url"
            />
            {storeLink.length > 0 && (
              <Pressable onPress={() => { setStoreLink(''); setGarmentData(null); }}>
                <Icon name="delete" size={16} color={theme.colors.textLight} />
              </Pressable>
            )}
          </View>

          {!garmentData && (
            <Pressable
              style={[styles.actionBtn, !canExtract && styles.disabledBtn, { marginBottom: 24, backgroundColor: theme.colors.dark }]}
              onPress={fetchProduct}
              disabled={!canExtract}
            >
               {stage === STAGES.EXTRACTING ? (
                 <View style={styles.tryBtnRow}>
                   <ActivityIndicator color="#FFF" size="small" />
                   <Text style={styles.tryBtnText}>Native Scraping...</Text>
                 </View>
               ) : (
                 <Text style={styles.actionBtnText}>Extract Product details & image</Text>
               )}
            </Pressable>
          )}

          {/* Extracted Product Card */}
          {garmentData && (
            <Animated.View entering={FadeInDown} layout={Layout.springify()} style={styles.productCard}>
              <View style={styles.productCardHeader}>
                <Text style={styles.productBadge}>EXTRACTED PRODUCT</Text>
                <Pressable onPress={() => setGarmentData(null)}>
                  <Icon name="delete" size={14} color={theme.colors.rose} />
                </Pressable>
              </View>
              <Image source={{ uri: garmentData.imageUrl }} style={styles.garmentImg} resizeMode="contain" />
              <View style={styles.productInfo}>
                <Text style={styles.productTitle} numberOfLines={2}>
                  {garmentData.garmentDesc === 'Custom Image' ? 'Uploaded Custom Image' : garmentData.garmentDesc}
                </Text>
                <View style={styles.priceTag}>
                  <Text style={styles.productPrice}>{garmentData.price}</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Loading Progress */}
          {stage === STAGES.TRYON && (
            <Animated.View entering={FadeIn} layout={Layout.springify()} style={styles.progressBox}>
              <View style={styles.loadingPulse}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
              <Text style={styles.progressText}>{statusMsg}</Text>
              <BlurView intensity={20} style={styles.hintBadge}>
                <Text style={styles.progressHint}>Powered by Gemini AI • 15-30s</Text>
              </BlurView>
            </Animated.View>
          )}

          {/* Try On Button */}
          {garmentData && stage !== STAGES.DONE && (
             <Pressable
              style={[styles.actionBtn, !canTryOn && styles.disabledBtn]}
              onPress={startTryOn}
              disabled={!canTryOn}
            >
              {stage === STAGES.TRYON ? (
                <View style={styles.tryBtnRow}>
                  <ActivityIndicator color="#FFF" size="small" />
                  <Text style={styles.actionBtnText}>Generating Look...</Text>
                </View>
              ) : (
                <Text style={styles.actionBtnText}>Generate Virtual Try-On ✨</Text>
              )}
            </Pressable>
          )}

          {/* Result */}
          {result && stage === STAGES.DONE && (
            <Animated.View entering={FadeIn.duration(1000)} style={styles.resultSection}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>Your Virtual Look ✨</Text>
                <Pressable style={styles.shareBtn}>
                  <Icon name="send" size={16} color="white" />
                  <Text style={styles.shareBtnText}>Share</Text>
                </Pressable>
              </View>
              
              <View style={styles.resultCard}>
                <Image source={{ uri: result }} style={styles.resultImg} resizeMode="cover" />
                <BlurView intensity={40} tint="dark" style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>GEMINI AI ENHANCED</Text>
                </BlurView>
                
                <View style={styles.resultActions}>
                  <Pressable style={styles.actionCircle}>
                    <Icon name="heart" size={20} color={theme.colors.rose} />
                  </Pressable>
                  <Pressable
                    style={styles.actionCircle}
                    onPress={() => Alert.alert('Saved!', 'Look saved to your try-on history.')}
                  >
                    <Icon name="camera" size={20} color={theme.colors.primary} />
                  </Pressable>
                </View>
              </View>

              {garmentData && (
                <Animated.View entering={FadeInDown.delay(400)} style={styles.compRow}>
                  <View style={styles.compCard}>
                    <Image source={{ uri: userPhoto }} style={styles.compImg} resizeMode="cover" />
                    <Text style={styles.compLabel}>Original</Text>
                  </View>
                  <View style={styles.arrowCircle}>
                    <Icon name="send" size={16} color="white" />
                  </View>
                  <View style={styles.compCard}>
                    <Image source={{ uri: garmentData.imageUrl }} style={styles.compImg} resizeMode="contain" />
                    <Text style={styles.compLabel}>Garment</Text>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          )}

          {/* Error State */}
          {stage === STAGES.ERROR && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{statusMsg}</Text>
              <Pressable style={styles.retryBtn} onPress={reset}>
                <Text style={styles.retryText}>Try Again</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.secondary },
  scrollContent: { padding: 24, paddingBottom: 120 },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 28, marginTop: 8 },
  title: { fontSize: 30, fontWeight: '800', color: theme.colors.primary },
  subtitle: { fontSize: 13, color: theme.colors.textLight, marginTop: 3 },
  newBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  newBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' },
  stepNum: { color: 'white', fontWeight: '800', fontSize: 13 },
  stepLabel: { fontSize: 15, fontWeight: '700', color: theme.colors.textDark },

  uploadBox: {
    height: 300, backgroundColor: '#FFFBF0', borderRadius: 28,
    borderWidth: 2, borderColor: theme.colors.darkLight, borderStyle: 'dashed',
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  previewImg: { width: '100%', height: '100%' },
  editOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 46,
    backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  editText: { color: 'white', fontWeight: '700', fontSize: 14 },
  uploadPlaceholder: { alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'white',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  uploadText: { fontSize: 15, fontWeight: '700', color: theme.colors.textDark },
  uploadHint: { fontSize: 12, color: theme.colors.textLight, textAlign: 'center', maxWidth: 220 },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFBF0',
    borderRadius: 18, borderWidth: 1.5, borderColor: theme.colors.darkLight,
    paddingHorizontal: 18, paddingVertical: 16, marginBottom: 16,
  },
  input: { flex: 1, fontSize: 14, color: theme.colors.primary },

  actionBtn: {
    height: 60, backgroundColor: theme.colors.primary, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', marginBottom: 32,
    shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 6,
  },
  tryBtnRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  actionBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  tryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  disabledBtn: { opacity: 0.4 },

  productCard: {
    backgroundColor: '#FFFBF0', borderRadius: 24, borderWidth: 1,
    borderColor: theme.colors.darkLight, padding: 18, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  productCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  productBadge: { fontSize: 10, fontWeight: '900', color: theme.colors.primary, letterSpacing: 1.5 },
  garmentImg: { width: '100%', height: 200, borderRadius: 16, backgroundColor: 'white', marginBottom: 16 },
  productInfo: { alignItems: 'center', gap: 8, width: '100%' },
  productTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textDark, textAlign: 'center' },
  priceTag: { backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  productPrice: { fontSize: 14, fontWeight: '800', color: 'white' },

  progressBox: {
    alignItems: 'center', gap: 16, padding: 32, backgroundColor: '#FFFBF0',
    borderRadius: 24, borderWidth: 1, borderColor: theme.colors.darkLight, marginBottom: 24,
  },
  loadingPulse: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: 'white',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: theme.colors.primary, shadowOpacity: 0.2, shadowRadius: 10,
  },
  progressText: { fontSize: 16, fontWeight: '800', color: theme.colors.primary, textAlign: 'center' },
  hintBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, overflow: 'hidden' },
  progressHint: { fontSize: 11, color: theme.colors.textLight, fontWeight: '600' },

  resultSection: { gap: 24 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  resultTitle: { fontSize: 22, fontWeight: '900', color: theme.colors.primary },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.primary,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
  },
  shareBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },
  resultCard: {
    width: '100%', height: 520, borderRadius: 32, overflow: 'hidden',
    backgroundColor: theme.colors.darkLight, shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
  },
  resultImg: { width: '100%', height: '100%' },
  aiBadge: {
    position: 'absolute', top: 20, left: 20, backgroundColor: theme.colors.primary,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
  },
  aiBadgeText: { color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  resultActions: { position: 'absolute', bottom: 20, right: 20, flexDirection: 'row', gap: 12 },
  actionCircle: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: 'white',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 4,
    borderWidth: 1, borderColor: theme.colors.darkLight,
  },

  compRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFBF0',
    borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.colors.darkLight,
  },
  compCard: { flex: 1, alignItems: 'center', gap: 8 },
  compImg: { width: '100%', height: 140, borderRadius: 16 },
  compLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  arrowCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '45deg' }],
  },

  errorBox: {
    padding: 20, backgroundColor: '#FFF1F1', borderRadius: 16,
    borderWidth: 1, borderColor: '#FFCDD2', alignItems: 'center', gap: 12,
  },
  errorText: { color: '#C62828', fontWeight: '600', textAlign: 'center', fontSize: 14 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: theme.colors.primary, borderRadius: 12 },
  retryText: { color: 'white', fontWeight: '700', fontSize: 14 },
});