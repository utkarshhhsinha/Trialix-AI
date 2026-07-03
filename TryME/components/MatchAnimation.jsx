/**
 * MatchAnimation.jsx — oraneo
 * ─────────────────────────────────────
 * Full-screen "IT'S A MATCH" overlay after right swipe.
 * Tinder-inspired with dark luxury aesthetic.
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Pressable, Image, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { theme } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');

// Random match copy from theme
function randomMatchCopy() {
  const c = theme.matchCopy;
  return c[Math.floor(Math.random() * c.length)];
}

export default function MatchAnimation({ visible, garment, userPhotoUrl, onTryOn, onSaveLater }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scaleText = useRef(new Animated.Value(0.5)).current;
  const slideCard = useRef(new Animated.Value(60)).current;
  const glowPulse = useRef(new Animated.Value(1)).current;
  const matchCopy = useRef(randomMatchCopy()).current;

  useEffect(() => {
    let glowAnim;
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Entrance sequence
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.parallel([
          Animated.spring(scaleText, {
            toValue: 1, friction: 4, tension: 140, useNativeDriver: true,
          }),
          Animated.timing(slideCard, {
            toValue: 0, duration: 400, useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Glow pulse loop
      glowAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: 1.15, duration: 900, useNativeDriver: true }),
          Animated.timing(glowPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      glowAnim.start();
    } else {
      opacity.setValue(0);
      scaleText.setValue(0.5);
      slideCard.setValue(60);
      glowPulse.setValue(1);
    }
    return () => {
      if (glowAnim) glowAnim.stop();
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.container, { opacity }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFillObject} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(250,247,244,0.7)' }]} />
      )}

      {/* Warm cream gradient overlay */}
      <LinearGradient
        colors={['rgba(250,247,244,0.9)', 'rgba(245,237,228,0.98)']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Glow ring behind text */}
      <Animated.View
        style={[
          styles.glowRing,
          { transform: [{ scale: glowPulse }] },
        ]}
      />

      {/* MATCH text */}
      <Animated.View style={[styles.centerContent, { transform: [{ scale: scaleText }] }]}>
        <Text style={styles.sparkle}>✨</Text>
        <Text style={styles.matchLabel}>IT'S A MATCH</Text>
        <Text style={styles.sparkle}>✨</Text>
      </Animated.View>

      {/* Outfit + User avatars */}
      <Animated.View
        style={[
          styles.avatarRow,
          { transform: [{ translateY: slideCard }] },
        ]}
      >
        {/* User avatar */}
        <View style={styles.avatarWrap}>
          {userPhotoUrl ? (
            <Image source={{ uri: userPhotoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>YOU</Text>
            </View>
          )}
          <LinearGradient
            colors={theme.colors.gradientPrimary}
            style={styles.avatarRing}
          />
        </View>

        {/* Heart */}
        <View style={styles.heartBubble}>
          <Text style={styles.heartEmoji}>❤️</Text>
        </View>

        {/* Garment avatar */}
        <View style={styles.avatarWrap}>
          {garment?.imageUrl ? (
            <Image source={{ uri: garment.imageUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>FIT</Text>
            </View>
          )}
          <LinearGradient
            colors={theme.colors.gradientAccent}
            style={styles.avatarRing}
          />
        </View>
      </Animated.View>

      {/* Match copy */}
      <Animated.Text
        style={[
          styles.matchCopy,
          { opacity: slideCard.interpolate({ inputRange: [0, 60], outputRange: [1, 0] }) },
        ]}
      >
        "{matchCopy}"
      </Animated.Text>

      {/* Garment info */}
      {garment && (
        <Animated.View
          style={[
            styles.garmentInfo,
            { opacity: slideCard.interpolate({ inputRange: [0, 60], outputRange: [1, 0] }) },
          ]}
        >
          <Text style={styles.garmentBrand}>{garment.brand?.toUpperCase()}</Text>
          <Text style={styles.garmentName}>{garment.title}</Text>
          <Text style={styles.garmentPrice}>₹{garment.priceINR}</Text>
        </Animated.View>
      )}

      {/* CTA Buttons */}
      <Animated.View
        style={[
          styles.ctaRow,
          { transform: [{ translateY: slideCard }] },
        ]}
      >
        <Pressable style={styles.ctaSecondary} onPress={onSaveLater}>
          <Text style={styles.ctaSecondaryText}>Save for Later</Text>
        </Pressable>
        <Pressable style={styles.ctaPrimary} onPress={onTryOn}>
          <LinearGradient
            colors={theme.colors.gradientPrimary}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.ctaPrimaryGradient}
          >
            <Text style={styles.ctaPrimaryText}>✨  Try It On</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },

  glowRing: {
    position: 'absolute',
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(196,120,90,0.2)',
    shadowColor: '#C4785A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 60,
    elevation: 0,
  },

  centerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  sparkle: { fontSize: 36 },
  matchLabel: {
    fontSize: 38,
    fontWeight: '900',
    color: '#2A1F1A',
    letterSpacing: 3,
    textAlign: 'center',
    textShadowColor: 'rgba(196,120,90,0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  avatarWrap: {
    width: 96, height: 96,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: '#FAF7F4',
  },
  avatarFallback: {
    justifyContent: 'center', alignItems: 'center',
  },
  avatarFallbackText: {
    color: '#2A1F1A', fontWeight: '800', fontSize: 16,
  },
  avatarRing: {
    position: 'absolute',
    width: 96, height: 96, borderRadius: 48,
    opacity: 0.7,
  },

  heartBubble: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(196,120,90,0.12)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EDD5B0',
  },
  heartEmoji: { fontSize: 22 },

  matchCopy: {
    fontSize: 16, color: '#7A6055',
    fontWeight: '600', fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 20,
  },

  garmentInfo: {
    alignItems: 'center',
    marginBottom: 36,
    gap: 4,
  },
  garmentBrand: {
    fontSize: 11, fontWeight: '800', color: '#C4785A',
    letterSpacing: 2.5,
  },
  garmentName: {
    fontSize: 18, fontWeight: '800', color: '#2A1F1A', textAlign: 'center',
  },
  garmentPrice: {
    fontSize: 15, fontWeight: '700', color: '#7A6055',
  },

  ctaRow: {
    position: 'absolute',
    bottom: 60,
    left: 24, right: 24,
    flexDirection: 'row',
    gap: 12,
  },
  ctaSecondary: {
    flex: 1, height: 54, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#EDE0D4',
    backgroundColor: '#FFFFFF',
  },
  ctaSecondaryText: { color: '#7A6055', fontWeight: '700', fontSize: 15 },
  ctaPrimary: {
    flex: 1.6, height: 54, borderRadius: 18, overflow: 'hidden',
    shadowColor: '#C4785A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 14, elevation: 8,
  },
  ctaPrimaryGradient: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  ctaPrimaryText: { color: 'white', fontWeight: '800', fontSize: 16 },
});
