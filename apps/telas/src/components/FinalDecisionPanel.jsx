import { Scale, FlaskConical, ClipboardList } from "lucide-react";
import { statusClass } from "../utils/finalDecision.js";
import "../styles/final-decision.css";

const MAX_LISTED = 8;

const hint = {
  rejected: "Hay resultados que no cumplen el estándar. Revisa el detalle y define devolución o reclamo.",
  "missing-standard": "Falta ingresar estándares en el módulo 01 para poder decidir.",
  pending: "Todavía faltan resultados por registrar en las pruebas o en la planilla.",
  released: "Todas las pruebas y los rollos revisados cumplen el estándar."
};

const Status = ({ value, label }) => (
  <span className={`fd-status ${statusClass(value)}`}>{label ? `${label}: ${value}` : value}</span>
);

const limitText = (min, max) => {
  if (min !== null && max !== null) return `${min} a ${max}`;
  if (min !== null) return `mín ${min}`;
  if (max !== null) return `máx ${max}`;
  return "—";
};

export default function FinalDecisionPanel({ decision }) {
  const { code, verdict, evidence, rows, failingTests, failingRolls, hasData } = decision;
  const shownTests = failingTests.slice(0, MAX_LISTED);
  const shownRolls = failingRolls.slice(0, MAX_LISTED);

  return (
    <section className="panel final-decision-panel" aria-labelledby="final-decision-title">
      <div className="panel-heading">
        <div>
          <h3 id="final-decision-title">Decisión final de la tela</h3>
          <p>Se calcula con “Pruebas de tela” y “Planilla 4 puntos”. Si alguna rechaza, la tela no se libera a corte.</p>
        </div>
        <Scale size={19} />
      </div>

      <div className={`fd-verdict ${code}`}>
        <span>Resultado</span>
        <strong>{verdict}</strong>
        <small>{hint[code]}</small>
      </div>

      <div className="fd-grid">
        <div className="fd-block">
          <h4>Evidencia que sustenta la decisión</h4>
          <div className="fd-table-wrap">
            <table className="fd-table">
              <thead>
                <tr><th>Indicador</th><th>Resultado</th><th>Referencia</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {evidence.map((item) => (
                  <tr key={item.label}>
                    <td>
                      <strong>{item.label}</strong>
                      <small>{item.source}</small>
                    </td>
                    <td className="fd-num">{item.value}</td>
                    <td className="fd-num">{item.reference}</td>
                    <td><Status value={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="fd-block">
          <h4>Resultado por condición</h4>
          <div className="fd-table-wrap">
            <table className="fd-table">
              <thead>
                <tr><th>Condición</th><th title="Aplican">Apl.</th><th title="Aceptan">Ac.</th><th title="Rechazan">Rech.</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <strong>{row.label}</strong>
                      {row.action && <small>{row.action}</small>}
                    </td>
                    <td className="fd-num">{row.applying}</td>
                    <td className="fd-num">{row.accept}</td>
                    <td className="fd-num">{row.reject}</td>
                    <td><Status value={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="fd-grid">
        <div className="fd-block">
          <h4><FlaskConical size={15} /> Pruebas que rechazan</h4>
          {shownTests.length === 0 ? (
            <p className="fd-empty">{hasData ? "Ninguna prueba rechaza." : "Sin pruebas registradas."}</p>
          ) : (
            <ul className="fd-list">
              {shownTests.map((item) => (
                <li key={`${item.condition}-${item.parameter}`}>
                  <div>
                    <strong>{item.parameter}</strong>
                    <small>{item.condition}</small>
                  </div>
                  <span>Peor valor <b>{item.worst}</b> {item.unit} · límite {limitText(item.min, item.max)}</span>
                </li>
              ))}
            </ul>
          )}
          {failingTests.length > MAX_LISTED && (
            <p className="fd-more">+{failingTests.length - MAX_LISTED} más en “Pruebas de tela”</p>
          )}
        </div>

        <div className="fd-block">
          <h4><ClipboardList size={15} /> Rollos que rechazan</h4>
          {shownRolls.length === 0 ? (
            <p className="fd-empty">{hasData ? "Ningún rollo rechaza." : "Sin rollos registrados."}</p>
          ) : (
            <ul className="fd-list">
              {shownRolls.map((item) => (
                <li key={item.roll}>
                  <div>
                    <strong>Rollo {item.roll}</strong>
                    <small>
                      {item.pointsPer100 === null ? "—" : `${item.pointsPer100} puntos/100 yd²`}
                      {item.gramaje === null ? "" : ` · ${item.gramaje} g/m²`}
                    </small>
                  </div>
                  <span>
                    <Status label="4 pts" value={item.result4} />
                    <Status label="Peso" value={item.weightStatus} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {failingRolls.length > MAX_LISTED && (
            <p className="fd-more">+{failingRolls.length - MAX_LISTED} más en “Planilla 4 puntos”</p>
          )}
        </div>
      </div>
    </section>
  );
}