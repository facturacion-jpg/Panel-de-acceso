import { useMemo } from "react";
import { ClipboardCheck, RotateCcw, Save, X } from "lucide-react";

import { APPLIES_OPTIONS, FABRIC_TEST_ROWS, FABRIC_TYPES, getRowLimits } from "../utils/fabricTests.js";
import "../styles/fabric-tests.css";

const META_FIELDS = [
  ["color", "Color", "Ej. Azul marino"],
  ["fabricLot", "Lote de tela / OM", "Número de lote"],
  ["composition", "Composición", "Ej. 95% algodón, 5% elastano"],
  ["clientStandard", "Cliente / norma de referencia", "Norma o ficha técnica"],
  ["inspector", "Auxiliar de revisión de telas", "Nombre del auxiliar"]
];

const BASE_FIELDS = [
  ["nominalWeight", "Gramaje nominal", "g/m²", "Ej. 180"],
  ["weightTolerance", "Tolerancia de gramaje", "% ±", "Ej. 5"],
  ["minUsableWidth", "Ancho útil mínimo", "cm", "Ej. 150"],
  ["maxPointsPerRoll", "Máximo de puntos por rollo", "puntos/100 yd²", "Ej. 40"],
  ["maxLotAverage", "Promedio máximo del lote", "puntos/100 yd²", "Ej. 28"],
  ["maxPercentOverLimit", "Máximo de rollos sobre el límite", "%", "Ej. 10"],
  ["maxWeightDifference", "Diferencia máxima de peso real vs. empaque", "% ±", "Ej. 5"]
];

export default function FabricStandardsDialog({
  test,
  info = {},
  onChange,
  onChangeRow,
  onReset,
  onClose
}) {
  const summary = useMemo(() => ({
    total: FABRIC_TEST_ROWS.length,
    applies: FABRIC_TEST_ROWS.filter((row) => test.rows[row.id]?.applies !== "NO").length,
    configured: FABRIC_TEST_ROWS.filter((row) => {
      const limits = getRowLimits(row, test);
      return limits.min !== "" || limits.max !== "";
    }).length
  }), [test]);

  const updateField = (key, value) => onChange(key, value);

  return (
    <div
      className="roll-dialog-backdrop ft-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="roll-dialog ft-dialog ft-standards-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="standards-title"
      >
        <header className="roll-dialog-header">
          <div className="roll-dialog-title">
            <span className="section-icon"><ClipboardCheck size={20} /></span>
            <div>
              <h2 id="standards-title">Prueba de rollo de las telas</h2>
              <p>Ingresa los datos del auxiliar, los estándares y límites del lote.</p>
            </div>
          </div>
          <button className="roll-dialog-close" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="ft-standards-content">
          <section className="ft-section-card ft-inspection-card">
            <div className="ft-section-heading">
              <div>
                <h3>Datos de la tela y revisión</h3>
                <p>La tela y el proveedor se toman de la información de inspección.</p>
              </div>
            </div>
            <div className="ft-existing-fields">
              <div className="ft-existing-field"><span>Tela / referencia</span><strong>{info.fabric || "—"}</strong></div>
              <div className="ft-existing-field"><span>Proveedor</span><strong>{info.supplier || "—"}</strong></div>
            </div>
            <div className="ft-standard-fields ft-metadata-fields">
              {META_FIELDS.map(([key, label, placeholder]) => (
                <label className="ft-field" key={key}>
                  <span>{label}</span>
                  <input
                    value={test[key] ?? ""}
                    onChange={(event) => updateField(key, event.target.value)}
                    placeholder={placeholder}
                  />
                </label>
              ))}
              <label className="ft-field">
                <span>Tipo de tela</span>
                <select value={test.fabricType} onChange={(event) => updateField("fabricType", event.target.value)}>
                  {FABRIC_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="ft-section-card ft-base-card">
            <div className="ft-section-heading">
              <div>
                <h3>Datos base y límites de 4 puntos</h3>
                <p>Estos valores se usan en los cálculos y en la planilla de 4 puntos.</p>
              </div>
            </div>
            <div className="ft-standard-fields ft-base-fields">
              {BASE_FIELDS.map(([key, label, unit, placeholder]) => (
                <label className="ft-field" key={key}>
                  <span>{label} <small>({unit})</small></span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={test[key] ?? ""}
                    onChange={(event) => updateField(key, event.target.value)}
                    placeholder={placeholder}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="ft-section-card ft-section-card--second ft-standards-table-card">
            <div className="ft-section-heading">
              <div>
                <h3>Estándares por condición y parámetro</h3>
                <p>La condición y el parámetro son nombres fijos. Configura si aplica y sus límites.</p>
              </div>
              <div className="ft-inline-stats">
                <b>{summary.applies}/{summary.total}</b><span>aplican</span>
                <b>{summary.configured}</b><span>con límites</span>
              </div>
            </div>
            <div className="ft-table-scroll">
              <table className="ft-table ft-standards-table">
                <thead>
                  <tr>
                    <th>Condición</th>
                    <th>Parámetro</th>
                    <th>Unidad</th>
                    <th>¿Aplica?</th>
                    <th>Límite mínimo</th>
                    <th>Límite máximo</th>
                    <th>Estándar sugerido</th>
                  </tr>
                </thead>
                <tbody>
                  {FABRIC_TEST_ROWS.map((row) => {
                    const state = test.rows[row.id];
                    const limits = getRowLimits(row, test);
                    const calculated = Boolean(row.calculated);

                    return (
                      <tr key={row.id} className={state.applies === "NO" ? "ft-row-off" : ""}>
                        <td className="ft-condition-cell">{row.condition}</td>
                        <td className="ft-parameter-cell">{row.parameter}</td>
                        <td>{row.unit}</td>
                        <td>
                          <select
                            className="ft-applies-select"
                            aria-label={`¿Aplica? ${row.parameter}`}
                            value={state.applies}
                            onChange={(event) => onChangeRow(row.id, "applies", event.target.value)}
                          >
                            {APPLIES_OPTIONS.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {calculated ? (
                            <span className="ft-calculated-limit">{limits.min || "Se calcula"}</span>
                          ) : (
                            <input
                              type="number"
                              step="any"
                              value={state.min}
                              disabled={state.applies === "NO"}
                              onChange={(event) => onChangeRow(row.id, "min", event.target.value)}
                              placeholder="Sin límite"
                            />
                          )}
                        </td>
                        <td>
                          {calculated ? (
                            <span className="ft-calculated-limit">{limits.max || "Se calcula"}</span>
                          ) : (
                            <input
                              type="number"
                              step="any"
                              value={state.max}
                              disabled={state.applies === "NO"}
                              onChange={(event) => onChangeRow(row.id, "max", event.target.value)}
                              placeholder="Sin límite"
                            />
                          )}
                        </td>
                        <td className="ft-suggested-cell">{row.suggested}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <footer className="ft-dialog-footer">
          <button className="button secondary" type="button" onClick={onReset}>
            <RotateCcw size={15} /> Restablecer estándares
          </button>
          <span>Los cambios quedan asociados a la inspección actual.</span>
          <button className="button primary" type="button" onClick={onClose}>
            <Save size={15} /> Guardar y continuar
          </button>
        </footer>
      </section>
    </div>
  );
}