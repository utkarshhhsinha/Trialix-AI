import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import Icon from '@/assets/icons';

function TabIcon({ name, focused }) {
  return (
    <View style={styles.tabIconContainer}>
      <Icon
        name={name}
        size={24}
        color={focused ? theme.colors.primary : '#8D6E63'}
        strokeWidth={focused ? 2.5 : 2}
      />
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
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="search" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="heart" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="user" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 84,
    backgroundColor: '#FDF5E6',
    borderTopWidth: 0.5,
    borderTopColor: '#EADDCA',
    paddingBottom: 28,
    paddingTop: 12,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  activeDot: {
    position: 'absolute',
    bottom: -10,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
});
