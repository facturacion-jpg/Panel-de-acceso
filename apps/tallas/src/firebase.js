import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const config = {
  apiKey: 'AIzaSyA1__VruS3tHvNpeMpg6g50-5NyNmcMXlQ',
  authDomain: 'crearte-by-confeccionart-6febe.firebaseapp.com',
  projectId: 'crearte-by-confeccionart-6febe',
  storageBucket: 'crearte-by-confeccionart-6febe.firebasestorage.app',
  messagingSenderId: '608899242887',
  appId: '1:608899242887:web:25e01fd0c8ed0007225122',
  measurementId: 'G-PFW5CGDXXQ',
};

const firebaseApp = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(firebaseApp);
export const db = initializeFirestore(firebaseApp, { experimentalForceLongPolling: true });
export const ADMIN_EMAIL = 'grupocontable2130@gmail.com';
