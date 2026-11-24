import { useMemo } from "react";
import { FlaskConical, Save, X } from "lucide-react";
import {
  FABRIC_TEST_ROWS,
  getRowLimits,
  evaluateFabricRow
} from "../utils/fabricTests.js";
import "../styles/fabric-tests.css";

export default function FabricTestDialog({
  info,
  test,
  onChange,
  onChangeRow,
  onClose
}) {
  const evaluations = useMemo(
    () =>
      FABRIC_TEST_ROWS.map((row) => {
        const state = test.rows?.[row.id] ?? {
          applies: "SI",
          test1: "",
          test2: "",
          test3: "",
          observations: ""
        };

        const limits = getRowLimits(row, test);

        return {
          row,
          state,
          limits,
          evaluation: evaluateFabricRow(state, limits)
        };
      }),
    [test]
  );

  const counts = evaluations.reduce((result, item) => {
    const status = item.evaluation.result;

    result[status] = (result[status] || 0) + 1;

    return result;
  }, {});

  // Agrupa por el nombre fijo de condición,
  // sin numeración y sin columna de número.
  const groups = [];

  evaluations.forEach((item) => {
    let group = groups.find(
      (entry) => entry.condition === item.row.condition
    );

    if (!group) {
      group = {
        condition: item.row.condition,
        rows: []
      };

      groups.push(group);
    }

    group.rows.push(item);
  });

  const evaluatedCount = evaluations.filter(
    ({ evaluation }) =>
      evaluation.result !== "SIN DATO" &&
      evaluation.result !== "N/A"
  ).length;

  return (
    <div
      className="roll-dialog-backdrop ft-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && onClose()
      }
    >
      <section
        className="roll-dialog ft-dialog ft-results-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fabric-test-title"
      >
        <header className="roll-dialog-header">
          <div className="roll-dialog-title">
            <span className="section-icon">
              <FlaskConical size={20} />
            </span>

            <div>
              <h2 id="fabric-test-title">
                Pruebas de tela
              </h2>

              <p>
                Registra tres mediciones por parámetro.
                Las condiciones, parámetros y límites
                corresponden a los estándares configurados.
              </p>
            </div>
          </div>

          <button
            className="roll-dialog-close"
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </header>

        <div className="ft-results-meta">
          <div>
            <small>Tela</small>
            <strong>{info?.fabric || "—"}</strong>
          </div>

          <div>
            <small>Proveedor</small>
            <strong>{info?.supplier || "—"}</strong>
          </div>

          <div>
            <small>Lote de tela / OM</small>
            <strong>
              {test.fabricLot || info?.remision || "—"}
            </strong>
          </div>

          <div>
            <small>Auxiliar</small>
            <strong>{test.inspector || "—"}</strong>
          </div>

          <label>
            <span>Rollos muestreados</span>

            <input
              type="number"
              min="0"
              step="1"
              value={test.sampledRolls}
              onChange={(event) =>
                onChange("sampledRolls", event.target.value)
              }
              placeholder="Cantidad"
            />
          </label>

          <label>
            <span>Fecha de las pruebas</span>

            <input
              type="date"
              value={test.testDate}
              onChange={(event) =>
                onChange("testDate", event.target.value)
              }
            />
          </label>
        </div>

        <div className="ft-result-summary">
          <div>
            <small>Parámetros evaluados</small>
            <strong>{evaluatedCount}</strong>
          </div>

          <div>
            <small>Aceptan</small>
            <strong className="ft-good">
              {counts.ACEPTA || 0}
            </strong>
          </div>

          <div>
            <small>Rechazan</small>
            <strong className="ft-bad">
              {counts.RECHAZA || 0}
            </strong>
          </div>

          <div>
            <small>Sin estándar</small>
            <strong>
              {counts["SIN ESTÁNDAR"] || 0}
            </strong>
          </div>
        </div>

        <div className="ft-results-content">
          <section className="ft-section-card">
            <div className="ft-section-heading">
              <div>
                <h3>Registro de resultados</h3>

                <p>
                  Las condiciones y los parámetros son nombres
                  fijos. No se muestra columna de número ni
                  numeración de condición.
                </p>
              </div>
            </div>

            <div className="ft-table-scroll">
              <table className="ft-table ft-results-table">
                <thead>
                  <tr>
                    <th>Condición</th>
                    <th>Parámetro</th>
                    <th>Unidad</th>
                    <th>Mín.</th>
                    <th>Máx.</th>
                    <th>Prueba 1</th>
                    <th>Prueba 2</th>
                    <th>Prueba 3</th>
                    <th>Peor valor</th>
                    <th>Resultado</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>

                <tbody>
                  {groups.map((group) =>
                    group.rows.map((item, index) => {
                      const {
                        row,
                        state,
                        limits,
                        evaluation
                      } = item;

                      return (
                        <tr
                          key={row.id}
                          className={[
                            index === 0
                              ? "ft-group-start"
                              : "",
                            state.applies === "NO"
                              ? "ft-row-off"
                              : ""
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {index === 0 && (
                            <th
                              className="ft-condition-cell"
                              rowSpan={group.rows.length}
                            >
                              {group.condition}
                            </th>
                          )}

                          <td className="ft-parameter-cell">
                            {row.parameter}
                          </td>

                          <td>{row.unit}</td>

                          <td>
                            {limits.min === ""
                              ? "—"
                              : limits.min}
                          </td>

                          <td>
                            {limits.max === ""
                              ? "—"
                              : limits.max}
                          </td>

                          {[
                            "test1",
                            "test2",
                            "test3"
                          ].map((key, indexTest) => (
                            <td key={key}>
                              <input
                                type="number"
                                step="any"
                                disabled={state.applies === "NO"}
                                aria-label={`${row.parameter}, prueba ${indexTest + 1}`}
                                value={state[key] ?? ""}
                                onChange={(event) =>
                                  onChangeRow(
                                    row.id,
                                    key,
                                    event.target.value
                                  )
                                }
                                placeholder="—"
                              />
                            </td>
                          ))}

                          <td className="ft-calculated-limit">
                            {evaluation.worst}
                          </td>

                          <td>
                            <span
                              className={`ft-status ${evaluation.result
                                .toLowerCase()
                                .replaceAll(" ", "-")}`}
                            >
                              {evaluation.result}
                            </span>
                          </td>

                          <td>
                            <input
                              className="ft-observation-input"
                              disabled={state.applies === "NO"}
                              value={state.observations ?? ""}
                              onChange={(event) =>
                                onChangeRow(
                                  row.id,
                                  "observations",
                                  event.target.value
                                )
                              }
                              placeholder="Observaciones"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <footer className="ft-dialog-footer">
          <span>
            Los resultados se guardan junto con la inspección.
          </span>

          <button
            className="button primary"
            type="button"
            onClick={onClose}
          >
            <Save size={15} />
            Guardar resultados
          </button>
        </footer>
      </section>
    </div>
  );
}