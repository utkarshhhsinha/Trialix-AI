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
  const navigate = useNavigate();
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
      const errMsg = err.message.replace('Firebase:', '').trim();
      console.error('[Auth Error]', errMsg, err);
      setError(errMsg);
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

      const { doc, getDoc } = await import('firebase/firestore');
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
      let errMsg = err.message.replace('Firebase:', '').trim();
      if (err.code === 'auth/popup-closed-by-user') {
        errMsg = 'Google window was closed. Try again.';
      } else if (err.code === 'auth/popup-blocked') {
        setLoadingText('Opening Google redirect…');
        await signInWithRedirect(firebaseAuth, googleProvider);
        return;
      }
      console.error('[Google Auth Error]', errMsg, err);
      setError(errMsg);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'row',
      backgroundColor: '#FAF7F4',
      overflow: 'hidden',
    }} className="login-page-container">
      {/* CSS Styles injected inline */}
      <style>{`
        .login-page-container {
          font-family: 'Hanken Grotesk', 'Inter', sans-serif;
        }
        .login-title-serif {
          font-family: 'Bodoni Moda', 'Outfit', serif;
        }
        .visual-side {
          display: none;
        }
        .form-side {
          width: 100%;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: linear-gradient(180deg, #FFF8F5 0%, #FAF7F4 100%);
          position: relative;
          z-index: 10;
        }
        .glass-card {
          width: 100%;
          max-width: 420px;
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 20px 50px rgba(139, 74, 48, 0.08);
          border-radius: 24px;
          padding: 40px 32px;
          transition: all 0.3s ease;
        }
        .form-group {
          position: relative;
          margin-bottom: 24px;
        }
        .form-group input {
          width: 100%;
          padding: 16px 0 8px;
          font-size: 16px;
          color: #201a17;
          background: transparent;
          border: none;
          border-bottom: 2px solid #D9C2BA;
          outline: none;
          transition: border-color 0.3s ease;
        }
        .form-group input:focus {
          border-bottom-color: #8b4a30;
        }
        .form-group label {
          position: absolute;
          left: 0;
          top: 16px;
          color: #7A6055;
          font-size: 15px;
          pointer-events: none;
          transition: all 0.3s ease;
        }
        .form-group input:focus ~ label,
        .form-group input:not(:placeholder-shown) ~ label {
          top: -8px;
          font-size: 12px;
          color: #8b4a30;
          font-weight: 700;
        }
        .btn-atelier-primary {
          width: 100%;
          padding: 18px;
          background: #8b4a30;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 2px;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(139, 74, 48, 0.25);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-atelier-primary:hover {
          background: #71361d;
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(139, 74, 48, 0.35);
        }
        .btn-atelier-primary:active {
          transform: translateY(0);
        }
        .btn-google {
          width: 100%;
          padding: 14px;
          background: white;
          color: #201a17;
          border: 1px solid #E6DED9;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .btn-google:hover {
          background: #FDFDFD;
          border-color: #CDC5C0;
          box-shadow: 0 4px 15px rgba(0,0,0,0.03);
        }
        @media (min-width: 768px) {
          .visual-side {
            display: flex;
            width: 60%;
            height: 100vh;
            position: relative;
            flex-direction: column;
            justify-content: space-between;
            padding: 60px;
            overflow: hidden;
          }
          .form-side {
            width: 40%;
          }
        }
      `}</style>

      {/* Left Side: Visual Narrative (60% Desktop) */}
      <div className="visual-side">
        {/* Full-bleed background image with terracotta overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url("https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1600&q=80")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 0
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, rgba(139, 74, 48, 0.25), rgba(139, 74, 48, 0.45))',
          zIndex: 1
        }} />

        {/* Content Overlay */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', color: 'white' }}>
          <div>
            <h3 className="login-title-serif" style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>oraneo</h3>
          </div>
          <div>
            <h1 className="login-title-serif" style={{ fontSize: '56px', fontWeight: '600', lineHeight: 1.15, textShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              The Future <br />of Style is <span style={{ fontStyle: 'italic', fontWeight: '400' }}>You</span>
            </h1>
            <div style={{ width: '80px', height: '3px', backgroundColor: 'rgba(255, 255, 255, 0.4)', marginTop: '24px' }}></div>
          </div>
          <div style={{ display: 'flex', gap: '20px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.8 }}>
            <span>Atelier</span>
            <span>•</span>
            <span>Generative Fashion</span>
          </div>
        </div>
      </div>

      {/* Right Side: Login Form (40% Desktop) */}
      <div className="form-side">
        <div className="glass-card">
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <img
              src="/icon.png"
              alt="oraneo Logo"
              style={{
                width: '64px', height: '64px', borderRadius: '18px',
                margin: '0 auto 16px', display: 'block',
                boxShadow: '0 8px 24px rgba(139, 74, 48, 0.15)'
              }}
            />
            <h2 className="login-title-serif" style={{ fontSize: '28px', fontWeight: '700', color: '#8b4a30', marginBottom: '6px' }}>
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p style={{ color: '#7A6055', fontSize: '14px', opacity: 0.8 }}>
              {isSignUp ? 'Join our private fashion atelier.' : 'Access your private fashion atelier.'}
            </p>
          </div>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="form-group">
              <input
                type="email"
                placeholder=" "
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <label>Email Address</label>
            </div>

            <div className="form-group">
              <input
                type="password"
                placeholder=" "
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <label>Password</label>
            </div>



            <button className="btn-atelier-primary" type="submit" disabled={loading}>
              <span>{loading ? loadingText : isSignUp ? 'Create Account' : 'Sign In'}</span>
            </button>
          </form>

          <div style={{ margin: '24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#E6DED9' }}></div>
            <span style={{ padding: '0 12px', color: '#B8A49A', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>OR</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#E6DED9' }}></div>
          </div>

          <button
            className="btn-google"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: 18, height: 18 }} />
            <span>Continue with Google</span>
          </button>

          <p style={{ marginTop: '28px', fontSize: '14px', color: '#7A6055', textAlign: 'center' }}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <span
              onClick={() => setIsSignUp(!isSignUp)}
              style={{ color: '#8b4a30', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
