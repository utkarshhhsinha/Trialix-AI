import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from './lib/firebase';
import { subscribeUserProfile } from './lib/community';
import Navigation from './components/Navigation';
import TrialRoomModal from './components/TrialRoomModal';
import CustomTryOnModal from './components/CustomTryOnModal';

import Login from './pages/Login';
import ProfileSetup from './pages/ProfileSetup';
import Discover from './pages/Discover';
import Community from './pages/Community';
import Explore from './pages/Explore';
import Wishlist from './pages/Wishlist';
import Profile from './pages/Profile';

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [trialItem, setTrialItem] = useState(null);
  const [showCustomTryOn, setShowCustomTryOn] = useState(false);

  useEffect(() => {
    let unsubProfile = null;
    let timeoutId = null;

    const unsubAuth = onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        // Start a 5-second timeout safeguard to prevent splash screen hang
        timeoutId = setTimeout(() => {
          console.warn('[App] Profile subscription timed out. Falling back.');
          setError('Firebase profile loading is taking longer than expected. Proceeding to app...');
          setProfile(null); // Fallback to bypass splash
        }, 5000);

        unsubProfile = subscribeUserProfile(
          u.uid,
          (p) => {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            setProfile(p);
            setError(null);
          },
          (err) => {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            console.error('[App] Profile subscription failed:', err);
            setError(`Firebase Connection Error: ${err.message} (${err.code})`);
            // Fallback so the app doesn't hang on splash
            setProfile(null);
          }
        );
      } else {
        setProfile(null);
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
      }
    });
    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
  }, []);

  const renderProtectedRoute = (element) => {
    if (!user) return <Navigate to="/login" />;
    if (profile === null) return <Navigate to="/profile-setup" />;
    return element;
  };

  if (loading || (profile === undefined && !error)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F4' }}>
        <img src="/oraneo_logo.jpeg" alt="Logo" style={{ width: 64, height: 64, borderRadius: 20, objectFit: 'cover', animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-layout">
        {error && (
          <div style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: '#D93838', color: 'white', padding: '12px 24px', borderRadius: '12px',
            zIndex: 9999, fontWeight: '700', fontSize: '13px', boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
            fontFamily: 'system-ui, sans-serif', textAlign: 'center', border: '1px solid rgba(255,255,255,0.2)'
          }}>
            ⚠️ {error}
          </div>
        )}
        {user && profile !== null && (
          <Navigation 
            profile={profile}
            onOpenCustomTryOn={() => setShowCustomTryOn(true)}
          />
        )}

        <div className={`main-content ${(!user || profile === null) ? 'full-screen-content' : ''}`}>
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/discover" />} />
            <Route path="/profile-setup" element={user ? <ProfileSetup /> : <Navigate to="/login" />} />
            
            <Route path="/discover" element={renderProtectedRoute(<Discover profile={profile} onOpenTrialRoom={setTrialItem} onOpenCustomTryOn={() => setShowCustomTryOn(true)} />)} />
            <Route path="/community" element={renderProtectedRoute(<Community onOpenTrialRoom={setTrialItem} />)} />
            <Route path="/explore" element={renderProtectedRoute(<Explore onOpenTrialRoom={setTrialItem} onOpenCustomTryOn={() => setShowCustomTryOn(true)} />)} />
            <Route path="/wishlist" element={renderProtectedRoute(<Wishlist onOpenTrialRoom={setTrialItem} />)} />
            <Route path="/profile" element={renderProtectedRoute(<Profile onOpenCustomTryOn={() => setShowCustomTryOn(true)} />)} />
            
            <Route path="*" element={<Navigate to={user ? (profile === null ? "/profile-setup" : "/discover") : "/login"} />} />
          </Routes>
        </div>

        {/* Modals */}
        {trialItem && (
          <TrialRoomModal 
            item={trialItem}
            user={user}
            profile={profile}
            onClose={() => setTrialItem(null)}
          />
        )}

        {showCustomTryOn && (
          <CustomTryOnModal onClose={() => setShowCustomTryOn(false)} />
        )}
      </div>
    </BrowserRouter>
  );
}
