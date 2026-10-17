// frontend/src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDsRPVG0MBCqRrAHgjQu0TmfZbrwprQv2E",
  authDomain: "drandee-a47e7.firebaseapp.com",
  projectId: "drandee-a47e7",
  storageBucket: "drandee-a47e7.firebasestorage.app",
  messagingSenderId: "770052054476",
  appId: "1:770052054476:web:a4c116eb5f30e4e279d169",
  measurementId: "G-WX64SR1WW4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Google Provider
export const googleProvider = new GoogleAuthProvider();

// Initialize Analytics (optional)
// import { getAnalytics } from "firebase/analytics";
// const analytics = getAnalytics(app);

export default app;