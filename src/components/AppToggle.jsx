export default function AppToggle({ nombre, activo, onClick }) {
  return (
    <button
      type="button"
      className="app"
      aria-pressed={activo}
      onClick={onClick}
    >
      {nombre}
    </button>
  );
}