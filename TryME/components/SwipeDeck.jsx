import React, { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { View, Animated, PanResponder, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.28;
const SWIPE_VELOCITY = 0.3;

const SwipeDeck = forwardRef(({ cards = [], renderCard, onSwipeRight, onSwipeLeft, stackSize = 3 }, ref) => {
  const [topIndex, setTopIndex] = useState(0);
  const position = useRef(new Animated.ValueXY()).current;

  useImperativeHandle(ref, () => ({
    swipeLeft: () => swipeCard('left'),
    swipeRight: () => swipeCard('right'),
  }));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, { dx, dy }) => {
        position.setValue({ x: dx, y: dy });
      },
      onPanResponderRelease: (_, { dx, dy, vx }) => {
        if (dx > SWIPE_THRESHOLD || vx > SWIPE_VELOCITY) {
          swipeCard('right');
        } else if (dx < -SWIPE_THRESHOLD || vx < -SWIPE_VELOCITY) {
          swipeCard('left');
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const swipeCard = (direction) => {
    const x = direction === 'right' ? SCREEN_W * 1.4 : -SCREEN_W * 1.4;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: 280,
      useNativeDriver: true,
    }).start(() => {
      setTopIndex((prev) => {
        const newIdx = prev + 1 >= cards.length ? 0 : prev + 1;
        if (direction === 'right' && onSwipeRight) onSwipeRight(prev, cards[prev]);
        if (direction === 'left' && onSwipeLeft) onSwipeLeft(prev, cards[prev]);
        return newIdx;
      });
      position.setValue({ x: 0, y: 0 });
    });
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const getCardStyle = (cardIndex) => {
    const offset = cardIndex - topIndex;
    if (offset < 0) return { display: 'none' };
    if (offset === 0) {
      const rotate = position.x.interpolate({
        inputRange: [-SCREEN_W, 0, SCREEN_W],
        outputRange: ['-12deg', '0deg', '12deg'],
        extrapolate: 'clamp',
      });
      return {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
        transform: [...position.getTranslateTransform(), { rotate }],
      };
    }
    const scale = 1 - offset * 0.04;
    const translateY = offset * 14;
    return {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100 - offset,
      transform: [{ scale }, { translateY }],
    };
  };

  // Overlay opacity for left/right labels
  const rightOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const leftOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const visibleCards = [];
  const startIdx = topIndex;
  const endIdx = Math.min(topIndex + stackSize, cards.length);

  for (let i = endIdx - 1; i >= startIdx; i--) {
    const card = cards[i];
    const isTop = i === topIndex;
    visibleCards.push(
      <Animated.View
        key={card.id || i}
        style={[styles.cardContainer, getCardStyle(i)]}
        {...(isTop ? panResponder.panHandlers : {})}
      >
        {renderCard(card, i)}
        {isTop && (
          <>
            <Animated.View style={[styles.overlayLabel, styles.overlayRight, { opacity: rightOpacity }]}>
              <View style={styles.overlayLabelBox}>
                <Animated.Text style={styles.overlayLabelTextRight}>TRY ON ✨</Animated.Text>
              </View>
            </Animated.View>
            <Animated.View style={[styles.overlayLabel, styles.overlayLeft, { opacity: leftOpacity }]}>
              <View style={styles.overlayLabelBoxLeft}>
                <Animated.Text style={styles.overlayLabelTextLeft}>SKIP ✕</Animated.Text>
              </View>
            </Animated.View>
          </>
        )}
      </Animated.View>
    );
  }

  if (cards.length === 0) return null;

  return (
    <View style={styles.deck}>
      {visibleCards}
    </View>
  );
});

export default SwipeDeck;

const styles = StyleSheet.create({
  deck: { flex: 1 },
  cardContainer: { position: 'absolute', left: 16, right: 16, top: 0, bottom: 0 },
  overlayLabel: { position: 'absolute', top: 60 },
  overlayRight: { right: 24 },
  overlayLeft: { left: 24 },
  overlayLabelBox: {
    backgroundColor: '#0047AB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 2, borderColor: '#0047AB',
  },
  overlayLabelBoxLeft: {
    backgroundColor: '#FF3B30', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 2, borderColor: '#FF3B30',
  },
  overlayLabelTextRight: { color: 'white', fontWeight: '800', fontSize: 20, letterSpacing: 1 },
  overlayLabelTextLeft: { color: 'white', fontWeight: '800', fontSize: 20, letterSpacing: 1 },
});
