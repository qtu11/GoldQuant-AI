import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDRmJ294aBZhVEcTliP86D19qM3tJbhgDI", 
  authDomain: "qtusdev.firebaseapp.com", 
  projectId: "qtusdev", 
  storageBucket: "qtusdev.firebasestorage.app", 
  messagingSenderId: "98060679867", 
  appId: "1:98060679867:web:563015a0a052b2f432879e", 
  measurementId: "G-F4F16X1TW4" 
};

// Khởi tạo Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { db };
export default app;
