import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { firebaseAuth, firestore } from '../lib/firebase';
import theme from '../theme';
import { ShoppingBag, Trash2, Sparkles } from 'lucide-react';

export default function Wishlist() {
  const user = firebaseAuth?.currentUser;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Real-time wishlist listener matching mobile app logic
  useEffect(() => {
    if (!user || !firestore) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(firestore, 'wishlist'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setItems(data);
        setLoading(false);
      },
      (err) => {
        console.warn('[wishlist web]', err.message);
        setLoading(false);
      }
    );
    return () => unsub?.();
  }, [user]);

  const removeItem = async (itemId) => {
    try {
      setItems(prev => prev.filter(i => i.id !== itemId));
      await deleteDoc(doc(firestore, 'wishlist', itemId));
    } catch (err) {
      console.warn('Failed to delete wishlist item:', err.message);
    }
  };

  return (
    <div style={{ padding: '20px 16px 90px', background: theme.colors.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '32px', fontWeight: '900', fontStyle: 'italic', color: theme.colors.primary }}>
          Wishlist
        </h1>
        <p style={{ color: theme.colors.textMuted, fontSize: '14px', marginTop: '2px' }}>
          {items.length} saved item{items.length !== 1 ? 's' : ''}
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: theme.colors.textMuted }}>
          <Sparkles size={32} color={theme.colors.primary} style={{ animation: 'spin 2s linear infinite', marginBottom: 12 }} />
          <p>Syncing Wishlist in Real-Time…</p>
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: 24, border: `1px solid ${theme.colors.border}` }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: theme.colors.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Sparkles size={28} color={theme.colors.primary} />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: theme.colors.text }}>Your wishlist is empty</h3>
          <p style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>
            Swipe right on any outfit or tap save to sync fits here in real-time!
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {items.map(item => (
            <div 
              key={item.id}
              style={{
                background: 'white', borderRadius: '24px', overflow: 'hidden',
                border: `1px solid ${theme.colors.border}`, padding: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column'
              }}
            >
              {/* Image Box */}
              <div style={{ height: '220px', borderRadius: '18px', overflow: 'hidden', position: 'relative', marginBottom: '10px', background: theme.colors.bgWarm }}>
                <img src={item.tryOnImageUrl || item.productImageUrl || item.imageUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                
                {item.tryOnImageUrl && (
                  <div style={{
                    position: 'absolute', top: 10, left: 10, background: theme.colors.primary, color: 'white',
                    padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    <Sparkles size={11} /> oraneo
                  </div>
                )}

                {item.productImageUrl && item.tryOnImageUrl && item.tryOnImageUrl !== item.productImageUrl && (
                  <div style={{
                    position: 'absolute', bottom: 10, right: 10, width: 42, height: 42,
                    borderRadius: '10px', overflow: 'hidden', border: '2px solid white', boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                  }}>
                    <img src={item.productImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>

              {/* Content info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: theme.colors.primary, textTransform: 'uppercase' }}>{item.brand || 'oraneo Brand'}</span>
                <Trash2 size={15} color="#FF3B30" style={{ cursor: 'pointer' }} onClick={() => removeItem(item.id)} />
              </div>

              <h4 style={{ fontSize: '14px', fontWeight: '800', color: theme.colors.text, marginTop: '2px', height: '36px', overflow: 'hidden', lineHeight: 1.2 }}>
                {item.title || item.garmentDesc || 'Outfit'}
              </h4>

              <div style={{ fontSize: '16px', fontWeight: '900', color: theme.colors.text, marginTop: '4px', marginBottom: '12px' }}>
                ₹{item.price || item.priceINR || '999'}
              </div>

              {item.buyLink && (
                <a 
                  href={item.buyLink} target="_blank" rel="noreferrer"
                  className="btn-primary"
                  style={{
                    width: '100%', padding: '10px', borderRadius: '16px', fontSize: '13px', textDecoration: 'none'
                  }}
                >
                  <ShoppingBag size={14} /> Shop Now
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
