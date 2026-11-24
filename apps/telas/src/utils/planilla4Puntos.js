// Cálculos de la planilla de 4 puntos, compartidos por el módulo 03
// y por la decisión final de la tela.
// Equivalen a las fórmulas de PLANILLA_4PUNTOS del Excel.

export const numeric = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
export const fixed = (value, digits = 2) => Number(value.toFixed(digits));

export function calculate(row, planilla) {
  const d1 = numeric(row.d1) ?? 0;
  const d2 = numeric(row.d2) ?? 0;
  const d3 = numeric(row.d3) ?? 0;
  const d4 = numeric(row.d4) ?? 0;
  const hasDefects = [row.d1, row.d2, row.d3, row.d4].some((v) => v !== "");
  const totalPoints = hasDefects ? d1 + 2*d2 + 3*d3 + 4*d4 : null;
  const meters = numeric(row.meters);
  const width = numeric(row.width);
  const pointsPer100 = totalPoints !== null && meters > 0 && width > 0
    ? totalPoints * 3600 / ((meters / 0.9144) * (width / 2.54))
    : null;
  const maxPoints = numeric(planilla.maxPointsPerRoll);
  const result4 = pointsPer100 === null ? "SIN DATO"
    : maxPoints === null ? "SIN ESTÁNDAR"
    : pointsPer100 <= maxPoints ? "ACEPTA" : "RECHAZA";
  const packageWeight = numeric(row.packageWeight);
  const realWeight = numeric(row.realWeight);
  const weightDifference = packageWeight > 0 && realWeight !== null
    ? ((realWeight - packageWeight) / packageWeight) * 100 : null;
  const gramaje = meters > 0 && width > 0 && realWeight !== null
    ? realWeight * 1000 / (meters * width / 100) : null;
  const nominal = numeric(planilla.nominalWeight);
  const tolerance = numeric(planilla.weightTolerance);
  const minWidth = numeric(planilla.minUsableWidth);
  const maxWeightDiff = numeric(planilla.maxWeightDifference);
  const gramajeMin = nominal !== null && tolerance !== null ? nominal * (1 - tolerance / 100) : null;
  const gramajeMax = nominal !== null && tolerance !== null ? nominal * (1 + tolerance / 100) : null;
  const hasAnyWeightStandard = gramajeMin !== null || gramajeMax !== null || minWidth !== null || maxWeightDiff !== null;
  const violatesGramaje = (gramajeMin !== null && gramaje < gramajeMin) || (gramajeMax !== null && gramaje > gramajeMax);
  const violatesWidth = minWidth !== null && width !== null && width < minWidth;
  const violatesWeight = maxWeightDiff !== null && weightDifference !== null && Math.abs(weightDifference) > maxWeightDiff;
  const weightStatus = gramaje === null ? "SIN DATO"
    : !hasAnyWeightStandard ? "SIN ESTÁNDAR"
    : (violatesGramaje || violatesWidth || violatesWeight) ? "RECHAZA" : "ACEPTA";
  return {
    totalPoints,
    pointsPer100: pointsPer100 === null ? null : fixed(pointsPer100),
    result4,
    weightDifference: weightDifference === null ? null : fixed(weightDifference),
    gramaje: gramaje === null ? null : fixed(gramaje),
    weightStatus
  };
}

// Estándares vigentes: los del módulo 01 mandan sobre los guardados en la planilla.
export const getEffectivePlanilla = (value = {}, standards = {}) => ({
  ...value,
  maxPointsPerRoll: standards.maxPointsPerRoll ?? value.maxPointsPerRoll,
  maxLotAverage: standards.maxLotAverage ?? value.maxLotAverage,
  maxPercentOverLimit: standards.maxPercentOverLimit ?? value.maxPercentOverLimit,
  nominalWeight: standards.nominalWeight ?? value.nominalWeight,
  weightTolerance: standards.weightTolerance ?? value.weightTolerance,
  minUsableWidth: standards.minUsableWidth ?? value.minUsableWidth,
  maxWeightDifference: standards.maxWeightDifference ?? value.maxWeightDifference
});

// Resumen del lote: promedio, % sobre el límite y resultado general (K3:K7 del Excel).
export function summarizePlanilla(value, standards) {
  const effectiveValue = getEffectivePlanilla(value, standards);
  const results = (value?.rows ?? []).map((row) => calculate(row, effectiveValue));
  const complete = results.filter((result) => result.pointsPer100 !== null);
  const overLimit = results.filter((result) => result.result4 === "RECHAZA").length;
  const average = complete.length
    ? fixed(complete.reduce((sum, row) => sum + row.pointsPer100, 0) / complete.length)
    : null;
  const percentOver = complete.length ? fixed(overLimit / complete.length * 100) : null;
  const maxAverage = numeric(effectiveValue.maxLotAverage);
  const maxPercent = numeric(effectiveValue.maxPercentOverLimit);
  const overall = !complete.length ? "SIN DATO"
    : numeric(effectiveValue.maxPointsPerRoll) === null || maxAverage === null || maxPercent === null
      ? "SIN ESTÁNDAR"
      : average <= maxAverage && percentOver <= maxPercent ? "ACEPTA" : "RECHAZA";
  return { effectiveValue, results, complete, overLimit, average, percentOver, overall, maxAverage, maxPercent };
}