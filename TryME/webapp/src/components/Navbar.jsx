import React from 'react';
import { Sparkles, Shirt, PlusCircle } from 'lucide-react';
import theme from '../theme';

export default function Navbar({ profile, onOpenTrialRoom, onOpenCustomTryOn, onOpenAIGen }) {
  return (
    <header style={{
      background: 'rgba(250, 247, 244, 0.9)',
      backdropFilter: 'blur(10px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      borderBottom: `1px solid ${theme.colors.border}`,
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '800',
          fontSize: '18px',
          boxShadow: '0 4px 10px rgba(196,120,90,0.3)'
        }}>
          T
        </div>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '20px', fontWeight: '800', color: theme.colors.text }}>
            TrialX <span style={{ color: theme.colors.primary }}>AI</span>
          </h1>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {profile && (
          <div style={{
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '600',
            color: theme.colors.accent,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            ✨ {profile.auraPoints || 0} Aura
          </div>
        )}

        <button 
          onClick={onOpenCustomTryOn}
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '12px' }}
          title="Custom VTON Studio"
        >
          <Shirt size={16} color={theme.colors.primary} />
          <span className="desktop-only">Custom Studio</span>
        </button>

        <button 
          onClick={onOpenAIGen}
          className="btn-primary"
          style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '12px' }}
        >
          <Sparkles size={16} />
          <span>AI Generator</span>
        </button>
      </div>
    </header>
  );
}
