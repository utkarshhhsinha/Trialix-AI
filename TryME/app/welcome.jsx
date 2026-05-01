import { StyleSheet, View, Image, Text } from 'react-native';
import React, { useEffect } from 'react';
import ScreenWrapper from '@/components/ScreenWrapper';
import { StatusBar } from 'expo-status-bar';
import { wp } from '@/helper/common';
import Button from '@/components/Button';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';

const Welcome = () => {
  const router = useRouter();

  return (
    <ScreenWrapper bg={theme.colors.secondary}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <Image
            style={styles.logo}
            resizeMode="contain"
            source={require('@/assets/images/logo.png')}
            tintColor={theme.colors.primary}
          />
          <Text style={[styles.brandName, { color: theme.colors.primary }]}>AURA</Text>
          <Text style={styles.tagline}>The Future of Virtual Fashion</Text>
        </View>

        <View style={styles.footer}>
          <Button
            title="Get Started"
            onPress={() => router.replace('/login')}
            buttonStyle={styles.startButton}
            textStyle={styles.startButtonText}
            hasShadow={true}
          />
        </View>
      </View>
    </ScreenWrapper>
  );
};

export default Welcome;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: wp(6),
  },
  logoContainer: {
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: wp(30),
    height: wp(30),
    marginBottom: 10,
  },
  brandName: {
    fontSize: 42,
    fontWeight: theme.fonts.extraBold,
    color: 'white',
    letterSpacing: 6,
  },
  tagline: {
    fontSize: 14,
    color: theme.colors.textLight,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  footer: {
    width: '100%',
    paddingBottom: 40,
  },
  startButton: {
    backgroundColor: theme.colors.primary,
    height: 60,
    borderRadius: 20,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: theme.fonts.bold,
  },
});