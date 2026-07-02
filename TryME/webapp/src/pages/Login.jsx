import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signInWithRedirect
} from 'firebase/auth';
import { firebaseAuth, googleProvider } from '../lib/firebase';
import theme from '../theme';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setLoadingText(isSignUp ? 'Creating your account…' : 'Signing you in…');
    setError('');
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(firebaseAuth, email, password);
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      }
    } catch (err) {
      setError(err.message.replace('Firebase:', '').trim());
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setLoadingText('Connecting to Google…');
    setError('');
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const user = result.user;

      // Auto-initialize profile for Google sign-in if it does not exist
      const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const { firestore } = await import('../lib/firebase');

      const profileRef = doc(firestore, 'profiles', user.uid);
      const profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists()) {
        console.log('[Auth] New Google user signed in — redirecting to onboarding setup page');
        navigate('/profile-setup');
      } else {
        console.log('[Auth] Existing Google user signed in — proceeding to Discover');
        navigate('/discover');
      }
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google window was closed. Try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setLoadingText('Opening Google redirect…');
        await signInWithRedirect(firebaseAuth, googleProvider);
      } else {
        setError(err.message.replace('Firebase:', '').trim());
      }
      setLoading(false);
    }
  };


  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '24px',
      background: `linear-gradient(180deg, ${theme.colors.bgWarm} 0%, ${theme.colors.bg} 100%)`
    }}>
      <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto', textAlign: 'center' }}>
        {/* Exact Android App Logo Image */}
        <img 
          src="/icon.png" 
          alt="TrialX AI Logo" 
          style={{
            width: '72px', height: '72px', borderRadius: '22px',
            margin: '0 auto 20px', display: 'block',
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
          }} 
        />

        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '32px', fontWeight: '800', marginBottom: '8px' }}>
          TrialX <span style={{ color: theme.colors.primary }}>AI</span>
        </h1>
        <p style={{ color: theme.colors.textMuted, fontSize: '15px', marginBottom: '28px' }}>
          Virtual Fitting Room & AI Style Assistant
        </p>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input 
            type="email" 
            placeholder="Email Address" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              padding: '16px', borderRadius: '16px', border: `1px solid ${theme.colors.border}`,
              fontSize: '15px', outline: 'none', background: 'white'
            }} 
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              padding: '16px', borderRadius: '16px', border: `1px solid ${theme.colors.border}`,
              fontSize: '15px', outline: 'none', background: 'white'
            }} 
            required 
          />

          {error && (
            <div style={{ background: theme.colors.dangerLight, padding: '10px 14px', borderRadius: '12px', color: theme.colors.danger, fontSize: '13px', textAlign: 'left', lineHeight: 1.4 }}>
              {error}
            </div>
          )}

          <button className="btn-primary" type="submit" disabled={loading} style={{ padding: '16px', marginTop: '6px' }}>
            <span>{loading ? loadingText : isSignUp ? 'Create Account' : 'Sign In'}</span>
          </button>
        </form>

        <div style={{ margin: '20px 0', color: theme.colors.textMuted, fontSize: '13px' }}>OR</div>

        <button 
          className="btn-secondary" 
          onClick={handleGoogleSignIn} 
          disabled={loading}
          style={{ width: '100%', padding: '14px', borderRadius: '16px' }}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: 18, height: 18 }} />
          <span>Continue with Google</span>
        </button>

        <p style={{ marginTop: '24px', fontSize: '14px', color: theme.colors.textMuted }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span 
            onClick={() => setIsSignUp(!isSignUp)} 
            style={{ color: theme.colors.primary, fontWeight: '700', cursor: 'pointer' }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </span>
        </p>
      </div>
    </div>
  );
}
