import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase.js';

const EMAILS_HISTORIAL_COMPARTIDO = new Set([
  'grupocontable2130@gmail.com',
  'analista.calidad@crearte-sas.com',
]);

export const esAdmin = (email) =>
  EMAILS_HISTORIAL_COMPARTIDO.has(String(email || '').trim().toLowerCase());

export const guardarEnFirestore = async (registro) => {
  const { fotos, ...sinFotos } = registro;
  const ref = await addDoc(collection(db, 'auditorias'), {
    ...sinFotos,
    cantidadFotos: fotos?.length || 0,
  });
  return ref.id;
};

export const cargarDeFirestore = async (emailUsuario) => {
  try {
    // Evita pedir un índice compuesto para auditor + id; el orden se aplica
    // después de leer los documentos autorizados.
    const consulta = esAdmin(emailUsuario)
      ? collection(db, 'auditorias')
      : query(collection(db, 'auditorias'), where('auditor', '==', emailUsuario));
    const snapshot = await getDocs(consulta);
    return snapshot.docs
      .map((item) => ({ ...item.data(), _firestoreId: item.id }))
      .sort((a, b) => (Number(b.id) || Date.parse(b.fecha || '') || 0)
        - (Number(a.id) || Date.parse(a.fecha || '') || 0));
  } catch (error) {
    console.error('Error cargando Firestore:', error);
    throw error;
  }
};

export const eliminarDeFirestore = async (firestoreId) => {
  await deleteDoc(doc(db, 'auditorias', firestoreId));
};
