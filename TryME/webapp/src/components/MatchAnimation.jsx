import React, { useEffect, useState } from 'react';
import { Sparkles, Heart } from 'lucide-react';
import theme from '../theme';

const MATCH_PHRASES = [
  "This look has your name written all over it.",
  "Perfect addition to your digital wardrobe.",
  "AI predicts this will look spectacular on you.",
  "A match made in fashion heaven.",
  "Clean aesthetic. Zero notes."
];

export default function MatchAnimation({ visible, garment, userPhotoUrl, onTryOn, onClose }) {
  const [show, setShow] = useState(false);
  const [copy, setCopy] = useState('');

  useEffect(() => {
    if (visible) {
      setShow(true);
      setCopy(MATCH_PHRASES[Math.floor(Math.random() * MATCH_PHRASES.length)]);
    } else {
      setShow(false);
    }
  }, [visible]);

  if (!show || !garment) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 10, 12, 0.95)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      color: 'white',
      animation: 'fadeIn 0.4s ease-out'
    }}>
      {/* Decorative Glow ring behind text */}
      <div style={{
        position: 'absolute',
        width: '320px',
        height: '320px',
        borderRadius: '50%',
        background: 'rgba(196, 120, 90, 0.15)',
        filter: 'blur(50px)',
        zIndex: 1,
        animation: 'pulseGlow 2s infinite ease-in-out'
      }} />

      {/* MATCH Title */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '36px',
        zIndex: 2,
        animation: 'scaleUpText 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        <Sparkles size={32} color={theme.colors.primary} />
        <h2 style={{
          fontFamily: 'Outfit, sans-serif',
          fontSize: '36px',
          fontWeight: '900',
          letterSpacing: '4px',
          color: '#FFFFFF',
          textShadow: '0 0 20px rgba(196, 120, 90, 0.4)',
          margin: 0
        }}>
          IT'S A MATCH
        </h2>
        <Sparkles size={32} color={theme.colors.primary} />
      </div>

      {/* Avatars Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        marginBottom: '32px',
        zIndex: 2,
        animation: 'slideUpAvatars 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        {/* User photo */}
        <div style={{ position: 'relative', width: '100px', height: '100px' }}>
          <img
            src={userPhotoUrl}
            alt="You"
            style={{
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: `3px solid ${theme.colors.primary}`,
              position: 'relative',
              zIndex: 2
            }}
          />
          <div style={{
            position: 'absolute',
            top: '-5px', left: '-5px', right: '-5px', bottom: '-5px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryLight})`,
            opacity: 0.6,
            zIndex: 1
          }} />
        </div>

        {/* Heart bubble */}
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          background: 'rgba(196, 120, 90, 0.15)',
          border: `1.5px solid ${theme.colors.primary}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(196, 120, 90, 0.3)',
          animation: 'bounceHeart 1.5s infinite ease-in-out'
        }}>
          <Heart size={26} color={theme.colors.primary} fill={theme.colors.primary} />
        </div>

        {/* Garment photo */}
        <div style={{ position: 'relative', width: '100px', height: '100px' }}>
          <img
            src={garment.imageUrl}
            alt="Garment"
            style={{
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: `3px solid ${theme.colors.primaryLight}`,
              position: 'relative',
              zIndex: 2
            }}
          />
          <div style={{
            position: 'absolute',
            top: '-5px', left: '-5px', right: '-5px', bottom: '-5px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${theme.colors.primaryLight}, ${theme.colors.accent || '#C4785A'})`,
            opacity: 0.6,
            zIndex: 1
          }} />
        </div>
      </div>

      {/* Match description */}
      <p style={{
        fontSize: '16px',
        color: '#E0D8D5',
        fontWeight: '600',
        fontStyle: 'italic',
        textAlign: 'center',
        padding: '0 24px',
        marginBottom: '20px',
        zIndex: 2,
        maxWidth: '320px',
        lineHeight: 1.4
      }}>
        "{copy}"
      </p>

      {/* Garment details */}
      <div style={{
        textAlign: 'center',
        marginBottom: '44px',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: '800',
          color: theme.colors.primaryLight,
          letterSpacing: '2.5px',
          textTransform: 'uppercase'
        }}>
          {garment.brand}
        </span>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '900',
          color: 'white',
          margin: 0
        }}>
          {garment.title}
        </h3>
        <span style={{
          fontSize: '16px',
          fontWeight: '700',
          color: '#AAA'
        }}>
          ₹{garment.priceINR || garment.price}
        </span>
      </div>

      {/* CTA Buttons */}
      <div style={{
        display: 'flex',
        gap: '14px',
        width: '100%',
        maxWidth: '340px',
        zIndex: 2
      }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            background: '#FFFFFF',
            color: '#7A6055',
            border: 'none',
            borderRadius: '16px',
            height: '52px',
            fontWeight: '700',
            fontSize: '15px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'opacity 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = 0.9}
          onMouseOut={(e) => e.currentTarget.style.opacity = 1}
        >
          Save for Later
        </button>

        <button
          onClick={onTryOn}
          style={{
            flex: 1.5,
            background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.primaryLight})`,
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '16px',
            height: '52px',
            fontWeight: '800',
            fontSize: '15px',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(196, 120, 90, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'opacity 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = 0.9}
          onMouseOut={(e) => e.currentTarget.style.opacity = 1}
        >
          ✨ Try It On
        </button>
      </div>
    </div>
  );
}
