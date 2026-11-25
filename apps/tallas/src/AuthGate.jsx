import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { ADMIN_EMAIL, auth, db } from './firebase.js';

export default function AuthGate({ children }) {
  const [estado, setEstado] = useState('verificando');
  const [usuario, setUsuario] = useState(null);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    let detenerPermiso = null;
    const detenerAuth = onAuthStateChanged(auth, (cuenta) => {
      detenerPermiso?.();
      detenerPermiso = null;
      setUsuario(cuenta);

      if (!cuenta?.email) {
        setEstado('ingreso');
        return;
      }

      if (cuenta.email.toLowerCase() === ADMIN_EMAIL) {
        setEstado('permitido');
        setMensaje('');
        return;
      }

      setEstado('verificando');
      detenerPermiso = onSnapshot(doc(db, 'app_access', cuenta.email.toLowerCase()), (perfil) => {
        if (perfil.exists() && perfil.data()?.access?.tallas === true) {
          setEstado('permitido');
          setMensaje('');
        } else {
          setEstado('sin-permiso');
          setMensaje('El administrador aún no habilita Estado de tallas para este correo.');
        }
      }, (error) => {
        console.error('No se pudo validar el permiso de Tallas:', error);
        setEstado('error');
        setMensaje(`No se pudo validar el acceso en Firebase (${error?.code || 'error'}). Revisa las reglas de Firestore y la conexión.`);
      });
    });

    return () => {
      detenerAuth();
      detenerPermiso?.();
    };
  }, []);

  useEffect(() => {
    if (estado === 'ingreso') window.location.replace('/');
  }, [estado]);

  if (estado === 'verificando' || estado === 'ingreso') {
    return <main style={estilos.fondo}><p>{estado === 'ingreso' ? 'Volviendo al portal para iniciar sesión…' : 'Verificando sesión…'}</p></main>;
  }

  if (estado === 'permitido') {
    return children;
  }

  return <main style={estilos.fondo}><section style={estilos.tarjeta}>
    <h1>Estado de tallas</h1>
    <p role="status">{mensaje}</p>
    <a style={estilos.enlace} href="/?retornoAplicativo=1">Volver al portal</a>
  </section></main>;
}

const estilos = {
  fondo: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f1f4f6', color: '#14202b', fontFamily: 'system-ui, sans-serif' },
  tarjeta: { width: 'min(100%, 420px)', display: 'grid', gap: 10, padding: 28, borderRadius: 18, background: '#fff', border: '1px solid #d5dce3', boxShadow: '0 16px 45px #14202b12' },
  enlace: { color: '#17324d', textAlign: 'center', fontSize: 14 },
};
