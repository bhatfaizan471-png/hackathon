import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD28lJfTEJf9621ygcyR7uohdnwlGv9Js0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "hackathon-5e1a9.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "hackathon-5e1a9",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "hackathon-5e1a9.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "365569722820",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:365569722820:web:5888a6e038d589ba56fc91",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-CGLN7X3KYT",
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
