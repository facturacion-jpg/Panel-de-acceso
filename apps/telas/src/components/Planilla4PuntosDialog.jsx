import { useMemo } from "react";
import { Save, X, RotateCcw, ClipboardList, ChevronDown } from "lucide-react";
import { summarizePlanilla } from "../utils/planilla4Puntos.js";
import "../styles/planilla-4puntos.css";

const blankRows = () => Array.from({ length: 40 }, (_, index) => ({
  id: index + 1, roll: String(index + 1), meters: "", width: "",
  d1: "", d2: "", d3: "", d4: "", packageWeight: "",
  realWeight: "", notes: ""
}));

export const makeBlankPlanilla = () => ({
  maxPointsPerRoll: "",
  maxLotAverage: "",
  maxPercentOverLimit: "",
  nominalWeight: "",
  weightTolerance: "",
  minUsableWidth: "",
  maxWeightDifference: "",
  rows: blankRows()
});

export const restorePlanilla = (saved) => {
  const blank = makeBlankPlanilla();
  if (!saved || typeof saved !== "object") return blank;
  return {
    maxPointsPerRoll: saved.maxPointsPerRoll ?? "",
    maxLotAverage: saved.maxLotAverage ?? "",
    maxPercentOverLimit: saved.maxPercentOverLimit ?? "",
    nominalWeight: saved.nominalWeight ?? "",
    weightTolerance: saved.weightTolerance ?? "",
    minUsableWidth: saved.minUsableWidth ?? "",
    maxWeightDifference: saved.maxWeightDifference ?? "",
    rows: blankRows().map((row, index) => ({ ...row, ...(saved.rows?.[index] || {}) }))
  };
};

export default function Planilla4PuntosDialog({ value, standards = {}, info = {}, onChange, onClose, onReset }) {
  // Los estándares se leen del módulo 01; no se vuelven a digitar aquí.
  // El cálculo vive en utils/planilla4Puntos.js para que la decisión final use los mismos resultados.
  const {
    effectiveValue, results, complete, overLimit, average, percentOver, overall
  } = useMemo(() => summarizePlanilla(value, standards), [value, standards]);

  const updateField = (key, fieldValue) => onChange({ ...value, [key]: fieldValue });
  const updateRow = (index, key, fieldValue) => {
    const rows = value.rows.map((row, i) => i === index ? { ...row, [key]: fieldValue } : row);
    onChange({ ...value, rows });
  };

  return (
    <div className="roll-dialog-backdrop p4-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="roll-dialog p4-dialog" role="dialog" aria-modal="true" aria-labelledby="p4-title">
        <header className="roll-dialog-header">
          <div className="roll-dialog-title">
            <span className="section-icon"><ClipboardList size={19} /></span>
            <div>
              <h2 id="p4-title">Planilla 4 puntos</h2>
              <p>Inspección por rollo, control de peso y cálculo de gramaje.</p>
            </div>
          </div>
          <button className="roll-dialog-close" type="button" onClick={onClose} aria-label="Cerrar"><X size={20}/></button>
        </header>

        <div className="p4-summary-grid">
          <div className="p4-readonly-standard"><small>Tela</small><strong>{info.fabric || "—"}</strong></div>
          <div className="p4-readonly-standard"><small>Lote / remisión</small><strong>{standards.fabricLot || info.remision || "—"}</strong></div>
          <div className="p4-standard-note"><strong>Estándares vinculados</strong><span>Estos valores se toman automáticamente de “Prueba de rollo de las telas”. Para modificarlos, abre el módulo 01.</span></div>
          {[
            ["Límite por rollo (puntos/100 yd²)", effectiveValue.maxPointsPerRoll],
            ["Promedio máximo del lote", effectiveValue.maxLotAverage],
            ["Máximo % de rollos sobre el límite", effectiveValue.maxPercentOverLimit],
            ["Gramaje nominal (g/m²)", effectiveValue.nominalWeight],
            ["Tolerancia de gramaje (± %)", effectiveValue.weightTolerance],
            ["Ancho útil mínimo (cm)", effectiveValue.minUsableWidth],
            ["Diferencia máxima de peso (± %)", effectiveValue.maxWeightDifference]
          ].map(([label, standard]) => <div className="p4-readonly-standard" key={label}><small>{label}</small><strong>{standard === "" || standard === null || standard === undefined ? "Sin estándar" : standard}</strong></div>)}
          <div className="p4-metric"><small>Rollos revisados</small><strong>{complete.length}</strong></div>
          <div className="p4-metric"><small>Promedio puntos/100 yd²</small><strong>{average ?? "—"}</strong></div>
          <div className="p4-metric"><small>Rollos sobre el límite</small><strong>{overLimit}</strong></div>
          <div className="p4-metric"><small>% sobre el límite</small><strong>{percentOver === null ? "—" : `${percentOver}%`}</strong></div>
          <div className={`p4-result ${overall.toLowerCase().replaceAll(" ", "-")}`}><small>Resultado del lote</small><strong>{overall}</strong></div>
        </div>

        <div className="p4-actions">
          <span>Registra únicamente los rollos inspeccionados. Los campos calculados se actualizan automáticamente.</span>
          <button className="button secondary" type="button" onClick={onReset}><RotateCcw size={15}/> Reiniciar planilla</button>
          <button className="button primary" type="button" onClick={onClose}><Save size={15}/> Listo</button>
        </div>

        <details className="p4-table-section">
          <summary className="p4-table-toggle">
            <span>Detalle de rollos</span>
            <span className="p4-table-toggle-hint">Mostrar u ocultar la tabla</span>
            <ChevronDown size={17} aria-hidden="true" />
          </summary>
          <div className="p4-table-wrap">
            <table className="p4-table">
            <thead><tr>
              {["Rollo","Metros","Ancho útil (cm)","Defectos 1 pt","Defectos 2 pts","Defectos 3 pts","Defectos 4 pts","Puntos totales","Puntos/100 yd²","Resultado 4 puntos","Peso empaque (kg)","Peso real (kg)","Dif. peso %","Gramaje (g/m²)","Gramaje y peso","Observaciones"].map((label) => <th key={label}>{label}</th>)}
            </tr></thead>
            <tbody>{value.rows.map((row, index) => {
              const result = results[index];
              return <tr key={row.id}>
                <td><input aria-label={`Rollo ${index+1}`} value={row.roll} onChange={(e) => updateRow(index,"roll",e.target.value)}/></td>
                {["meters","width","d1","d2","d3","d4"].map((key) => <td key={key}><input type="number" min="0" step="any" value={row[key]} onChange={(e) => updateRow(index,key,e.target.value)}/></td>)}
                <td className="p4-calculated">{result.totalPoints ?? "—"}</td>
                <td className="p4-calculated">{result.pointsPer100 ?? "—"}</td>
                <td><span className={`p4-status ${result.result4.toLowerCase().replaceAll(" ","-")}`}>{result.result4}</span></td>
                {["packageWeight","realWeight"].map((key) => <td key={key}><input type="number" min="0" step="any" value={row[key]} onChange={(e) => updateRow(index,key,e.target.value)}/></td>)}
                <td className="p4-calculated">{result.weightDifference === null ? "—" : `${result.weightDifference}%`}</td>
                <td className="p4-calculated">{result.gramaje ?? "—"}</td>
                <td><span className={`p4-status ${result.weightStatus.toLowerCase().replaceAll(" ","-")}`}>{result.weightStatus}</span></td>
                <td><input className="p4-notes" value={row.notes} onChange={(e) => updateRow(index,"notes",e.target.value)} placeholder="Defectos, tono..."/></td>
              </tr>;
            })}</tbody>
            </table>
          </div>
        </details>
        <p className="p4-footnote">El gramaje se calcula con peso real, metros y ancho útil. La evaluación utiliza los estándares del módulo 01; si falta alguno, se indica SIN ESTÁNDAR.</p>
      </section>
    </div>
  );
}
