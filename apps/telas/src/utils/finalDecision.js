// Decisión final de la tela.
// Replica la hoja DECISION_TELA del Excel: toma los resultados de
// "Pruebas de tela" (PRUEBAS_TELA) y de la "Planilla 4 puntos" (PLANILLA_4PUNTOS)
// y decide si la tela se libera a corte.

import { evaluateAllFabricRows } from "./fabricTests.js";
import { summarizePlanilla } from "./planilla4Puntos.js";

export const ACTIONS = {
  RECHAZA: "Revisar causa y definir devolución o reclamo al proveedor.",
  "SIN ESTÁNDAR": "El auxiliar debe ingresar el estándar en el módulo 01.",
  "SIN DATO": "Faltan resultados por registrar."
};

const actionFor = (status) => ACTIONS[status] ?? "";

// Estado de una condición a partir de sus conteos (igual que G11:G17 del Excel).
const statusFromCounts = ({ applying, reject, noStandard, noData }) => {
  if (applying === 0) return "N/A";
  if (reject > 0) return "RECHAZA";
  if (noStandard > 0) return "SIN ESTÁNDAR";
  if (noData > 0) return "SIN DATO";
  return "ACEPTA";
};

const countBy = (items, getStatus) => ({
  accept: items.filter((item) => getStatus(item) === "ACEPTA").length,
  reject: items.filter((item) => getStatus(item) === "RECHAZA").length,
  noStandard: items.filter((item) => getStatus(item) === "SIN ESTÁNDAR").length,
  noData: items.filter((item) => getStatus(item) === "SIN DATO").length
});

export const VERDICTS = {
  rejected: "TELA RECHAZADA: no se libera a corte",
  "missing-standard": "FALTA ESTÁNDAR: no se puede decidir",
  pending: "PENDIENTE DE RESULTADOS",
  released: "TELA LIBERADA PARA CORTE"
};

export function buildFinalDecision(fabricTest, planilla) {
  // --- Pruebas de tela (módulo 02)
  const evaluations = evaluateAllFabricRows(fabricTest);
  const applyingTests = evaluations.filter((item) => item.evaluation.result !== "N/A");

  // --- Planilla 4 puntos (módulo 03)
  const summary = summarizePlanilla(planilla, fabricTest);
  const rollRows = summary.results.map((result, index) => ({
    ...result,
    roll: planilla?.rows?.[index]?.roll || String(index + 1)
  }));
  const withWeight = rollRows.filter((result) => result.gramaje !== null);

  // --- Tabla de condiciones (filas 9 a 17 de DECISION_TELA)
  const rows = [];

  const fourPoints = {
    applying: summary.complete.length,
    ...countBy(summary.complete, (result) => result.result4),
    noData: summary.complete.length === 0 ? 1 : 0
  };
  rows.push({
    key: "four-points",
    label: "4 puntos (planilla de rollos)",
    source: "planilla",
    ...fourPoints,
    status: summary.overall
  });

  const weight = {
    applying: withWeight.length,
    ...countBy(withWeight, (result) => result.weightStatus),
    noData: withWeight.length === 0 ? 1 : 0
  };
  rows.push({
    key: "weight-roll",
    label: "Gramaje y peso por rollo",
    source: "planilla",
    ...weight,
    status: weight.applying === 0 ? "SIN DATO"
      : weight.reject > 0 ? "RECHAZA"
      : weight.noStandard > 0 ? "SIN ESTÁNDAR"
      : "ACEPTA"
  });

  const conditions = [];
  evaluations.forEach((item) => {
    if (!conditions.includes(item.row.condition)) conditions.push(item.row.condition);
  });
  conditions.forEach((condition) => {
    const items = applyingTests.filter((item) => item.row.condition === condition);
    const counts = countBy(items, (item) => item.evaluation.result);
    const base = { applying: items.length, ...counts };
    rows.push({
      key: `lab-${condition}`,
      label: condition,
      source: "pruebas",
      ...base,
      status: statusFromCounts(base)
    });
  });
  rows.forEach((row) => { row.action = actionFor(row.status); });

  // --- Decisión (B19 del Excel)
  const statuses = rows.map((row) => row.status);
  const code = statuses.includes("RECHAZA") ? "rejected"
    : statuses.includes("SIN ESTÁNDAR") ? "missing-standard"
    : statuses.includes("SIN DATO") ? "pending"
    : "released";

  // --- Evidencia: de dónde sale la decisión
  const labCounts = countBy(applyingTests, (item) => item.evaluation.result);
  const labNoStandard = labCounts.noStandard + labCounts.noData;
  const hasLab = applyingTests.length > 0;
  const hasRolls = summary.complete.length > 0;
  const evidence = [
    {
      label: "Pruebas de laboratorio que aplican",
      value: applyingTests.length, reference: "—",
      status: hasLab ? "OK" : "SIN DATO", source: "Pruebas de tela"
    },
    {
      label: "Pruebas de laboratorio que rechazan",
      value: labCounts.reject, reference: "Máx. 0",
      status: !hasLab ? "SIN DATO" : labCounts.reject > 0 ? "RECHAZA" : "ACEPTA",
      source: "Pruebas de tela"
    },
    {
      label: "Pruebas sin estándar o sin dato",
      value: labNoStandard, reference: "Máx. 0",
      status: !hasLab ? "SIN DATO" : labNoStandard > 0 ? "PENDIENTE" : "ACEPTA",
      source: "Pruebas de tela"
    },
    {
      label: "Rollos revisados (4 puntos)",
      value: summary.complete.length, reference: "—",
      status: hasRolls ? "OK" : "SIN DATO", source: "Planilla 4 puntos"
    },
    {
      label: "Promedio de puntos por 100 yd²",
      value: summary.average ?? "—",
      reference: summary.maxAverage ?? "Sin estándar",
      status: !hasRolls ? "SIN DATO"
        : summary.maxAverage === null ? "SIN ESTÁNDAR"
        : summary.average <= summary.maxAverage ? "ACEPTA" : "RECHAZA",
      source: "Planilla 4 puntos"
    },
    {
      label: "% de rollos sobre el límite por rollo",
      value: summary.percentOver === null ? "—" : `${summary.percentOver}%`,
      reference: summary.maxPercent === null ? "Sin estándar" : `${summary.maxPercent}%`,
      status: !hasRolls ? "SIN DATO"
        : summary.maxPercent === null ? "SIN ESTÁNDAR"
        : summary.percentOver <= summary.maxPercent ? "ACEPTA" : "RECHAZA",
      source: "Planilla 4 puntos"
    },
    {
      label: "Rollos con gramaje o peso fuera de estándar",
      value: weight.reject, reference: "Máx. 0",
      status: !hasRolls ? "SIN DATO" : weight.reject > 0 ? "RECHAZA" : "ACEPTA",
      source: "Planilla 4 puntos"
    }
  ];

  // --- Detalle: qué rechazó
  const failingTests = evaluations
    .filter((item) => item.evaluation.result === "RECHAZA")
    .map((item) => ({
      condition: item.row.condition,
      parameter: item.row.parameter,
      unit: item.row.unit,
      worst: item.evaluation.worst,
      min: item.limits.min === "" ? null : item.limits.min,
      max: item.limits.max === "" ? null : item.limits.max
    }));

  const failingRolls = rollRows
    .filter((result) => result.result4 === "RECHAZA" || result.weightStatus === "RECHAZA")
    .map((result) => ({
      roll: result.roll,
      pointsPer100: result.pointsPer100,
      result4: result.result4,
      gramaje: result.gramaje,
      weightDifference: result.weightDifference,
      weightStatus: result.weightStatus
    }));

  return {
    code,
    verdict: VERDICTS[code],
    rows,
    evidence,
    failingTests,
    failingRolls,
    hasData: hasLab || hasRolls
  };
}

// Texto corto para tarjetas pequeñas (PDF) y para guardar en el registro.
export const SHORT_VERDICTS = {
  rejected: "Tela rechazada",
  "missing-standard": "Falta estándar",
  pending: "Pendiente de resultados",
  released: "Liberada para corte"
};

// Clase CSS a partir de un estado ("SIN ESTÁNDAR" -> "sin-estandar").
export const statusClass = (status) =>
  String(status ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");