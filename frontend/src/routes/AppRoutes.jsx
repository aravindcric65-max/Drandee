import React, { Suspense, lazy, useContext, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { UserContext } from '../context/UserContext';

// Pages & Components Import (Lazy)
const Login = lazy(() => import('../pages/Login'));
const Reels = lazy(() => import('../pages/Reels'));
const Home = lazy(() => import('../pages/Home'));
const Profile = lazy(() => import('../pages/Profile'));
const Upload = lazy(() => import('../pages/Upload'));
const Spotlight = lazy(() => import('../pages/Spotlight'));
const Settings = lazy(() => import('../pages/Settings'));
const Search = lazy(() => import('../pages/Search'));
const HashtagPage = lazy(() => import('../pages/HashtagPage'));
const Notifications = lazy(() => import('../pages/Notifications'));
const OnboardingFlow = lazy(() => import('../components/onboarding/OnboardingFlow'));
const CreatorDashboard = lazy(() => import('../pages/creator/Dashboard'));
const CreatorAnalytics = lazy(() => import('../pages/creator/Analytics'));
const CreatorTopPosts = lazy(() => import('../pages/creator/TopPosts'));
const CreatorAudience = lazy(() => import('../pages/creator/Audience'));

// Per-route error boundary — contains lazy-import failures to the affected route only
class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('[RouteErrorBoundary]', error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#080808', color: '#fff', gap: 16 }}>
          <p style={{ fontSize: 16, fontFamily: 'Inter, sans-serif' }}>This page failed to load.</p>
          <a href="/" style={{ color: '#7F77DD', textDecoration: 'underline', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>Go to home</a>
        </div>
      );
    }
    return this.props.children;
  }
}

// 1. Protected Route
const ProtectedRoute = ({ children }) => {
  const { user, loading, backendSyncStatus, backendSyncError, retryBackendSync } = useAuth();
  const { user: backendUser } = useContext(UserContext) || {};
  const location = useLocation();
  
  // 1. Firebase auth still initializing
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  // 2. Not signed in → login (preserve the intended destination)
  if (!user) {
    const redirectPath = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(redirectPath)}`} replace />;
  }

  // 3. Backend sync in progress — show spinner, NOT a login redirect
  if (backendSyncStatus === 'idle' || backendSyncStatus === 'syncing') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // 4. Backend sync failed — show retry, NOT a login redirect
  if (backendSyncStatus === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#080808] gap-4" style={{ fontFamily: 'Inter, sans-serif' }}>
        <p className="text-white text-base">
          {backendSyncError || 'Could not load your profile. Check your connection.'}
        </p>
        <button
          onClick={retryBackendSync}
          className="px-6 py-3 rounded-xl font-semibold text-white"
          style={{ background: '#7F77DD' }}
        >
          Retry
        </button>
      </div>
    );
  }

  // 5. Sync ready — check onboarding. Use backendUser from AuthContext (freshest)
  // backendUser from AuthContext is the freshest source; UserContext's backendUser is from localStorage
  const profileUser = backendUser;
  const needsOnboarding = profileUser && profileUser.id && !profileUser.onboardingCompleted;

  if (needsOnboarding) {
    return (
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen bg-black">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      }>
        <OnboardingFlow onComplete={() => {}} />
      </Suspense>
    );
  }

  return children;
};

// 2. Public Route
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  if (user) {
    // ✅ FIXED: Redirect to /feed (not /reels)
    return <Navigate to="/feed" replace />;
  }
  return children;
};

// 3. Semi-public route — renders content logged-out, shows auth prompts on actions
const PublicProfileRoute = ({ children }) => {
  // Does NOT redirect to login — allows logged-out viewing
  // Actions inside the page (follow, respect, comment) will prompt login
  return children;
};

// Not-found page — sets noindex so Google doesn't index unknown SPA routes
const NotFound = () => {
  useEffect(() => {
    // Set noindex on unknown SPA routes so Google doesn't index them
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'robots'; document.head.appendChild(meta); }
    meta.content = 'noindex,nofollow';
    return () => { meta.content = 'index,follow'; };
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#080808', color: '#fff', gap: 16, fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Page not found</h1>
      <p style={{ fontSize: 14, color: '#888' }}>The page you're looking for doesn't exist.</p>
      <a href="/" style={{ color: '#7F77DD', textDecoration: 'underline', fontSize: 14 }}>Go home</a>
    </div>
  );
};

const AppRoutes = () => {
  const location = useLocation();
  
  // Hide navbar on login and spotlight for full-screen immersive experience
  const hideNavbarRoutes = ['/login', '/spotlight'];
  const shouldShowNavbar = !hideNavbarRoutes.includes(location.pathname);

  return (
    <>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-black"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>}>
        <Routes>
        {/* ✅ FIXED: Default route redirects to /feed (not /login) */}
        <Route path="/" element={<Navigate to="/feed" replace />} />
        
        {/* ===== PUBLIC ROUTES ===== */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        
        {/* ===== PROTECTED ROUTES ===== */}
        <Route path="/feed" element={<RouteErrorBoundary><ProtectedRoute><Home /></ProtectedRoute></RouteErrorBoundary>} />
        <Route path="/reels" element={<RouteErrorBoundary><ProtectedRoute><Reels /></ProtectedRoute></RouteErrorBoundary>} />
        <Route path="/profile" element={<RouteErrorBoundary><ProtectedRoute><Profile /></ProtectedRoute></RouteErrorBoundary>} />
        <Route path="/profile/:id" element={<RouteErrorBoundary><ProtectedRoute><Profile /></ProtectedRoute></RouteErrorBoundary>} />
        <Route path="/u/:username" element={<RouteErrorBoundary><PublicProfileRoute><Profile /></PublicProfileRoute></RouteErrorBoundary>} />
        <Route path="/creator/:id" element={<RouteErrorBoundary><ProtectedRoute><Profile /></ProtectedRoute></RouteErrorBoundary>} />
        <Route path="/search" element={<RouteErrorBoundary><ProtectedRoute><Search /></ProtectedRoute></RouteErrorBoundary>} />
        <Route path="/notifications" element={<RouteErrorBoundary><ProtectedRoute><Notifications /></ProtectedRoute></RouteErrorBoundary>} />
        <Route path="/settings" element={<RouteErrorBoundary><ProtectedRoute><Settings /></ProtectedRoute></RouteErrorBoundary>} />
        <Route path="/upload" element={<RouteErrorBoundary><ProtectedRoute><Upload /></ProtectedRoute></RouteErrorBoundary>} />
        <Route path="/spotlight" element={<RouteErrorBoundary><ProtectedRoute><Spotlight /></ProtectedRoute></RouteErrorBoundary>} />
        <Route path="/tag/:tag" element={<RouteErrorBoundary><PublicProfileRoute><HashtagPage /></PublicProfileRoute></RouteErrorBoundary>} />
        
        {/* ===== CREATOR ANALYTICS ROUTES ===== */}
        <Route path="/creator/dashboard" element={<RouteErrorBoundary><ProtectedRoute><CreatorDashboard /></ProtectedRoute></RouteErrorBoundary>} />
        <Route path="/creator/analytics" element={<RouteErrorBoundary><ProtectedRoute><CreatorAnalytics /></ProtectedRoute></RouteErrorBoundary>} />
        <Route path="/creator/top-posts" element={<RouteErrorBoundary><ProtectedRoute><CreatorTopPosts /></ProtectedRoute></RouteErrorBoundary>} />
        <Route path="/creator/audience" element={<RouteErrorBoundary><ProtectedRoute><CreatorAudience /></ProtectedRoute></RouteErrorBoundary>} />
        
        {/* 404 — sets noindex so Google doesn't waste crawl budget on SPA routes */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>

      {/* Login page thavira matha ellathilayum Navbar varum */}
      {shouldShowNavbar && <Navbar />}
    </>
  );
};

export default AppRoutes;
