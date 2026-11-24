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

        <Field
          label="Proveedor de tela"
          icon={Truck}
          value={info.supplier}
          onChange={(v) => updateInfo("supplier", v)}
          list="master-suppliers"
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

      <datalist id="master-suppliers">
        {supplierOptions.map((supplier) => <option key={supplier} value={supplier} />)}
      </datalist>
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
