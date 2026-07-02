import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import theme from '../theme';

export default function AIGenerationModal({ onClose, onApplyToTryOn }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);

  const presets = [
    "Emerald green silk saree with gold embroidery",
    "Cyberpunk oversized black hoodie with neon graphics",
    "Minimalist beige oversized linen blazer",
    "Y2K vintage pink crop jacket"
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    // Simulating vertex image prompt generation
    setTimeout(() => {
      setGeneratedImage('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80');
      setLoading(false);
    }, 2500);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)',
      zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        background: theme.colors.surface, borderRadius: '24px', width: '100%', maxWidth: '500px',
        position: 'relative', padding: '24px'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: theme.colors.bgWarm, border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer' }}>
          <X size={20} />
        </button>

        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px' }}>AI Fashion Generator ✨</h3>
        <p style={{ fontSize: '13px', color: theme.colors.textMuted, marginBottom: '20px' }}>Describe any clothing item to design it with AI</p>

        <textarea 
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="e.g. Vintage leather biker jacket with silver zippers..."
          style={{
            width: '100%', height: '100px', padding: '14px', borderRadius: '16px',
            border: `1px solid ${theme.colors.border}`, fontSize: '14px', fontFamily: 'inherit',
            resize: 'none', marginBottom: '12px'
          }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
          {presets.map((p, idx) => (
            <button 
              key={idx} 
              onClick={() => setPrompt(p)}
              style={{
                background: theme.colors.bgWarm, border: 'none', padding: '6px 12px',
                borderRadius: '12px', fontSize: '12px', color: theme.colors.textSecondary, cursor: 'pointer'
              }}
            >
              + {p.slice(0, 24)}…
            </button>
          ))}
        </div>

        {generatedImage && (
          <div style={{ height: 260, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
            <img src={generatedImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        <button 
          className="btn-primary" 
          onClick={handleGenerate} 
          disabled={loading || !prompt.trim()}
          style={{ width: '100%' }}
        >
          <Sparkles size={18} />
          <span>{loading ? 'Designing Garment…' : generatedImage ? 'Regenerate Design' : 'Generate Outfit'}</span>
        </button>
      </div>
    </div>
  );
}
