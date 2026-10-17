import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

// Pages & Components Import (Lazy)
const Login = lazy(() => import('../pages/Login'));
const Reels = lazy(() => import('../pages/Reels'));
const Home = lazy(() => import('../pages/Home'));
const Profile = lazy(() => import('../pages/Profile'));
const Upload = lazy(() => import('../pages/Upload'));
const Spotlight = lazy(() => import('../pages/Spotlight'));
const Settings = lazy(() => import('../pages/Settings'));
const Search = lazy(() => import('../pages/Search'));
const Notifications = lazy(() => import('../pages/Notifications'));
const OnboardingFlow = lazy(() => import('../components/onboarding/OnboardingFlow'));

// 1. Protected Route
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Intercept for onboarding
  if (user && user.onboardingCompleted === false) {
    // If onboarding is not completed, we render the flow. 
    // It will call updateUser which triggers a re-render and bypasses this.
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
        <Route path="/feed" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/reels" element={<ProtectedRoute><Reels /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/creator/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
        <Route path="/spotlight" element={<ProtectedRoute><Spotlight /></ProtectedRoute>} />
        
        {/* ✅ FIXED: Thappana URL adichal /feed-kku pogum */}
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
      </Suspense>

      {/* Login page thavira matha ellathilayum Navbar varum */}
      {shouldShowNavbar && <Navbar />}
    </>
  );
};

export default AppRoutes;