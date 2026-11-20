import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDCqai0QxC4Wg5MRVcFFy_A9qRo-Hj2Xa0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "hackathon-c30ed.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "hackathon-c30ed",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "hackathon-c30ed.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "28815143246",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:28815143246:web:2ec3c97f9226573b466e1f",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-Y3LNLJXBW3",
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and Auth
export const db = getFirestore(app);
export const auth = getAuth(app);

// Initialize Firebase Analytics conditionally (only supported in browser environments)
let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Analytics not supported in this environment
  });
}

export { analytics };
export default app;
