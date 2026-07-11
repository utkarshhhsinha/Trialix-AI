import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, Heart, Video, User, Shirt, Compass, Plus, Menu, LayoutGrid, Sliders } from 'lucide-react';
import theme from '../theme';

export default function Navigation({ profile, onOpenCustomTryOn, onOpenAIGen }) {
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isDarkPage = true; // Always use premium dark mode on desktop to match screenshot!

  // Desktop Left Sidebar Layout (Instagram Style)
  if (isDesktop) {
    const iconColor = 'white';
    const activeColor = '#C4785A'; 

    return (
      <aside style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: '72px',
        height: '100vh',
        background: '#000000',
        color: 'white',
        borderRight: '1px solid #262626',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10000,
      }}>
        {/* Top Branding Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <NavLink to="/discover" style={{ textDecoration: 'none' }}>
            <img 
              src="/oraneo_logo.jpeg" 
              alt="oraneo" 
              style={{
                width: '32px', 
                height: '32px', 
                borderRadius: '8px', 
                objectFit: 'cover',
                boxShadow: '0 0 10px rgba(196, 120, 90, 0.4)'
              }} 
            />
          </NavLink>
        </div>

        {/* Navigation / Action Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', flex: 1 }}>
          <NavLink
            to="/discover"
            title="Discover"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: isActive ? activeColor : iconColor,
              transition: 'background 0.2s',
            })}
          >
            <Home size={22} />
          </NavLink>

          <NavLink
            to="/community"
            title="Community"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: isActive ? activeColor : iconColor,
              transition: 'background 0.2s',
            })}
          >
            <Video size={22} />
          </NavLink>

          <button
            onClick={onOpenCustomTryOn}
            title="Custom VTON Studio"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'transparent',
              border: 'none',
              color: iconColor,
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <Sliders size={22} />
          </button>

          <NavLink
            to="/explore"
            title="Search"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: isActive ? activeColor : iconColor,
              transition: 'background 0.2s',
            })}
          >
            <Search size={22} />
          </NavLink>

          <NavLink
            to="/explore"
            title="Explore"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: isActive ? activeColor : iconColor,
              transition: 'background 0.2s',
            })}
          >
            <Compass size={22} />
          </NavLink>

          <NavLink
            to="/wishlist"
            title="Wishlist"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: isActive ? activeColor : iconColor,
              transition: 'background 0.2s',
            })}
          >
            <Heart size={22} />
          </NavLink>
        </div>

        {/* Bottom Section: Aura points + profile + menu */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', marginTop: 'auto' }}>
          {/* Aura Points badge */}
          <div style={{
            background: 'rgba(196,120,90,0.15)',
            border: '1px solid rgba(196,120,90,0.4)',
            borderRadius: '12px',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '10px',
            fontWeight: '900',
            color: '#C4785A',
            letterSpacing: '0.3px',
          }}>
            <span style={{ fontSize: '11px' }}>⚡</span>
            {profile?.auraPoints ?? 0}
          </div>

          <NavLink
            to="/profile"
            title="Profile"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: isActive ? `2px solid ${activeColor}` : '2px solid transparent',
              overflow: 'hidden',
              transition: 'border 0.2s',
            })}
          >
            <img 
              src={profile?.basePhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80'} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              alt="Profile"
            />
          </NavLink>

          <NavLink
            to="/discover"
            title="Dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              color: iconColor,
              transition: 'background 0.2s',
            }}
          >
            <LayoutGrid size={22} />
          </NavLink>

          <button
            title="Menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'transparent',
              border: 'none',
              color: iconColor,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <Menu size={22} />
          </button>
        </div>
      </aside>
    );
  }

  // Mobile Bottom Navigation Bar
  const navItems = [
    { path: '/discover', label: 'Discover', icon: Home },
    { path: '/explore', label: 'Explore', icon: Search },
    { path: '/wishlist', label: 'Wishlist', icon: Heart },
    { path: '/community', label: 'Community', icon: Video },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  const isDarkPageMobile = location.pathname === '/discover' || location.pathname === '/community';

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: '480px',
      background: isDarkPageMobile ? 'rgba(18, 18, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(16px)',
      borderTop: `1px solid ${isDarkPageMobile ? 'rgba(255,255,255,0.1)' : theme.colors.border}`,
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '10px 0 14px',
      zIndex: 10000,
    }}>
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        const activeColor = theme.colors.primary;
        const inactiveColor = isDarkPageMobile ? '#888888' : '#A09088';

        return (
          <NavLink
            key={item.path}
            to={item.path}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              textDecoration: 'none',
              flex: 1,
            }}
          >
            <Icon 
              size={24} 
              color={isActive ? activeColor : inactiveColor} 
              strokeWidth={isActive ? 2.5 : 1.8} 
            />
            
            {isActive && (
              <div style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: theme.colors.primary,
                position: 'absolute',
                bottom: '-6px'
              }} />
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
