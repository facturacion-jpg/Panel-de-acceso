
import {
  CheckCircle2,
  Layers3,
  Percent,
  XCircle
} from "lucide-react";

export default function SummaryCards({ lot }) {

  const items = [
    {
      label: "Rollos inspeccionados",
      value: lot.inspected,
      detail: "Con medidas completas",
      icon: Layers3,
      tone: "sage"
    },
    {
      label: "Rollos aceptados",
      value: lot.accepted,
      detail: "Dentro del límite individual",
      icon: CheckCircle2,
      tone: "green"
    },
    {
      label: "Rollos rechazados",
      value: lot.rejected,
      detail: "Superan el límite individual",
      icon: XCircle,
      tone: "rose"
    },
    {
      label: "Promedio del lote",
      value: lot.average === null
        ? "0.0"
        : lot.average.toFixed(1),
      detail: "Puntos por 100 yd²",
      icon: Percent,
      tone: "gold"
    }
  ];

  return (
    <section className="summary-grid">

      {items.map((item) => {

        const Icon = item.icon;

        return (
          <article
            className="metric-card"
            key={item.label}
          >

            <div className={`metric-icon ${item.tone}`}>
              <Icon size={18} />
            </div>

            <span>{item.label}</span>

            <strong>{item.value}</strong>

            <small>{item.detail}</small>

          </article>
        );
      })}

    </section>
  );
}
