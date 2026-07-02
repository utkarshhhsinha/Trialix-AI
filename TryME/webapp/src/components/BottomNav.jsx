import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, Heart, Video, User } from 'lucide-react';
import theme from '../theme';

export default function BottomNav() {
  const location = useLocation();
  const navItems = [
    { path: '/discover', label: 'Discover', icon: Home },
    { path: '/explore', label: 'Explore', icon: Search },
    { path: '/wishlist', label: 'Wishlist', icon: Heart },
    { path: '/community', label: 'Community', icon: Video },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  // Dark background on Discover and Community pages to match screenshot!
  const isDarkPage = location.pathname === '/discover' || location.pathname === '/community';

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: '480px',
      background: isDarkPage ? 'rgba(18, 18, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(16px)',
      borderTop: `1px solid ${isDarkPage ? 'rgba(255,255,255,0.1)' : theme.colors.border}`,
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '10px 0 14px',
      zIndex: 1000,
    }}>
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        const activeColor = theme.colors.primary;
        const inactiveColor = isDarkPage ? '#888888' : '#A09088';

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
            
            {/* Active Orange Dot below icon */}
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
