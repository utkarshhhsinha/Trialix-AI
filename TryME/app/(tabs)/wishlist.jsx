import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Image,
  ActivityIndicator, Alert, Platform, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { firebaseAuth, firestore } from '../../lib/firebase';
import { theme } from '../../constants/theme';
import { StatusBar } from 'expo-status-bar';
import Icon from '../../assets/icons';
import { LinearGradient } from 'expo-linear-gradient';

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
      // Most recent first
      data.sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
      setItems(data);
    } catch (e) {
      console.log('Wishlist load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (itemId) => {
    Alert.alert('Remove from Wishlist', 'Remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await deleteDoc(doc(firestore, 'wishlist', itemId));
          setItems(prev => prev.filter(i => i.id !== itemId));
        },
      },
    ]);
  };

  const openBuyLink = (link) => {
    if (!link) {
      Alert.alert('No link available', 'This item does not have a purchase link.');
      return;
    }
    Linking.openURL(link).catch(() => Alert.alert('Cannot open link'));
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {/* Image area */}
      <View style={styles.cardImgWrap}>
        <Image
          source={{ uri: item.tryOnImageUrl || item.productImageUrl }}
          style={styles.cardImg}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.cardImgGradient}
        />
        {item.tryOnImageUrl && (
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>✨ Trialix AI</Text>
          </View>
        )}
        {/* Small product thumbnail in corner if try-on exists */}
        {item.tryOnImageUrl && item.productImageUrl && (
          <Image source={{ uri: item.productImageUrl }} style={styles.productThumb} />
        )}
      </View>

      {/* Info area */}
      <View style={styles.cardInfo}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardBrand} numberOfLines={1}>{item.brand}</Text>
          <Pressable style={styles.deleteBtn} onPress={() => removeItem(item.id)}>
            <Icon name="delete" size={15} color="#FF3B30" />
          </Pressable>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardPrice}>₹{item.price}</Text>

        {/* Buy button */}
        <Pressable
          style={styles.buyBtn}
          onPress={() => openBuyLink(item.buyLink)}
        >
          <Text style={styles.buyBtnText}>🛒  Shop Now</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wishlist</Text>
        <Text style={styles.headerSub}>{items.length} saved item{items.length !== 1 ? 's' : ''}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        /* Empty state */
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Icon name="heart" size={52} color={theme.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptySub}>
            Swipe right on any outfit or tap ❤️ after a try-on to save it here.
          </Text>
          <Pressable
            style={styles.discoverBtn}
            onPress={() => router.push('/(tabs)/discover')}
          >
            <Text style={styles.discoverBtnText}>Discover Outfits ✨</Text>
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
  container: { flex: 1, backgroundColor: '#FAF7F4' },

  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 16,
    backgroundColor: '#FAF7F4',
    borderBottomWidth: 0.5,
    borderBottomColor: '#EDE0D4',
  },
  headerTitle: {
    fontSize: 30, fontWeight: '900', color: '#C4785A', fontStyle: 'italic',
  },
  headerSub: { fontSize: 13, color: '#7A6055', fontWeight: '600', marginTop: 2 },

  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: 14, paddingHorizontal: 44,
  },
  emptyIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#FDF2EC', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#EEC4AA', marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 22, fontWeight: '800', color: '#2A1F1A', textAlign: 'center',
  },
  emptySub: {
    fontSize: 14, color: '#7A6055', textAlign: 'center', lineHeight: 21,
  },
  discoverBtn: {
    marginTop: 8, paddingHorizontal: 28, paddingVertical: 14,
    backgroundColor: '#C4785A', borderRadius: 18,
    shadowColor: '#C4785A', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  discoverBtnText: { color: 'white', fontWeight: '800', fontSize: 15 },

  listContent: { padding: 14 },
  row: { gap: 12, marginBottom: 14 },

  card: {
    flex: 1, borderRadius: 20, backgroundColor: 'white', overflow: 'hidden',
    shadowColor: '#2A1F1A', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
    borderWidth: 1, borderColor: '#EDE0D4',
  },
  cardImgWrap: { width: '100%', aspectRatio: 0.72, position: 'relative' },
  cardImg: { width: '100%', height: '100%' },
  cardImgGradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%',
  },
  aiBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: '#C4785A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  aiBadgeText: { color: 'white', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  productThumb: {
    position: 'absolute', bottom: 8, right: 8,
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 2, borderColor: 'white',
  },

  cardInfo: { padding: 12, gap: 5 },
  cardTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardBrand: {
    fontSize: 10, fontWeight: '800', color: '#C4785A', letterSpacing: 1.5, flex: 1,
  },
  deleteBtn: { padding: 2 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#2A1F1A', lineHeight: 18 },
  cardPrice: { fontSize: 15, fontWeight: '900', color: '#2A1F1A', marginTop: 2 },

  buyBtn: {
    marginTop: 6, height: 38, backgroundColor: '#C4785A',
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#C4785A', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 2,
  },
  buyBtnText: { color: 'white', fontWeight: '800', fontSize: 12 },
});