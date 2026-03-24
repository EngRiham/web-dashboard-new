import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAhbjCBDAJj3lYks5Zp2RhfFzO5TktWjaw",
  authDomain: "cnc-monitor-967f7.firebaseapp.com",
  databaseURL: "https://cnc-monitor-967f7-default-rtdb.firebaseio.com",
  projectId: "cnc-monitor-967f7",
  storageBucket: "cnc-monitor-967f7.firebasestorage.app",
  messagingSenderId: "106748688678",
  appId: "1:106748688678:web:2d1105007fb7b12cf3a9e7",
  measurementId: "G-EJVL8LMY5G"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
