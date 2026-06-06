import { StyleSheet, View, Text } from 'react-native';
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { wp } from '@/helper/common';
import Button from '@/components/Button';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import TrialixLogo from '@/components/TrialixLogo';

const Welcome = () => {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#A05A3E', '#C4785A', '#E8A882']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.container}>
        <View style={styles.logoContainer}>
          <TrialixLogo size={120} />
          <Text style={styles.brandName}>Trialix</Text>
          <Text style={styles.tagline}>The future of AI fashion</Text>
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
      </SafeAreaView>
    </View>
  );
};

export default Welcome;

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  brandName: {
    fontSize: 40,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 2,
    marginTop: 8,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  footer: {
    width: '100%',
    paddingBottom: 40,
  },
  startButton: {
    backgroundColor: '#FFFFFF',
    height: 56,
    borderRadius: 28,
  },
  startButtonText: {
    color: '#C4785A',
    fontSize: 17,
    fontWeight: '900',
  },
});
