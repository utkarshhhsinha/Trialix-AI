/**
 * Oraneo — brand mark (uses same asset as home-screen app icon)
 */
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';

const APP_ICON = require('@/assets/images/icon.png');

export default function OraneoLogo({ size = 88, showRing = true }) {
  const radius = showRing ? size * 0.22 : size * 0.2;
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
        },
        showRing && styles.ring,
      ]}
    >
      <Image source={APP_ICON} style={{ width: size, height: size }} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
