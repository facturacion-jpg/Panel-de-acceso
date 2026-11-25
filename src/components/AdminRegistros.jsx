import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { COTIZADOR_SUPABASE } from '../config/cotizadorSupabase';

const MODULOS = [
  { id: 'crearte', nombre: 'Auditorías' },
  { id: 'tallas', nombre: 'Estado de tallas' },
  { id: 'telas', nombre: 'Inspección de telas' },
  { id: 'cotizador_muestras', nombre: 'Cotizador de muestras' },
];

function fechaDe(item, appId) {
  const value = appId === 'crearte'
    ? item.fecha
    : appId === 'cotizador_muestras'
      ? item.createdAt
    : appId === 'tallas'
      ? item.updatedAt
      : item.record?.info?.date || item.record?.savedAt;
  if (value?.toDate) return value.toDate().toLocaleString('es-CO');
  if (value) {
    const fecha = new Date(value);
    return Number.isNaN(fecha.getTime()) ? String(value) : fecha.toLocaleString('es-CO');
  }
  return '—';
}

function resumen(item, appId) {
  const registro = appId === 'crearte' || appId === 'cotizador_muestras' ? item : item.record || {};
  if (appId === 'crearte') return `Empresa: ${registro.empresa || '—'} · Referencia: ${registro.referencia || '—'} · Lote: ${registro.tamañoLote || '—'} · Resultado: ${registro.decision || '—'}`;
  if (appId === 'cotizador_muestras') return `Referencia: ${registro.reference || '—'} · Marca: ${registro.marca || '—'} · Precio sugerido: ${Number(registro.result?.totals?.precioSugerido || 0).toLocaleString('es-CO')}`;
  if (appId === 'tallas' && registro.recordType === 'plan') return 'Plano de referencias';
  if (appId === 'tallas') return `OC: ${registro.oc || '—'} · REF: ${registro.ref || '—'} · Marca: ${registro.marca || '—'} · Web: ${registro.web || '—'} · Final: ${registro.fin || '—'}`;
  const info = registro.info || {};
  return `Proveedor: ${info.supplier || '—'} · Tela: ${info.fabric || '—'} · Remisión: ${info.remision || '—'} · Resultado: ${registro.finalDecision?.verdict || '—'}`;
}

export default function AdminRegistros() {
  const [appId, setAppId] = useState('crearte');
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    if (appId === 'cotizador_muestras') {
      const { url, anonKey, stateKey } = COTIZADOR_SUPABASE;
      const base = String(url || '').replace(/\/+$/, '');
      const consulta = `${base}/rest/v1/cotizador_state?select=value,updated_at&key=eq.${encodeURIComponent(stateKey)}&limit=1`;
      fetch(consulta, {
        cache: 'no-store',
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Accept: 'application/json' },
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Supabase respondió ${response.status}.`);
          const rows = await response.json();
          if (!Array.isArray(rows)) throw new Error('Supabase devolvió un formato de registros inesperado.');
          const quotes = rows[0]?.value?.quotes;
          if (!Array.isArray(quotes)) throw new Error('El estado compartido no contiene cotizaciones.');
          const ordenadas = [...quotes].sort((a, b) =>
            (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0));
          if (vigente) {
            setRegistros(ordenadas);
            setCargando(false);
          }
        })
        .catch((cause) => {
          console.error('No se pudieron cargar las cotizaciones:', cause);
          if (vigente) {
            setError('No se pudieron cargar las cotizaciones. Verifica la conexión con Supabase y las políticas de la tabla cotizador_state.');
            setCargando(false);
          }
        });
      return () => { vigente = false; };
    }
    const fuente = appId === 'crearte'
      ? collection(db, 'auditorias')
      : query(collection(db, 'app_records'), where('appId', '==', appId));
    const unsubscribe = onSnapshot(fuente, (snapshot) => {
      if (!vigente) return;
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      const filtrados = appId === 'crearte'
        ? items
        : items.filter((item) => appId === 'tallas'
          ? ['set', 'plan'].includes(item.recordType)
          : item.recordType === 'inspection');
      filtrados.sort((a, b) => {
        const dateOf = (item) => item.updatedAt?.toMillis?.() || Date.parse(item.record?.savedAt || item.record?.info?.date || item.createdAt || item.fecha || '') || 0;
        return dateOf(b) - dateOf(a);
      });
      setRegistros(filtrados);
      setCargando(false);
    }, (cause) => {
      console.error(`No se pudieron cargar registros de ${appId}:`, cause);
      if (vigente) { setError('No se pudieron cargar los registros. Revisa que las reglas actualizadas de Firestore estén publicadas.'); setCargando(false); }
    });
    return () => { vigente = false; unsubscribe(); };
  }, [appId]);

  return <section className="admin-records">
    <div className="admin-record-tabs" aria-label="Registros por aplicativo">
      {MODULOS.map((modulo) => <button key={modulo.id} type="button" className={appId === modulo.id ? 'selected' : ''} onClick={() => setAppId(modulo.id)}>{modulo.nombre}</button>)}
    </div>
    <h2>{MODULOS.find((modulo) => modulo.id === appId)?.nombre}</h2>
    <p className="sub">{cargando ? 'Consultando registros…' : `${registros.length} registros guardados`}</p>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {!cargando && !error && registros.length === 0 && <p className="empty">Todavía no hay registros en este aplicativo.</p>}
    <div className="admin-record-list">{registros.map((item) => {
      const registro = appId === 'crearte' || appId === 'cotizador_muestras' ? item : item.record || {};
      return <article className="admin-record-card" key={item.id}>
        <div className="admin-record-heading"><strong>{resumen(appId === 'tallas' ? { ...item.record, recordType: item.recordType } : item, appId)}</strong><span>{fechaDe(item, appId)}</span></div>
        <p>{appId === 'cotizador_muestras' ? `Descripción: ${item.description || '—'} · Tipo: ${item.type || '—'} · Líneas: ${item.lines?.length || 0}` : `Registrado por: ${appId === 'crearte' ? item.auditor || '—' : item.ownerEmail || '—'}`}</p>
        <details><summary>Ver datos completos</summary><pre>{JSON.stringify(registro, null, 2)}</pre></details>
      </article>;
    })}</div>
  </section>;
}
