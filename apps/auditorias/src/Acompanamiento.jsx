import React, { useState } from 'react';
import { guardarAcompanamiento, eliminarAcompanamiento } from './db.js';

// Campos de observación que pide el acompañamiento previo. Se conservan como texto
// editable y se identifican con las mismas claves que se usarán en la auditoría final.
const CAMPOS = [
  { key: 'apariencia', label: 'Apariencia' },
  { key: 'medidas', label: 'Medidas' },
  { key: 'empaque', label: 'Empaque' },
  { key: 'insumos', label: 'Insumos' },
  { key: 'segundas', label: 'Segundas' },
];

const crearFormulario = () => ({
  fecha: new Date().toISOString().slice(0, 10),
  referencia: '',
  loteNum: '',
  apariencia: '',
  medidas: '',
  empaque: '',
  insumos: '',
  segundas: '',
  id: '',
  creadoEn: '',
  _firestoreId: '',
});

const resumen = (registro) =>
  CAMPOS.map((campo) => registro[campo.key] && `${campo.label}: ${registro[campo.key]}`)
    .filter(Boolean)
    .join(' · ');

// Pantalla independiente dentro de Auditorías: captura las observaciones previas
// y mantiene un historial para que la auditoría final pueda vincularlas por ref + lote.
export default function Acompanamiento({ usuario, registros, setRegistros, onVolver, triggerToast }) {
  const [form, setForm] = useState(crearFormulario);
  const [guardando, setGuardando] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const guardar = async () => {
    if (!form.fecha || !form.referencia.trim() || !form.loteNum.trim()) {
      triggerToast('Completa fecha, referencia y lote antes de guardar');
      return;
    }

    setGuardando(true);
    const esEdicion = Boolean(form._firestoreId);
    const registro = {
      ...form,
      referencia: form.referencia.trim(),
      loteNum: form.loteNum.trim(),
      id: form.id || Date.now(),
      creadoEn: form.creadoEn || new Date().toISOString(),
      auditor: usuario.email,
    };

    const listaBase = esEdicion
      ? registros.map((item) => (item._firestoreId === form._firestoreId ? registro : item))
      : [registro, ...registros];
    setRegistros(listaBase);

    try {
      const firestoreId = await guardarAcompanamiento(registro);
      const sincronizados = listaBase.map((item) =>
        item.id === registro.id ? { ...item, _firestoreId: firestoreId } : item);
      setRegistros(sincronizados);
      setForm({ ...registro, _firestoreId: firestoreId });
      triggerToast(esEdicion
        ? 'Acompañamiento actualizado y sincronizado'
        : 'Acompañamiento guardado y sincronizado');
    } catch (error) {
      console.error('No fue posible guardar el acompañamiento:', error);
      triggerToast('Acompañamiento guardado solo en este navegador; no se sincronizó con la nube.');
    } finally {
      setGuardando(false);
    }
  };

  const cargarRegistro = (registro) => {
    setForm({ ...registro, _firestoreId: registro._firestoreId || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    triggerToast(`Acompañamiento Ref ${registro.referencia || 'S/N'} cargado en el formulario`);
  };

  const eliminar = async (registro) => {
    if (!window.confirm(`¿Eliminar el acompañamiento de la referencia ${registro.referencia || 'S/N'} lote ${registro.loteNum || 'S/N'}?`)) return;

    setRegistros(registros.filter((item) => item.id !== registro.id));
    if (form.id === registro.id) setForm(crearFormulario());

    if (registro._firestoreId) {
      try {
        await eliminarAcompanamiento(registro._firestoreId);
      } catch (error) {
        console.error('No fue posible eliminar el acompañamiento de Firestore:', error);
        triggerToast('Se eliminó en este navegador, pero no se pudo eliminar de la nube.');
        return;
      }
    }
    triggerToast('Acompañamiento eliminado');
  };

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-6 lg:p-8 pb-28 sm:pb-8 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">Acompañamiento previo</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Registra las observaciones antes de la auditoría final. Se vinculan por referencia y lote.
          </p>
        </div>
        {/* Mismo diseño que el botón de retorno de Auditorías: solo icono y tooltip. */}
        <button
          type="button"
          onClick={onVolver}
          data-tip="Volver a auditoría"
          aria-label="Volver a auditoría"
          className="inline-grid place-items-center w-10 h-10 rounded-xl border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 16l-4-4 4-4M6 12h9" />
          </svg>
        </button>
      </div>

      <section className="bg-white text-slate-800 rounded-2xl shadow-sm border border-slate-200 overflow-visible">
        <div className="bg-slate-50/80 px-4 sm:px-6 py-3.5 border-b border-slate-200 rounded-t-2xl flex justify-between items-center gap-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
            Datos del acompañamiento
          </h2>
          <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full font-semibold">
            Fecha elegida por la auditora
          </span>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase">Fecha</label>
            <input
              type="date"
              name="fecha"
              value={form.fecha}
              onChange={handleChange}
              className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase">Referencia</label>
            <input
              type="text"
              name="referencia"
              placeholder="Ej. 543678"
              value={form.referencia}
              onChange={handleChange}
              className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase">Lote</label>
            <input
              type="text"
              name="loteNum"
              placeholder="Ej. 123456"
              value={form.loteNum}
              onChange={handleChange}
              className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        <div className="px-4 sm:px-6 pb-4 sm:pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {CAMPOS.map((campo) => (
            <div key={campo.key} className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase">{campo.label}</label>
              <textarea
                name={campo.key}
                rows={3}
                placeholder={`Observaciones de ${campo.label.toLowerCase()}...`}
                value={form[campo.key]}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
              />
            </div>
          ))}
        </div>

        <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            {guardando ? 'Guardando...' : form._firestoreId ? 'Actualizar acompañamiento' : 'Guardar acompañamiento'}
          </button>
          <button
            type="button"
            onClick={() => setForm(crearFormulario())}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border border-slate-300 cursor-pointer"
          >
            Nuevo
          </button>
        </div>
      </section>

      <section className="bg-white text-slate-800 rounded-2xl shadow-sm border border-slate-200 overflow-visible">
        <div className="bg-slate-50/80 px-4 sm:px-6 py-3.5 border-b border-slate-200 rounded-t-2xl flex justify-between items-center gap-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Historial de acompañamientos
          </h2>
          <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full font-semibold">
            {registros.length} registros
          </span>
        </div>

        <div className="p-4 sm:p-6 space-y-3">
          {registros.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm font-semibold text-slate-600">Aún no hay acompañamientos registrados.</p>
              <p className="text-xs text-slate-500">Diligencia el formulario y haz clic en <strong>Guardar acompañamiento</strong>.</p>
            </div>
          ) : (
            registros.map((registro) => (
              <div key={registro.id || registro._firestoreId} className="border border-slate-200 rounded-xl p-3 sm:p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500 font-semibold">{registro.fecha || 'Sin fecha'}</span>
                  <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold">Ref: {registro.referencia || 'S/N'}</span>
                  <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-bold">Lote: {registro.loteNum || 'S/N'}</span>
                </div>
                <p className="text-xs text-slate-600 break-words">{resumen(registro) || 'Sin observaciones registradas'}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => cargarRegistro(registro)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cargar
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminar(registro)}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
