/**
 * explore.jsx — oraneo
 * Pinterest-style fashion exploration grid.
 * Trending picks, Spotify-style mood collections, Instagram search.
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase';
import { Ionicons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  TextInput, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { subscribeCommunityFeed } from '@/lib/community';
import { shareTryOnWhatsApp } from '@/lib/socialActions';
import { useRouter } from 'expo-router';
import Icon from '@/assets/icons';
import { WOMEN_TOPS } from '@/constants/womenTops';

const { width: W } = Dimensions.get('window');
const COL = (W - 48) / 2;

// ── Curated Mood Collections (Spotify-style)
const MOODS = [
  { id: 'date', label: 'Date Night', imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80' },
  { id: 'monsoon', label: 'Monsoon Fits', imageUrl: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=400&q=80' },
  { id: 'street', label: 'Mumbai Street', imageUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&q=80' },
  { id: 'softgirl', label: 'Soft Girl Era', imageUrl: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&q=80' },
  { id: 'office', label: 'Office Glam', imageUrl: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&q=80' },
  { id: 'vacation', label: 'Vacation Vibes', imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80' },
];

// ── Trending grid items
const TRENDING = [
  { id: 't1', title: 'Relaxed Linen Set', brand: 'Zara', priceINR: '7,899', matchScore: 94, imageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&q=80', buyLink: 'https://www.zara.com/in/en/', tall: true },
  { id: 't2', title: 'Air Force 1 Lo', brand: 'Nike', priceINR: '9,295', matchScore: 88, imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80', buyLink: 'https://www.nike.com/in/' },
  { id: 't3', title: 'Y2K Cargo Pants', brand: 'H&M', priceINR: '3,499', matchScore: 91, imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4d29?w=400&q=80', buyLink: 'https://www2.hm.com/en_in/', tall: true },
  { id: 't4', title: 'Silk Cami Top', brand: 'ASOS', priceINR: '2,199', matchScore: 86, imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80', buyLink: 'https://www.asos.com/' },
  { id: 't5', title: 'Classic Trench', brand: 'Mango', priceINR: '12,499', matchScore: 97, imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&q=80', buyLink: 'https://shop.mango.com/in/', tall: true },
  { id: 't6', title: 'Chunky Loafers', brand: 'Steve Madden', priceINR: '6,999', matchScore: 83, imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&q=80', buyLink: 'https://www.stevemadden.in/' },
];

const FILTERS = ['All Outfits', 'Tops', 'Bottoms', 'Dresses', 'Shoes', 'Accessories'];

export default function Explore() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All Outfits');
  const [user, setUser] = useState(null);
  const [auraPoints, setAuraPoints] = useState(0);
  const [communityLooks, setCommunityLooks] = useState([]);

  useEffect(() => {
    if (!firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, u => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !firestore) return;
    let unsub = () => {};
    user.getIdToken().then(() => {
      unsub = onSnapshot(
        doc(firestore, 'profiles', user.uid),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            if (d.auraPoints !== undefined) setAuraPoints(d.auraPoints);
          }
        },
        (err) => console.warn('[explore profiles listener]', err.code)
      );
    }).catch(e => console.warn('[explore profiles listener] token refresh failed:', e.message));
    return () => unsub();
  }, [user]);

  // Real-time community looks for Explore
  useEffect(() => {
    if (!user) {
      setCommunityLooks([]);
      return;
    }
    let unsub = () => { };
    user.getIdToken().then(() => {
      unsub = subscribeCommunityFeed(
        (posts) => setCommunityLooks(posts.slice(0, 12)),
        () => { }
      );
    }).catch(e => console.warn('[explore community feed] token refresh failed:', e.message));
    return () => unsub();
  }, [user]);

  const filteredTrending = TRENDING.filter(item => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return item.title.toLowerCase().includes(q) || item.brand.toLowerCase().includes(q);
  });

  const leftCol = filteredTrending.filter((_, i) => i % 2 === 0);
  const rightCol = filteredTrending.filter((_, i) => i % 2 !== 0);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Explore</Text>
            <Text style={styles.headerSub}>Discover your next look</Text>
          </View>
          <View style={styles.headerRight}>
            <LinearGradient
              colors={['#C49A6C', '#E8C89A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.auraChip}
            >
              <Ionicons name="sparkles" size={12} color="white" />
              <Text style={styles.auraText}>{auraPoints}</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Search Bar - Instagram style */}
        <View style={styles.searchBar}>
          <Icon name="search" size={16} color="#7A6055" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search styles, brands, vibes…"
            placeholderTextColor="#B8A49A"
            selectionColor="#C4785A"
          />
        </View>

        {/* Category Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {FILTERS.map(f => (
            <Pressable
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Live Community Looks (real-time from Firestore) */}
        {communityLooks.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Live Community Fits</Text>
              <Pressable onPress={() => router.push('/(tabs)/community')}>
                <Text style={styles.sectionLink}>See all</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communityRow}>
              {communityLooks.map(item => (
                <Pressable
                  key={item.id}
                  style={styles.communityCard}
                  onPress={() => router.push('/(tabs)/community')}
                  onLongPress={() => shareTryOnWhatsApp({ imageUrl: item.resultImageUrl, title: item.garmentDesc, brand: item.brand })}
                >
                  <Image source={{ uri: item.resultImageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  <LinearGradient colors={['transparent', 'rgba(42,31,26,0.85)']} style={StyleSheet.absoluteFillObject} />
                  <View style={styles.communityInfo}>
                    <Text style={styles.communityUser} numberOfLines={1}>{item.userName}</Text>
                    <Text style={styles.communityTitle} numberOfLines={1}>{item.garmentDesc}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Women's Tops */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Women's Tops</Text>
          <Text style={styles.sectionSub}>19 styles</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topsRow}
        >
          {WOMEN_TOPS.map(top => (
            <WomenTopCard key={top.id} item={top} />
          ))}
        </ScrollView>

        {/* ── Mood Collections (Spotify-style) */}
        <Text style={styles.sectionTitle}>Mood Collections</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodsRow}>
          {MOODS.map(m => (
            <Pressable key={m.id} style={styles.moodCard}>
              <Image source={{ uri: m.imageUrl }} style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]} resizeMode="cover" />
              <LinearGradient colors={['transparent', 'rgba(42,31,26,0.8)']} style={StyleSheet.absoluteFillObject} />
              <Text style={styles.moodLabel}>{m.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Trending Grid (Pinterest masonry) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trending Now</Text>
          <Text style={styles.sectionSub}>Updated daily</Text>
        </View>
        
        <View style={styles.masonryRow}>
          {/* Left column */}
          <View style={styles.masonryCol}>
            {leftCol.map(item => (
              <TrendCard key={item.id} item={item} />
            ))}
          </View>
          {/* Right column */}
          <View style={styles.masonryCol}>
            {rightCol.map(item => (
              <TrendCard key={item.id} item={item} />
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function TrendCard({ item }) {
  const cardH = item.tall ? COL * 1.55 : COL * 1.15;
  return (
    <Pressable
      style={[styles.trendCard, { height: cardH }]}
      onPress={() => item.buyLink && Linking.openURL(item.buyLink).catch(() => {})}
    >
      <Image source={{ uri: item.imageUrl }} style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(42,31,26,0.85)']} style={styles.trendGrad} />

      {/* Match score */}
      <View style={styles.trendMatch}>
        <Text style={styles.trendMatchText}>{item.matchScore}% Match</Text>
      </View>

      <View style={styles.trendInfo}>
        <Text style={styles.trendBrand}>{item.brand.toUpperCase()}</Text>
        <Text style={styles.trendTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.trendPrice}>₹{item.priceINR}</Text>
      </View>
    </Pressable>
  );
}

function WomenTopCard({ item }) {
  return (
    <View style={styles.womenTopCard}>
      {/* Product image */}
      <Pressable
        style={styles.womenTopImgWrap}
        onPress={() => item.buyLink && Linking.openURL(item.buyLink).catch(() => {})}
      >
        <Image
          source={item.image}
          style={styles.womenTopImg}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(42,31,26,0.7)']}
          style={styles.womenTopGrad}
        />
        <View style={styles.womenTopPriceChip}>
          <Text style={styles.womenTopPriceText}>₹{item.priceINR}</Text>
        </View>
      </Pressable>

      {/* Info */}
      <View style={styles.womenTopInfo}>
        <Text style={styles.womenTopBrand} numberOfLines={1}>{item.brand.toUpperCase()}</Text>
        <Text style={styles.womenTopTitle} numberOfLines={2}>{item.title}</Text>
        <Pressable
          style={styles.womenTopBuyBtn}
          onPress={() => item.buyLink && Linking.openURL(item.buyLink).catch(() => {})}
        >
          <Ionicons name="cart-outline" size={13} color="white" />
          <Text style={styles.womenTopBuyBtnText}>Buy Now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F4' },
  safe: { backgroundColor: '#FAF7F4' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 30, fontWeight: '900', color: '#2A1F1A' },
  headerSub: { fontSize: 13, color: '#7A6055', marginTop: 2, fontWeight: '600' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16, paddingHorizontal: 16, height: 48,
    borderWidth: 1, borderColor: '#EDE0D4',
  },
  searchInput: { flex: 1, color: '#2A1F1A', fontSize: 14, fontWeight: '500' },

  filtersRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 4 },
  filterChip: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#EDE0D4',
  },
  filterChipActive: { backgroundColor: '#C4785A', borderColor: '#C4785A' },
  filterChipText: { color: '#7A6055', fontWeight: '700', fontSize: 13 },
  filterChipTextActive: { color: '#FFFFFF' },

  scroll: { paddingTop: 20 },

  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#2A1F1A', paddingHorizontal: 20, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingRight: 20, marginBottom: 12 },
  sectionLink: { fontSize: 13, fontWeight: '800', color: '#C4785A' },
  sectionSub: { fontSize: 12, color: '#B8A49A', fontWeight: '600' },

  communityRow: { paddingHorizontal: 20, gap: 12, paddingBottom: 24 },
  communityCard: {
    width: 130, height: 180, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: '#EDE0D4',
  },
  communityInfo: { position: 'absolute', bottom: 10, left: 10, right: 10 },
  communityUser: { fontSize: 10, fontWeight: '800', color: '#EEC4AA', marginBottom: 2 },
  communityTitle: { fontSize: 11, fontWeight: '800', color: 'white' },

  moodsRow: { paddingHorizontal: 20, gap: 12, paddingBottom: 24 },
  moodCard: {
    width: 140, height: 140, borderRadius: 18, overflow: 'hidden',
    justifyContent: 'flex-end', padding: 14,
    borderWidth: 1, borderColor: '#EDE0D4',
    shadowColor: '#2A1F1A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  moodLabel: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', textAlign: 'left' },

  masonryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12, marginTop: 4 },
  masonryCol: { flex: 1, gap: 12 },
  trendCard: {
    borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFFFFF',
    shadowColor: '#2A1F1A', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  trendGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  trendMatch: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(250,247,244,0.9)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: '#EDE0D4',
  },
  trendMatchText: { fontSize: 11, fontWeight: '900', color: '#6B9E7A' },
  trendInfo: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  trendBrand: { fontSize: 9, fontWeight: '800', color: '#EEC4AA', letterSpacing: 2, marginBottom: 2 },
  trendTitle: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  trendPrice: { fontSize: 13, fontWeight: '900', color: 'rgba(255,255,255,0.8)' },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 20,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  auraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    shadowColor: '#C49A6C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  auraText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },

  // ── Women's Tops horizontal strip
  topsRow: { paddingHorizontal: 20, gap: 14, paddingBottom: 28 },

  womenTopCard: {
    width: 148,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#2A1F1A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#EDE0D4',
  },
  womenTopImgWrap: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  womenTopImg: {
    width: '100%',
    height: '100%',
  },
  womenTopGrad: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
  },
  womenTopPriceChip: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#C4785A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  womenTopPriceText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '900',
  },
  womenTopInfo: {
    padding: 10,
    gap: 4,
  },
  womenTopBrand: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C4785A',
    letterSpacing: 1.5,
  },
  womenTopTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2A1F1A',
    lineHeight: 16,
  },
  womenTopBuyBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 34,
    backgroundColor: '#C4785A',
    borderRadius: 12,
    shadowColor: '#C4785A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  womenTopBuyBtnText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 12,
  },
});
