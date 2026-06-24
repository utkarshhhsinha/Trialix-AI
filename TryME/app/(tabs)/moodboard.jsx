/**
 * moodboard.jsx — TrialX AI
 * Pinterest-style pinboard of saved AI try-on looks.
 * Replaces "Wishlist" in the nav.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Image,
  Alert, Dimensions, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase';
import { useRouter } from 'expo-router';

const { width: W } = Dimensions.get('window');
const COL_W = (W - 48) / 2;

// Board categories
const BOARDS = ['All', 'AI Try-Ons', 'Saved Fits', 'Inspo'];

export default function Moodboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBoard, setActiveBoard] = useState('All');

  useEffect(() => {
    if (!firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, async u => {
      if (!u) { router.replace('/login'); return; }
      setUser(u);
      await loadItems(u.uid);
    });
    return () => unsub();
  }, []);

  const loadItems = async uid => {
    try {
      const q = query(collection(firestore, 'wishlist'), where('userId', '==', uid));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(data);
    } catch (e) { console.warn('Moodboard load:', e.message); }
    finally { setLoading(false); }
  };

  const removeItem = id => {
    Alert.alert('Remove from Board', 'Remove this pin?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await deleteDoc(doc(firestore, 'wishlist', id));
          setItems(prev => prev.filter(i => i.id !== id));
        },
      },
    ]);
  };

  // Alternate card heights for Pinterest feel
  const leftCol = items.filter((_, i) => i % 2 === 0);
  const rightCol = items.filter((_, i) => i % 2 !== 0);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Moodboard</Text>
            <Text style={styles.headerSub}>{items.length} pins saved</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>🔥 {Math.min(items.length * 2, 14)} pts</Text>
            </View>
          </View>
        </View>

        {/* Board selector */}
        <View style={styles.boardRow}>
          {BOARDS.map(b => (
            <Pressable key={b} style={[styles.boardChip, activeBoard === b && styles.boardChipActive]} onPress={() => setActiveBoard(b)}>
              <Text style={[styles.boardChipText, activeBoard === b && styles.boardChipTextActive]}>{b}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      {items.length === 0 && !loading ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyEmoji}>📌</Text>
          </View>
          <Text style={styles.emptyTitle}>Your board is empty</Text>
          <Text style={styles.emptySub}>
            Swipe ↑ on any outfit or save after a try-on to pin it here.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/(tabs)/discover')}>
            <LinearGradient colors={['#FE3C72', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyBtnGrad}>
              <Text style={styles.emptyBtnText}>Discover Looks ✨</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={[{ key: 'grid' }]}
          renderItem={() => (
            <View style={styles.masonryRow}>
              <View style={styles.col}>
                {leftCol.map((item, i) => (
                  <PinCard key={item.id} item={item} tall={i % 3 === 0} onRemove={removeItem} />
                ))}
              </View>
              <View style={styles.col}>
                {rightCol.map((item, i) => (
                  <PinCard key={item.id} item={item} tall={i % 3 === 1} onRemove={removeItem} />
                ))}
              </View>
            </View>
          )}
          keyExtractor={i => i.key}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function PinCard({ item, tall, onRemove }) {
  const h = tall ? COL_W * 1.6 : COL_W * 1.15;
  const imgSrc = item.tryOnImageUrl || item.productImageUrl;

  return (
    <View style={[styles.pin, { height: h }]}>
      {imgSrc ? (
        <Image source={{ uri: imgSrc }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.pinFallback]}>
          <Text style={{ fontSize: 32 }}>👗</Text>
        </View>
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.pinGrad} />

      {/* AI badge */}
      {item.tryOnImageUrl ? (
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>✨ AI</Text>
        </View>
      ) : null}

      {/* Remove */}
      <Pressable style={styles.pinRemove} onPress={() => onRemove(item.id)}>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '700' }}>✕</Text>
      </Pressable>

      {/* Info */}
      <View style={styles.pinInfo}>
        <Text style={styles.pinBrand} numberOfLines={1}>{item.brand?.toUpperCase()}</Text>
        <Text style={styles.pinTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.pinPrice}>₹{item.price}</Text>
        {item.buyLink ? (
          <Pressable style={styles.pinBuyBtn} onPress={() => Linking.openURL(item.buyLink).catch(() => {})}>
            <Text style={styles.pinBuyText}>🛒 Shop</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  safe: { backgroundColor: '#0D0D0D' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerTitle: { fontSize: 30, fontWeight: '900', color: 'white' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 2, fontWeight: '600' },
  headerRight: {},
  streakBadge: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(245,197,24,0.1)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.3)',
  },
  streakText: { fontSize: 12, fontWeight: '800', color: '#F5C518' },

  boardRow: {
    flexDirection: 'row', paddingHorizontal: 20, gap: 8, paddingBottom: 14,
  },
  boardChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  boardChipActive: { backgroundColor: '#FE3C72', borderColor: '#FE3C72' },
  boardChipText: { color: 'rgba(255,255,255,0.45)', fontWeight: '700', fontSize: 13 },
  boardChipTextActive: { color: 'white' },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 44 },
  emptyIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(254,60,114,0.1)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(254,60,114,0.3)',
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: 'white', textAlign: 'center' },
  emptySub: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 21 },
  emptyBtn: { width: '100%', height: 54, borderRadius: 18, overflow: 'hidden', marginTop: 8 },
  emptyBtnGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBtnText: { color: 'white', fontWeight: '800', fontSize: 15 },

  scroll: { paddingBottom: 100 },
  masonryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, paddingTop: 4 },
  col: { flex: 1, gap: 12 },

  pin: {
    borderRadius: 20, overflow: 'hidden', backgroundColor: '#1A1A1A',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  pinFallback: { backgroundColor: '#2A2A2A', justifyContent: 'center', alignItems: 'center' },
  pinGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' },
  aiBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: '#FE3C72', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  aiBadgeText: { color: 'white', fontSize: 9, fontWeight: '800' },
  pinRemove: {
    position: 'absolute', top: 8, right: 8,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  pinInfo: { position: 'absolute', bottom: 10, left: 10, right: 10, gap: 3 },
  pinBrand: { fontSize: 9, fontWeight: '800', color: '#FE3C72', letterSpacing: 1.5 },
  pinTitle: { fontSize: 12, fontWeight: '800', color: 'white', lineHeight: 16 },
  pinPrice: { fontSize: 13, fontWeight: '900', color: 'rgba(255,255,255,0.8)' },
  pinBuyBtn: {
    marginTop: 4, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: '#FE3C72', borderRadius: 8, alignSelf: 'flex-start',
  },
  pinBuyText: { color: 'white', fontWeight: '800', fontSize: 11 },
});