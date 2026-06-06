import React, { useEffect, useState } from 'react';
import {
  Alert, StyleSheet, Text, View,
  TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, Dimensions, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { firebaseAuth } from '@/lib/firebase';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import TrialixLogo from '@/components/TrialixLogo';

const { width: W, height: H } = Dimensions.get('window');

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
GoogleSignin.configure({
  webClientId,
  offlineAccess: !!webClientId,
});

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
        'auth/operation-not-allowed': 'Enable Email/Password in Firebase Console.',
      }[e.code] || e.message;
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => router.replace('/profile-setup');
  const isSignUp = mode === 'signup';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Tinder-style full-screen gradient */}
      <LinearGradient
        colors={['#A05A3E', '#C4785A', '#E8A882']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Soft orbs — depth like Tinder/IG */}
      <View style={[styles.orb, styles.orb1]} />
      <View style={[styles.orb, styles.orb2]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Hero — logo + wordmark */}
            <View style={styles.hero}>
              <TrialixLogo size={96} />
              <Text style={styles.wordmark}>Trialix</Text>
              <Text style={styles.tagline}>Swipe. Try. Slay.</Text>
              <Text style={styles.subtag}>AI virtual try-on — see any outfit on you</Text>
            </View>

            {/* Bottom sheet card — Tinder auth panel */}
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />

              <View style={styles.modeRow}>
                <Pressable
                  style={[styles.modePill, !isSignUp && styles.modePillActive]}
                  onPress={() => setMode('signin')}
                >
                  <Text style={[styles.modeText, !isSignUp && styles.modeTextActive]}>Log in</Text>
                </Pressable>
                <Pressable
                  style={[styles.modePill, isSignUp && styles.modePillActive]}
                  onPress={() => setMode('signup')}
                >
                  <Text style={[styles.modeText, isSignUp && styles.modeTextActive]}>Sign up</Text>
                </Pressable>
              </View>

              {/* Primary CTA — Google first (Tinder pattern) */}
              <TouchableOpacity
                style={[styles.googleBtn, googleLoading && styles.disabled]}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                activeOpacity={0.9}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#2A1F1A" />
                ) : (
                  <>
                    <View style={styles.googleG}>
                      <Text style={styles.googleGText}>G</Text>
                    </View>
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.divLine} />
                <Text style={styles.divText}>or email</Text>
                <View style={styles.divLine} />
              </View>

              {isSignUp && (
                <View style={styles.field}>
                  <Ionicons name="person-outline" size={18} color="#B8A49A" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full name"
                    placeholderTextColor="#B8A49A"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              )}

              <View style={styles.field}>
                <Ionicons name="mail-outline" size={18} color="#B8A49A" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#B8A49A"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.field}>
                <Ionicons name="lock-closed-outline" size={18} color="#B8A49A" style={styles.fieldIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Password"
                  placeholderTextColor="#B8A49A"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#B8A49A" />
                </Pressable>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.disabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#C4785A', '#E8A882']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryGrad}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.primaryText}>
                      {isSignUp ? 'Create account' : 'Continue'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.guestBtn} onPress={handleGuest} activeOpacity={0.8}>
                <Text style={styles.guestText}>Continue as guest</Text>
              </TouchableOpacity>

              <Text style={styles.legal}>
                By continuing you agree to our Terms & Privacy Policy
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#C4785A' },
  flex: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    minHeight: H * 0.92,
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  orb1: { width: W * 0.7, height: W * 0.7, top: -W * 0.2, right: -W * 0.15 },
  orb2: { width: W * 0.5, height: W * 0.5, bottom: H * 0.35, left: -W * 0.2 },

  hero: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 32,
    gap: 6,
  },
  wordmark: {
    fontSize: 42,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 1,
    marginTop: 12,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: 0.5,
  },
  subtag: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    fontWeight: '500',
  },

  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EDE0D4',
    alignSelf: 'center',
    marginBottom: 8,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: '#F5EDE4',
    borderRadius: 14,
    padding: 4,
  },
  modePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  modePillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#2A1F1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  modeText: { fontSize: 15, fontWeight: '700', color: '#B8A49A' },
  modeTextActive: { color: '#C4785A' },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#EDE0D4',
    backgroundColor: '#FAF7F4',
  },
  googleG: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleGText: { color: 'white', fontSize: 12, fontWeight: '900' },
  googleBtnText: { fontSize: 15, fontWeight: '800', color: '#2A1F1A' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divLine: { flex: 1, height: 1, backgroundColor: '#EDE0D4' },
  divText: { fontSize: 12, fontWeight: '600', color: '#B8A49A' },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 8,
  },
  fieldIcon: { marginRight: 2 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#2A1F1A',
    paddingVertical: 12,
    fontWeight: '500',
  },

  primaryBtn: { borderRadius: 28, overflow: 'hidden', marginTop: 4 },
  primaryGrad: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: 'white', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  disabled: { opacity: 0.65 },

  guestBtn: { alignItems: 'center', paddingVertical: 10 },
  guestText: { color: '#C4785A', fontSize: 15, fontWeight: '700' },

  legal: {
    fontSize: 10,
    color: '#B8A49A',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 4,
  },
});
