import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseAuth, firestore, uploadBase64Image } from '../lib/firebase';
import { subscribeUserProfile, subscribeUserTryOns, subscribeUserCommunityPosts } from '../lib/community';
import theme from '../theme';
import { Edit2, Heart, Image as ImageIcon, Video, X, Upload, Check, LogOut, Sliders, ChevronRight } from 'lucide-react';


export default function Profile({ onOpenCustomTryOn }) {
  const user = firebaseAuth?.currentUser;
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [tryOns, setTryOns] = useState([]);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('tryons');

  // Edit Profile Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGender, setEditGender] = useState('female');
  const [editPhoto, setEditPhoto] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !firestore) return;
    const unsubProfile = subscribeUserProfile(user.uid, d => {
      if (d) {
        setProfile(d);
        setEditName(d.name || '');
        setEditPhone(d.phone || '');
        setEditGender((d.gender || 'female').toLowerCase());
        setEditPhoto(d.basePhotoUrl || '');
      }
    });
    const unsubTryOns = subscribeUserTryOns(user.uid, data => setTryOns(data));
    const unsubCommunity = subscribeUserCommunityPosts(user.uid, data => setCommunityPosts(data));
    return () => {
      unsubProfile?.();
      unsubTryOns?.();
      unsubCommunity?.();
    };
  }, [user]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setEditPhoto(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !firestore) return;
    setSaving(true);
    try {
      let finalPhotoUrl = editPhoto;
      if (editPhoto && editPhoto.startsWith('data:')) {
        finalPhotoUrl = await uploadBase64Image(editPhoto, 'base-photos', `${user.uid}.jpg`);
        try {
          const cleanB64 = editPhoto.split('base64,')[1] || editPhoto;
          localStorage.setItem(`b64_${finalPhotoUrl}`, cleanB64);
        } catch (e) {
          console.warn('[Profile] LocalStorage caching failed:', e);
        }
      }

      await setDoc(doc(firestore, 'profiles', user.uid), {
        name: editName,
        phone: editPhone,
        gender: editGender,
        basePhotoUrl: finalPhotoUrl,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setShowEditModal(false);
    } catch (err) {
      alert('Failed to save profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(firebaseAuth);
    navigate('/login');
  };

  if (!user) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p>Please sign in to view your profile.</p>
        <button className="btn-primary" onClick={() => navigate('/login')} style={{ marginTop: 16 }}>Sign In</button>
      </div>
    );
  }

  const activeGridData = activeTab === 'tryons' ? tryOns : communityPosts;

  return (
    <div style={{ padding: '20px 16px 90px', background: theme.colors.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '28px', fontWeight: '900', color: theme.colors.text }}>
          Style ID
        </h1>
        <button 
          onClick={() => setShowEditModal(true)}
          style={{
            background: 'white', border: `1px solid ${theme.colors.border}`, padding: '6px 16px',
            borderRadius: '20px', fontSize: '13px', fontWeight: '700', color: theme.colors.primary,
            display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
          }}
        >
          <Edit2 size={13} /> Edit
        </button>
      </div>

      {/* User Info Row */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{
          width: 84, height: 84, borderRadius: '50%', padding: '3px',
          background: 'linear-gradient(135deg, #FF6B6B, #FFA07A)', flexShrink: 0
        }}>
          <img 
            src={profile?.basePhotoUrl || user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80'} 
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid white' }} 
          />
        </div>

        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: theme.colors.text, fontFamily: 'Outfit, sans-serif' }}>
            {profile?.name || user.displayName || 'Fashionista'}
          </h2>
          <p style={{ fontSize: '13px', color: theme.colors.textMuted, marginTop: '2px' }}>
            {user?.email || 'sinhau916@gmail.com'}
          </p>

          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: theme.colors.primaryLight, color: theme.colors.primaryDark,
              padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800'
            }}>
              <Heart size={11} fill={theme.colors.primaryDark} /> {profile?.rank || 'STYLE ROOKIE'}
            </div>
            
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: theme.colors.bgWarm, color: theme.colors.text, border: `1px solid ${theme.colors.border}`,
              padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', textTransform: 'capitalize'
            }}>
              {profile?.gender === 'male' ? '👨 Male Model' : '👩 Female Model'}
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: '13px', color: theme.colors.textMuted, lineHeight: 1.4, marginBottom: '20px' }}>
        Auto-generation target: <strong>{(profile?.gender || 'female').toUpperCase()}</strong> outfits. {communityPosts.length} posts · {tryOns.length} try-ons.
      </p>

      {/* 4-Column Stats Card */}
      <div style={{
        background: 'white', borderRadius: '24px', padding: '16px 12px',
        border: `1px solid ${theme.colors.border}`, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        textAlign: 'center', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        <div>
          <span style={{ display: 'block', fontSize: '20px', fontWeight: '900', color: '#1A1A1A' }}>{tryOns.length}</span>
          <span style={{ fontSize: '12px', color: theme.colors.textMuted, fontWeight: '600' }}>Tries</span>
        </div>
        <div style={{ borderLeft: `1px solid ${theme.colors.borderLight}` }}>
          <span style={{ display: 'block', fontSize: '20px', fontWeight: '900', color: '#1A1A1A' }}>{communityPosts.length}</span>
          <span style={{ fontSize: '12px', color: theme.colors.textMuted, fontWeight: '600' }}>Posts</span>
        </div>
        <div style={{ borderLeft: `1px solid ${theme.colors.borderLight}` }}>
          <span style={{ display: 'block', fontSize: '20px', fontWeight: '900', color: '#1A1A1A' }}>🔥 {profile?.streak || 0}</span>
          <span style={{ fontSize: '12px', color: theme.colors.textMuted, fontWeight: '600' }}>Streak</span>
        </div>
        <div style={{ borderLeft: `1px solid ${theme.colors.borderLight}` }}>
          <span style={{ display: 'block', fontSize: '20px', fontWeight: '900', color: '#1A1A1A' }}>{profile?.auraPoints || 50}</span>
          <span style={{ fontSize: '12px', color: theme.colors.textMuted, fontWeight: '600' }}>Aura</span>
        </div>
      </div>

        {/* STYLE WALLET Section — Aura Points only */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', color: theme.colors.textMuted, marginBottom: '12px' }}>
          STYLE WALLET
        </h3>

        <div style={{
          background: 'linear-gradient(135deg, #FDF2EC 0%, #FFF8F5 100%)',
          border: `1px solid ${theme.colors.primaryLight}`,
          borderRadius: '20px', padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(196,120,90,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg, #C4785A, #E8A882)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(196,120,90,0.35)'
            }}>
              <span style={{ fontSize: '22px' }}>✨</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '28px', fontWeight: '900', color: '#1A1A1A', lineHeight: 1 }}>
                {profile?.auraPoints || 50}
              </span>
              <span style={{ fontSize: '11px', fontWeight: '800', color: theme.colors.primary, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Aura Points
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: theme.colors.textMuted, display: 'block', marginBottom: '2px' }}>Your rank</span>
            <span style={{ fontSize: '13px', fontWeight: '800', color: theme.colors.primaryDark }}>
              {profile?.rank || 'STYLE ROOKIE'}
            </span>
          </div>
        </div>
      </div>

      {/* STUDIO TOOLS Section */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', color: theme.colors.textMuted, marginBottom: '12px' }}>
          STUDIO TOOLS
        </h3>

        <div 
          onClick={onOpenCustomTryOn}
          style={{
            background: 'linear-gradient(135deg, #F5F3FF 0%, #FAF8FF 100%)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            borderRadius: '20px', padding: '20px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.08)',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(139, 92, 246, 0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.08)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.35)'
            }}>
              <Sliders size={22} color="white" />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '17px', fontWeight: '900', color: '#1A1A1A', marginBottom: '2px', fontFamily: 'Outfit, sans-serif' }}>
                Custom VTON Studio
              </span>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#6D28D9', display: 'block', lineHeight: 1.2 }}>
                Try on any garment of your choice instantly
              </span>
            </div>
          </div>
          <ChevronRight size={20} color="#8B5CF6" />
        </div>
      </div>


      {/* Sub-tab Pill Toggle Container */}
      <div style={{
        background: theme.colors.bgWarm, padding: '4px', borderRadius: '24px',
        display: 'flex', gap: '4px', marginBottom: '20px'
      }}>
        <button 
          onClick={() => setActiveTab('tryons')}
          style={{
            flex: 1, padding: '10px', borderRadius: '20px', border: 'none',
            background: activeTab === 'tryons' ? 'white' : 'transparent',
            color: activeTab === 'tryons' ? theme.colors.text : theme.colors.textMuted,
            fontWeight: '800', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            boxShadow: activeTab === 'tryons' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer'
          }}
        >
          <ImageIcon size={16} color={activeTab === 'tryons' ? theme.colors.primary : theme.colors.textMuted} /> Try-Ons ({tryOns.length})
        </button>
        <button 
          onClick={() => setActiveTab('community')}
          style={{
            flex: 1, padding: '10px', borderRadius: '20px', border: 'none',
            background: activeTab === 'community' ? 'white' : 'transparent',
            color: activeTab === 'community' ? theme.colors.text : theme.colors.textMuted,
            fontWeight: '800', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            boxShadow: activeTab === 'community' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer'
          }}
        >
          <Video size={16} color={activeTab === 'community' ? theme.colors.primary : theme.colors.textMuted} /> Community ({communityPosts.length})
        </button>
      </div>

      {/* Grid of Results */}
      {activeGridData.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 20, padding: 30, textAlign: 'center', border: `1px solid ${theme.colors.border}`, color: theme.colors.textMuted, fontSize: 13 }}>
          No {activeTab === 'tryons' ? 'try-ons' : 'community posts'} saved yet!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
          {activeGridData.map(item => (
            <div key={item.id} style={{
              height: '240px', borderRadius: '24px', overflow: 'hidden', position: 'relative',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: theme.colors.bgWarm
            }}>
              <img src={item.resultImageUrl || item.tryOnImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{
                position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                color: 'white', padding: '3px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '800'
              }}>
                AI FIT
              </div>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)', color: 'white'
              }}>
                <span style={{ fontSize: '9px', fontWeight: '800', opacity: 0.9, letterSpacing: '0.5px' }}>{item.brand || 'oraneo Brand'}</span>
                <h5 style={{ fontSize: '12px', fontWeight: '800', marginTop: '1px' }}>{item.garmentDesc || item.title || 'Outfit'}</h5>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="btn-secondary" onClick={handleSignOut} style={{ width: '100%', color: theme.colors.danger, borderColor: theme.colors.dangerLight }}>
        <LogOut size={18} /> Sign Out
      </button>

      {/* Edit Profile Real-Time Modal */}
      {showEditModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 3000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{ background: 'white', borderRadius: 24, padding: 24, width: '100%', maxWidth: 460, position: 'relative' }}>
            <button onClick={() => setShowEditModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: theme.colors.bgWarm, border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer' }}>
              <X size={20} />
            </button>

            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Edit Profile ✏️</h3>
            <p style={{ fontSize: 13, color: theme.colors.textMuted, marginBottom: 16 }}>Update details & gender for auto-generating outfits</p>

            {/* Full Body Warning Tip */}
            <div style={{
              background: 'rgba(196,120,90,0.08)',
              border: `1px dashed ${theme.colors.primary}`,
              borderRadius: '16px',
              padding: '12px 14px',
              marginBottom: '16px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start'
            }}>
              <span style={{ fontSize: '16px' }}>💡</span>
              <div style={{ fontSize: '12px', color: theme.colors.text, lineHeight: 1.3, textAlign: 'left' }}>
                <strong style={{ color: theme.colors.primary }}>Try-On Tip:</strong> Please upload a <strong>standing, full-body photo</strong>. Face-only close-ups (like Google profile pictures) will fail to generate fits correctly.
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 100, height: 100, borderRadius: '50%', margin: '0 auto 10px', overflow: 'hidden', border: `3px solid ${theme.colors.primary}` }}>
                <img src={editPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <label className="btn-secondary" style={{ padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                <Upload size={14} /> Upload New Model Photo
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Full Name</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${theme.colors.border}`, fontSize: 14 }} />
              </div>

              {/* Gender Selector for Auto-Generating Images */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Generating Image Target (Gender)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button 
                    type="button"
                    onClick={() => setEditGender('female')}
                    style={{
                      padding: '12px', borderRadius: 14, border: `2px solid ${editGender === 'female' ? theme.colors.primary : theme.colors.border}`,
                      background: editGender === 'female' ? theme.colors.primaryBg : 'white',
                      color: editGender === 'female' ? theme.colors.primaryDark : theme.colors.text,
                      fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    👩 Female Outfits
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEditGender('male')}
                    style={{
                      padding: '12px', borderRadius: 14, border: `2px solid ${editGender === 'male' ? theme.colors.primary : theme.colors.border}`,
                      background: editGender === 'male' ? theme.colors.primaryBg : 'white',
                      color: editGender === 'male' ? theme.colors.primaryDark : theme.colors.text,
                      fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    👨 Male Outfits
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Phone Number</label>
                <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+91 9876543210" style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${theme.colors.border}`, fontSize: 14 }} />
              </div>
            </div>

            <button className="btn-primary" onClick={handleSaveProfile} disabled={saving} style={{ width: '100%' }}>
              <Check size={18} /> {saving ? 'Saving Real-Time…' : 'Save Profile & Auto-Generate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
