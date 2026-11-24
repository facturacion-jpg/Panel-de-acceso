import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

function mostrarFecha(value) {
  if (!value?.toDate) return "Hace un momento";
  return value.toDate().toLocaleString("es-CO");
}

export default function SolicitudesRegistro({ correos, onAdd }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState("");

  useEffect(() => {
    const lista = query(collection(db, "registration_requests"), orderBy("createdAt", "desc"));
    return onSnapshot(lista, (snapshot) => {
      setSolicitudes(snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.status === "pending"));
      setError("");
    }, (cause) => {
      console.error("No se pudieron cargar los nuevos registros:", cause);
      setError("No se pudieron consultar los nuevos registros. Publica las reglas actualizadas de Firestore.");
    });
  }, []);

  const revisar = async (solicitud) => {
    setProcesando(solicitud.id);
    setError("");
    try {
      const existe = correos.some((correo) => correo.id === solicitud.email || correo.email === solicitud.email);
      if (!existe) {
        const errorAgregar = await onAdd(solicitud.email);
        if (errorAgregar) throw new Error(errorAgregar);
      }
      await updateDoc(doc(db, "registration_requests", solicitud.id), {
        status: "reviewed",
        reviewedAt: serverTimestamp(),
      });
    } catch (cause) {
      console.error("No se pudo revisar el registro:", cause);
      setError(cause?.message || "No se pudo agregar el usuario a la lista de accesos.");
    } finally {
      setProcesando("");
    }
  };

  return <section className="new-user-notices" aria-live="polite" aria-label="Nuevas cuentas registradas">
    <div className="new-user-heading">
      <div><h2>Nuevos usuarios</h2><p className="sub">{solicitudes.length ? `${solicitudes.length} registro${solicitudes.length === 1 ? "" : "s"} pendiente${solicitudes.length === 1 ? "" : "s"}` : "No hay registros pendientes."}</p></div>
      {solicitudes.length > 0 && <span className="new-user-count">{solicitudes.length}</span>}
    </div>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {solicitudes.map((solicitud) => <article className="new-user-card" key={solicitud.id}>
      <div><strong>{solicitud.name || "Usuario nuevo"}</strong><span>{solicitud.email}</span><small>Se registró {mostrarFecha(solicitud.createdAt)}</small></div>
      <button type="button" className="btn" disabled={procesando === solicitud.id} onClick={() => revisar(solicitud)}>
        {procesando === solicitud.id ? "Guardando…" : "Agregar a accesos"}
      </button>
    </article>)}
  </section>;
}
