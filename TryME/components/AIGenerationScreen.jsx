/**
 * AIGenerationScreen.jsx — TrialX AI
 * ─────────────────────────────────────────────
 * Cinematic Speedtest-style AI try-on loader.
 * Circular glow ring + rotating particles + animated copy.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Image, Dimensions, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { theme } from '@/constants/theme';

const { width: W } = Dimensions.get('window');
const RING_SIZE = W * 0.72;
const COPY = theme.aiLoadingCopy;

// ── Orbiting dot component
function OrbitDot({ angle, radius, color, size, duration, delay }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop;
    const startAnim = () => {
      loop = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: duration || 3200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
    };

    const timeout = setTimeout(startAnim, delay || 0);

    return () => {
      clearTimeout(timeout);
      if (loop) loop.stop();
    };
  }, [delay, duration]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.orbitContainer,
        {
          width: radius * 2,
          height: radius * 2,
          left: RING_SIZE / 2 - radius,
          top: RING_SIZE / 2 - radius,
          transform: [{ rotate }],
        },
      ]}
    >
      <View
        style={[
          styles.dot,
          {
            width: size || 8, height: size || 8,
            borderRadius: (size || 8) / 2,
            backgroundColor: color,
            top: 0, left: radius - (size || 8) / 2,
          },
        ]}
      />
    </Animated.View>
  );
}

export default function AIGenerationScreen({ visible, garment }) {
  const [copyIndex, setCopyIndex] = useState(0);

  // Glow pulse animation
  const glowScale = useRef(new Animated.Value(1)).current;
  const innerScale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const copyOpacity = useRef(new Animated.Value(1)).current;

  // Rotate cycling copy
  useEffect(() => {
    if (!visible) return;
    let idx = 0;
    const interval = setInterval(() => {
      // Fade out → change text → fade in
      Animated.timing(copyOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        idx = (idx + 1) % COPY.length;
        setCopyIndex(idx);
        Animated.timing(copyOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 2200);
    return () => clearInterval(interval);
  }, [visible]);

  // Entrance + glow pulse
  useEffect(() => {
    let anim1, anim2;
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      anim1 = Animated.loop(
        Animated.sequence([
          Animated.timing(glowScale, { toValue: 1.08, duration: 1100, useNativeDriver: true }),
          Animated.timing(glowScale, { toValue: 1, duration: 1100, useNativeDriver: true }),
        ])
      );
      anim1.start();
      anim2 = Animated.loop(
        Animated.sequence([
          Animated.timing(innerScale, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(innerScale, { toValue: 0.9, duration: 900, useNativeDriver: true }),
        ])
      );
      anim2.start();
    } else {
      opacity.setValue(0);
    }
    return () => {
      if (anim1) anim1.stop();
      if (anim2) anim2.stop();
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.container, { opacity }]}>
      {/* Background: blurred garment */}
      {garment?.imageUrl && (
        <Image
          source={{ uri: garment.imageUrl }}
          style={StyleSheet.absoluteFillObject}
          blurRadius={40}
          resizeMode="cover"
        />
      )}
      {/* Dark overlay */}
      <View style={[StyleSheet.absoluteFillObject, styles.dimmer]} />

      {/* ── Orbit rings (decorative) */}
      <View style={styles.ringSystem}>
        {/* Outer glow ring */}
        <Animated.View
          style={[
            styles.outerGlowRing,
            { transform: [{ scale: glowScale }] },
          ]}
        />

        {/* Middle AI ring */}
        <View style={styles.midRing} />

        {/* Inner pulse ring */}
        <Animated.View
          style={[
            styles.innerRing,
            { transform: [{ scale: innerScale }] },
          ]}
        />

        {/* Orbiting dots */}
        <OrbitDot radius={RING_SIZE * 0.46} color="#FE3C72" size={10} duration={3000} />
        <OrbitDot radius={RING_SIZE * 0.46} color="#A855F7" size={7} duration={3000} delay={1500} />
        <OrbitDot radius={RING_SIZE * 0.35} color="rgba(255,255,255,0.6)" size={5} duration={2200} />
        <OrbitDot radius={RING_SIZE * 0.35} color="#FE3C72" size={4} duration={2200} delay={1100} />
        <OrbitDot radius={RING_SIZE * 0.25} color="#A855F7" size={6} duration={1800} />

        {/* Center: TrialX logo / garment thumb */}
        <View style={styles.centerCircle}>
          <LinearGradient
            colors={['#1E1E1E', '#2D2D2D']}
            style={StyleSheet.absoluteFillObject}
          />
          {garment?.imageUrl ? (
            <Image source={{ uri: garment.imageUrl }} style={styles.centerImg} />
          ) : (
            <>
              <Text style={styles.centerLogoText}>T</Text>
              <Text style={styles.centerLogoSub}>TrialX</Text>
            </>
          )}
          {/* Pink glow border */}
          <View style={styles.centerBorder} />
        </View>
      </View>

      {/* ── Copy text */}
      <View style={styles.copySection}>
        <Animated.Text style={[styles.copyText, { opacity: copyOpacity }]}>
          {COPY[copyIndex]}
        </Animated.Text>

        {/* Garment info */}
        {garment && (
          <View style={styles.garmentRow}>
            <Image source={{ uri: garment.imageUrl }} style={styles.garmentThumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.garmentBrand} numberOfLines={1}>
                {garment.brand?.toUpperCase()}
              </Text>
              <Text style={styles.garmentTitle} numberOfLines={2}>
                {garment.title}
              </Text>
            </View>
          </View>
        )}

        {/* Progress dots */}
        <View style={styles.progressDots}>
          {[0, 1, 2, 3].map(i => (
            <ProgressDot key={i} delay={i * 220} />
          ))}
        </View>
      </View>

      {/* Bottom label */}
      <Text style={styles.poweredBy}>Powered by TrialX AI  ✦</Text>
    </Animated.View>
  );
}

// Bouncing progress dot
function ProgressDot({ delay }) {
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let anim;
    const startAnim = () => {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(y, { toValue: -7, duration: 350, useNativeDriver: true }),
          Animated.timing(y, { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.delay(400),
        ])
      );
      anim.start();
    };

    const timeout = setTimeout(startAnim, delay || 0);

    return () => {
      clearTimeout(timeout);
      if (anim) anim.stop();
    };
  }, [delay]);

  return (
    <Animated.View
      style={[
        styles.progressDot,
        { transform: [{ translateY: y }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 900,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dimmer: {
    backgroundColor: 'rgba(13,13,13,0.78)',
  },

  ringSystem: {
    width: RING_SIZE, height: RING_SIZE,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },

  outerGlowRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(168,85,247,0.4)',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
  },
  midRing: {
    position: 'absolute',
    top: RING_SIZE * 0.14,
    left: RING_SIZE * 0.14,
    width: RING_SIZE * 0.72, height: RING_SIZE * 0.72,
    borderRadius: RING_SIZE * 0.36,
    borderWidth: 1.5,
    borderColor: 'rgba(254,60,114,0.3)',
  },
  innerRing: {
    position: 'absolute',
    top: RING_SIZE * 0.24,
    left: RING_SIZE * 0.24,
    width: RING_SIZE * 0.52, height: RING_SIZE * 0.52,
    borderRadius: RING_SIZE * 0.26,
    borderWidth: 2,
    borderColor: 'rgba(254,60,114,0.5)',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },

  orbitContainer: {
    position: 'absolute',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  dot: {
    position: 'absolute',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },

  centerCircle: {
    width: RING_SIZE * 0.38, height: RING_SIZE * 0.38,
    borderRadius: RING_SIZE * 0.19,
    overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
  },
  centerImg: {
    width: '100%', height: '100%',
  },
  centerBorder: {
    position: 'absolute',
    width: '100%', height: '100%',
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: '#FE3C72',
  },
  centerLogoText: {
    fontSize: 40, fontWeight: '900', color: '#FE3C72', lineHeight: 44,
  },
  centerLogoSub: {
    fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
  },

  copySection: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  copyText: {
    fontSize: 22, fontWeight: '800', color: 'white',
    textAlign: 'center', lineHeight: 30,
    textShadowColor: 'rgba(254,60,114,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },

  garmentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    padding: 14, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    width: W - 80,
  },
  garmentThumb: { width: 52, height: 66, borderRadius: 10 },
  garmentBrand: {
    fontSize: 10, fontWeight: '800', color: '#FE3C72',
    letterSpacing: 2, marginBottom: 4,
  },
  garmentTitle: {
    fontSize: 14, fontWeight: '700', color: 'white', lineHeight: 19,
  },

  progressDots: {
    flexDirection: 'row', gap: 8, marginTop: 4,
  },
  progressDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FE3C72',
  },

  poweredBy: {
    position: 'absolute', bottom: 52,
    fontSize: 11, color: 'rgba(255,255,255,0.3)',
    fontWeight: '700', letterSpacing: 2,
  },
});
