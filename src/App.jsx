import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import AddEmailForm from "./components/AddEmailForm";
import AdminRegistros from "./components/AdminRegistros";
import EmailCard from "./components/EmailCard";
import SolicitudesRegistro from "./components/SolicitudesRegistro";
import { ADMIN_EMAIL, auth, db, FIREBASE_DATABASE_ID, FIREBASE_PROJECT_ID } from "./firebase";
import { APPS } from "./config/apps";
import { useAccesos } from "./hooks/useAccesos";

const marcarSalidaAplicativo = () => {
  try { sessionStorage.setItem("panel-accesos:retorno-aplicativo", "1"); } catch {}
};

const urlAplicativo = (app) => {
  if (app.id !== "cotizador_muestras") return app.url;
  const url = new URL(app.url, window.location.origin);
  url.searchParams.set("panel_return", window.location.origin);
  return url.toString();
};

function BotonTema({ tema, onClick }) {
  const texto = tema === "dark" ? "Modo claro" : "Modo oscuro";
  return <button type="button" className="theme-button" onClick={onClick} aria-label={`Cambiar a ${texto.toLowerCase()}`}><span aria-hidden="true">{tema === "dark" ? "☀" : "☾"}</span><span>{texto}</span></button>;
}

function IniciarSesion({ mensaje, onLogin, onRegister, onRecover, tema, onToggleTheme }) {
  const [modo, setModo] = useState("ingresar");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState(mensaje || "");
  const [cargando, setCargando] = useState(false);
  useEffect(() => setError(mensaje || ""), [mensaje]);
  const enviar = async (event) => {
    event.preventDefault(); setError(""); setCargando(true);
    try {
      if (modo === "registro") {
        await onRegister(nombre.trim(), email.trim().toLowerCase(), clave);
        setModo("ingresar"); setClave(""); setError("");
        setMensajeLocal("Cuenta creada y aviso enviado al administrador. Podrás ingresar a los aplicativos cuando habilite tu acceso.");
      } else await onLogin(email.trim().toLowerCase(), clave);
    }
    catch (error) {
      if (error?.code === "auth/invalid-credential" || error?.code === "auth/wrong-password" || error?.code === "auth/user-not-found") {
        setError("Correo o contraseña incorrectos. Verifica tus datos o restablece la contraseña.");
      } else setError(error?.message || "No se pudo completar la operación.");
    }
    finally { setCargando(false); }
  };
  const [mensajeLocal, setMensajeLocal] = useState("");
  const recuperar = async () => {
    setError(""); setMensajeLocal(""); setCargando(true);
    try {
      await onRecover(email.trim().toLowerCase());
      setMensajeLocal("Si ese correo tiene una cuenta, recibirás un enlace para restablecer la contraseña.");
    } catch (error) {
      setError(error?.code === "auth/invalid-email" ? "Escribe un correo válido." : "No se pudo enviar el enlace. Revisa el correo e inténtalo de nuevo.");
    } finally { setCargando(false); }
  };
  return <main className="login-wrap"><BotonTema tema={tema} onClick={onToggleTheme} /><section className="login-card">
    <span className="eyebrow">CONFECCIONARTE · APLICATIVOS</span><h1>{modo === "registro" ? "Crear cuenta" : "Ingresar"}</h1>
    <p className="sub">{modo === "registro" ? "Registra tu cuenta para solicitar acceso a los aplicativos." : "Ingresa para abrir los aplicativos que tienes autorizados."}</p>
    <div className="login-modes"><button type="button" className={modo === "ingresar" ? "selected" : ""} onClick={() => { setModo("ingresar"); setError(""); setMensajeLocal(""); }}>Ingresar</button><button type="button" className={modo === "registro" ? "selected" : ""} onClick={() => { setModo("registro"); setError(""); setMensajeLocal(""); }}>Crear cuenta</button></div>
    <form className="login-form" onSubmit={enviar}>
      {modo === "registro" && <><label htmlFor="user-name">Nombre</label><input id="user-name" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="name" />
      </>}
      <label htmlFor="user-email">Correo</label><input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
      <label htmlFor="user-password">Contraseña</label><input id="user-password" type="password" minLength={6} value={clave} onChange={(e) => setClave(e.target.value)} required autoComplete={modo === "registro" ? "new-password" : "current-password"} />
      {modo === "ingresar" && <button className="login-recover" type="button" onClick={recuperar} disabled={cargando}>¿Olvidaste tu contraseña?</button>}
      {mensajeLocal && <p className="success-banner" role="status">{mensajeLocal}</p>}
      {error && <p className="error-banner" role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={cargando}>{cargando ? "Un momento…" : modo === "registro" ? "Crear cuenta" : "Iniciar sesión"}</button>
    </form><p className="login-help">Después de crear tu cuenta, solicita al administrador que habilite los aplicativos que necesitas.</p>
  </section></main>;
}

function PanelAdmin({ usuario, onLogout, tema, onToggleTheme }) {
  const { correos, agregar, editar, eliminar, alternar, cargando, error } = useAccesos();
  const [vista, setVista] = useState("accesos");
  return <div className="wrap"><header className="page-head"><div><span className="eyebrow">CONFECCIONARTE · ADMINISTRACIÓN</span><h1>Panel administrativo</h1><p className="sub">Gestiona accesos y consulta los registros de todos los aplicativos.</p><p className="firebase-project">Firebase: {FIREBASE_PROJECT_ID} · base {FIREBASE_DATABASE_ID}</p></div><div className="admin-session"><span>{usuario.email}</span><BotonTema tema={tema} onClick={onToggleTheme} /><button type="button" className="del" onClick={onLogout}>Cerrar sesión</button></div></header>
    <nav className="admin-main-tabs" aria-label="Secciones administrativas"><button type="button" className={vista === "accesos" ? "selected" : ""} onClick={() => setVista("accesos")}>Accesos</button><button type="button" className={vista === "registros" ? "selected" : ""} onClick={() => setVista("registros")}>Registros</button>{APPS.map((app) => <a key={app.id} href={urlAplicativo(app)} onClick={marcarSalidaAplicativo}>{app.nombre}</a>)}</nav>
    {vista === "registros" ? <AdminRegistros /> : <><SolicitudesRegistro correos={correos} onAdd={agregar} /><AddEmailForm onAdd={agregar} /><div className="legend"><span><span className="dot dot-on" />Con acceso</span><span><span className="dot dot-off" />Sin acceso</span></div>
      {error && <p className="error-banner" role="alert">{error}</p>}{cargando ? <p className="empty">Cargando permisos compartidos…</p> : correos.length === 0 ? <p className="empty">No hay correos registrados todavía.</p> : <ul className="list">{correos.map((correo) => <EmailCard key={correo.id} correo={correo} onToggle={alternar} onEdit={editar} onDelete={eliminar} />)}</ul>}</>}
  </div>;
}

function PortalAplicativos({ usuario, permisos, mensaje, onLogout, tema, onToggleTheme }) {
  const disponibles = APPS.filter((app) => permisos[app.id]);
  return <main className="wrap"><header className="page-head"><div><span className="eyebrow">CONFECCIONARTE · APLICATIVOS</span><h1>Hola, {usuario.displayName || usuario.email}</h1><p className="sub">Estos son los aplicativos disponibles para tu cuenta.</p></div><div className="admin-session"><BotonTema tema={tema} onClick={onToggleTheme} /><button type="button" className="del" onClick={onLogout}>Cerrar sesión</button></div></header>
    {disponibles.length === 0 && <p className="empty" role="status">{mensaje || "Tu cuenta aún no tiene aplicativos habilitados. Solicita acceso al administrador."}</p>}
    <section className="app-launcher" aria-label="Aplicativos autorizados">{disponibles.map((app) => <article className="app-card" key={app.id}><h2>{app.nombre}</h2>{app.url ? <a className="btn" href={urlAplicativo(app)} onClick={marcarSalidaAplicativo}>Abrir aplicativo <span aria-hidden="true">↗</span></a> : <p className="sub">La dirección de este aplicativo aún no está configurada.</p>}</article>)}</section>
  </main>;
}

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [permisos, setPermisos] = useState({});
  const [requiereIngreso, setRequiereIngreso] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [tema, setTema] = useState(() => { try { return localStorage.getItem("panel-accesos:tema") === "dark" ? "dark" : "light"; } catch { return "light"; } });
  useEffect(() => { document.documentElement.dataset.theme = tema; try { localStorage.setItem("panel-accesos:tema", tema); } catch {} }, [tema]);
  useEffect(() => {
    let detenerPermisos = null;
    let primerEstadoAuth = true;
    const navegacion = performance.getEntriesByType?.("navigation")?.[0];
    const navegandoAtras = navegacion?.type === "back_forward";
    const claveRetorno = "panel-accesos:retorno-aplicativo";
    let retornoMarcado = false;
    try {
      const queryRetorno = new URLSearchParams(window.location.search).get("retornoAplicativo") === "1";
      // El panel marca la salida al aplicativo antes de navegar. No dependemos
      // del tipo de navegación que reporte cada navegador al regresar.
      retornoMarcado = queryRetorno || sessionStorage.getItem(claveRetorno) === "1";
      sessionStorage.removeItem(claveRetorno);
      const url = new URL(window.location.href);
      if (url.searchParams.has("retornoAplicativo")) {
        url.searchParams.delete("retornoAplicativo");
        window.history.replaceState(null, "", url);
      }
    } catch { /* Si el almacenamiento está bloqueado, queda la detección del historial. */ }
    const volviendoDesdeAplicativo = navegandoAtras || retornoMarcado;
    const detenerAuth = onAuthStateChanged(auth, (user) => {
      // Al abrir el panel desde cero se pide login; al volver desde un aplicativo
      // se conserva la sesión y el usuario regresa a la pantalla que dejó abierta.
      if (primerEstadoAuth) {
        primerEstadoAuth = false;
        if (user && !volviendoDesdeAplicativo) setRequiereIngreso(true);
      }
      detenerPermisos?.();
      detenerPermisos = null;
      setVerificando(true);
      if (!user) {
        setUsuario(null); setPermisos({}); setMensaje(""); setVerificando(false);
        return;
      }
      setUsuario(user);
      if (user.email?.toLowerCase() === ADMIN_EMAIL) {
        setPermisos({}); setMensaje(""); setVerificando(false);
        return;
      }
      const email = user.email?.trim().toLowerCase();
      if (!email) {
        setPermisos({}); setMensaje("La cuenta de Firebase no tiene un correo asociado."); setVerificando(false);
        return;
      }
      detenerPermisos = onSnapshot(doc(db, "app_access", email), (perfil) => {
        const acceso = perfil.exists() ? perfil.data()?.access || {} : {};
        setPermisos(acceso);
        setMensaje(APPS.some(({ id }) => acceso[id] === true) ? "" : "Tu cuenta aún no tiene aplicativos habilitados. Solicita acceso al administrador.");
        setVerificando(false);
      }, (error) => {
        console.error("No se pudieron consultar tus permisos:", error);
        setPermisos({}); setMensaje("No se pudieron validar tus permisos. Revisa la conexión y las reglas de Firestore."); setVerificando(false);
      });
    });
    return () => { detenerAuth(); detenerPermisos?.(); };
  }, []);
  useEffect(() => {
    const limpiarRetornoRestaurado = (event) => {
      if (event.persisted) {
        try { sessionStorage.removeItem("panel-accesos:retorno-aplicativo"); } catch {}
      }
    };
    window.addEventListener("pageshow", limpiarRetornoRestaurado);
    return () => window.removeEventListener("pageshow", limpiarRetornoRestaurado);
  }, []);
  const iniciar = async (email, clave) => {
    const credencial = await signInWithEmailAndPassword(auth, email, clave);
    setRequiereIngreso(false);
    return credencial;
  };
  const recuperar = (email) => sendPasswordResetEmail(auth, email);
  const registrar = async (nombre, email, clave) => {
    if (!nombre) throw new Error("Escribe tu nombre.");
    if (clave.length < 6) throw new Error("La contraseña debe tener mínimo 6 caracteres.");
    try {
      const credencial = await createUserWithEmailAndPassword(auth, email, clave);
      await updateProfile(credencial.user, { displayName: nombre });
      await setDoc(doc(db, "registration_requests", credencial.user.uid), {
        uid: credencial.user.uid,
        name: nombre,
        email,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setRequiereIngreso(false);
    } catch (error) {
      if (error?.code === "auth/email-already-in-use") throw new Error("Ese correo ya tiene una cuenta. Ingresa con tu contraseña.");
      if (error?.code === "auth/invalid-email") throw new Error("Escribe un correo válido.");
      if (error?.code === "auth/weak-password") throw new Error("La contraseña debe tener mínimo 6 caracteres.");
      throw new Error("No se pudo crear la cuenta. Revisa la conexión y la configuración de Firebase.");
    }
  };
  const alternarTema = () => setTema((actual) => actual === "dark" ? "light" : "dark");
  if (requiereIngreso || !usuario && !verificando) return <IniciarSesion mensaje={mensaje} onLogin={iniciar} onRegister={registrar} onRecover={recuperar} tema={tema} onToggleTheme={alternarTema} />;
  if (verificando) return <main className="login-wrap"><BotonTema tema={tema} onClick={alternarTema} /><p className="empty">Verificando sesión…</p></main>;
  if (!usuario) return <IniciarSesion mensaje={mensaje} onLogin={iniciar} onRegister={registrar} onRecover={recuperar} tema={tema} onToggleTheme={alternarTema} />;
  if (usuario.email?.toLowerCase() === ADMIN_EMAIL) return <PanelAdmin usuario={usuario} onLogout={() => signOut(auth)} tema={tema} onToggleTheme={alternarTema} />;
  return <PortalAplicativos usuario={usuario} permisos={permisos} mensaje={mensaje} onLogout={() => signOut(auth)} tema={tema} onToggleTheme={alternarTema} />;
}
