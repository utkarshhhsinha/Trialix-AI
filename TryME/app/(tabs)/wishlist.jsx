import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Image,
  ActivityIndicator, Alert, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where, getDocs, deleteDoc, doc
} from 'firebase/firestore';
import { firebaseAuth, firestore } from '../../lib/firebase';
import { theme } from '../../constants/theme';
import { StatusBar } from 'expo-status-bar';
import Icon from '../../assets/icons';

export default function Wishlist() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, async (u) => {
      if (!u) { router.replace('/login'); return; }
      setUser(u);
      await loadWishlist(u.uid);
    });
    return () => unsub();
  }, []);

  const loadWishlist = async (uid) => {
    try {
      const q = query(collection(firestore, 'wishlist'), where('userId', '==', uid));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(data);
    } catch (e) {
      console.log('Wishlist load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (itemId) => {
    Alert.alert('Remove', 'Remove from wishlist?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await deleteDoc(doc(firestore, 'wishlist', itemId));
          setItems(prev => prev.filter(i => i.id !== itemId));
        }
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image
        source={{ uri: item.tryOnImageUrl || item.productImageUrl }}
        style={styles.cardImage}
        resizeMode="cover"
      />
      {/* AI badge if it's a try-on result */}
      {item.tryOnImageUrl && (
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>✨ AI Try-On</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardBrand}>{item.brand}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.cardFooterRow}>
          <Text style={styles.cardPrice}>{item.currency}{Number(item.price).toFixed(2)}</Text>
          <View style={styles.cardBtns}>
            <Pressable
              style={styles.buyBtn}
              onPress={() => {
                // Open buy link
                const { Linking } = require('react-native');
                Linking.openURL(item.buyLink).catch(() => Alert.alert('Cannot open link'));
              }}
            >
              <Text style={styles.buyBtnText}>Buy</Text>
            </Pressable>
            <Pressable style={styles.removeBtn} onPress={() => removeItem(item.id)}>
              <Icon name="delete" size={16} color="#FF3B30" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wishlist</Text>
        <Text style={styles.headerSub}>{items.length} saved items</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Icon name="heart" size={64} color={theme.colors.gray} />
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptySub}>Swipe right or tap ❤️ on any outfit to save it here</Text>
          <Pressable style={styles.discoverBtn} onPress={() => router.push('/(tabs)/discover')}>
            <Text style={styles.discoverBtnText}>Discover Outfits</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={i => i.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: theme.fonts.extraBold, color: theme.colors.textDark },
  headerSub: { fontSize: 13, color: theme.colors.textLight, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: theme.fonts.bold, color: theme.colors.textDark, textAlign: 'center' },
  emptySub: { fontSize: 14, color: theme.colors.textLight, textAlign: 'center', lineHeight: 20 },
  discoverBtn: {
    marginTop: 8, paddingHorizontal: 28, paddingVertical: 14,
    backgroundColor: theme.colors.primary, borderRadius: 16,
  },
  discoverBtnText: { color: 'white', fontWeight: theme.fonts.bold, fontSize: 15 },
  listContent: { padding: 16 },
  row: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1, borderRadius: 20, backgroundColor: 'white', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  cardImage: { width: '100%', aspectRatio: 0.75 },
  aiBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: theme.colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  aiBadgeText: { color: 'white', fontSize: 10, fontWeight: theme.fonts.bold },
  cardInfo: { padding: 12, gap: 4 },
  cardBrand: { fontSize: 10, fontWeight: theme.fonts.bold, color: theme.colors.primary, letterSpacing: 1.5 },
  cardTitle: { fontSize: 13, fontWeight: theme.fonts.semibold, color: theme.colors.textDark },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  cardPrice: { fontSize: 15, fontWeight: theme.fonts.extraBold, color: theme.colors.textDark },
  cardBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  buyBtn: {
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: theme.colors.primary, borderRadius: 10,
  },
  buyBtnText: { color: 'white', fontSize: 12, fontWeight: theme.fonts.bold },
  removeBtn: { padding: 4 },
});
