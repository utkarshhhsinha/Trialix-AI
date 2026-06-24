import React from 'react';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="trial-room" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
      <Stack.Screen name="custom-tryon" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
    </Stack>
  );
}
