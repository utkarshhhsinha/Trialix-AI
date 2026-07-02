import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { firestore, firebaseAuth, uploadBase64Image } from '../lib/firebase';
import theme from '../theme';
import { Upload, Check } from 'lucide-react';

export default function ProfileSetup() {
  const user = firebaseAuth?.currentUser;
  const [name, setName] = useState(user?.displayName || '');
  const [gender, setGender] = useState('female');
  const [selectedPersonality, setSelectedPersonality] = useState('clean_girl');
  const getInitialAvatar = () => {
    const photo = user?.photoURL;
    if (photo && !photo.includes('googleusercontent.com') && !photo.includes('accounts.google.com')) {
      return photo;
    }
    return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80';
  };
  const [avatarBase64, setAvatarBase64] = useState(getInitialAvatar());
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatarBase64(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!user) {
      navigate('/discover');
      return;
    }
    setLoading(true);
    try {
      let finalPhotoUrl = avatarBase64;
      if (avatarBase64.startsWith('data:')) {
        finalPhotoUrl = await uploadBase64Image(avatarBase64, 'base-photos', `${user.uid}.jpg`);
        try {
          const cleanB64 = avatarBase64.split('base64,')[1] || avatarBase64;
          localStorage.setItem(`b64_${finalPhotoUrl}`, cleanB64);
        } catch (e) {
          console.warn('[ProfileSetup] LocalStorage caching failed:', e);
        }
      }

      await setDoc(doc(firestore, 'profiles', user.uid), {
        name: name || 'Fashionista',
        gender,
        basePhotoUrl: finalPhotoUrl,
        stylePersonality: selectedPersonality,
        auraPoints: 100,
        tryOnCountToday: 0,
        createdAt: new Date(),
      }, { merge: true });

      navigate('/discover');
    } catch (err) {
      alert('Error saving profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '32px 20px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '26px', fontWeight: '800', marginBottom: '8px' }}>
        Setup Your Style Profile 👗
      </h2>
      <p style={{ color: theme.colors.textMuted, fontSize: '14px', marginBottom: '24px' }}>
        Upload your photo so TrialX AI can fit clothing perfectly on your body
      </p>

      {/* Full Body Warning Tip */}
      <div style={{
        background: 'rgba(196,120,90,0.08)',
        border: `1px dashed ${theme.colors.primary}`,
        borderRadius: '16px',
        padding: '14px 16px',
        marginBottom: '24px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start'
      }}>
        <span style={{ fontSize: '18px' }}>💡</span>
        <div style={{ fontSize: '13px', color: theme.colors.text, lineHeight: 1.4, textAlign: 'left' }}>
          <strong style={{ color: theme.colors.primary }}>Try-On Tip:</strong> Please upload a <strong>standing, full-body photo</strong> facing the camera. Face-only close-ups (like Google profile pictures) will fail to generate fits correctly.
        </div>
      </div>

      {/* Model Photo Upload */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          width: '140px', height: '180px', borderRadius: '24px', margin: '0 auto 12px',
          overflow: 'hidden', border: `3px solid ${theme.colors.primary}`, position: 'relative',
          background: theme.colors.bgWarm, boxShadow: '0 8px 20px rgba(0,0,0,0.08)'
        }}>
          <img src={avatarBase64} alt="Model Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <label className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '12px', cursor: 'pointer' }}>
          <Upload size={14} /> Change Photo
          <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
        </label>
      </div>

      {/* Name Input */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '13px', fontWeight: '700', display: 'block', marginBottom: '8px' }}>Your Name / Handle</label>
        <input 
          type="text" 
          value={name} 
          onChange={e => setName(e.target.value)} 
          placeholder="e.g. Maya Lin"
          style={{
            width: '100%', padding: '14px', borderRadius: '14px', border: `1px solid ${theme.colors.border}`,
            fontSize: '15px', outline: 'none'
          }} 
        />
      </div>

      {/* Gender Picker */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '13px', fontWeight: '700', display: 'block', marginBottom: '10px' }}>I want outfits for…</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setGender('female')}
            style={{
              padding: '14px', borderRadius: '16px',
              border: `2px solid ${gender === 'female' ? theme.colors.primary : theme.colors.border}`,
              background: gender === 'female' ? theme.colors.primaryBg : 'white',
              color: gender === 'female' ? theme.colors.primaryDark : theme.colors.text,
              fontWeight: '800', fontSize: '15px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: gender === 'female' ? '0 4px 12px rgba(196,120,90,0.2)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            👩 Female
          </button>
          <button
            type="button"
            onClick={() => setGender('male')}
            style={{
              padding: '14px', borderRadius: '16px',
              border: `2px solid ${gender === 'male' ? theme.colors.primary : theme.colors.border}`,
              background: gender === 'male' ? theme.colors.primaryBg : 'white',
              color: gender === 'male' ? theme.colors.primaryDark : theme.colors.text,
              fontWeight: '800', fontSize: '15px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: gender === 'male' ? '0 4px 12px rgba(196,120,90,0.2)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            👨 Male
          </button>
        </div>
      </div>

      {/* Style Personality */}
      <div style={{ marginBottom: '32px' }}>
        <label style={{ fontSize: '13px', fontWeight: '700', display: 'block', marginBottom: '12px' }}>Select Style Vibe</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {theme.personalities.map(p => {
            const selected = selectedPersonality === p.id;
            return (
              <div 
                key={p.id} 
                onClick={() => setSelectedPersonality(p.id)}
                style={{
                  padding: '12px 14px', borderRadius: '14px',
                  border: `2px solid ${selected ? theme.colors.primary : theme.colors.border}`,
                  background: selected ? theme.colors.primaryBg : 'white',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: '600' }}>{p.emoji} {p.label}</span>
                {selected && <Check size={16} color={theme.colors.primary} />}
              </div>
            );
          })}
        </div>
      </div>

      <button className="btn-primary" onClick={handleSave} disabled={loading} style={{ width: '100%', padding: '16px' }}>
        <span>{loading ? 'Saving Profile…' : 'Start Fitting Outfits ✨'}</span>
      </button>
    </div>
  );
}
