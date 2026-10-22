const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let app;

try {
  if (process.env.FIREBASE_PROJECT_ID) {
    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Handle escaped newlines in environment variables
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log("🔥 Firebase Admin initialized via environment variables.");
  } else {
    try {
      const serviceAccount = require('../firebaseServiceAccountKey.json');
      app = initializeApp({
        credential: cert(serviceAccount)
      });
      console.log("🔥 Firebase Admin initialized via service account file.");
    } catch (fileError) {
      console.error("❌ Firebase service account file not found and environment variables not set. Firebase Auth will not work.");
    }
  }
} catch (error) {
  console.error("❌ Firebase Admin initialization error:", error);
}

module.exports = { app, getAuth };
