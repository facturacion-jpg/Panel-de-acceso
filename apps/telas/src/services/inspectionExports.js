import { jsPDF } from "jspdf";
import { SHORT_VERDICTS, VERDICTS, buildFinalDecision } from "../utils/finalDecision.js";
import { evaluateAllFabricRows } from "../utils/fabricTests.js";
import { summarizePlanilla } from "../utils/planilla4Puntos.js";

const safeBaseName = (value) => String(value || "inspeccion-telas")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const inspectedRolls = (record) => (record.rolls || []).filter((roll) => Number.isFinite(Number(roll.pointsPer100)) && roll.pointsPer100 !== null);
const chartBins = (record, rows) => {
  const limit = Number(record.info?.rollLimit) || 40;
  const step = limit / 4;
  const bins = Array.from({ length: 5 }, (_, index) => ({
    label: index === 4 ? `>${limit}` : `${(index * step).toFixed(0)}-${((index + 1) * step).toFixed(0)}`,
    count: 0,
    over: index === 4
  }));
  rows.forEach((roll) => {
    const points = Number(roll.pointsPer100);
    const index = points > limit ? 4 : Math.min(Math.floor(points / step), 3);
    bins[index].count += 1;
  });
  return bins;
};
const createFileName = (record, extension) => {
  const info = record.info || {};
  return `${safeBaseName(`inspeccion-${info.date || ""}-${info.fabric || "telas"}`)}.${extension}`;
};

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadInspectionExcel(record) {
  const info = record.info || {};
  const lot = record.lot || {};
  const rolls = inspectedRolls(record);
  const summary = [
    ["Fecha", info.date], ["Proveedor", info.supplier], ["Tela", info.fabric],
    ["Remisión", info.remision], ["Rollos inspeccionados", lot.inspected],
    ["Aceptados", lot.accepted], ["Rechazados", lot.rejected],
    ["Promedio (puntos / 100 yd²)", lot.average == null ? "Pendiente" : Number(lot.average).toFixed(2)],
    ["Decisión del lote", lot.decision],
    ...(record.finalDecision ? [["Decisión final de la tela", VERDICTS[record.finalDecision.code] ?? record.finalDecision.verdict]] : [])
  ];
  const testRows = evaluateAllFabricRows(record.fabricTest || {}).filter(({ state }) => state.applies !== "NO").map(({ row, state, limits, evaluation }) => [row.condition, row.parameter, state.test1, state.test2, state.test3, limits.min ?? "", limits.max ?? "", evaluation.worst, evaluation.result]);
  const planillaSummary = summarizePlanilla(record.planilla4Puntos || {}, record.fabricTest || {});
  const planillaRows = (record.planilla4Puntos?.rows || []).map((row, index) => ({ row, result: planillaSummary.results[index] })).filter(({ row }) => [row.meters, row.width, row.d1, row.d2, row.d3, row.d4, row.packageWeight, row.realWeight, row.notes].some((value) => value !== "" && value !== undefined)).map(({ row, result }) => [row.roll, row.meters, row.width, row.d1, row.d2, row.d3, row.d4, result.totalPoints, result.pointsPer100, result.result4, row.packageWeight, row.realWeight, result.weightDifference, result.gramaje, result.weightStatus, row.notes]);
  const simpleTable = (headers, data) => `<table><thead><tr>${headers.map((value) => `<th>${escapeHtml(value)}</th>`).join("")}</tr></thead><tbody>${data.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const rows = rolls.map((roll) => `<tr>${[
    roll.roll, roll.color || "#ffffff", roll.length, roll.width, roll.d1, roll.d2, roll.d3, roll.d4,
    roll.totalPoints, Number(roll.pointsPer100).toFixed(1), roll.decision, roll.notes || ""
  ].map((value, index) => `<td${index === 1 ? ` style="background-color:${/^#[\da-f]{6}$/i.test(String(value)) ? value : "#ffffff"};mso-number-format:'\\@';"` : ""}>${escapeHtml(value)}</td>`).join("")}</tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#243044}h1{color:#17233a;font-size:20px}h2{color:#17233a;font-size:15px;margin-top:24px}
    table{border-collapse:collapse;width:100%;margin-bottom:16px}th,td{border:1px solid #d8dee8;padding:7px;text-align:left}
    th{background:#f2f5f9;color:#243044} .color{width:80px}
  </style></head><body><h1>CREARTE BY CONFECCIONARTE</h1><p>Reporte de inspección de telas</p>
  <h2>Resumen</h2><table><thead><tr><th>Dato</th><th>Resultado</th></tr></thead><tbody>${summary.map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value ?? "")}</td></tr>`).join("")}</tbody></table>
  <h2>Detalle de rollos</h2><table><thead><tr>${["Rollo", "Color", "Largo (m)", "Ancho útil (cm)", "D1", "D2", "D3", "D4", "Puntos", "Puntos / 100 yd²", "Decisión", "Notas"].map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
  <h2>Pruebas de tela (módulo 02)</h2>${simpleTable(["Condición", "Parámetro", "Medición 1", "Medición 2", "Medición 3", "Mínimo", "Máximo", "Peor resultado", "Estado"], testRows)}
  <h2>Planilla 4 puntos (módulo 03)</h2><p>Resultado del lote: ${escapeHtml(planillaSummary.overall)} · Promedio: ${escapeHtml(planillaSummary.average ?? "—")} · Rollos sobre límite: ${escapeHtml(planillaSummary.overLimit)}</p>${simpleTable(["Rollo", "Metros", "Ancho útil", "D1", "D2", "D3", "D4", "Puntos", "Puntos/100 yd²", "4 puntos", "Peso empaque", "Peso real", "Dif. peso %", "Gramaje", "Estado peso", "Observaciones"], planillaRows)}
  <h2>Evidencia de decisión final</h2>${simpleTable(["Criterio", "Resultado", "Referencia", "Estado", "Origen"], (buildFinalDecision(record.fabricTest || {}, record.planilla4Puntos || {}).evidence || []).map((item) => [item.label, item.value, item.reference, item.status, item.source]))}
  </body></html>`;
  saveBlob(new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" }), createFileName(record, "xls"));
}

export function downloadInspectionPdf(record) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const info = record.info || {};
  const lot = record.lot || {};
  const rolls = inspectedRolls(record);
  const bins = chartBins(record, rolls);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  const navy = [23, 35, 58];
  const gold = [210, 169, 0];
  const green = [60, 128, 103];
  const red = [198, 108, 88];
  const text = (value) => String(value ?? "");

  pdf.setFillColor(...navy);
  pdf.rect(0, 0, pageWidth, 34, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(17);
  pdf.text("CREARTE BY CONFECCIONARTE", margin, 14);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  pdf.text("REPORTE DE INSPECCIÓN DE TELAS", margin, 23);
  pdf.setFontSize(9); pdf.text(`${text(info.date)}   •   ${text(info.fabric)}`, pageWidth - margin, 22, { align: "right" });

  const summary = [
    ["Proveedor", info.supplier], ["Remisión", info.remision], ["Rollos inspeccionados", lot.inspected],
    ["Aceptados", lot.accepted], ["Rechazados", lot.rejected],
    ["Promedio / 100 yd²", lot.average == null ? "Pendiente" : Number(lot.average).toFixed(2)],
    ["Decisión del lote", lot.decision],
    ...(record.finalDecision ? [["Decisión final tela", SHORT_VERDICTS[record.finalDecision.code] ?? record.finalDecision.verdict]] : [])
  ];
  const cardGap = 4;
  const cardWidth = (pageWidth - margin * 2 - cardGap * 3) / 4;
  summary.forEach(([label, value], index) => {
    const col = index % 4; const row = Math.floor(index / 4);
    const x = margin + col * (cardWidth + cardGap); const y = 40 + row * 20;
    pdf.setFillColor(245, 247, 250); pdf.roundedRect(x, y, cardWidth, 16, 2, 2, "F");
    pdf.setTextColor(89, 101, 121); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.text(text(label), x + 3, y + 5);
    pdf.setTextColor(...navy); pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.text(pdf.splitTextToSize(text(value), cardWidth - 6)[0] || "—", x + 3, y + 11.5);
  });

  // Gráfica de distribución de puntos, basada en los mismos rangos del panel.
  const chartY = 88; const chartH = 31; const chartW = (pageWidth - margin * 2 - 12) / 2;
  pdf.setDrawColor(216, 222, 232); pdf.roundedRect(margin, chartY, chartW, 34, 2, 2, "S");
  pdf.setTextColor(...navy); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.text("Distribución de puntos", margin + 4, chartY + 6);
  const maxCount = Math.max(1, ...bins.map((bin) => bin.count));
  const barWidth = 15; const barGap = (chartW - 12 - barWidth * bins.length) / (bins.length + 1);
  bins.forEach((bin, index) => {
    const x = margin + 6 + barGap + index * (barWidth + barGap);
    const height = (bin.count / maxCount) * 16;
    pdf.setFillColor(...(bin.over ? [36, 36, 32] : gold));
    if (height) pdf.rect(x, chartY + 27 - height, barWidth, height, "F");
    pdf.setTextColor(80, 88, 101); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
    pdf.text(bin.label, x + barWidth / 2, chartY + 31, { align: "center" });
    if (bin.count) pdf.text(String(bin.count), x + barWidth / 2, chartY + 25 - height, { align: "center" });
  });

  // Gráfica de estado con los colores del panel.
  const secondX = margin + chartW + 12;
  pdf.setDrawColor(216, 222, 232); pdf.roundedRect(secondX, chartY, chartW, 34, 2, 2, "S");
  pdf.setTextColor(...navy); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.text("Estado de los rollos", secondX + 4, chartY + 6);
  const total = Math.max(1, Number(lot.inspected) || 0);
  const acceptedWidth = (chartW - 12) * ((Number(lot.accepted) || 0) / total);
  pdf.setFillColor(...green); pdf.rect(secondX + 6, chartY + 13, acceptedWidth, 9, "F");
  pdf.setFillColor(...red); pdf.rect(secondX + 6 + acceptedWidth, chartY + 13, chartW - 12 - acceptedWidth, 9, "F");
  pdf.setTextColor(60, 70, 82); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
  pdf.setFillColor(...green); pdf.circle(secondX + 10, chartY + 29, 1.5, "F"); pdf.text(`Aceptados: ${Number(lot.accepted) || 0}`, secondX + 14, chartY + 30);
  pdf.setFillColor(...red); pdf.circle(secondX + chartW / 2 + 4, chartY + 29, 1.5, "F"); pdf.text(`Rechazados: ${Number(lot.rejected) || 0}`, secondX + chartW / 2 + 8, chartY + 30);

  const columns = ["Rollo", "Color", "Largo (m)", "Ancho (cm)", "D1", "D2", "D3", "D4", "Puntos", "Puntos / 100 yd²", "Decisión", "Notas"];
  const widths = [14, 25, 19, 20, 10, 10, 10, 10, 16, 25, 23, pageWidth - margin * 2 - 182];
  const drawTableHeader = (y) => {
    pdf.setFillColor(...navy); pdf.rect(margin, y, pageWidth - margin * 2, 8, "F");
    pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7);
    let x = margin;
    columns.forEach((column, index) => { pdf.text(column, x + 1.5, y + 5.2); x += widths[index]; });
  };
  let y = 128;
  pdf.setTextColor(...navy); pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.text("Detalle de rollos", margin, y - 4);
  drawTableHeader(y);
  y += 8;
  rolls.forEach((roll, index) => {
    const values = [roll.roll, roll.color || "#ffffff", roll.length, roll.width, roll.d1, roll.d2, roll.d3, roll.d4, roll.totalPoints, Number(roll.pointsPer100).toFixed(1), roll.decision, roll.notes || ""];
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
    const noteLines = pdf.splitTextToSize(text(roll.notes || ""), widths[11] - 3);
    const rowHeight = Math.max(8, noteLines.length * 3.5 + 3);
    if (y + rowHeight > 198) { pdf.addPage(); y = 15; drawTableHeader(y); y += 8; }
    if (index % 2 === 0) { pdf.setFillColor(247, 249, 251); pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, "F"); }
    pdf.setTextColor(36, 48, 68);
    let x = margin;
    values.forEach((value, col) => {
      if (col === 1 && /^#[\da-f]{6}$/i.test(String(value))) {
        pdf.setFillColor(parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16));
        pdf.rect(x + 1.5, y + 2.5, 4, 3, "F"); pdf.text(String(value), x + 7, y + 5.5);
      } else {
        const cellLines = col === 11 ? noteLines : pdf.splitTextToSize(text(value), widths[col] - 3).slice(0, 1);
        if (cellLines.length) pdf.text(cellLines, x + 1.5, y + 5.5, { lineHeightFactor: 1.1 });
      }
      x += widths[col];
    });
    y += rowHeight;
  });
  if (!rolls.length) { pdf.setTextColor(89, 101, 121); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.text("No hay rollos completos para mostrar.", margin, y + 8); }
  const addReportSection = (title, rows) => {
    pdf.addPage();
    let sectionY = 18;
    pdf.setTextColor(...navy); pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.text(title, margin, sectionY);
    sectionY += 8;
    rows.forEach((row) => {
      const line = pdf.splitTextToSize(row.map((value) => text(value || "—")).join("   |   "), pageWidth - margin * 2);
      const height = line.length * 4 + 2;
      if (sectionY + height > 195) { pdf.addPage(); sectionY = 18; }
      pdf.setTextColor(36, 48, 68); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
      pdf.text(line, margin, sectionY);
      sectionY += height;
    });
  };
  const testRows = evaluateAllFabricRows(record.fabricTest || {}).filter(({ state }) => state.applies !== "NO").map(({ row, state, limits, evaluation }) => [row.condition, row.parameter, `Mediciones: ${state.test1 || "—"}/${state.test2 || "—"}/${state.test3 || "—"}`, `Rango: ${limits.min || "—"} a ${limits.max || "—"}`, `Peor: ${evaluation.worst}`, evaluation.result]);
  const planilla = summarizePlanilla(record.planilla4Puntos || {}, record.fabricTest || {});
  const planillaRows = (record.planilla4Puntos?.rows || []).map((row, index) => ({ row, result: planilla.results[index] })).filter(({ row }) => [row.meters, row.width, row.d1, row.d2, row.d3, row.d4, row.packageWeight, row.realWeight, row.notes].some((value) => value !== "" && value !== undefined)).map(({ row, result }) => [`Rollo ${row.roll}`, `${row.meters} m x ${row.width} cm`, `D1-D4: ${row.d1}/${row.d2}/${row.d3}/${row.d4}`, `Puntos: ${result.totalPoints ?? "—"}`, `Puntos/100 yd²: ${result.pointsPer100 ?? "—"}`, result.result4, `Peso: ${result.weightDifference ?? "—"}%`, `Gramaje: ${result.gramaje ?? "—"}`, result.weightStatus]);
  const evidenceRows = (buildFinalDecision(record.fabricTest || {}, record.planilla4Puntos || {}).evidence || []).map((item) => [item.label, item.value, item.reference, item.status, item.source]);
  addReportSection("Pruebas de tela · Módulo 02", testRows.length ? testRows : [["Sin resultados registrados"]]);
  addReportSection(`Planilla 4 puntos · Módulo 03 · ${planilla.overall} · promedio ${planilla.average ?? "—"}`, planillaRows.length ? planillaRows : [["Sin rollos registrados"]]);
  addReportSection("Evidencia de decisión final", evidenceRows.length ? evidenceRows : [[record.finalDecision?.verdict || "Pendiente"]]);
  pdf.save(createFileName(record, "pdf"));
}