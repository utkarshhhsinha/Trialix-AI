import React, { useEffect, useState } from 'react';
import {
  Alert, StyleSheet, Text, View, ImageBackground, Image,
  TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { firebaseAuth, firebaseConfigError } from '@/lib/firebase';
import { StatusBar } from 'expo-status-bar';
import { theme } from '@/constants/theme';
import ScreenWrapper from '@/components/ScreenWrapper';

// Configure Google Sign-In (called once at module load)
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  offlineAccess: true,
});


export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) router.replace('/');
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
      if (!idToken) throw new Error('No ID token received from Google');
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(firebaseAuth, credential);
      // onAuthStateChanged will redirect
    } catch (e) {
      if (e.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Google Sign-In Failed', e.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      Alert.alert('Missing name', 'Please enter your full name.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { user } = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await updateProfile(user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      }
    } catch (e) {
      const msg = {
        'auth/email-already-in-use': 'This email is already registered. Try signing in.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/user-not-found': 'No account found. Try signing up.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/invalid-credential': 'Wrong email or password.',
        'auth/network-request-failed': 'No internet connection.',
        'auth/operation-not-allowed': 'Enable Email/Password in Firebase Console → Authentication → Sign-in method.',
      }[e.code] || e.message;
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => router.replace('/profile-setup');
  const isSignUp = mode === 'signup';

  return (
    <ImageBackground
      source={require('../assets/images/login_bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(75, 56, 50, 0.5)' }]} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenWrapper bg="transparent">
          <StatusBar style="light" />
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Brand */}
            <View style={styles.brandContainer}>
              <View style={styles.logoRing}>
                <Image source={require('../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
              </View>
              <Text style={styles.title}>AURA</Text>
              <Text style={styles.subtitle}>AI Virtual Trial Room</Text>
            </View>

            {/* Form Card */}
            <View style={styles.card}>

              {/* Google Sign-In (works in dev build only) */}
              <TouchableOpacity
                style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                activeOpacity={0.85}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#1a1a2e" />
                ) : (
                  <>
                    <View style={styles.googleIconBox}>
                      <Text style={styles.googleIconText}>G</Text>
                    </View>
                    <Text style={styles.googleButtonText}>Sign in with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.divLine} />
                <Text style={styles.divText}>or use email</Text>
                <View style={styles.divLine} />
              </View>

              {/* Toggle Sign In / Sign Up */}
              <View style={styles.toggle}>
                <TouchableOpacity
                  style={[styles.toggleBtn, !isSignUp && styles.toggleBtnActive]}
                  onPress={() => setMode('signin')}
                >
                  <Text style={[styles.toggleText, !isSignUp && styles.toggleTextActive]}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, isSignUp && styles.toggleBtnActive]}
                  onPress={() => setMode('signup')}
                >
                  <Text style={[styles.toggleText, isSignUp && styles.toggleTextActive]}>Create Account</Text>
                </TouchableOpacity>
              </View>

              {isSignUp && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor="rgba(75, 56, 50, 0.4)"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(75, 56, 50, 0.4)"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Min. 6 characters"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                    <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.submitText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
                }
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.divLine} />
                <Text style={styles.divText}>or</Text>
                <View style={styles.divLine} />
              </View>

              <TouchableOpacity style={styles.guestBtn} onPress={handleGuest} activeOpacity={0.8}>
                <Text style={styles.guestText}>Continue as Guest →</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </ScreenWrapper>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,18,72,0.62)' },
  scroll: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 32, paddingTop: 60 },
  brandContainer: { alignItems: 'center', marginBottom: 40 },
  logoRing: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)', justifyContent: 'center',
    alignItems: 'center', marginBottom: 16,
    transform: [{ rotate: '45deg' }], // Diamond shape for logo
  },
  logo: { width: 44, height: 44, tintColor: 'white', transform: [{ rotate: '-45deg' }] },
  title: { fontSize: 52, fontWeight: '900', color: 'white', letterSpacing: 8, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 6, fontWeight: '500' },
  card: {
    backgroundColor: '#FDF5E6', borderRadius: 32,
    borderWidth: 1.5, borderColor: '#EADDCA', padding: 26, gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.15, shadowRadius: 30,
  },
  googleButton: {
    backgroundColor: 'white', height: 56, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  buttonDisabled: { opacity: 0.65 },
  googleIconBox: {
    width: 24, height: 24, borderRadius: 4, backgroundColor: '#4285F4',
    justifyContent: 'center', alignItems: 'center',
  },
  googleIconText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  googleButtonText: { color: '#4B3832', fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  divLine: { flex: 1, height: 1, backgroundColor: '#EADDCA' },
  divText: { color: '#8D6E63', fontSize: 13, fontWeight: '600' },
  toggle: {
    flexDirection: 'row', backgroundColor: '#EADDCA',
    borderRadius: 16, padding: 5, marginBottom: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#4B3832' },
  toggleText: { color: '#8D6E63', fontSize: 14, fontWeight: '700' },
  toggleTextActive: { color: 'white' },
  inputGroup: { gap: 6 },
  inputLabel: { color: '#4B3832', fontSize: 13, fontWeight: '600', marginLeft: 4 },
  input: {
    backgroundColor: '#FFFBF0', borderWidth: 1.5,
    borderColor: '#EADDCA', borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 14, fontSize: 16, color: '#4B3832',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyeBtn: {
    backgroundColor: '#FFFBF0', borderWidth: 1.5,
    borderColor: '#EADDCA', borderRadius: 16,
    paddingHorizontal: 15, paddingVertical: 14,
  },
  eyeText: { fontSize: 18 },
  submitBtn: {
    backgroundColor: '#4B3832', height: 56, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 15, elevation: 10,
  },
  submitText: { color: 'white', fontSize: 17, fontWeight: '800' },
  guestBtn: {
    height: 48, borderRadius: 13, borderWidth: 1,
    borderColor: '#8D6E63', justifyContent: 'center', alignItems: 'center',
  },
  guestText: { color: '#4B3832', fontSize: 15, fontWeight: '600' },
});