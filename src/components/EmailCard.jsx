import { useState } from "react";
import { APPS } from "../config/apps";
import AppToggle from "./AppToggle";

const EditIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" />
  </svg>
);

const DeleteIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
);

const CancelIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
);

export default function EmailCard({ correo, onToggle, onDelete, onEdit }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(correo.email);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const manejarEliminar = () => {
    if (window.confirm(`¿Eliminar ${correo.email} de la lista de accesos?`)) onDelete(correo.id);
  };

  const cancelarEdicion = () => {
    setValor(correo.email);
    setError("");
    setEditando(false);
  };

  const guardarEdicion = async (event) => {
    event.preventDefault();
    setGuardando(true);
    const resultado = await onEdit(correo.id, valor);
    setGuardando(false);
    if (resultado) {
      setError(resultado);
      return;
    }
    setError("");
    setEditando(false);
  };

  return (
    <li className="row">
      <div className="mail-controls">
        <div className="identity">
          {editando ? (
            <form className="edit-form" onSubmit={guardarEdicion}>
              <input
                type="email"
                value={valor}
                onChange={(event) => setValor(event.target.value)}
                aria-label={`Editar correo ${correo.email}`}
                autoFocus
                required
              />
              <button type="submit" className="icon-action save-action" aria-label="Guardar correo" title="Guardar" disabled={guardando}>
                <CheckIcon />
              </button>
              <button type="button" className="icon-action" aria-label="Cancelar edición" title="Cancelar" onClick={cancelarEdicion} disabled={guardando}>
                <CancelIcon />
              </button>
            </form>
          ) : (
            <span className="mail">{correo.email}</span>
          )}
        </div>

        <div className="apps" aria-label={`Aplicativos permitidos para ${correo.email}`}>
          {APPS.map(({ id, nombre }) => (
            <AppToggle
              key={id}
              nombre={nombre}
              activo={!!correo.acceso[id]}
              onClick={() => onToggle(correo.id, id)}
            />
          ))}
        </div>

        {!editando && (
          <div className="row-actions">
            <button
              type="button"
              className="icon-action"
              aria-label={`Editar ${correo.email}`}
              title="Editar correo"
              onClick={() => { setValor(correo.email); setEditando(true); }}
            >
              <EditIcon />
            </button>
            <button
              type="button"
              className="icon-action delete-action"
              aria-label={`Eliminar ${correo.email}`}
              title="Eliminar correo"
              onClick={manejarEliminar}
            >
              <DeleteIcon />
            </button>
          </div>
        )}
      </div>
      {error && <p className="edit-error" role="alert">{error}</p>}
    </li>
  );
}
