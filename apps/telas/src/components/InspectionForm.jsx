import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  Package,
  Truck
} from "lucide-react";

const Field = ({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  list,
  icon: Icon
}) => (
  <label className="field">

    <span>
      {Icon && <Icon size={16} />}
      {label}
    </span>

    <input
      type={type}
      list={list}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />

  </label>
);

const normalizar = (texto) =>
  String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function SupplierField({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef(null);
  const query = normalizar(value);

  const filtered = useMemo(() => {
    if (!query) return options;
    const exact = [];
    const starts = [];
    const contains = [];
    options.forEach((option) => {
      const texto = normalizar(option);
      if (texto === query) exact.push(option);
      else if (texto.startsWith(query)) starts.push(option);
      else if (texto.includes(query)) contains.push(option);
    });
    return [...exact, ...starts, ...contains];
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [open]);

  const select = (option) => {
    onChange(option);
    setOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(0, Math.min(index + 1, filtered.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && filtered[activeIndex]) {
      event.preventDefault();
      select(filtered[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <label className="field supplier-field" ref={wrapperRef}>
      <span>
        <Truck size={16} />
        Proveedor de tela
      </span>
      <div className="supplier-combobox">
        <input
          type="text"
          value={value ?? ""}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls="supplier-options"
          aria-autocomplete="list"
          autoComplete="off"
        />
        {open && (
          <div className="supplier-options" id="supplier-options" role="listbox">
            {filtered.length ? (
              filtered.map((option, index) => (
                <button
                  type="button"
                  key={option}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? "is-active" : ""}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(option)}
                >
                  {option}
                </button>
              ))
            ) : (
              <p className="supplier-empty">Sin coincidencias</p>
            )}
          </div>
        )}
      </div>
    </label>
  );
}

export default function InspectionForm({
  info,
  updateInfo,
  editing = false,
  supplierOptions = [],
  fabricOptions = [],
  masterReference = null
}) {
  return (
    <section className="panel inspection-form">

      <div className="panel-heading">

        <div>
          <h3>
            <ClipboardList size={22} />
            Información de inspección
          </h3>

          <p>
            Datos generales del proveedor y del material recibido.
          </p>
        </div>

        <span className="panel-tag">{editing ? "EDITANDO" : "NUEVA"}</span>

      </div>

      <div className="form-grid">

        <Field
          label="Fecha de inspección"
          type="date"
          icon={CalendarDays}
          value={info.date}
          onChange={(v) => updateInfo("date", v)}
        />

        <SupplierField
          value={info.supplier}
          onChange={(v) => updateInfo("supplier", v)}
          options={supplierOptions}
          placeholder="Ingresa el proveedor"
        />

        <Field
          label="Nombre de la tela"
          icon={Package}
          value={info.fabric}
          onChange={(v) => updateInfo("fabric", v)}
          list="master-fabrics"
          placeholder="Ingresa el nombre de la tela"
        />

        <Field
          label="Remisión"
          icon={FileText}
          value={info.remision}
          onChange={(v) => updateInfo("remision", v)}
          placeholder="Número de remisión"
        />

      </div>

      <datalist id="master-fabrics">
        {fabricOptions.map((fabric) => <option key={fabric} value={fabric} />)}
      </datalist>

      {masterReference && (
        <div className="master-details" role="status">
          <strong>Ficha cargada automáticamente</strong>
          <span>Gramaje: {masterReference.nominalWeight ?? "sin dato"} g/m² · Tolerancia: ±{masterReference.weightTolerance ?? "sin dato"}%</span>
          <span>Ancho total: {masterReference.totalWidth ?? "sin dato"} m · Ancho mínimo calculado: {masterReference.minUsableWidth ?? "sin dato"} cm</span>
          <span>Rendimiento: {masterReference.yieldValue ?? "sin dato"} · Composición: {masterReference.composition || "sin dato"}</span>
        </div>
      )}

      <div className="form-footnote">
        La fecha se completa automáticamente. Selecciona la tela y el proveedor para cargar la ficha; puedes completar otros datos manualmente.
      </div>

    </section>
  );
}
