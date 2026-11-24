import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { APPS, CORREOS_INICIALES } from "../config/apps";
import { db, FIREBASE_DATABASE_ID, FIREBASE_PROJECT_ID } from "../firebase";

const crearAcceso = (valor = false) =>
  Object.fromEntries(APPS.map(({ id }) => [id, valor]));

const normalizar = (correo) => String(correo || "").trim().toLowerCase();

function explicarError(error, accion) {
  const codigo = error?.code || "error-desconocido";
  if (codigo === "permission-denied") {
    return `Firebase rechazó ${accion} (permission-denied). Publica las reglas de firestore.rules y confirma que la sesión sea grupocontable2130@gmail.com.`;
  }
  if (codigo === "unauthenticated") {
    return "La sesión de administrador expiró. Cierra sesión e ingresa de nuevo.";
  }
  if (codigo === "unavailable" || codigo === "network-request-failed") {
    const detalle = error?.message ? ` ${error.message}` : "";
    return `Firebase no pudo conectar (${codigo}). Proyecto: ${FIREBASE_PROJECT_ID}; base: ${FIREBASE_DATABASE_ID}. Revisa que esa base exista y la conexión. Detalle:${detalle}`;
  }
  return `No se pudo ${accion} (${codigo}). Revisa la consola del navegador para ver el detalle.`;
}

export function useAccesos() {
  const [correos, setCorreos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let inicializado = false;
    const lista = query(collection(db, "app_access"), orderBy("email"));

    const unsubscribe = onSnapshot(
      lista,
      async (snapshot) => {
        setError("");
        setCorreos(snapshot.docs.map((item) => ({
          id: item.id,
          email: item.data().email || item.id,
          acceso: { ...crearAcceso(), ...item.data().access },
        })));
        setCargando(false);

        if (!inicializado) {
          inicializado = true;
          if (snapshot.empty) {
            const batch = writeBatch(db);
            CORREOS_INICIALES.forEach((email) => {
              batch.set(doc(db, "app_access", email), {
                email,
                access: crearAcceso(),
                updatedAt: serverTimestamp(),
              });
            });
            try {
              await batch.commit();
            } catch (e) {
              console.error("Error creando la lista inicial:", e);
              setError(explicarError(e, "crear la lista inicial"));
            }
          }
        }
      },
      (e) => {
        setCargando(false);
        setError("No se pudo cargar la lista compartida. Revisa la conexión y las reglas de Firestore.");
        console.error(e);
      }
    );

    return unsubscribe;
  }, []);

  const agregar = async (texto) => {
    const email = normalizar(texto);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Escribe un correo válido.";
    let existente;
    try {
      existente = await getDoc(doc(db, "app_access", email));
    } catch (e) {
      console.error("Error consultando el correo en Firestore:", e);
      return explicarError(e, "consultar el correo en Firestore");
    }
    if (correos.some((c) => c.email === email) || existente.exists()) {
      return "Ese correo ya está en la lista.";
    }

    try {
      await setDoc(doc(db, "app_access", email), {
        email,
        access: crearAcceso(),
        updatedAt: serverTimestamp(),
      });
      return null;
    } catch (e) {
      console.error("Error guardando el correo en Firestore:", e);
      return explicarError(e, "agregar el correo");
    }
  };

  const eliminar = async (id) => {
    try {
      await deleteDoc(doc(db, "app_access", id));
    } catch (e) {
      console.error(e);
      setError(explicarError(e, "eliminar el correo"));
    }
  };

  const editar = async (id, texto) => {
    const email = normalizar(texto);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Escribe un correo válido.";
    if (email === id) return null;

    try {
      const nuevaReferencia = doc(db, "app_access", email);
      if ((await getDoc(nuevaReferencia)).exists()) return "Ese correo ya está en la lista.";

      const referenciaAnterior = doc(db, "app_access", id);
      const anterior = await getDoc(referenciaAnterior);
      if (!anterior.exists()) return "El correo ya no existe en la lista. Recarga el panel.";

      const batch = writeBatch(db);
      batch.set(nuevaReferencia, {
        ...anterior.data(),
        email,
        updatedAt: serverTimestamp(),
      });
      batch.delete(referenciaAnterior);
      await batch.commit();
      return null;
    } catch (e) {
      console.error("Error editando el correo en Firestore:", e);
      return explicarError(e, "editar el correo");
    }
  };

  const alternar = async (id, appId) => {
    const correo = correos.find((item) => item.id === id);
    if (!correo) return;
    try {
      await updateDoc(doc(db, "app_access", id), {
        [`access.${appId}`]: !correo.acceso[appId],
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      setError(explicarError(e, "cambiar el permiso"));
    }
  };

  return { correos, agregar, editar, eliminar, alternar, cargando, error };
}
