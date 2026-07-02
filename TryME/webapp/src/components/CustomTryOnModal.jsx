import React, { useState } from 'react';
import { X, Upload, Sparkles, AlertCircle, Download } from 'lucide-react';
import theme from '../theme';
import { runVirtualTryOn } from '../lib/ai_engine';

const downloadImageToLocal = async (imageUrl, fileName = 'custom-tryon-look.jpg') => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    console.warn('[Download] Blob fetch failed, falling back to direct open:', err.message);
    window.open(imageUrl, '_blank');
  }
};


export default function CustomTryOnModal({ onClose }) {
  const [modelPhoto, setModelPhoto] = useState(null);
  const [garmentPhoto, setGarmentPhoto] = useState(null);
  const [category, setCategory] = useState('upper_body');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [resultImage, setResultImage] = useState(null);
  const [error, setError] = useState(null);

  const handleFileUpload = (e, setFn) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFn(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!modelPhoto || !garmentPhoto) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runVirtualTryOn(
        modelPhoto,
        garmentPhoto,
        'custom outfit',
        (msg) => setStatusText(msg),
        false,
        category
      );
      if (!res) {
        setError('Generation failed. Please try a different or smaller photo.');
      } else {
        setResultImage(res);
      }
    } catch (err) {
      setError(err.message || 'Custom fitting failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        background: theme.colors.surface,
        borderRadius: '24px',
        width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto',
        position: 'relative', padding: '24px'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: theme.colors.bgWarm, border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer' }}>
          <X size={20} />
        </button>

        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px' }}>Custom VTON Studio 👗</h3>
        <p style={{ fontSize: '13px', color: theme.colors.textMuted, marginBottom: '20px' }}>Upload your photo & any clothing item to fit them together</p>

        {!resultImage ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>1. Person / Model</label>
                <div style={{ height: 160, border: `2px dashed ${theme.colors.border}`, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', background: theme.colors.bgWarm }}>
                  {modelPhoto ? (
                    <img src={modelPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <label style={{ cursor: 'pointer', textAlign: 'center', padding: 10 }}>
                      <Upload size={24} color={theme.colors.primary} />
                      <span style={{ display: 'block', fontSize: 12, marginTop: 4 }}>Choose Photo</span>
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setModelPhoto)} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>2. Garment Item</label>
                <div style={{ height: 160, border: `2px dashed ${theme.colors.border}`, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', background: theme.colors.bgWarm }}>
                  {garmentPhoto ? (
                    <img src={garmentPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <label style={{ cursor: 'pointer', textAlign: 'center', padding: 10 }}>
                      <Upload size={24} color={theme.colors.primary} />
                      <span style={{ display: 'block', fontSize: 12, marginTop: 4 }}>Choose Clothes</span>
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setGarmentPhoto)} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Category</label>
              <select 
                value={category} 
                onChange={e => setCategory(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: `1px solid ${theme.colors.border}`, fontSize: '14px' }}
              >
                <option value="upper_body">Upper Body (Top, Shirt, Jacket)</option>
                <option value="lower_body">Lower Body (Pants, Skirt)</option>
                <option value="dress">Full Outfit / Dress</option>
              </select>
            </div>

            {error && <p style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</p>}

            <button 
              className="btn-primary" 
              onClick={handleGenerate}
              disabled={loading || !modelPhoto || !garmentPhoto}
              style={{ opacity: (!modelPhoto || !garmentPhoto) ? 0.6 : 1 }}
            >
              <Sparkles size={18} />
              <span>{loading ? statusText || 'Fitting Clothes…' : 'Generate Try-On'}</span>
            </button>
          </div>
        ) : (
          <div>
            <div style={{ height: 380, borderRadius: 20, overflow: 'hidden', marginBottom: 20 }}>
              <img src={resultImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <button 
                className="btn-primary" 
                onClick={() => downloadImageToLocal(resultImage)} 
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Download size={18} /> Download Image
              </button>
              
              <button 
                className="btn-secondary" 
                onClick={() => setResultImage(null)} 
                style={{ flex: 1 }}
              >
                Try Another Look
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
