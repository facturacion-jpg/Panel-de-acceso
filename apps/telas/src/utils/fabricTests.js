// Estructura del módulo "Pruebas de tela", sincronizada con las filas
// 23 a 39 de ESTANDARES_TELA y 10 a 26 de PRUEBAS_TELA del Excel.
// Los nombres de condición y parámetro son fijos: no llevan numeración ni "#".
//
// IMPORTANTE: se conservan los IDs históricos para que las inspecciones ya
// guardadas sigan abriendo y no pierdan sus mediciones.

export const FABRIC_TYPES = ["Punto", "Plano"];
export const APPLIES_OPTIONS = ["SI", "NO"];

export const FABRIC_TEST_ROWS = [
  {
    id: "shrink-length",
    excelRow: 10,
    standardRow: 23,
    condition: "Encogimiento",
    parameter: "Encogimiento largo",
    unit: "%",
    suggested: "Punto: mín −5, máx +2 · Plano: mín −3, máx +2"
  },
  {
    id: "shrink-width",
    excelRow: 11,
    standardRow: 24,
    condition: "Encogimiento",
    parameter: "Encogimiento ancho",
    unit: "%",
    suggested: "Punto: mín −5, máx +2 · Plano: mín −2, máx +2"
  },
  {
    id: "color-change",
    excelRow: 12,
    standardRow: 25,
    condition: "Solidez del color",
    parameter: "Cambio de Color",
    unit: "grado 1–5",
    suggested: "Mín 4"
  },
  {
    id: "color-staining",
    excelRow: 13,
    standardRow: 26,
    condition: "Solidez del color",
    parameter: "Manchado",
    unit: "grado 1–5",
    suggested: "Mín 4"
  },
  {
    id: "color-dry-rub",
    excelRow: 14,
    standardRow: 27,
    condition: "Solidez del color",
    parameter: "Frote Seco",
    unit: "grado 1–5",
    suggested: "Mín 4"
  },
  {
    id: "iron-color",
    excelRow: 15,
    standardRow: 28,
    condition: "Planchado",
    parameter: "Cambio de color por plancha",
    unit: "grado 1–5",
    suggested: "Mín 4"
  },
  {
    id: "iron-dimensional",
    excelRow: 16,
    standardRow: 29,
    condition: "Planchado",
    parameter: "Variación dimensional por plancha",
    unit: "%",
    suggested: "Mín −2, máx +1"
  },
  {
    id: "iron-appearance",
    excelRow: 17,
    standardRow: 30,
    condition: "Planchado",
    parameter: "Apariencia por plancha",
    unit: "grado 1–5",
    suggested: "Mín 4"
  },
  {
    id: "skew",
    excelRow: 18,
    standardRow: 31,
    condition: "Hilo y escuadra",
    parameter: "Desplazamiento",
    unit: "%",
    suggested: "Máx 5 (plano: 3)"
  },
  {
    id: "construction",
    excelRow: 19,
    standardRow: 32,
    condition: "Hilo y escuadra",
    parameter: "Construcción",
    unit: "%",
    suggested: "Máx 3"
  },
  {
    id: "elastic-recovery",
    excelRow: 20,
    standardRow: 33,
    condition: "Elasticidad y recuperación",
    parameter: "Recuperación elástica",
    unit: "%",
    suggested: "Mín 90"
  },
  {
    id: "residual-growth",
    excelRow: 21,
    standardRow: 34,
    condition: "Elasticidad y recuperación",
    parameter: "Crecimiento residual",
    unit: "%",
    suggested: "Máx 5"
  },
  {
    id: "seam-slippage",
    excelRow: 22,
    standardRow: 35,
    condition: "Costurabilidad",
    parameter: "Deslizamiento de costura",
    unit: "mm",
    suggested: "Máx 6 (plano)"
  },
  {
    id: "seam-strength",
    excelRow: 23,
    standardRow: 36,
    condition: "Costurabilidad",
    parameter: "Resistencia de la costura",
    unit: "N",
    suggested: "Mín según ficha o cliente"
  },
  {
    id: "needle-damage",
    excelRow: 24,
    standardRow: 37,
    condition: "Costurabilidad",
    parameter: "Daño por aguja y puntadas saltadas",
    unit: "cantidad",
    suggested: "Máx 0"
  },
  {
    id: "weight",
    excelRow: 25,
    standardRow: 38,
    condition: "Base: gramaje y ancho",
    parameter: "Gramaje",
    unit: "g/m²",
    suggested: "Nominal ± tolerancia (se calcula)",
    calculated: "weight"
  },
  {
    id: "usable-width",
    excelRow: 26,
    standardRow: 39,
    condition: "Base: gramaje y ancho",
    parameter: "Ancho útil",
    unit: "cm",
    suggested: "Mín según ficha técnica",
    calculated: "width"
  }
];

export const makeBlankFabricTest = () => ({
  fabricType: "Punto",
  color: "",
  fabricLot: "",
  composition: "",
  masterReference: null,
  clientStandard: "",
  inspector: "",
  sampledRolls: "",
  testDate: new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10),
  nominalWeight: "",
  weightTolerance: "",
  minUsableWidth: "",
  maxPointsPerRoll: "",
  maxLotAverage: "",
  maxPercentOverLimit: "",
  maxWeightDifference: "",
  rows: Object.fromEntries(
    FABRIC_TEST_ROWS.map((row) => [
      row.id,
      {
        applies: "SI",
        min: "",
        max: "",
        test1: "",
        test2: "",
        test3: "",
        observations: ""
      }
    ])
  )
});

// Combina la estructura vigente con los datos guardados.
// Los IDs se mantienen para garantizar compatibilidad con
// inspecciones de versiones anteriores.
export const restoreFabricTest = (saved) => {
  const blank = makeBlankFabricTest();

  if (!saved || typeof saved !== "object") {
    return blank;
  }

  return {
    ...blank,
    fabricType: FABRIC_TYPES.includes(saved.fabricType)
      ? saved.fabricType
      : blank.fabricType,
    color: saved.color ?? "",
    fabricLot: saved.fabricLot ?? "",
    composition: saved.composition ?? "",
    masterReference: saved.masterReference ?? null,
    clientStandard: saved.clientStandard ?? "",
    inspector: saved.inspector ?? "",
    sampledRolls: saved.sampledRolls ?? "",
    testDate: saved.testDate ?? blank.testDate,
    nominalWeight: saved.nominalWeight ?? "",
    weightTolerance: saved.weightTolerance ?? "",
    minUsableWidth: saved.minUsableWidth ?? "",
    maxPointsPerRoll: saved.maxPointsPerRoll ?? "",
    maxLotAverage: saved.maxLotAverage ?? "",
    maxPercentOverLimit: saved.maxPercentOverLimit ?? "",
    maxWeightDifference: saved.maxWeightDifference ?? "",
    rows: Object.fromEntries(
      FABRIC_TEST_ROWS.map((row) => {
        const savedRow = saved.rows?.[row.id] ?? {};

        return [
          row.id,
          {
            applies: APPLIES_OPTIONS.includes(savedRow.applies)
              ? savedRow.applies
              : "SI",
            min: savedRow.min ?? "",
            max: savedRow.max ?? "",
            test1: savedRow.test1 ?? "",
            test2: savedRow.test2 ?? "",
            test3: savedRow.test3 ?? "",
            observations: savedRow.observations ?? ""
          }
        ];
      })
    )
  };
};

export const normalizeMasterKey = (value) =>
  String(value ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("es");

const masterValue = (value) => value === null || value === undefined ? "" : String(value);

export const clearMasterReference = (test) => {
  const reference = test.masterReference;
  if (!reference) return test;

  const next = { ...test, masterReference: null };
  ["nominalWeight", "weightTolerance", "composition", "minUsableWidth"].forEach((key) => {
    if (masterValue(test[key]) === masterValue(reference[key])) next[key] = "";
  });
  return next;
};

export const applyMasterReference = (test, reference) => {
  const totalWidth = Number(reference.totalWidth);
  const widthTolerance = Number(reference.widthTolerance);
  const minUsableWidth = Number.isFinite(totalWidth) && totalWidth > 0
    ? String(Number((totalWidth * 100 * (1 - (Number.isFinite(widthTolerance) ? widthTolerance : 0) / 100)).toFixed(2)))
    : "";
  const selectedReference = { ...reference, minUsableWidth };
  return {
    ...test,
    nominalWeight: masterValue(reference.nominalWeight),
    weightTolerance: masterValue(reference.weightTolerance),
    composition: masterValue(reference.composition),
    minUsableWidth,
    masterReference: selectedReference
  };
};

const toNumber = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const round = (value) => String(Number(value.toFixed(2)));

// Los límites de gramaje y ancho útil se derivan de los datos base,
// igual que las fórmulas de las filas 38 y 39 de ESTANDARES_TELA.
export const getRowLimits = (row, test) => {
  if (row.calculated === "weight") {
    const nominal = toNumber(test.nominalWeight);
    const tolerance = toNumber(test.weightTolerance);

    if (nominal === null || tolerance === null) {
      return { min: "", max: "" };
    }

    return {
      min: round(nominal * (1 - tolerance / 100)),
      max: round(nominal * (1 + tolerance / 100))
    };
  }

  if (row.calculated === "width") {
    const width = toNumber(test.minUsableWidth);

    return {
      min: width === null ? "" : String(width),
      max: ""
    };
  }

  const saved = test.rows?.[row.id] ?? {};

  return {
    min: saved.min ?? "",
    max: saved.max ?? ""
  };
};

export const summarizeFabricTest = (test) => {
  const applying = FABRIC_TEST_ROWS.filter(
    (row) => test.rows?.[row.id]?.applies !== "NO"
  );

  const withLimits = applying.filter((row) => {
    const { min, max } = getRowLimits(row, test);

    return min !== "" || max !== "";
  });

  return {
    total: FABRIC_TEST_ROWS.length,
    applying: applying.length,
    notApplying: FABRIC_TEST_ROWS.length - applying.length,
    withLimits: withLimits.length
  };
};

// Evalúa una fila de PRUEBAS_TELA (peor valor y resultado).
// Compartido por el módulo 02 y por la decisión final de la tela.
export function evaluateFabricRow(state, limits) {
  if (state.applies === "NO") {
    return {
      worst: "—",
      result: "N/A"
    };
  }

  const values = [
    state.test1,
    state.test2,
    state.test3
  ]
    .map(toNumber)
    .filter((value) => value !== null);

  const min = toNumber(limits.min);
  const max = toNumber(limits.max);

  if (min === null && max === null) {
    return {
      worst: values.length ? Math.min(...values) : "—",
      result: "SIN ESTÁNDAR"
    };
  }

  if (!values.length) {
    return {
      worst: "—",
      result: "SIN DATO"
    };
  }

  // Se considera peor la medición que más se aleja
  // del rango permitido.
  const violation = (value) =>
    Math.max(
      min === null ? 0 : min - value,
      max === null ? 0 : value - max,
      0
    );

  const worst = values.reduce(
    (currentWorst, value) =>
      violation(value) > violation(currentWorst)
        ? value
        : currentWorst,
    values[0]
  );

  const rejected = values.some(
    (value) =>
      (min !== null && value < min) ||
      (max !== null && value > max)
  );

  return {
    worst: Number(worst.toFixed(2)),
    result: rejected ? "RECHAZA" : "ACEPTA"
  };
}

// Evalúa todas las filas de pruebas con sus límites vigentes.
export const evaluateAllFabricRows = (test) =>
  FABRIC_TEST_ROWS.map((row) => {
    const state = test?.rows?.[row.id] ?? {
      applies: "SI", test1: "", test2: "", test3: "", observations: ""
    };
    const limits = getRowLimits(row, test ?? {});
    return { row, state, limits, evaluation: evaluateFabricRow(state, limits) };
  });
