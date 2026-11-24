import { useState } from "react";
import { evaluateAllFabricRows } from "../utils/fabricTests.js";
import { summarizePlanilla } from "../utils/planilla4Puntos.js";
import { buildFinalDecision } from "../utils/finalDecision.js";
import {
  ArrowLeft,
  Eye,
  FileSpreadsheet,
  FileDown,
  Pencil,
  Trash2,
  X
} from "lucide-react";

const getInspectedCount = (record) =>
  Array.isArray(record.lot?.inspected)
    ? record.lot.inspected.length
    : record.lot?.inspected ?? 0;

export default function InspectionDatabase({
  inspections,
  onEdit,
  onDelete,
  onDownloadPdf,
  onDownloadExcel,
  onClose
}) {
  const [selected, setSelected] = useState(null);

  const handleDelete = (record) => {
    const name = record.info?.fabric || "esta inspección";
    if (window.confirm(`¿Eliminar ${name} de la base de datos?`)) {
      onDelete(record.id);
      if (selected?.id === record.id) setSelected(null);
    }
  };

  return (
    <div className="database-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="database-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="database-title"
      >
        <header className="database-header">
          <div className="database-heading">
            {selected && (
              <button
                type="button"
                className="database-icon-button"
                onClick={() => setSelected(null)}
                aria-label="Volver a la base de datos"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 id="database-title">
                {selected ? "Detalle de inspección" : "Base de datos"}
              </h2>
              <p>
                {selected
                  ? `${selected.info?.fabric || "Tela sin nombre"} · ${selected.info?.date || ""}`
                  : `${inspections.length} inspecciones sincronizadas con Firebase`}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="database-icon-button"
            onClick={onClose}
            aria-label="Cerrar base de datos"
          >
            <X size={20} />
          </button>
        </header>

        {selected ? (
          <div className="database-detail">
            <div className="database-detail-grid">
              <span>Proveedor<strong>{selected.info?.supplier || "—"}</strong></span>
              <span>Remisión<strong>{selected.info?.remision || "—"}</strong></span>
              <span>Rollos completos<strong>{getInspectedCount(selected)}</strong></span>
              <span>Promedio / 100 yd²<strong>
                {selected.lot?.average == null ? "0.00" : selected.lot.average.toFixed(2)}
              </strong></span>
              <span>Decisión<strong>{selected.lot?.decision || "Pendiente"}</strong></span>
            </div>

            <details className="database-module-detail">
              <summary>Ver estándares y resultados de módulos 01–03</summary>
              <p><b>Estándares:</b> Gramaje {selected.fabricTest?.nominalWeight || "—"} g/m² (±{selected.fabricTest?.weightTolerance || "—"}%), ancho útil mínimo {selected.fabricTest?.minUsableWidth || "—"} cm, máximo por rollo {selected.fabricTest?.maxPointsPerRoll || "—"} puntos/100 yd², promedio máximo {selected.fabricTest?.maxLotAverage || "—"}, máximo sobre límite {selected.fabricTest?.maxPercentOverLimit || "—"}%.</p>
              <h4>Pruebas de tela</h4>
              <div className="database-detail-table"><table><thead><tr><th>Condición</th><th>Parámetro</th><th>Mediciones</th><th>Resultado</th></tr></thead><tbody>
                {evaluateAllFabricRows(selected.fabricTest || {}).filter(({ state }) => state.applies !== "NO").map(({ row, state, evaluation }) => <tr key={row.id}><td>{row.condition}</td><td>{row.parameter}</td><td>{[state.test1, state.test2, state.test3].filter((value) => value !== "").join(" / ") || "—"}</td><td>{evaluation.result}</td></tr>)}
              </tbody></table></div>
              <h4>Planilla 4 puntos</h4>
              {(() => {
                const planilla = summarizePlanilla(selected.planilla4Puntos || {}, selected.fabricTest || {});
                const rows = selected.planilla4Puntos?.rows || [];
                const filled = rows.map((row, index) => ({ row, result: planilla.results[index] })).filter(({ row }) => [row.meters, row.width, row.d1, row.d2, row.d3, row.d4, row.packageWeight, row.realWeight, row.notes].some((value) => value !== "" && value !== undefined));
                return <><p><b>Resultado del lote:</b> {planilla.overall} · Promedio: {planilla.average ?? "—"} puntos/100 yd² · Sobre el límite: {planilla.percentOver === null ? "—" : `${planilla.percentOver}%`}</p><div className="database-detail-table"><table><thead><tr><th>Rollo</th><th>Metros</th><th>Ancho útil</th><th>Puntos</th><th>Puntos/100 yd²</th><th>4 puntos</th><th>Dif. peso</th><th>Gramaje</th><th>Estado peso</th></tr></thead><tbody>{filled.map(({ row, result }) => <tr key={row.id}><td>{row.roll}</td><td>{row.meters}</td><td>{row.width}</td><td>{result.totalPoints ?? "—"}</td><td>{result.pointsPer100 ?? "—"}</td><td>{result.result4}</td><td>{result.weightDifference ?? "—"}</td><td>{result.gramaje ?? "—"}</td><td>{result.weightStatus}</td></tr>)}</tbody></table></div></>;
              })()}
              <p><b>Decisión final:</b> {buildFinalDecision(selected.fabricTest || {}, selected.planilla4Puntos || {}).verdict}</p>
            </details>
            <div className="database-record-actions" aria-label="Descargar inspección">
              <button type="button" onClick={() => onDownloadPdf(selected)}>
                <FileDown size={16} /><span>Descargar PDF</span>
              </button>
              <button type="button" onClick={() => onDownloadExcel(selected)}>
                <FileSpreadsheet size={16} /><span>Descargar Excel</span>
              </button>
            </div>

            <div className="database-detail-table">
              <table>
                <thead>
                  <tr>
                    <th>Rollo</th>
                    <th>Color</th>
                    <th>Largo (m)</th>
                    <th>Ancho útil (cm)</th>
                    <th>Puntos totales</th>
                    <th>Puntos / 100 yd²</th>
                    <th>Decisión</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.rolls || [])
                    .filter((roll) => Number.isFinite(roll.pointsPer100))
                    .map((roll) => (
                      <tr key={roll.id}>
                        <td>{roll.roll}</td>
                        <td>
                          <span className="database-roll-color">
                            {/^#[\da-f]{6}$/i.test(roll.color || "") && (
                              <span
                                className="database-roll-color-swatch"
                                style={{ backgroundColor: roll.color }}
                              />
                            )}
                            {roll.color || "—"}
                          </span>
                        </td>
                        <td>{roll.length}</td>
                        <td>{roll.width}</td>
                        <td>{roll.totalPoints}</td>
                        <td>{roll.pointsPer100.toFixed(2)}</td>
                        <td>{roll.decision}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!(selected.rolls || []).some((roll) => Number.isFinite(roll.pointsPer100)) && (
                <p className="database-empty">Esta inspección todavía no tiene rollos completos.</p>
              )}
            </div>
          </div>
        ) : inspections.length ? (
          <div className="database-list">
            {inspections.map((record) => (
              <article className="database-record" key={record.id}>
                <div className="database-record-main">
                  <strong>{record.info?.fabric || "Tela sin nombre"}</strong>
                  <span>{record.info?.supplier || "Sin proveedor"} · Remisión {record.info?.remision || "—"}</span>
                  <small>
                    {record.info?.date || "Sin fecha"} · {getInspectedCount(record)} rollos · {record.lot?.decision || "Pendiente"}
                  </small>
                </div>
                <div className="database-record-actions">
                  <button type="button" onClick={() => setSelected(record)} aria-label="Ver inspección">
                    <Eye size={16} /><span>Ver</span>
                  </button>
                  <button type="button" onClick={() => onDownloadPdf(record)} aria-label="Descargar PDF">
                    <FileDown size={16} /><span>PDF</span>
                  </button>
                  <button type="button" onClick={() => onDownloadExcel(record)} aria-label="Descargar Excel">
                    <FileSpreadsheet size={16} /><span>Excel</span>
                  </button>
                  <button type="button" onClick={() => onEdit(record)} aria-label="Editar inspección">
                    <Pencil size={16} /><span>Editar</span>
                  </button>
                  <button type="button" className="delete-action" onClick={() => handleDelete(record)} aria-label="Eliminar inspección">
                    <Trash2 size={16} /><span>Eliminar</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="database-empty">
            Aún no hay inspecciones guardadas. Guarda una inspección para verla aquí.
          </div>
        )}
      </section>
    </div>
  );
}
