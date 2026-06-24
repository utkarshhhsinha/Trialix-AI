/**
 * SwipeDeck.jsx — TrialX AI v5.0
 * Tinder-style card deck with:
 * - Swipe RIGHT → match (onSwipeRight)
 * - Swipe LEFT  → skip (onSwipeLeft)
 * - Swipe UP    → save to moodboard (onSwipeUp)
 * - Double tap  → instant wishlist burst
 * - Long press  → details (handled by parent card via Pressable)
 * - HOT / SKIP overlay badges (colored, angled)
 */

import React, { useRef, useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { View, Animated, PanResponder, StyleSheet, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';

const { width: W, height: H } = Dimensions.get('window');
const SWIPE_H = W * 0.28;     // Horizontal threshold
const SWIPE_V = H * 0.18;     // Vertical threshold (up swipe)
const VELOCITY_THRESHOLD = 0.35;

const SwipeDeck = forwardRef(({
  cards = [],
  renderCard,
  onSwipeRight,
  onSwipeLeft,
  onSwipeUp,
  stackSize = 3,
  overlayLabels = { right: '✨ TRY ON', left: '✕ SKIP', up: '📌 SAVE' },
  cardVersion = 0,   // bump this to force top-card re-render when card data changes
}, ref) => {
  const [topIndex, setTopIndex] = useState(0);
  const position = useRef(new Animated.ValueXY()).current;
  const hapticFired = useRef(false);
  const lastTap = useRef(0);
  const swipeHistory = useRef([]);

  useEffect(() => {
    swipeHistory.current = [];
  }, [cards]);

  // Stale closure fix: Store parameters in ref updated every render
  const stateRef = useRef({ topIndex, cards, onSwipeRight, onSwipeLeft, onSwipeUp });
  useEffect(() => {
    stateRef.current = { topIndex, cards, onSwipeRight, onSwipeLeft, onSwipeUp };
  }, [topIndex, cards, onSwipeRight, onSwipeLeft, onSwipeUp]);

  useImperativeHandle(ref, () => ({
    swipeLeft: () => animateSwipe('left'),
    swipeRight: () => animateSwipe('right'),
    swipeUp: () => animateSwipe('up'),
    undo: () => {
      const { topIndex: curIdx, cards: currentCards } = stateRef.current;
      if (curIdx > 0 && swipeHistory.current.length > 0) {
        const prevIdx = curIdx - 1;
        const lastDirection = swipeHistory.current.pop() || 'left';

        // Position card far away in the direction it swiped off
        const startX = lastDirection === 'right' ? W * 1.5 : lastDirection === 'left' ? -W * 1.5 : 0;
        const startY = lastDirection === 'up' ? -H * 0.8 : 0;
        position.setValue({ x: startX, y: startY });

        setTopIndex(prevIdx);

        // Animate back to center
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }).start();

        return lastDirection;
      }
      return null;
    }
  }));

  const pan = useRef(
    PanResponder.create({
      // Do not intercept on start: let child pressables get taps
      onStartShouldSetPanResponder: () => false,
      // Intercept only when dragging begins (move exceeds 10px)
      onMoveShouldSetPanResponder: (_, { dx, dy }) => {
        return Math.abs(dx) > 10 || Math.abs(dy) > 10;
      },
      onPanResponderGrant: () => {
        hapticFired.current = false;
        Haptics.selectionAsync();

        // Double tap detection on the deck
        const now = Date.now();
        if (now - lastTap.current < 300) {
          lastTap.current = 0;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const { topIndex: curIdx, cards: currentCards, onSwipeRight: swipeRightCb } = stateRef.current;
          if (swipeRightCb && currentCards[curIdx]) {
            swipeRightCb(curIdx, currentCards[curIdx]);
          }
        } else {
          lastTap.current = now;
        }
      },
      onPanResponderMove: (_, { dx, dy }) => {
        position.setValue({ x: dx, y: dy * 0.2 });
        const crossed = Math.abs(dx) > SWIPE_H || dy < -SWIPE_V;
        if (crossed && !hapticFired.current) {
          hapticFired.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      onPanResponderRelease: (_, { dx, dy, vx, vy }) => {
        if (dy < -SWIPE_V || vy < -VELOCITY_THRESHOLD) {
          animateSwipe('up');
        } else if (dx > SWIPE_H || vx > VELOCITY_THRESHOLD) {
          animateSwipe('right');
        } else if (dx < -SWIPE_H || vx < -VELOCITY_THRESHOLD) {
          animateSwipe('left');
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 5, tension: 100, useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const animateSwipe = (direction) => {
    const { topIndex: curIdx, cards: currentCards, onSwipeRight: swipeRightCb, onSwipeLeft: swipeLeftCb, onSwipeUp: swipeUpCb } = stateRef.current;
    if (!currentCards.length) return;

    const x = direction === 'right' ? W * 1.6 : direction === 'left' ? -W * 1.6 : 0;
    const y = direction === 'up' ? -H * 0.8 : 0;

    Animated.timing(position, {
      toValue: { x, y },
      duration: 280,
      useNativeDriver: true,
    }).start(() => {
      const nextIdx = curIdx + 1;

      swipeHistory.current.push(direction);

      if (direction === 'right' && swipeRightCb) swipeRightCb(curIdx, currentCards[curIdx]);
      if (direction === 'left' && swipeLeftCb) swipeLeftCb(curIdx, currentCards[curIdx]);
      if (direction === 'up' && swipeUpCb) swipeUpCb(curIdx, currentCards[curIdx]);

      setTopIndex(nextIdx);
      position.setValue({ x: 0, y: 0 });
    });
  };

  // Overlay opacities
  const rightOpacity = position.x.interpolate({ inputRange: [0, SWIPE_H], outputRange: [0, 1], extrapolate: 'clamp' });
  const leftOpacity = position.x.interpolate({ inputRange: [-SWIPE_H, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const upOpacity = position.y.interpolate({ inputRange: [-SWIPE_V, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const rotate = position.x.interpolate({
    inputRange: [-W, 0, W], outputRange: ['-10deg', '0deg', '10deg'], extrapolate: 'clamp',
  });

  if (cards.length === 0) return null;

  const visibleCards = [];
  const endIdx = Math.min(topIndex + stackSize, cards.length);
  for (let i = endIdx - 1; i >= topIndex; i--) {
    const card = cards[i];
    const isTop = i === topIndex;
    const offset = i - topIndex;
    const scale = 1 - offset * 0.04;
    const translateY = offset * 14;

    const cardStyle = isTop
      ? { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }], zIndex: 100 }
      : { transform: [{ scale }, { translateY }], zIndex: 100 - offset };

    visibleCards.push(
      <Animated.View
        key={`${card.id || i}_v${cardVersion}`}
        style={[styles.card, cardStyle]}
        {...(isTop ? pan.panHandlers : {})}
      >
        {renderCard(card, i)}

        {/* Overlays — only on top card */}
        {isTop && (
          <>
            {/* ✨ TRY ON (right) */}
            <Animated.View style={[styles.overlayRight, { opacity: rightOpacity }]}>
              <View style={styles.badgeRight}>
                <Animated.Text style={styles.badgeText}>{overlayLabels.right}</Animated.Text>
              </View>
            </Animated.View>

            {/* ✕ SKIP (left) */}
            <Animated.View style={[styles.overlayLeft, { opacity: leftOpacity }]}>
              <View style={styles.badgeLeft}>
                <Animated.Text style={styles.badgeText}>{overlayLabels.left}</Animated.Text>
              </View>
            </Animated.View>

            {/* 📌 SAVE (up) */}
            <Animated.View style={[styles.overlayUp, { opacity: upOpacity }]}>
              <View style={styles.badgeUp}>
                <Animated.Text style={styles.badgeText}>{overlayLabels.up}</Animated.Text>
              </View>
            </Animated.View>
          </>
        )}
      </Animated.View>
    );
  }

  return <View style={styles.deck}>{visibleCards}</View>;
});

export default SwipeDeck;

const styles = StyleSheet.create({
  deck: { flex: 1 },
  card: {
    position: 'absolute',
    left: 12, right: 12,
    top: 8, bottom: 168,
  },

  // ── Overlays
  overlayRight: { position: 'absolute', top: 56, right: 18 },
  overlayLeft: { position: 'absolute', top: 56, left: 18 },
  overlayUp: { position: 'absolute', top: 20, alignSelf: 'center', left: 0, right: 0, alignItems: 'center' },

  badgeRight: {
    backgroundColor: '#6B9E7A', borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 10,
    transform: [{ rotate: '14deg' }],
    shadowColor: '#6B9E7A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  badgeLeft: {
    backgroundColor: '#C4604A', borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 10,
    transform: [{ rotate: '-14deg' }],
    shadowColor: '#C4604A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  badgeUp: {
    backgroundColor: '#C49A6C', borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 10,
    shadowColor: '#C49A6C', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  badgeText: {
    color: 'white', fontWeight: '900', fontSize: 17, letterSpacing: 1.2,
  },
});