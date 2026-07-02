import React, { useState, useEffect } from 'react';
import { Search, ShoppingBag, Sparkles } from 'lucide-react';
import { WOMEN_TOPS } from '../constants/womenTops';
import { subscribeCommunityFeed } from '../lib/community';
import theme from '../theme';

export default function Explore({ onOpenTrialRoom }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [communityFits, setCommunityFits] = useState([]);

  // Subscribe to real community feed!
  useEffect(() => {
    const unsub = subscribeCommunityFeed(
      posts => {
        // Just take the first 6 posts for Explore page
        setCommunityFits(posts.slice(0, 6));
      },
      err => console.warn(err)
    );
    return () => unsub?.();
  }, []);

  return (
    <div style={{ padding: '20px 16px 90px', background: theme.colors.bg, minHeight: '100vh' }}>
      {/* Header (Matching Screenshot 2!) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '28px', fontWeight: '900', color: theme.colors.text }}>Explore</h1>
          <p style={{ color: theme.colors.textMuted, fontSize: '14px', marginTop: '2px' }}>Discover your next look</p>
        </div>
        
        <div style={{
          background: theme.colors.accentLight, color: theme.colors.textDark,
          padding: '6px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '13px',
          display: 'flex', alignItems: 'center', gap: '4px'
        }}>
          ✨ 50
        </div>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <Search size={18} color={theme.colors.textMuted} style={{ position: 'absolute', left: 16, top: 14 }} />
        <input 
          type="text" 
          placeholder="Search styles, brands, vibes..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            width: '100%', padding: '14px 14px 14px 48px', borderRadius: '20px',
            border: `1px solid ${theme.colors.border}`, fontSize: '14px', outline: 'none', background: 'white'
          }}
        />
      </div>

      {/* Filter Chips Pill Row */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '24px' }}>
        {[
          { id: 'all', label: 'All Outfits' },
          { id: 'tops', label: 'Tops' },
          { id: 'bottoms', label: 'Bottoms' },
          { id: 'dresses', label: 'Dresses' }
        ].map(cat => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '10px 20px', borderRadius: '24px',
                border: `1px solid ${isActive ? theme.colors.primary : theme.colors.border}`,
                background: isActive ? theme.colors.primary : 'white',
                color: isActive ? 'white' : theme.colors.textSecondary,
                fontWeight: '700', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Section 1: Live Community Fits */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: theme.colors.text }}>Live Community Fits</h3>
          <span style={{ fontSize: '13px', fontWeight: '700', color: theme.colors.primary, cursor: 'pointer' }}>See all</span>
        </div>

        <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '8px' }}>
          {communityFits.map(item => {
            const imageUrl = item.resultImageUrl || item.tryOnImageUrl || item.garmentImageUrl;
            return (
              <div 
                key={item.id} 
                onClick={() => onOpenTrialRoom?.({ 
                  title: item.garmentDesc || item.title || 'Outfit', 
                  imageUrl: item.garmentImageUrl || item.productImageUrl || imageUrl 
                })}
                style={{
                  minWidth: '140px', height: '200px', borderRadius: '20px', overflow: 'hidden', position: 'relative',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)', cursor: 'pointer'
                }}
              >
                <img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={item.garmentDesc} />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
                  padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', color: 'white'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', opacity: 0.9 }}>{item.userName}</span>
                  <span style={{ fontSize: '13px', fontWeight: '800' }}>{item.garmentDesc || item.title}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Women's Tops */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: theme.colors.text }}>Women's Tops</h3>
          <span style={{ fontSize: '13px', color: theme.colors.textMuted }}>19 styles</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {WOMEN_TOPS.map(item => (
            <div 
              key={item.id}
              style={{
                background: 'white', borderRadius: '24px', overflow: 'hidden',
                border: `1px solid ${theme.colors.border}`, padding: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column'
              }}
            >
              {/* Image Container with Price Badge */}
              <div style={{ height: '180px', borderRadius: '16px', overflow: 'hidden', position: 'relative', marginBottom: '10px' }}>
                <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{
                  position: 'absolute', bottom: 10, left: 10, background: theme.colors.primary, color: 'white',
                  padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '800'
                }}>
                  ₹{item.priceINR}
                </div>
              </div>

              {/* Text Info */}
              <span style={{ fontSize: '10px', fontWeight: '800', color: theme.colors.primary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {item.brand}
              </span>
              <h4 style={{ fontSize: '14px', fontWeight: '800', color: theme.colors.text, marginTop: '2px', marginBottom: '12px', height: '36px', overflow: 'hidden' }}>
                {item.title}
              </h4>

              {/* Buy Now Button */}
              <a 
                href={item.buyLink} target="_blank" rel="noreferrer"
                className="btn-primary"
                style={{
                  width: '100%', padding: '10px', borderRadius: '16px', fontSize: '13px', textDecoration: 'none'
                }}
              >
                <ShoppingBag size={14} /> Buy Now
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
