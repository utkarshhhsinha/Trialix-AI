import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect
} from 'firebase/auth';
import { firebaseAuth, googleProvider } from '../lib/firebase';
import { getReviews } from '../lib/reviews';
import theme from '../theme';

export default function Login() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [shakeCheckbox, setShakeCheckbox] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Static fallback reviews shown until Supabase loads
  const FALLBACK_REVIEWS = [
    { name: 'Priya M.', location: 'Mumbai', body: 'Tried 20 outfits in 5 minutes without a dressing room. This is the future of shopping.', rating: 5 },
    { name: 'Aditya K.', location: 'Bangalore', body: "The AI try-on is shockingly realistic. Saved me from buying clothes that don't fit.", rating: 5 },
    { name: 'Shreya R.', location: 'Delhi', body: 'Love how I can mix and match outfits before buying. The community feed is so addictive!', rating: 5 },
  ];
  const [reviews, setReviews] = useState(FALLBACK_REVIEWS);
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '4.8';

  useEffect(() => {
    getReviews().then(data => {
      if (data && data.length > 0) setReviews(data.slice(0, 5));
    }).catch(() => {}); // silently fall back to static reviews
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!acceptedTerms) {
      setShakeCheckbox(true);
      setError('Please agree to the Terms of Service & Privacy Policy.');
      setTimeout(() => setShakeCheckbox(false), 400);
      return;
    }
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
    if (!acceptedTerms) {
      setShakeCheckbox(true);
      setError('Please agree to the Terms of Service & Privacy Policy.');
      setTimeout(() => setShakeCheckbox(false), 400);
      return;
    }
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
          margin-top: 10px;
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
        
        /* Terms and Checkbox Styles */
        .terms-container {
          margin-bottom: 24px;
          display: flex;
          align-items: flex-start;
          width: 100%;
        }
        .custom-checkbox-label {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
          text-align: left;
          width: 100%;
        }
        .custom-checkbox {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border: 2px solid #D9C2BA;
          border-radius: 6px;
          background: white;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          flex-shrink: 0;
          margin-top: 2px;
          color: white;
        }
        .custom-checkbox.checked {
          background: #8b4a30;
          border-color: #8b4a30;
          box-shadow: 0 4px 10px rgba(139, 74, 48, 0.2);
        }
        .custom-checkbox.shake {
          animation: checkbox-shake 0.4s ease;
          border-color: #e53e3e;
          background: #fff5f5;
        }
        @keyframes checkbox-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .terms-link {
          color: #8b4a30;
          font-weight: 700;
          text-decoration: underline;
          cursor: pointer;
          transition: color 0.2s ease;
        }
        .terms-link:hover {
          color: #71361d;
        }
        
        .validation-error {
          color: #e53e3e;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 16px;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 8px;
          background: #FFF5F5;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid #FED7D7;
          width: 100%;
          box-sizing: border-box;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Modal Overlay Styles */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(32, 26, 23, 0.45);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 9999;
          animation: modal-fade-in 0.25s ease;
        }
        .modal-card {
          background: white;
          width: 100%;
          max-width: 540px;
          max-height: 75vh;
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.8);
          box-shadow: 0 30px 60px rgba(32, 26, 23, 0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: modal-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid #E6DED9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #FFF8F5;
        }
        .modal-body {
          padding: 24px;
          overflow-y: auto;
          font-size: 14px;
          line-height: 1.6;
          color: #4A3E39;
          text-align: left;
        }
        .modal-body h3 {
          color: #8b4a30;
          font-family: 'Outfit', sans-serif;
          font-size: 16px;
          font-weight: 700;
          margin-top: 18px;
          margin-bottom: 8px;
        }
        .modal-body p {
          margin-bottom: 12px;
        }
        .modal-body ul {
          margin-bottom: 12px;
          padding-left: 20px;
        }
        .modal-body li {
          margin-bottom: 6px;
        }
        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #E6DED9;
          background: #FAF7F4;
          display: flex;
          justify-content: flex-end;
        }
        .btn-modal-close {
          padding: 10px 22px;
          background: #8b4a30;
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .btn-modal-close:hover {
          background: #71361d;
        }
        @keyframes modal-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-slide-up {
          from { transform: translateY(24px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
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
          .mobile-reviews {
            display: none;
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

        {/* Reviews Section — visible on desktop left panel */}
        <div style={{
          position: 'relative', zIndex: 10,
          marginTop: '48px',
          display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ color: 'white', fontSize: '14px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.9 }}>What users say</span>
            <div style={{ display: 'flex', gap: '2px' }}>
              {[1,2,3,4,5].map(i => (
                <svg key={i} viewBox="0 0 24 24" fill="#FFD700" style={{ width: 14, height: 14 }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              ))}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: '600' }}>{avgRating} / 5</span>
          </div>

          {reviews.slice(0, 3).map((review, i) => (
            <div key={review.id || i} style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              borderRadius: '14px',
              padding: '16px 18px',
              border: '1px solid rgba(255,255,255,0.15)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <span style={{ color: 'white', fontSize: '14px', fontWeight: '700' }}>{review.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', marginLeft: '8px' }}>{review.location}</span>
                </div>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {Array.from({ length: review.rating }).map((_, j) => (
                    <svg key={j} viewBox="0 0 24 24" fill="#FFD700" style={{ width: 12, height: 12 }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ))}
                </div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
                "{review.body}"
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Right Side: Login Form (40% Desktop) */}
      <div className="form-side">
        <div className="glass-card">
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <img
              src="/oraneo_logo.jpeg"
              alt="OraNeo AI Virtual Try-On"
              style={{
                width: '64px', height: '64px', borderRadius: '18px',
                margin: '0 auto 12px', display: 'block',
                boxShadow: '0 8px 24px rgba(139, 74, 48, 0.15)'
              }}
            />
            <h1 className="login-title-serif" style={{ fontSize: '32px', fontWeight: '800', color: '#8b4a30', margin: '0 auto 4px', letterSpacing: '-0.5px', textAlign: 'center' }}>
              OraNeo
            </h1>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#7A6055', margin: '8px 0 6px', textAlign: 'center' }}>
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p style={{ color: '#7A6055', fontSize: '14px', opacity: 0.8, textAlign: 'center', lineHeight: '1.5' }}>
              {isSignUp 
                ? 'Join our private AI fashion atelier. Try on clothes virtually and define your neo style.' 
                : 'Access your private AI fashion atelier. Try on clothes virtually and design your neo style.'}
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

            {error && (
              <div className="validation-error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 16, height: 16, flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="terms-container">
              <label className="custom-checkbox-label" onClick={(e) => {
                if (e.target.className === 'terms-link') {
                  e.preventDefault();
                }
              }}>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={e => {
                    setAcceptedTerms(e.target.checked);
                    if (e.target.checked && error.includes('agree')) {
                      setError('');
                    }
                  }}
                  style={{ display: 'none' }}
                />
                <span className={`custom-checkbox ${acceptedTerms ? 'checked' : ''} ${shakeCheckbox ? 'shake' : ''}`}>
                  {acceptedTerms && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span style={{ fontSize: '13px', color: '#7A6055', lineHeight: 1.4, userSelect: 'none' }}>
                  I confirm I am 18+ and agree to the{' '}
                  <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTermsModal(true); }} className="terms-link">Terms of Service</span>
                  {' '}and{' '}
                  <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPrivacyModal(true); }} className="terms-link">Privacy Policy</span>.
                </span>
              </label>
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

        {/* Mobile Reviews Section — shown below card on mobile only */}
        <div style={{ width: '100%', maxWidth: '420px', marginTop: '32px', paddingBottom: '40px' }} className="mobile-reviews">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[1,2,3,4,5].map(i => (
                <svg key={i} viewBox="0 0 24 24" fill="#8b4a30" style={{ width: 16, height: 16 }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              ))}
            </div>
            <span style={{ color: '#8b4a30', fontSize: '14px', fontWeight: '700' }}>{avgRating} out of 5</span>
            <span style={{ color: '#7A6055', fontSize: '13px' }}>· {reviews.length}+ reviews</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reviews.slice(0, 3).map((review, i) => (
              <div key={review.id || i} style={{
                background: 'rgba(255, 255, 255, 0.8)',
                borderRadius: '14px',
                padding: '16px',
                border: '1px solid #E6DED9',
                boxShadow: '0 2px 12px rgba(139,74,48,0.06)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <span style={{ color: '#201a17', fontSize: '14px', fontWeight: '700' }}>{review.name}</span>
                    <span style={{ color: '#7A6055', fontSize: '12px', marginLeft: '6px' }}>{review.location}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {Array.from({ length: review.rating }).map((_, j) => (
                      <svg key={j} viewBox="0 0 24 24" fill="#8b4a30" style={{ width: 12, height: 12 }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    ))}
                  </div>
                </div>
                <p style={{ color: '#4A3E39', fontSize: '13px', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
                  "{review.body}"
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section — for SEO / Google People Also Ask / AI Overview */}
        <div style={{ width: '100%', maxWidth: '420px', marginTop: '32px', paddingBottom: '48px' }} className="mobile-reviews">
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#201a17', marginBottom: '16px', fontFamily: 'Outfit, sans-serif' }}>
            Frequently Asked Questions
          </h2>
          {[
            {
              q: 'What is OraNeo?',
              a: 'OraNeo is a free AI-powered virtual try-on platform that lets you see how clothes look on you before buying — no dressing room needed. Upload your photo, pick an outfit, and the AI generates a realistic preview in seconds.'
            },
            {
              q: 'How does OraNeo\'s AI virtual try-on work?',
              a: 'OraNeo uses advanced generative AI (Google Vertex AI) to overlay selected garments onto your uploaded photo. The AI analyzes your body shape, lighting, and pose to produce a realistic simulation of how the outfit would look on you.'
            },
            {
              q: 'Is OraNeo free to use?',
              a: 'Yes, OraNeo is completely free. Sign up with your email or Google account, upload a full-body photo, and start trying on outfits instantly.'
            },
            {
              q: 'What types of clothes can I try on with OraNeo?',
              a: 'OraNeo supports tops, shirts, dresses, kurtas, jackets, and more. The catalog is updated regularly with trending fashion from Indian and global brands.'
            },
            {
              q: 'Is my photo safe on OraNeo?',
              a: 'Yes. Your uploaded photos are processed securely and are never sold or shared with third parties. You can delete your data at any time from your profile settings.'
            },
          ].map((faq, i) => (
            <details key={i} style={{
              background: 'white',
              borderRadius: '14px',
              padding: '16px',
              border: '1px solid #E6DED9',
              marginBottom: '10px',
              boxShadow: '0 2px 8px rgba(139,74,48,0.04)',
            }}>
              <summary style={{
                fontSize: '14px', fontWeight: '700', color: '#201a17',
                cursor: 'pointer', listStyle: 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                {faq.q}
                <span style={{ color: '#8b4a30', fontSize: '18px', fontWeight: '400', flexShrink: 0, marginLeft: '8px' }}>+</span>
              </summary>
              <p style={{ fontSize: '13px', color: '#4A3E39', lineHeight: 1.6, margin: '12px 0 0', paddingTop: '12px', borderTop: '1px solid #F0E8E3' }}>
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div className="modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="login-title-serif" style={{ fontSize: '20px', fontWeight: '800', color: '#8b4a30', margin: 0 }}>Terms of Service</h2>
              <button 
                onClick={() => setShowTermsModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#7A6055', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>Welcome to <strong>oraneo</strong>. By accessing our virtual trial room services, you agree to comply with and be bound by the following terms:</p>
              
              <h3>1. Eligibility</h3>
              <p>You must be at least 18 years of age or older to register an account and use our Services. By agreeing to these terms, you represent and warrant that you meet this requirement.</p>
              
              <h3>2. User Content & Conduct</h3>
              <p>To use our virtual try-on features, you may upload photos of yourself. You are solely responsible for any photographs or images you upload. You agree not to upload any content that is offensive, explicit, illegal, defamatory, or infringes on any third-party intellectual property or privacy rights.</p>
              
              <h3>3. AI Virtual Try-On Simulations</h3>
              <p>Our virtual trial room uses generative AI technologies (including Google Vertex AI and Google AI Studio) to simulate how clothes would look on you. You understand that these simulations are provided "as-is" for entertainment and stylistic purposes and may not reflect the exact fit, texture, color, or shape of physical clothing.</p>
              
              <h3>4. License to Process</h3>
              <p>You grant oraneo and Ascendras Organization a limited, royalty-free, worldwide license to process, resize, and transmit your uploaded photographs for the sole purpose of providing the AI virtual try-on results. We do not sell or use your personal photographs for any other purpose.</p>
              
              <h3>5. Intellectual Property</h3>
              <p>All software, website layouts, style recommendations, and branding elements associated with oraneo are the exclusive property of Ascendras Organization.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-close" onClick={() => setShowTermsModal(false)}>
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="modal-overlay" onClick={() => setShowPrivacyModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="login-title-serif" style={{ fontSize: '20px', fontWeight: '800', color: '#8b4a30', margin: 0 }}>Privacy Policy</h2>
              <button 
                onClick={() => setShowPrivacyModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#7A6055', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>Your privacy is important to us. This Privacy Policy details how <strong>oraneo</strong> collects, uses, and secures your personal data under the <strong>Indian Digital Personal Data Protection (DPDP) Act, 2023</strong> and CERT-In directions.</p>
              
              <h3>1. Personal Data We Collect</h3>
              <ul>
                <li><strong>Account Details:</strong> Email address, name, style preferences, and profile images.</li>
                <li><strong>Uploaded Photos:</strong> The full-body standing photo you upload for virtual try-on, and the resulting simulated outputs.</li>
                <li><strong>Activity Logs:</strong> System logs, device parameters, IP address, and usage statistics.</li>
              </ul>
              
              <h3>2. Data Processing and AI Sub-processors</h3>
              <p>We process your uploaded photographs to generate virtual try-ons. This processing is performed securely via <strong>Google Vertex AI</strong> and <strong>Google AI Studio</strong>. Your photos are transmitted via secure HTTPS and processed in transient memory to generate outputs. Your styling preferences and profiles are saved on Firebase Cloud storage.</p>
              
              <h3>3. Data Retention & Erasure</h3>
              <p>We delete your uploaded body photos and AI try-on results immediately upon user account deletion or withdrawal of consent. In accordance with CERT-In cybersecurity directives, we maintain rolling system activity logs for 180 days and basic user registration records for 5 years after deletion.</p>
              
              <h3>4. Your Rights</h3>
              <p>You have the right to request access to the data we hold, correct inaccuracies, delete your account/data, and file complaints. For inquiries or grievances, contact our Grievance Redressal Officer at <strong>privacy@oraneo.space</strong>.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-close" onClick={() => setShowPrivacyModal(false)}>
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
