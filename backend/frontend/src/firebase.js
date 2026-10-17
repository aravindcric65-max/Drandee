import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDuXwYU2Me0VtIq5xN_s6rJ5jHSB0TTlr4",
  authDomain: "drandee-6b0c3.firebaseapp.com",
  projectId: "drandee-6b0c3",
  storageBucket: "drandee-6b0c3.firebasestorage.app",
  messagingSenderId: "783202680857",
  appId: "1:783202680857:web:eb370b1dc5c50263a92a88"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Service 
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);