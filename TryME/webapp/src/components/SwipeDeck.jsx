import React, { useState, useEffect, useRef } from 'react';
import { Heart, X, Sparkles, ShoppingBag, Star, Download, Share2, Send, Loader2, Cpu } from 'lucide-react';
import theme from '../theme';

const downloadImageToLocal = async (imageUrl, fileName = 'tryon-look.jpg') => {
  if (!imageUrl) return;
  if (imageUrl.startsWith('data:')) {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(imageUrl, '_blank');
  }
};

const SWIPE_THRESHOLD = 90; // px drag needed to trigger action

export default function SwipeDeck({
  items = [],
  currentIndex = 0,
  userPhotoUrl,
  postingId,
  onTryOn,
  onSwipeRight,
  onSwipeLeft,
  onSuperLike,
  onRewind,
  onBoost,
  onSave,
  onShare,
  onPost
}) {
  const [, forceUpdate] = useState(0);
  const currentItem = items[currentIndex];
  const prevTryOnUrl = useRef(currentItem?.tryOnImageUrl);

  // ── Swipe gesture state ──────────────────────────────────────────
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const dragStart = useRef({ x: 0, y: 0 });
  const cardRef = useRef(null);

  useEffect(() => {
    const item = items[currentIndex];
    if (!item) return;
    // Re-render whenever either the image URL or the generation status changes
    const key = (item.tryOnImageUrl || '') + '|' + (item.generationStatus || '');
    if (key !== prevTryOnUrl.current) {
      prevTryOnUrl.current = key;
      forceUpdate(n => n + 1);
    }
  }, [items, currentIndex]);

  // Reset drag when card changes
  useEffect(() => {
    setDrag({ x: 0, y: 0, active: false });
  }, [currentIndex]);

  if (!items || items.length === 0 || currentIndex >= items.length || !currentItem) {
    return null;
  }

  // ── Image decision ───────────────────────────────────────────────
  const tryOnUrl = currentItem.tryOnImageUrl;
  const isRealTryOn = tryOnUrl && tryOnUrl !== currentItem.imageUrl;
  const status = currentItem.generationStatus; // 'pending' | 'queued' | 'success' | 'failed'

  // isGenerating = true ONLY while actively generating (pending).
  // 'queued' cards are waiting their turn — show clean garment image, no spinner.
  // 'failed' and 'success' both end the generating state immediately.
  const isGenerating = status === 'pending';

  // During generation (pending) → user's own photo (personalised preview while waiting)
  // Queued / failed       → garment catalog photo (clean product image)
  // After success         → AI try-on result
  const displayImage = isGenerating
    ? (userPhotoUrl || currentItem.imageUrl)   // user photo while AI is working
    : (isRealTryOn ? tryOnUrl : currentItem.imageUrl); // AI result or clean garment photo

  // ── Swipe indicator derived values ──────────────────────────────
  const dragPct = Math.min(Math.abs(drag.x) / SWIPE_THRESHOLD, 1);
  const isSwipingRight = drag.x > 20;
  const isSwipingLeft = drag.x < -20;
  const cardTransform = drag.active
    ? `translateX(${drag.x}px) rotate(${drag.x * 0.04}deg)`
    : 'translateX(0) rotate(0deg)';

  // ── Pointer handlers ─────────────────────────────────────────────
  const onPointerDown = (e) => {
    if (e.target.closest('a') || e.target.closest('button')) return; // don't hijack button taps
    dragStart.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
    cardRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!drag.active) return;
    setDrag(prev => ({ ...prev, x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }));
  };

  const onPointerUp = () => {
    if (!drag.active) return;
    const finalX = drag.x;
    setDrag({ x: 0, y: 0, active: false });
    if (finalX > SWIPE_THRESHOLD) {
      onSwipeRight?.(); // drag right → save / like
    } else if (finalX < -SWIPE_THRESHOLD) {
      onSwipeLeft?.();  // drag left  → discard
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '420px', margin: '0 auto' }}>

      {/* ── Swipe Hint Labels ───────────────────────────────────── */}
      {isSwipingRight && drag.active && (
        <div style={{
          position: 'absolute', top: 24, left: 20, zIndex: 30,
          background: '#34C759', borderRadius: '14px', padding: '8px 18px',
          fontSize: '16px', fontWeight: '900', color: 'white',
          opacity: dragPct, transform: `scale(${0.8 + 0.2 * dragPct})`,
          boxShadow: '0 4px 16px rgba(52,199,89,0.5)',
          display: 'flex', alignItems: 'center', gap: '6px',
          transition: 'opacity 0.1s ease, transform 0.1s ease'
        }}>
          <Heart size={18} fill="white" /> SAVE
        </div>
      )}
      {isSwipingLeft && drag.active && (
        <div style={{
          position: 'absolute', top: 24, right: 20, zIndex: 30,
          background: '#FF3B30', borderRadius: '14px', padding: '8px 18px',
          fontSize: '16px', fontWeight: '900', color: 'white',
          opacity: dragPct, transform: `scale(${0.8 + 0.2 * dragPct})`,
          boxShadow: '0 4px 16px rgba(255,59,48,0.5)',
          display: 'flex', alignItems: 'center', gap: '6px',
          transition: 'opacity 0.1s ease, transform 0.1s ease'
        }}>
          <X size={18} /> NOPE
        </div>
      )}

      {/* ── Card ────────────────────────────────────────────────── */}
      <div
        ref={cardRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: 'relative',
          height: 'min(500px, calc(100vh - 230px))',
          borderRadius: '28px',
          overflow: 'hidden',

          boxShadow: drag.active
            ? (isSwipingRight ? '0 20px 60px rgba(52,199,89,0.3)' : isSwipingLeft ? '0 20px 60px rgba(255,59,48,0.3)' : '0 20px 40px rgba(0,0,0,0.4)')
            : '0 20px 40px rgba(0, 0, 0, 0.4)',
          background: '#121212',
          border: drag.active
            ? (isSwipingRight ? '2px solid rgba(52,199,89,0.5)' : isSwipingLeft ? '2px solid rgba(255,59,48,0.5)' : '1px solid rgba(255,255,255,0.1)')
            : '1px solid rgba(255, 255, 255, 0.1)',
          transform: cardTransform,
          transition: drag.active ? 'box-shadow 0.1s ease, border-color 0.1s ease' : 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.35s ease',
          cursor: drag.active ? 'grabbing' : 'grab',
          userSelect: 'none',
          touchAction: 'none'   // prevent browser intercepting swipe as scroll
        }}
      >
        {/* Card Image — draggable=false prevents browser native drag ghost on desktop */}
        <img
          src={displayImage}
          alt={currentItem.title}
          draggable={false}
          onDragStart={e => e.preventDefault()}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            filter: isGenerating ? 'brightness(0.65)' : 'none',
            transition: 'filter 0.5s ease',
            userSelect: 'none',
            WebkitUserDrag: 'none',
            pointerEvents: 'none'  // let pointer events bubble to the card div, not the img
          }}
        />

        {/* Generating overlay */}
        {isGenerating && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(135deg, rgba(196,120,90,0.18) 0%, transparent 50%, rgba(196,120,90,0.22) 100%)',
            pointerEvents: 'none', zIndex: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px'
          }}>
            {/* Animated laser scan bar */}
            <div style={{
              position: 'absolute', left: 0, right: 0, height: '3px',
              background: 'linear-gradient(90deg, transparent, #E8A882, #C4785A, transparent)',
              boxShadow: '0 0 15px #E8A882', animation: 'scanline 2.2s linear infinite', top: '20%'
            }} />
            {/* Garment preview pill */}
            <div style={{
              background: 'rgba(18,18,20,0.85)', backdropFilter: 'blur(12px)',
              borderRadius: '20px', padding: '10px 16px',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', gap: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}>
              <img src={currentItem.imageUrl} alt="garment" style={{ width: '44px', height: '56px', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)' }} />
              <div>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>Trying on</p>
                <p style={{ fontSize: '13px', color: 'white', fontWeight: '800', maxWidth: '160px', lineHeight: 1.2 }}>{currentItem.title}</p>
              </div>
            </div>
            {/* Status chip */}
            <div style={{
              background: 'rgba(196,120,90,0.9)', backdropFilter: 'blur(8px)',
              padding: '8px 18px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px',
              border: '1px solid rgba(232,168,130,0.5)', boxShadow: '0 8px 24px rgba(196,120,90,0.3)'
            }}>
              <Cpu size={15} color="white" style={{ animation: 'spin 2s linear infinite' }} />
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>AI STYLING YOUR LOOK…</span>
            </div>
          </div>
        )}

        {/* Top Badge */}
        <div style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          background: isGenerating ? 'rgba(196, 120, 90, 0.9)' : 'rgba(20, 20, 25, 0.85)',
          backdropFilter: 'blur(10px)',
          padding: '6px 14px', borderRadius: '20px', color: 'white',
          fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px',
          border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {isGenerating ? (
            <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /><span>GENERATING…</span></>
          ) : (
            <><Sparkles size={13} color={theme.colors.primaryLight} /><span>TRIALIX AI</span></>
          )}
        </div>

        {/* Swipe colour tint overlay while dragging */}
        {drag.active && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
            background: isSwipingRight
              ? `rgba(52,199,89,${0.15 * dragPct})`
              : isSwipingLeft
                ? `rgba(255,59,48,${0.15 * dragPct})`
                : 'transparent',
            transition: 'background 0.1s ease'
          }} />
        )}

        {/* Card Bottom Overlay */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          background: 'linear-gradient(to top, rgba(10,10,12,0.96) 0%, rgba(10,10,12,0.7) 60%, transparent 100%)',
          padding: '24px 20px', color: 'white'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1.5px', textTransform: 'uppercase', color: theme.colors.accentLight }}>
            {currentItem.brand}
          </span>
          <h2 style={{ fontSize: '24px', fontWeight: '900', marginTop: '2px', marginBottom: '14px', fontFamily: 'Outfit, sans-serif' }}>
            {currentItem.title}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '10px 18px', borderRadius: '16px', fontWeight: '800', fontSize: '16px' }}>
              ₹{currentItem.priceINR || '999'}
            </div>
            {currentItem.buyLink && (
              <a href={currentItem.buyLink} target="_blank" rel="noreferrer noopener"
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1, background: theme.colors.primary, color: 'white', padding: '10px 18px',
                  borderRadius: '16px', textDecoration: 'none', fontWeight: '800', fontSize: '15px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  boxShadow: '0 4px 12px rgba(196,120,90,0.4)', cursor: 'pointer', zIndex: 20, position: 'relative'
                }}>
                <ShoppingBag size={18} /> Buy Now
              </a>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const targetUrl = currentItem.tryOnImageUrl || currentItem.imageUrl;
                if (targetUrl) downloadImageToLocal(targetUrl, `${currentItem.title.replace(/\s+/g, '_')}_look.jpg`);
                onSave?.(currentItem);
              }}
              style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', padding: '8px', borderRadius: '14px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
            >
              <Download size={14} /> Save
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onShare?.(currentItem); }}
              style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', padding: '8px', borderRadius: '14px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
            >
              <Share2 size={14} /> Share
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); !isGenerating && !postingId && onPost?.(currentItem); }}
              disabled={isGenerating || postingId === currentItem.id}
              style={{
                flex: 1,
                background: postingId === currentItem.id ? 'rgba(196,120,90,0.3)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${postingId === currentItem.id ? 'rgba(196,120,90,0.6)' : 'rgba(255,255,255,0.12)'}`,
                color: 'white', padding: '8px', borderRadius: '14px', fontSize: '12px', fontWeight: '700',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                cursor: isGenerating || postingId ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.5 : 1,
              }}
            >
              {postingId === currentItem.id
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Posting…</>
                : <><Send size={14} /> Post</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── 3 Action Buttons ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', marginTop: '16px', padding: '0 10px' }}>
        {/* Swipe hint text */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '-20px', display: 'none' }}></div>

        <button
          onClick={onSwipeLeft}
          title="Discard (swipe left)"
          style={{ width: 58, height: 58, borderRadius: '50%', background: '#121212', border: '2px solid #FF3B30', color: '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s ease', boxShadow: '0 4px 12px rgba(255,59,48,0.2)' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <X size={28} />
        </button>
        <button
          onClick={onSuperLike}
          title="Super Like"
          style={{ width: 52, height: 52, borderRadius: '50%', background: '#121212', border: '2px solid #007AFF', color: '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s ease', boxShadow: '0 4px 12px rgba(0,122,255,0.2)' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Star size={22} fill="#007AFF" />
        </button>
        <button
          onClick={onSwipeRight}
          title="Save to Wishlist (swipe right)"
          style={{ width: 58, height: 58, borderRadius: '50%', background: '#121212', border: '2px solid #34C759', color: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s ease', boxShadow: '0 4px 12px rgba(52,199,89,0.2)' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Heart size={28} fill="#34C759" />
        </button>
      </div>

      {/* Swipe instruction hint */}
      <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: '600', letterSpacing: '0.5px' }}>
        ← Swipe to discard &nbsp;·&nbsp; Swipe to save →
      </div>
    </div>
  );
}
