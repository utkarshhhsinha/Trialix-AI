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

  const [trialItem, setTrialItem] = useState(null);
  const [showCustomTryOn, setShowCustomTryOn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        subscribeUserProfile(u.uid, (p) => setProfile(p));
      } else {
        setProfile(null);
      }
    });
    return () => unsub();
  }, []);

  const renderProtectedRoute = (element) => {
    if (!user) return <Navigate to="/login" />;
    if (profile === null) return <Navigate to="/profile-setup" />;
    return element;
  };

  if (loading || profile === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F4' }}>
        <img src="/icon.png" alt="Logo" style={{ width: 64, height: 64, borderRadius: 20, animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-layout">
        {user && (
          <Navigation 
            profile={profile}
            onOpenCustomTryOn={() => setShowCustomTryOn(true)}
          />
        )}

        <div className="main-content">
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
