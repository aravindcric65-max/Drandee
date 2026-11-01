import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { UploadProvider } from './context/UploadContext';
import { AuthProvider } from './context/AuthContext';
import { UserProvider } from './context/UserContext';
import GlobalUploadToast from './components/studio/GlobalUploadToast';
import PushNotification from './components/notifications/PushNotification';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import DrandeeLogo from './components/brand/DrandeeLogo';
import './index.css';

const AppTransition = ({ children }) => {
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setShowIntro(false);
      return;
    }
    const timer = setTimeout(() => setShowIntro(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {children}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} // Cinematic ease-out cubic
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              zIndex: 999999,
              pointerEvents: 'none'
            }}
          >
            <DrandeeLogo className="w-20 h-20" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <UserProvider>
        <UploadProvider>
          <AppTransition>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <AppRoutes />
              <GlobalUploadToast />
              <PushNotification />
            </Router>
          </AppTransition>
        </UploadProvider>
      </UserProvider>
    </AuthProvider>
  );
}

export default App;