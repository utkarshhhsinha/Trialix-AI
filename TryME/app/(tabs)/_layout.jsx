import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { theme } from '@/constants/theme';

import Icon from '@/assets/icons';

// ── Tab icon with glow dot
function TabIcon({ iconName, focused }) {
  return (
    <View style={styles.tabItem}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Icon
          name={iconName}
          size={28}
          color={focused ? theme.colors.primary : 'rgba(42,31,26,0.45)'}
        />
      </View>
      {focused && <View style={styles.activeDot} />}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarBackground: () => (
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={40}
              tint="light"
              style={[StyleSheet.absoluteFillObject, styles.tabBarBg]}
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.tabBarBg]} />
          )
        ),
      }}
    >
      {/* ── Swipe (main) */}
      <Tabs.Screen
        name="discover"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconName="home" focused={focused} />
          ),
        }}
      />

      {/* ── Explore */}
      <Tabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconName="search" focused={focused} />
          ),
        }}
      />

      {/* ── Wishlist (main tab now) */}
      <Tabs.Screen
        name="wishlist"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconName="heart" focused={focused} />
          ),
        }}
      />

      {/* ── Community */}
      <Tabs.Screen
        name="community"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconName="video" focused={focused} />
          ),
        }}
      />

      {/* ── Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconName="user" focused={focused} />
          ),
        }}
      />

      {/* ── Hidden screens (keep routing intact) */}
      <Tabs.Screen name="moodboard" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    height: 82,
    borderTopWidth: 0,
    backgroundColor: Platform.OS === 'android' ? '#FAF7F4' : 'transparent',
    elevation: 0,
    paddingBottom: Platform.OS === 'ios' ? 22 : 8,
    paddingTop: 8,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopColor: '#EDE0D4',
    borderTopWidth: 0.5,
  },
  tabBarBg: {
    backgroundColor: 'rgba(250,247,244,0.92)',
    borderTopWidth: 0.5,
    borderTopColor: '#EDE0D4',
  },

  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingBottom: 2,
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#FDF2EC',
  },
  activeDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: '#C4785A',
    marginTop: 1,
    shadowColor: '#C4785A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
});