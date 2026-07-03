/**
 * CardReveal.jsx — oraneo
 *
 * Displays the try-on image for a swipe card:
 *  - While tryOnImageUrl is null: shows the garment placeholder image
 *  - When tryOnImageUrl first arrives (null → URL): fades in the try-on image
 *    over the placeholder with a brief oraneo logo flash
 *  - If tryOnImageUrl is already set on mount: shows it immediately, no animation
 *
 * Kept intentionally simple so it works reliably on all cards in the stack,
 * including off-screen ones that React Native may pause animations on.
 */
import React, { useRef, useEffect, useState } from 'react';
import { View, Image, Animated, StyleSheet, Text } from 'react-native';

const LOGO = require('@/assets/images/logo.png');

export default function CardReveal({ tryOnImageUrl, placeholderSource, style }) {
  const prevUrlRef = useRef(tryOnImageUrl);

  // If the URL is already available when this component first mounts, skip
  // straight to 'revealed' — no animation needed.
  const [phase, setPhase] = useState(tryOnImageUrl ? 'revealed' : 'placeholder');

  const placeholderOpacity = useRef(new Animated.Value(tryOnImageUrl ? 0 : 1)).current;
  const tryOnOpacity = useRef(new Animated.Value(tryOnImageUrl ? 1 : 0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const prev = prevUrlRef.current;
    prevUrlRef.current = tryOnImageUrl;

    // Only animate on the null → URL transition
    if (!prev && tryOnImageUrl) {
      setPhase('logo');

      // Reset values
      logoOpacity.setValue(0);
      tryOnOpacity.setValue(0);

      Animated.sequence([
        // Fade out placeholder
        Animated.timing(placeholderOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        // Flash the logo briefly
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(600),
        // Crossfade: logo out, try-on image in
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(tryOnOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => setPhase('revealed'));
    }
  }, [tryOnImageUrl]);

  return (
    <View style={[styles.container, style]}>
      {/* Garment placeholder — hidden once revealed */}
      {phase !== 'revealed' && (
        <Animated.Image
          source={placeholderSource}
          style={[StyleSheet.absoluteFillObject, { opacity: placeholderOpacity }]}
          resizeMode="cover"
        />
      )}

      {tryOnImageUrl ? (
        <Animated.Image
          source={typeof tryOnImageUrl === 'number' ? tryOnImageUrl : { uri: tryOnImageUrl }}
          style={[StyleSheet.absoluteFillObject, { opacity: tryOnOpacity }]}
          resizeMode="cover"
        />
      ) : null}

      {/* Logo flash — only during transition */}
      {phase === 'logo' && (
        <Animated.View style={[styles.logoOverlay, { opacity: logoOpacity }]}>
          <Image source={LOGO} style={styles.logoImg} resizeMode="contain" />
          <Text style={styles.logoLabel}>
            oraneo
          </Text>
          <Text style={styles.logoSub}>Your look is ready ✨</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111',
  },
  logoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  logoImg: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  logoLabel: {
    fontSize: 26,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 0.5,
  },
  logoAI: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C4785A',
    letterSpacing: 2,
  },
  logoSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
  },
});
