import { useState } from "react";

export default function AddEmailForm({ onAdd }) {
  const [valor, setValor] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setCargando(true);
    const resultado = await onAdd(valor);
    setCargando(false);
    setError(resultado || "");
    if (!resultado) setValor("");
  };

  return (
    <>
      <form className="add" onSubmit={enviar}>
        <input
          type="email"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="correo@empresa.com"
          autoComplete="off"
          aria-label="Correo nuevo"
          disabled={cargando}
        />
        <button type="submit" className="btn" disabled={cargando}>{cargando ? "Guardando…" : "Agregar correo"}</button>
      </form>
      <p className="msg" role="alert">{error}</p>
    </>
  );
}
