import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Share2, Download, Send, CheckCircle, AlertCircle, Upload, User } from 'lucide-react';
import theme from '../theme';
import { runVirtualTryOn } from '../lib/ai_engine';
import { postTryOnToCommunity, downloadTryOnImage, shareTryOnWhatsApp } from '../lib/socialActions';
import { sendWebNotification } from '../lib/notifications';

export default function TrialRoomModal({ item, user, profile, onClose }) {
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('Initializing AI Model…');
  const [resultImage, setResultImage] = useState(null);
  const [error, setError] = useState(null);
  const [posted, setPosted] = useState(false);

  const defaultUserPhoto = profile?.basePhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80';
  const [userPhoto, setUserPhoto] = useState(defaultUserPhoto);
  // Track whether user has manually changed the photo so we don't overwrite it
  const userPhotoChangedRef = useRef(false);

  // Only sync from profile on mount (first load), not on every profile update
  useEffect(() => {
    if (!userPhotoChangedRef.current && profile?.basePhotoUrl) {
      setUserPhoto(profile.basePhotoUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — only run on mount

  const handleRunTryOn = async (overridePhoto = null) => {
    if (!item) return;
    if (item.tryOnImageUrl && (item.tryOnImageUrl.startsWith('data:') || item.tryOnImageUrl.includes('firebasestorage') || item.tryOnImageUrl.includes('storage.googleapis.com'))) {
      setResultImage(item.tryOnImageUrl);
      setLoading(false);
      return;
    }
    const photoToUse = overridePhoto || userPhoto;
    setLoading(true);
    setError(null);
    setStatusText('Fitting garment onto model body…');

    try {
      const result = await runVirtualTryOn(
        photoToUse,
        item.imageUrl,
        item.title,
        (msg) => setStatusText(msg),
        false,
        item.category || 'upper_body'
      );
      setResultImage(result);
      sendWebNotification('Your AI Look is Ready! ✨', `Trialix AI successfully fitted "${item.title}".`);
    } catch (err) {
      setError(err.message || 'AI fitting failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRunTryOn();
  }, [item]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newPhoto = reader.result;
        userPhotoChangedRef.current = true; // prevent profile sync from overwriting
        setUserPhoto(newPhoto);
        handleRunTryOn(newPhoto);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePost = async () => {
    if (!resultImage || !user) return;
    try {
      await postTryOnToCommunity({
        user,
        profile,
        card: {
          title: item.title,
          brand: item.brand,
          tryOnImageUrl: resultImage,
          productImageUrl: item.imageUrl,
          buyLink: item.buyLink,
        }
      });
      setPosted(true);
      sendWebNotification('Posted to Community! 🎉', `Your outfit fitting is now live on the feed.`);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: theme.colors.surface,
        borderRadius: '24px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        border: `1px solid ${theme.colors.border}`,
        padding: '24px'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: theme.colors.bgWarm,
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={20} color={theme.colors.text} />
        </button>

        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px', color: theme.colors.text }}>
          Virtual Trial Room 🪞
        </h3>
        <p style={{ fontSize: '13px', color: theme.colors.textMuted, marginBottom: '16px' }}>
          Dressing your model with <span style={{ fontWeight: '700', color: theme.colors.primary }}>{item?.title}</span>
        </p>

        {/* Model Photo Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: theme.colors.bgWarm, padding: '8px 14px', borderRadius: '16px', marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={userPhoto} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${theme.colors.primary}` }} />
            <span style={{ fontSize: '13px', fontWeight: '700' }}>Active Model Photo</span>
          </div>

          <label className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
            <Upload size={13} /> Change Photo
            <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Display Area */}
        <div style={{
          height: '380px',
          borderRadius: '20px',
          background: '#121212',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'white' }}>
              <Sparkles size={40} color={theme.colors.primary} style={{ animation: 'spin 2s linear infinite' }} />
              <p style={{ marginTop: '16px', fontWeight: '700', color: theme.colors.primaryLight, fontSize: '15px' }}>
                {statusText}
              </p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '20px', color: theme.colors.danger }}>
              <AlertCircle size={40} style={{ marginBottom: '12px' }} />
              <p style={{ fontWeight: '600', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
              <button className="btn-primary" onClick={() => handleRunTryOn()}>Retry Fitting</button>
            </div>
          ) : resultImage ? (
            <img src={resultImage} alt="Try-On Result" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : null}
        </div>

        {/* Controls */}
        {resultImage && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => downloadTryOnImage(resultImage)}
              >
                <Download size={18} /> Download
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => shareTryOnWhatsApp({ imageUrl: resultImage, title: item.title, brand: item.brand })}
              >
                <Share2 size={18} color="#25D366" /> WhatsApp
              </button>
            </div>

            <button 
              className="btn-primary" 
              onClick={handlePost} 
              disabled={posted}
              style={{ opacity: posted ? 0.7 : 1 }}
            >
              {posted ? (
                <>
                  <CheckCircle size={18} /> Posted to Community!
                </>
              ) : (
                <>
                  <Send size={18} /> Post to Community Feed
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
