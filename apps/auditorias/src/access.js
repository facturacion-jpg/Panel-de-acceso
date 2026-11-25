import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { app } from './firebase.js';

const db = getFirestore(app);

export async function tieneAcceso(email, modulo) {
  if (!email) return false;
  try {
    const perfil = await getDoc(doc(db, 'app_access', email.trim().toLowerCase()));
    return perfil.exists() && perfil.data()?.access?.[modulo] === true;
  } catch (error) {
    console.error('No se pudo validar el permiso:', error);
    return false;
  }
}
