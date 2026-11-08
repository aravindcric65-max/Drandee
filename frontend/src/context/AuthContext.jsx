// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { 
  signInWithPopup, 
  signInWithRedirect,
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { auth, googleProvider } from "../firebase/config";

const AuthContext = createContext();

const BACKEND_LOGIN_URL = '/api/auth/firebase-login';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);           // Firebase user
  const [loading, setLoading] = useState(true);     // Firebase auth initializing
  const [backendSyncStatus, setBackendSyncStatus] = useState('idle'); // 'idle'|'syncing'|'ready'|'error'
  const [backendUser, setBackendUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [backendSyncError, setBackendSyncError] = useState(null);
  const syncInFlightRef = useRef(false);            // guard against duplicate sync calls
  const lastSyncedUidRef = useRef(null);            // guard against re-syncing the same user

  // Sync Firebase user → backend. Returns the backend user object.
  const syncWithBackend = useCallback(async (firebaseUser) => {
    if (!firebaseUser) return null;
    // Deduplicate: skip if a sync is already in flight for the same UID
    if (syncInFlightRef.current && lastSyncedUidRef.current === firebaseUser.uid) return null;
    syncInFlightRef.current = true;
    lastSyncedUidRef.current = firebaseUser.uid;
    setBackendSyncStatus('syncing');
    setBackendSyncError(null);
    try {
      const res = await fetch(BACKEND_LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        }),
      });
      if (!res.ok) throw new Error(`Backend sync failed (${res.status})`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Backend sync failed');
      // Persist before setting status so ProtectedRoute sees complete data
      try { localStorage.setItem('user', JSON.stringify(data.user)); } catch (_) {}
      setBackendUser(data.user);
      setBackendSyncStatus('ready');
      window.dispatchEvent(new Event('user_updated'));
      return data.user;
    } catch (err) {
      setBackendSyncStatus('error');
      setBackendSyncError(err.message || 'Backend sync failed');
      return null;
    } finally {
      syncInFlightRef.current = false;
    }
  }, []);

  // Re-sync on demand (retry action)
  const retryBackendSync = useCallback(() => {
    if (user) {
      lastSyncedUidRef.current = null; // allow re-sync
      syncWithBackend(user);
    }
  }, [user, syncWithBackend]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser) {
        // Only auto-sync if not already synced for this user
        if (lastSyncedUidRef.current !== firebaseUser.uid) {
          await syncWithBackend(firebaseUser);
        }
      } else {
        // User signed out — clear backend state
        setBackendSyncStatus('idle');
        setBackendUser(null);
        setBackendSyncError(null);
        lastSyncedUidRef.current = null;
        try { localStorage.removeItem('user'); } catch (_) {}
      }
    });
    return unsubscribe;
  }, [syncWithBackend]);

  // Google Sign In
  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.warn("Google Sign-In Popup failed, falling back to redirect:", error);
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request' || error.message.includes('Cross-Origin')) {
         signInWithRedirect(auth, googleProvider);
      } else {
         throw error;
      }
    }
  };

  // Email/Password Sign Up
  const signUpWithEmail = async (email, password) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      console.error("Sign Up Error:", error);
      throw error;
    }
  };

  // Email/Password Sign In
  const signInWithEmail = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      console.error("Sign In Error:", error);
      throw error;
    }
  };

  // Sign Out
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
      throw error;
    }
  };

  const value = {
    user,                   // Firebase user (null if not signed in)
    loading,                // Firebase auth initializing
    backendSyncStatus,      // 'idle' | 'syncing' | 'ready' | 'error'
    backendUser,            // backend profile (null until synced)
    backendSyncError,       // error message if sync failed
    syncWithBackend,        // manual trigger (used by Login page)
    retryBackendSync,       // retry after failure
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
