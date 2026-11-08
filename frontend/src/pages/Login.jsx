// frontend/src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DrandeeLogo from '../components/brand/DrandeeLogo';
import DrandeeWordmark from '../components/brand/DrandeeWordmark';
import { getRedirectResult } from 'firebase/auth';
import { auth } from '../firebase/config';

/* ── Google SVG icon inline — no broken img needed ── */
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const EyeIcon = ({ open }) => open ? (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);



export default function Login() {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [isSignup, setIsSignup]     = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [googleLoading, setGL]      = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [emailFocus, setEF]         = useState(false);
  const [passFocus, setPF]          = useState(false);
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, syncWithBackend } = useAuth();
  const navigate = useNavigate();
  const syncBackend = React.useCallback(async (firebaseUser) => {
    // AuthContext auto-syncs on onAuthStateChanged; here we call it explicitly
    // so we can await completion before navigating (avoids race with ProtectedRoute).
    const result = await syncWithBackend(firebaseUser);
    if (!result) throw new Error('Server sync failed. Please try again.');
    // Check for preserved redirect target from ProtectedRoute
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    navigate(next || '/feed', { replace: true });
  }, [navigate, syncWithBackend]);

  useEffect(() => {
    const checkRedirect = async () => {
      try {
        setGL(true);
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await syncBackend(result.user);
        }
      } catch (err) {
        setError(cleanFirebaseError(err));
      } finally {
        setGL(false);
      }
    };
    checkRedirect();
  }, [syncBackend]);

  const cleanFirebaseError = (err) => {
    const code = err?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Invalid email or password.';
    if (code === 'auth/user-disabled') return 'This account has been disabled.';
    if (code === 'auth/network-request-failed') return 'Unable to connect to Firebase. Check your internet connection and try again.';
    if (code === 'auth/too-many-requests') return 'Too many attempts. Please try again later.';
    const msg = err?.message || '';
    return msg.replace('Firebase: ', '').replace(/ \(auth\/.*?\)\.?/g, '').trim() || 'Something went wrong. Please try again.';
  };

  const handleGoogle = async () => {
    setError(''); setGL(true);
    try   { const u = await signInWithGoogle(); await syncBackend(u); }
    catch (e) { setError(cleanFirebaseError(e)); }
    finally   { setGL(false); }
  };

  const handleEmail = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const trimmedEmail = email.trim();
      const u = isSignup
        ? await signUpWithEmail(trimmedEmail, password)
        : await signInWithEmail(trimmedEmail, password);
      await syncBackend(u);
    } catch (e) { setError(cleanFirebaseError(e)); }
    finally     { setLoading(false); }
  };

  const busy = loading || googleLoading;

  return (
    <div style={S.page}>
      <div style={S.orb1} aria-hidden="true"/>
      <div style={S.orb2} aria-hidden="true"/>

      <main style={S.card}>
        {/* ── Logo ── */}
        <div style={S.logoArea}>
          <DrandeeLogo className="w-16 h-16 mb-4" />
          <DrandeeWordmark className="text-3xl" showGradient={true} />
          <p style={S.logoSub}>Share your moment</p>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={S.errorBox} role="alert" aria-live="polite">
            <span aria-hidden="true" style={{ color: '#FF6B6B', fontSize: 14 }}>⚠</span>
            <span style={S.errorText}>{error}</span>
          </div>
        )}

        {/* ── Google ── */}
        <button
          style={{ ...S.googleBtn, opacity: busy ? 0.65 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}
          onClick={handleGoogle}
          disabled={busy}
          aria-label="Continue with Google"
        >
          {googleLoading
            ? <div style={S.spinner} aria-hidden="true"/>
            : <GoogleIcon />}
          <span>{googleLoading ? 'Signing in…' : 'Continue with Google'}</span>
        </button>

        {/* ── Divider ── */}
        <div style={S.divider} aria-hidden="true">
          <div style={S.divLine}/>
          <span style={S.divText}>or with email</span>
          <div style={S.divLine}/>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleEmail} noValidate aria-label={isSignup ? 'Sign up form' : 'Login form'}>
          {/* Email */}
          <div style={{ ...S.field, borderColor: emailFocus ? 'var(--primary)' : 'rgba(255,255,255,0.1)', boxShadow: emailFocus ? '0 0 0 3px rgba(127,119,221,0.18)' : 'none' }}>
            <svg style={S.fieldIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <input
              id="login-email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setEF(true)}
              onBlur={() => setEF(false)}
              required
              autoComplete="email"
              style={S.input}
              aria-label="Email address"
            />
          </div>

          {/* Password */}
          <div style={{ ...S.field, marginTop: 12, borderColor: passFocus ? 'var(--primary)' : 'rgba(255,255,255,0.1)', boxShadow: passFocus ? '0 0 0 3px rgba(127,119,221,0.18)' : 'none' }}>
            <svg style={S.fieldIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              id="login-password"
              type={showPass ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setPF(true)}
              onBlur={() => setPF(false)}
              required
              minLength={6}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              style={S.input}
              aria-label="Password"
            />
            <button
              type="button"
              onClick={() => setShowPass(p => !p)}
              style={S.eyeBtn}
              aria-label={showPass ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showPass}/>
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            style={{ ...S.submitBtn, opacity: busy ? 0.65 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}
            aria-label={isSignup ? 'Create account' : 'Log in'}
          >
            {loading
              ? <><div style={S.spinner} aria-hidden="true"/>&nbsp;Please wait…</>
              : isSignup ? 'Create Account' : 'Log In'}
          </button>
        </form>

        {/* ── Toggle ── */}
        <div style={S.toggle}>
          <span style={S.toggleLabel}>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button
            type="button"
            onClick={() => { setIsSignup(p => !p); setError(''); }}
            style={S.toggleBtn}
          >
            {isSignup ? 'Log In' : 'Sign Up'}
          </button>
        </div>
      </main>

      <style>{`
        @keyframes login-spin { to { transform: rotate(360deg); } }
        #login-email,
        #login-password { color: #fff !important; }
        #login-email::placeholder,
        #login-password::placeholder { color: rgba(255,255,255,0.35); }
        #login-email:-webkit-autofill,
        #login-password:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 40px #1a1a2e inset !important;
          -webkit-text-fill-color: #fff !important;
          caret-color: #fff;
        }
      `}</style>
    </div>
  );
}

/* ── Styles ── */
const S = {
  page: {
    minHeight: '100dvh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#050505',
    padding: '24px 16px', position: 'relative', overflow: 'hidden',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', sans-serif",
  },
  orb1: {
    position: 'fixed', top: '-20%', left: '50%', transform: 'translateX(-50%)',
    width: '100vw', height: '55vh',
    background: 'radial-gradient(ellipse at center, rgba(127,119,221,0.22) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  orb2: {
    position: 'fixed', bottom: '-15%', right: '-15%', width: '65vw', height: '55vh',
    background: 'radial-gradient(ellipse at center, rgba(175,169,236,0.1) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  card: {
    width: '100%', maxWidth: 380, position: 'relative', zIndex: 1,
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 24, padding: '40px 32px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(127,119,221,0.08)',
  },
  logoArea: { textAlign: 'center', marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  logoSub: { fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: '8px 0 0' },
  errorBox: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.22)',
    borderRadius: 12, padding: '11px 14px', marginBottom: 16,
  },
  errorText: { fontSize: 13, color: '#FF6B6B', lineHeight: 1.5, flex: 1 },
  googleBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 10, background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.13)', borderRadius: 14,
    padding: '13px 20px', color: '#fff', fontSize: 15, fontWeight: 600,
    transition: 'all 0.2s ease', minHeight: 50, letterSpacing: '-0.01em',
    cursor: 'pointer',
  },
  divider: { display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' },
  divLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' },
  divText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', letterSpacing: '0.04em' },
  field: {
    display: 'flex', alignItems: 'center',
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid rgba(255,255,255,0.1)',
    borderRadius: 14, padding: '0 16px', minHeight: 52,
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  },
  fieldIcon: { color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginRight: 10 },
  input: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: '#fff', fontSize: 15, padding: '0', fontFamily: 'inherit',
    caretColor: '#9F99E8',
  },
  eyeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(255,255,255,0.3)', padding: '4px',
    display: 'flex', alignItems: 'center', marginLeft: 4, flexShrink: 0,
    transition: 'color 0.2s ease',
  },
  submitBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, background: 'linear-gradient(135deg, #7F77DD 0%, #6A61C9 100%)',
    color: '#fff', fontWeight: 700, fontSize: 16, padding: '14px 20px',
    borderRadius: 14, border: 'none', marginTop: 16, minHeight: 52,
    boxShadow: '0 0 28px rgba(127,119,221,0.35)',
    letterSpacing: '-0.01em', transition: 'opacity 0.2s ease',
  },
  spinner: {
    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
    animation: 'login-spin 0.7s linear infinite',
  },
  toggle: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 24, flexWrap: 'wrap' },
  toggleLabel: { fontSize: 13, color: 'rgba(255,255,255,0.38)' },
  toggleBtn: {
    fontSize: 13, fontWeight: 700, color: '#9F99E8',
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  },
};
