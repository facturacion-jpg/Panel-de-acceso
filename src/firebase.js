import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// Configuración de la app web del panel. Si no hay variables de entorno,
// conserva como respaldo la configuración del proyecto existente.
const firebaseConfigExistente = {
  apiKey: "AIzaSyA1__VruS3tHvNpeMpg6g50-5NyNmcMXlQ",
  authDomain: "crearte-by-confeccionart-6febe.firebaseapp.com",
  projectId: "crearte-by-confeccionart-6febe",
  storageBucket: "crearte-by-confeccionart-6febe.firebasestorage.app",
  messagingSenderId: "608899242887",
  appId: "1:608899242887:web:25e01fd0c8ed0007225122",
  measurementId: "G-PFW5CGDXXQ",
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigExistente.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigExistente.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigExistente.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigExistente.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigExistente.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigExistente.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigExistente.measurementId,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Long polling evita bloqueos de WebChannel causados por algunos proxies o antivirus.
const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID?.trim();
const firestoreSettings = { experimentalForceLongPolling: true };
export const db = databaseId && databaseId !== "(default)"
  ? initializeFirestore(app, firestoreSettings, databaseId)
  : initializeFirestore(app, firestoreSettings);

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_DATABASE_ID = databaseId || "(default)";
export const ADMIN_EMAIL = "grupocontable2130@gmail.com";
