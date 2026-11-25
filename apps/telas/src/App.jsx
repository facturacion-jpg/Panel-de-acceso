import { useEffect, useMemo, useState } from "react";

import {
  ArrowDownToLine,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FlaskConical,
  Mail,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";

import Header from "./components/Header.jsx";
import InspectionForm from "./components/InspectionForm.jsx";
import SummaryCards from "./components/SummaryCards.jsx";
import EmailComposer from "./components/EmailComposer.jsx";
import InspectionDatabase from "./components/InspectionDatabase.jsx";
import FabricTestDialog from "./components/FabricTestDialog.jsx";
import FabricStandardsDialog from "./components/FabricStandardsDialog.jsx";
import FinalDecisionPanel from "./components/FinalDecisionPanel.jsx";
import Planilla4PuntosDialog, { makeBlankPlanilla, restorePlanilla } from "./components/Planilla4PuntosDialog.jsx";

import {
  calculateRoll,
  calculateLot
} from "./utils/calculations.js";

import {
  saveInspection,
  loadInspections,
  deleteInspection,
  subscribeInspections
} from "./services/inspections.js";
import { auth } from "./firebase.js";
import { sendInspectionEmail } from "./services/email.js";
import fabricMaster from "./data/fabricMaster.json";
import { validateInspection } from "./utils/validations.js";
import { buildFinalDecision } from "./utils/finalDecision.js";
import {
  makeBlankFabricTest,
  restoreFabricTest,
  summarizeFabricTest,
  normalizeMasterKey,
  clearMasterReference,
  applyMasterReference,
  evaluateAllFabricRows,
} from "./utils/fabricTests.js";
import { summarizePlanilla } from "./utils/planilla4Puntos.js";

import "./styles/dashboard.css";
import "./styles/inspection.css";
import "./styles/planilla-4puntos.css";
import "./styles/dark.css";

const blankRolls = () =>
  Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    roll: i + 1,
    length: "0",
    width: "0",
    d1: "0",
    d2: "0",
    d3: "0",
    d4: "0",
    color: "#ffffff",
    notes: ""
  }));

const restoreRolls = (record) =>
  blankRolls().map((blank, index) => {
    const savedRoll = record?.rolls?.[index];
    return savedRoll
      ? {
          ...blank,
          ...savedRoll,
          length: savedRoll.length ?? "0",
          width: savedRoll.width ?? "0",
          d1: savedRoll.d1 ?? "0",
          d2: savedRoll.d2 ?? "0",
          d3: savedRoll.d3 ?? "0",
          d4: savedRoll.d4 ?? "0",
          color: savedRoll.color ?? "#ffffff"
        }
      : blank;
  });

const localDate = () => {
  const date = new Date();
  const localOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - localOffset).toISOString().slice(0, 10);
};

const initialInfo = () => ({
  date: localDate(),
  supplier: "",
  email: "",
  fabric: "",
  remision: "",
  rollLimit: 40,
  lotLimit: 28
});

const downloadInspectionExcel = (...args) => import("./services/inspectionExports.js")
  .then(({ downloadInspectionExcel: download }) => download(...args));
const downloadSavedInspectionPdf = (...args) => import("./services/inspectionExports.js")
  .then(({ downloadInspectionPdf: download }) => download(...args));

export default function App() {
  const user = auth.currentUser;
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("crearte:tema") === "dark" ? "dark" : "light"; }
    catch (_) { return "light"; }
  });
  const [charts, setCharts] = useState(null);
  const masterRecords = fabricMaster.records;
  const [inspections, setInspections] = useState(loadInspections);
  const [cloudReady, setCloudReady] = useState(false);
  const [info, setInfo] = useState(initialInfo);
  const [rolls, setRolls] = useState(blankRolls);
  const [savedRolls, setSavedRolls] = useState(blankRolls);
  const [emailObservations, setEmailObservations] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [fabricTest, setFabricTest] = useState(makeBlankFabricTest);
  const [fabricTestOpen, setFabricTestOpen] = useState(false);
  const [standardsOpen, setStandardsOpen] = useState(false);
  const [planilla4Puntos, setPlanilla4Puntos] = useState(makeBlankPlanilla);
  const [planillaOpen, setPlanillaOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("crearte:tema", theme); } catch (_) {}
  }, [theme]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      import("recharts")
        .then((module) => { if (active) setCharts(module); })
        .catch((error) => console.error("No se pudieron cargar los gráficos:", error));
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    return subscribeInspections(
      user,
      setInspections,
      (error) => {
        console.error("No se pudieron sincronizar las inspecciones:", error);
        setSaveError("No se pudo sincronizar con Firebase. Revisa tu conexión y las reglas de Firestore.");
        setCloudReady(true);
      },
      () => setCloudReady(true)
    );
  }, [user?.uid]);

  useEffect(() => {
    if (!emailDialogOpen && !databaseOpen && !helpOpen && !fabricTestOpen && !standardsOpen && !planillaOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setEmailDialogOpen(false);
        setDatabaseOpen(false);
        setHelpOpen(false);
        setFabricTestOpen(false);
        setStandardsOpen(false);
        setPlanillaOpen(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [emailDialogOpen, databaseOpen, helpOpen, fabricTestOpen, standardsOpen, planillaOpen]);

  const calculated = useMemo(
    () =>
      rolls.map((roll) => ({
        ...roll,
        ...calculateRoll(
          roll,
          Number(info.rollLimit) || 40
        )
      })),
    [rolls, info.rollLimit]
  );

  const savedCalculated = useMemo(
    () =>
      savedRolls.map((roll) => ({
        ...roll,
        ...calculateRoll(
          roll,
          Number(info.rollLimit) || 40
        )
      })),
    [savedRolls, info.rollLimit]
  );

  const draftLot = useMemo(
    () =>
      calculateLot(
        calculated,
        Number(info.lotLimit) || 28
      ),
    [calculated, info.lotLimit]
  );

  const lot = useMemo(
    () =>
      calculateLot(
        savedCalculated,
        Number(info.lotLimit) || 28
      ),
    [savedCalculated, info.lotLimit]
  );

  // Decisión final: sale de "Pruebas de tela" y "Planilla 4 puntos".
  const finalDecision = useMemo(
    () => buildFinalDecision(fabricTest, planilla4Puntos),
    [fabricTest, planilla4Puntos]
  );

  const rollLimit = Number(info.rollLimit) || 40;
  const chartData = useMemo(() => {
    const intervalSize = rollLimit / 4;
    const formatBoundary = (value) => Number(value.toFixed(1)).toString();
    const bins = Array.from({ length: 5 }, (_, index) => {
      const lower = index * intervalSize;
      const upper = (index + 1) * intervalSize;
      return {
        interval: index === 4
          ? `>${formatBoundary(rollLimit)}`
          : `${formatBoundary(lower)}–${formatBoundary(upper)}`,
        rolls: 0,
        exceedsLimit: index === 4
      };
    });

    savedCalculated
      .filter((roll) => roll.pointsPer100 !== null)
      .forEach((roll) => {
        const index = roll.pointsPer100 > rollLimit
          ? 4
          : Math.min(Math.floor(roll.pointsPer100 / intervalSize), 3);
        bins[index].rolls += 1;
      });

    return bins;
  }, [savedCalculated, rollLimit]);
  const hasHistogramData = chartData.some((bin) => bin.rolls > 0);
  const reportHtml = useMemo(() => {
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
    const cell = (value) => `<td style="padding:7px;border:1px solid #d8dee8;text-align:left;">${escapeHtml(value ?? "—")}</td>`;
    const header = (labels) => `<thead><tr>${labels.map((label) => `<th style="padding:7px;border:1px solid #d8dee8;background:#f2f5f9;text-align:left;">${escapeHtml(label)}</th>`).join("")}</tr></thead>`;
    const table = (labels, rows) => `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">${header(labels)}<tbody>${rows.map((row) => `<tr>${row.map(cell).join("")}</tr>`).join("")}</tbody></table>`;
    const inspectedRolls = savedCalculated.filter((roll) => roll.pointsPer100 !== null);
    const testRows = evaluateAllFabricRows(fabricTest)
      .filter(({ state }) => state.applies !== "NO")
      .map(({ row, state, limits, evaluation }) => [row.condition, row.parameter, state.test1, state.test2, state.test3, limits.min || "—", limits.max || "—", evaluation.worst, evaluation.result]);
    const planilla = summarizePlanilla(planilla4Puntos, fabricTest);
    const planillaRows = (planilla4Puntos.rows || []).map((row, index) => ({ row, result: planilla.results[index] }))
      .filter(({ row }) => [row.meters, row.width, row.d1, row.d2, row.d3, row.d4, row.packageWeight, row.realWeight, row.notes].some((value) => value !== "" && value !== undefined))
      .map(({ row, result }) => [row.roll, row.meters, row.width, row.d1, row.d2, row.d3, row.d4, result.totalPoints, result.pointsPer100, result.result4, row.packageWeight, row.realWeight, result.weightDifference, result.gramaje, result.weightStatus, row.notes]);
    const summaryRows = [
      ["Fecha", info.date], ["Proveedor", info.supplier], ["Tela", info.fabric], ["Remisión", info.remision],
      ["Rollos inspeccionados (módulo 03)", planilla.complete.length], ["Promedio puntos/100 yd²", planilla.average],
      ["Rollos sobre el límite", planilla.overLimit], ["Porcentaje sobre el límite", planilla.percentOver === null ? "Pendiente" : `${planilla.percentOver}%`],
      ["Resultado Planilla 4 puntos", planilla.overall], ["Decisión final de la tela", finalDecision.verdict]
    ];
    const standardsRows = [
      ["Tipo de tela", fabricTest.fabricType], ["Lote / OM", fabricTest.fabricLot || info.remision],
      ["Composición", fabricTest.composition], ["Gramaje nominal (g/m²)", fabricTest.nominalWeight],
      ["Tolerancia de gramaje (%)", fabricTest.weightTolerance], ["Ancho útil mínimo (cm)", fabricTest.minUsableWidth],
      ["Máximo puntos por rollo", fabricTest.maxPointsPerRoll], ["Promedio máximo del lote", fabricTest.maxLotAverage],
      ["Máximo % rollos sobre límite", fabricTest.maxPercentOverLimit], ["Diferencia máxima de peso (%)", fabricTest.maxWeightDifference]
    ];
    const evidenceRows = (finalDecision.evidence || []).map((item) => [item.label, item.value, item.reference, item.status, item.source]);
    return `<div style="font-family:Arial,sans-serif;color:#243044;line-height:1.45;max-width:1100px;">
      <h2 style="margin:0 0 4px;color:#17233a;">CREARTE BY CONFECCIONARTE</h2><p style="margin:0 0 18px;color:#596579;">Reporte completo de inspección de telas · ${escapeHtml(info.date)} · ${escapeHtml(info.fabric)}</p>
      <h3>Resumen de inspección</h3>${table(["Dato", "Resultado"], summaryRows)}
      <h3>Datos y estándares vigentes</h3>${table(["Estándar", "Valor"], standardsRows)}
      <h3>Pruebas de tela (módulo 02)</h3>${table(["Condición", "Parámetro", "Medición 1", "Medición 2", "Medición 3", "Mínimo", "Máximo", "Peor resultado", "Estado"], testRows)}
      <h3>Planilla 4 puntos (módulo 03)</h3>${table(["Rollo", "Metros", "Ancho útil", "D1", "D2", "D3", "D4", "Puntos", "Puntos/100 yd²", "4 puntos", "Peso empaque", "Peso real", "Dif. peso %", "Gramaje", "Peso/gramaje", "Observaciones"], planillaRows)}
      <h3>Evidencia de la decisión final</h3>${table(["Criterio", "Resultado", "Referencia", "Estado", "Origen"], evidenceRows)}
      <h3>Registro tradicional de rollos</h3>${table(["Rollo", "Largo (m)", "Ancho (cm)", "D1", "D2", "D3", "D4", "Puntos", "Puntos/100 yd²", "Estado", "Observaciones"], inspectedRolls.map((roll) => [roll.roll, roll.length, roll.width, roll.d1, roll.d2, roll.d3, roll.d4, roll.totalPoints, roll.pointsPer100, roll.decision, roll.notes]))}
    </div>`;
  }, [info.date, info.fabric, info.remision, info.supplier, lot, finalDecision, savedCalculated, fabricTest, planilla4Puntos]);
  const hasInspectionData = Boolean(
    info.supplier || info.fabric || info.remision || draftLot.inspected
  );
  const notifications = [
    ...(hasInspectionData && !saved
      ? [{
          id: "unsaved",
          title: "Cambios sin guardar",
          message: "Guarda la inspección para conservar la información.",
          tone: "warning"
        }]
      : []),
    ...(draftLot.inspected === 0 && lot.inspected === 0
      ? [{
          id: "no-rolls",
          title: "Faltan rollos por registrar",
          message: "Completa largo y ancho útil para generar los cálculos.",
          action: "rolls"
        }]
      : []),
    ...(lot.rejected > 0
      ? [{
          id: "rejected-rolls",
          title: `${lot.rejected} rollo${lot.rejected === 1 ? "" : "s"} rechazado${lot.rejected === 1 ? "" : "s"}`,
          message: "Revisa los resultados antes de cerrar la inspección.",
          tone: "danger",
          action: "rolls"
        }]
      : []),
    ...(inspections.length > 0
      ? [{
          id: "saved-inspections",
          title: "Inspecciones guardadas",
          message: `${inspections.length} inspecciones guardadas en Firebase.`,
          action: "database"
        }]
      : [])
  ];

  const decisionData = [
    {
      name: "Aceptados",
      value: lot.accepted,
      color: "#3c8067"
    },
    {
      name: "Rechazados",
      value: lot.rejected,
      color: "#c66c58"
    }
  ];

  const updateInfo = (key, value) => {
    const nextInfo = { ...info, [key]: value };
    if (key === "fabric") {
      const sameFabric = masterRecords.filter((record) =>
        normalizeMasterKey(record.fabric) === normalizeMasterKey(value)
      );
      const suppliers = [...new Set(sameFabric.map((record) => record.supplier))];
      if (value.trim() && suppliers.length === 1) nextInfo.supplier = suppliers[0];
    }

    setInfo(nextInfo);
    if (key === "fabric" || key === "supplier") {
      const matches = masterRecords.filter((record) =>
        normalizeMasterKey(record.fabric) === normalizeMasterKey(nextInfo.fabric) &&
        normalizeMasterKey(record.supplier) === normalizeMasterKey(nextInfo.supplier)
      );
      const reference = matches[0] ?? null;
      setFabricTest((current) => {
        if (reference && current.masterReference?.id === reference.id) return current;
        const cleared = clearMasterReference(current);
        return reference ? applyMasterReference(cleared, reference) : cleared;
      });
    }
    setSaved(false);
    setFormError("");
    setSaveError("");
  };

  const supplierOptions = useMemo(() => {
    const fabric = normalizeMasterKey(info.fabric);
    const matching = fabric
      ? masterRecords.filter((record) => normalizeMasterKey(record.fabric) === fabric).map((record) => record.supplier)
      : [];
    return [...new Set(matching.length ? matching : fabricMaster.suppliers)].sort((a, b) => a.localeCompare(b, "es"));
  }, [masterRecords, info.fabric]);

  const fabricOptions = useMemo(() => {
    const supplier = normalizeMasterKey(info.supplier);
    const matching = supplier
      ? masterRecords.filter((record) => normalizeMasterKey(record.supplier) === supplier).map((record) => record.fabric)
      : [];
    return [...new Set(matching.length ? matching : masterRecords.map((record) => record.fabric))].sort((a, b) => a.localeCompare(b, "es"));
  }, [masterRecords, info.supplier]);

  const updatePlanilla4Puntos = (value) => {
    setPlanilla4Puntos(value);
    const syncedRolls = blankRolls().map((blank, index) => {
      const row = value.rows[index];
      return row ? {
        ...blank,
        roll: row.roll || String(index + 1),
        length: row.meters || "0",
        width: row.width || "0",
        d1: row.d1 || "0",
        d2: row.d2 || "0",
        d3: row.d3 || "0",
        d4: row.d4 || "0",
        notes: row.notes || ""
      } : blank;
    });
    setRolls(syncedRolls);
    setSavedRolls(syncedRolls);
    setSaved(false);
    setSaveError("");
  };

  const handleResetPlanilla4Puntos = () => {
    const blank = makeBlankPlanilla();
    setPlanilla4Puntos(blank);
    const emptyRolls = blankRolls();
    setRolls(emptyRolls);
    setSavedRolls(emptyRolls);
    setSaved(false);
    setSaveError("");
  };

  const updateFabricTest = (key, value) => {
    setFabricTest((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setSaveError("");
  };

  const updateFabricTestRow = (rowId, key, value) => {
    setFabricTest((prev) => ({
      ...prev,
      rows: {
        ...prev.rows,
        [rowId]: { ...prev.rows[rowId], [key]: value }
      }
    }));
    setSaved(false);
    setSaveError("");
  };

  const handleResetFabricTest = () => {
    setFabricTest(makeBlankFabricTest());
    setSaved(false);
  };

  const handleResetStandards = () => {
    setFabricTest((current) => {
      const blank = makeBlankFabricTest();
      return {
        ...blank,
        sampledRolls: current.sampledRolls,
        testDate: current.testDate,
        rows: Object.fromEntries(Object.keys(blank.rows).map((id) => [id, {
          ...blank.rows[id],
          test1: current.rows[id]?.test1 ?? "",
          test2: current.rows[id]?.test2 ?? "",
          test3: current.rows[id]?.test3 ?? "",
          observations: current.rows[id]?.observations ?? ""
        }]))
      };
    });
    setSaved(false);
    setSaveError("");
  };

  const fabricTestSummary = summarizeFabricTest(fabricTest);

  const handleSave = async () => {
    const errors = validateInspection(info);
    if (lot.inspected === 0) {
      errors.push("Completa al menos un rollo con largo y ancho útil.");
    }

    if (errors.length) {
      setFormError(errors.join(" "));
      setSaveError("");
      setSaved(false);
      return;
    }

    const record = {
      id: editingId ?? Date.now(),
      info,
      rolls: savedCalculated,
      lot,
      fabricTest,
      planilla4Puntos,
      finalDecision,
      savedAt: new Date().toISOString()
    };

    try {
      await saveInspection(record, user);
      setInspections(loadInspections());
      setEditingId(record.id);
      setRolls(blankRolls());
      setSaved(true);
      setFormError("");
      setSaveError("");
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? `No se pudo guardar la inspección: ${error.message}`
          : "No se pudo guardar la inspección."
      );
      setSaved(false);
    }
  };

  const handleNewInspection = () => {
    setInfo(initialInfo());
    setRolls(blankRolls());
    setSavedRolls(blankRolls());
    setEditingId(null);
    setFabricTest(makeBlankFabricTest());
    setPlanilla4Puntos(makeBlankPlanilla());
    setEmailObservations("");
    setEmailError("");
    setEmailSuccess("");
    setSaved(false);
    setFormError("");
    setSaveError("");
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEditInspection = (record) => {
    const restoredRolls = blankRolls().map((blank, index) => {
      const savedRoll = record.rolls?.[index];
      return savedRoll
        ? {
            ...blank,
            ...savedRoll,
            length: savedRoll.length ?? "0",
            width: savedRoll.width ?? "0",
            d1: savedRoll.d1 ?? "0",
            d2: savedRoll.d2 ?? "0",
            d3: savedRoll.d3 ?? "0",
            d4: savedRoll.d4 ?? "0"
          }
        : blank;
    });

    setInfo({ ...initialInfo(), ...record.info });
    setRolls(restoredRolls);
    setSavedRolls(restoredRolls);
    setEditingId(record.id);
    const restoredFabricTest = restoreFabricTest(record.fabricTest);
    const legacyPlanilla = record.planilla4Puntos || {};
    // Compatibilidad con inspecciones guardadas antes de centralizar estándares.
    ["nominalWeight", "weightTolerance", "minUsableWidth", "maxPointsPerRoll", "maxLotAverage", "maxPercentOverLimit", "maxWeightDifference"].forEach((key) => {
      if ((restoredFabricTest[key] === "" || restoredFabricTest[key] === undefined) && legacyPlanilla[key] !== undefined) {
        restoredFabricTest[key] = legacyPlanilla[key];
      }
    });
    setFabricTest(restoredFabricTest);
    const restoredPlanilla = restorePlanilla(record.planilla4Puntos);
    const hasPlanillaRows = restoredPlanilla.rows.some((row) =>
      [row.meters, row.width, row.d1, row.d2, row.d3, row.d4, row.notes].some((value) => value !== "")
    );
    if (!hasPlanillaRows) {
      restoredPlanilla.rows = restoredPlanilla.rows.map((row, index) => {
        const roll = restoredRolls[index];
        return { ...row, roll: String(roll.roll ?? index + 1), meters: roll.length === "0" ? "" : roll.length,
          width: roll.width === "0" ? "" : roll.width, d1: roll.d1 === "0" ? "" : roll.d1,
          d2: roll.d2 === "0" ? "" : roll.d2, d3: roll.d3 === "0" ? "" : roll.d3,
          d4: roll.d4 === "0" ? "" : roll.d4, notes: roll.notes || "" };
      });
    }
    setPlanilla4Puntos(restoredPlanilla);
    setSaved(false);
    setFormError("");
    setSaveError("");
    setEmailObservations("");
    setEmailError("");
    setEmailSuccess("");
    setDatabaseOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteInspection = async (id) => {
    try {
      setInspections(await deleteInspection(id, user));
      if (editingId === id) {
        setEditingId(null);
        setSaved(false);
      }
    } catch (error) {
      console.error("No se pudo eliminar la inspección:", error);
      setSaveError("No se pudo eliminar la inspección de Firebase.");
    }
  };

  const handleEmail = async (form) => {
    if (emailSending) return;
    if (!info.email.trim()) {
      setEmailError("Ingresa el correo del destinatario antes de enviar el reporte.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email.trim())) {
      setEmailError("El correo del destinatario no tiene un formato válido.");
      return;
    }


    if (lot.inspected === 0) {
      setEmailError("Guarda al menos un rollo completo antes de enviar el reporte.");
      return;
    }

    setEmailSending(true);
    setEmailError("");
    setEmailSuccess("");

    try {
      await sendInspectionEmail({ form });

      setEmailSuccess(`Correo enviado correctamente a ${info.email.trim()}.`);
    } catch (error) {
      setEmailError(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el correo. Intenta de nuevo."
      );
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="app-shell">

      <Header
        userEmail={user?.email}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        onHelp={() => setHelpOpen(true)}
        notifications={notifications}
        onOpenRolls={() => setPlanillaOpen(true)}
        onOpenDatabase={() => {
          setInspections(loadInspections());
          setDatabaseOpen(true);
        }}
      />

      <main className="page-content">

        <section className="intro-row">
          <div>
            <div className="eyebrow">
              <Sparkles size={18} />
              CONTROL DE CALIDAD TEXTIL
            </div>

            <p className="subtitle">
              Registra, evalúa y controla la calidad de cada rollo de tela.
            </p>
          </div>

          <div className="today-chip">
            <span className="live-dot" />
            Sistema de inspección
            <b>Activo</b>
          </div>
        </section>

        <div className="dashboard-shortcuts">
          <button
            className="database-launcher panel"
            type="button"
            onClick={() => {
              setInspections(loadInspections());
              setDatabaseOpen(true);
            }}
            aria-haspopup="dialog"
          >
            <span className="database-launcher-icon">
              <Database size={20} />
            </span>
            <span>
              <strong>Base de datos</strong>
              <small>{inspections.length} inspecciones guardadas</small>
            </span>
            <span className="button secondary">Ver</span>
          </button>
        </div>

        <section className="inspection-tools-section" aria-labelledby="inspection-tools-title">
          <div className="inspection-tools-heading">
            <div>
              <span className="eyebrow">MÓDULOS DE CONTROL TEXTIL</span>
              <h2 id="inspection-tools-title">Herramientas de inspección</h2>
              <p>Completa cada etapa en orden. Los estándares alimentan las pruebas y la planilla.</p>
            </div>
          </div>
          <div className="inspection-tools-grid">
            <button className="inspection-tool-card standards-tool" type="button" onClick={() => setStandardsOpen(true)} aria-haspopup="dialog" aria-expanded={standardsOpen}>
              <span className="inspection-tool-number">01</span>
              <span className="inspection-tool-icon"><ClipboardCheck size={22}/></span>
              <strong>Prueba de rollo de las telas</strong>
              <small>Estándares, condiciones, parámetros y límites.</small>
              <span className="inspection-tool-action">Configurar estándares <ArrowDownToLine size={15}/></span>
            </button>
            <button className="inspection-tool-card tests-tool" type="button" onClick={() => setFabricTestOpen(true)} aria-haspopup="dialog" aria-expanded={fabricTestOpen}>
              <span className="inspection-tool-number">02</span>
              <span className="inspection-tool-icon"><FlaskConical size={22}/></span>
              <strong>Pruebas de tela</strong>
              <small>Registra tres mediciones y consulta el resultado automático.</small>
              <span className="inspection-tool-action">Registrar pruebas <ArrowDownToLine size={15}/></span>
            </button>
            <button className="inspection-tool-card planilla-tool" type="button" onClick={() => setPlanillaOpen(true)} aria-haspopup="dialog" aria-expanded={planillaOpen}>
              <span className="inspection-tool-number">03</span>
              <span className="inspection-tool-icon"><ClipboardCheck size={22}/></span>
              <strong>Planilla 4 puntos</strong>
              <small>Defectos, puntos, peso real y gramaje por rollo.</small>
              <span className="inspection-tool-action">Abrir planilla <ArrowDownToLine size={15}/></span>
            </button>
          </div>
        </section>

        <section className="inspection-overview">
          <InspectionForm
            info={info}
            updateInfo={updateInfo}
            editing={editingId !== null}
            supplierOptions={supplierOptions}
            fabricOptions={fabricOptions}
            masterReference={fabricTest.masterReference}
          />
        </section>

        <SummaryCards lot={lot} />

        <section className="analytics-grid">

          <div className="panel chart-panel">

            <div className="panel-heading">
              <div>
                <h3>Distribución de puntos</h3>
                <p>
                  Frecuencia de rollos por puntos / 100 yd²
                </p>
              </div>

              <BarChart3 size={19} />
            </div>

            {hasHistogramData ? (
              charts ? <div className="chart-area">

                <charts.ResponsiveContainer width="100%" height="100%">
                  <charts.BarChart data={chartData} barCategoryGap={0} barGap={0}>

                    <charts.CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                    />

                    <charts.XAxis
                      dataKey="interval"
                      tick={{ fontSize: 10 }}
                      label={{
                        value: "Puntos / 100 yd²",
                        position: "insideBottom",
                        offset: -2,
                        fontSize: 10
                      }}
                    />

                    <charts.YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10 }}
                      label={{
                        value: "Rollos",
                        angle: -90,
                        position: "insideLeft",
                        fontSize: 10
                      }}
                    />

                    <charts.Tooltip
                      formatter={(value) => [value, "Rollos"]}
                      labelFormatter={(label) => `Puntos: ${label}`}
                    />

                    <charts.Bar
                      dataKey="rolls"
                      name="Rollos"
                      fill="#d2a900"
                    >
                      {chartData.map((bin) => (
                        <charts.Cell
                          key={bin.interval}
                          fill={bin.exceedsLimit ? "#242420" : "#d2a900"}
                        />
                      ))}
                    </charts.Bar>

                  </charts.BarChart>
                </charts.ResponsiveContainer>

              </div> : <div className="empty-chart" role="status">Preparando grÃ¡ficosâ€¦</div>

            ) : (

              <div className="empty-chart">
                Guarda los rollos con largo y ancho útil para ver aquí los resultados.
              </div>

            )}

          </div>

          <div className="panel chart-panel">

            <div className="panel-heading">
              <div>
                <h3>Estado de los rollos</h3>
                <p>Distribución de aceptación y rechazo</p>
              </div>

              <ShieldCheck size={19} />
            </div>

            {lot.inspected ? (
              charts ? <div className="donut-wrap">

                <div className="donut-chart">

                  <charts.ResponsiveContainer width="100%" height="100%">
                    <charts.PieChart>

                      <charts.Pie
                        data={decisionData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={62}
                        outerRadius={88}
                        paddingAngle={3}
                      >
                        {decisionData.map((item, index) => (
                          <charts.Cell
                            key={index}
                            fill={item.color}
                          />
                        ))}
                      </charts.Pie>

                      <charts.Tooltip />

                    </charts.PieChart>
                  </charts.ResponsiveContainer>

                  <div className="donut-center">
                    <strong>{lot.inspected}</strong>
                    <span>rollos</span>
                  </div>

                </div>

                <div className="legend">

                  {decisionData.map((item) => (
                    <div key={item.name}>
                      <i style={{ background: item.color }} />
                      <span>{item.name}</span>
                      <b>{item.value}</b>
                    </div>
                  ))}

                </div>

              </div> : <div className="empty-chart" role="status">Preparando grÃ¡ficosâ€¦</div>

            ) : (

              <div className="empty-chart">
                Aún no hay rollos guardados para mostrar.
              </div>

            )}

          </div>

        </section>

        <FinalDecisionPanel decision={finalDecision} />

        <section className="bottom-grid">
          <div className="panel action-panel">

            <div className="panel-heading">
              <div>
                <h3>Cierre de inspección</h3>
                <p>
                  Guarda el registro o prepara el correo de resultado.
                </p>
              </div>

              <CheckCircle2 size={19} />
            </div>

            <div className="result-banner">

              <span>Resultado del lote</span>

              <strong
                className={
                  lot.decision === "Lote aceptado"
                    ? "accepted"
                    : lot.decision === "Lote rechazado"
                    ? "rejected"
                    : ""
                }
              >
                {lot.decision}
              </strong>

              <small>
                {lot.average === null
                  ? "Completa los datos de los rollos para calcular."
                  : `Promedio: ${lot.average.toFixed(2)} puntos / 100 yd²`}
              </small>

            </div>

            <div className="action-buttons">

              <button
                className="button primary"
                onClick={handleSave}
                disabled={!cloudReady}
              >
                <Save size={16} />
                {!cloudReady ? "Conectando…" : saved
                  ? "Guardado"
                  : editingId
                    ? "Actualizar inspección"
                    : "Guardar inspección"}
              </button>
              {editingId && (
                <button
                  className="button ghost"
                  onClick={handleNewInspection}
                >
                  <Plus size={16} />
                  Nueva inspección
                </button>
              )}

              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setEmailError("");
                  setEmailSuccess("");
                  setEmailDialogOpen(true);
                }}
                aria-haspopup="dialog"
                aria-expanded={emailDialogOpen}
              >
                <Mail size={16} />
                Enviar correo
              </button>

              <button
                className="button ghost"
                onClick={() => window.print()}
              >
                <ArrowDownToLine size={16} />
                Imprimir / PDF
              </button>
            </div>

            {formError && (
              <p className="form-message error" role="alert">{formError}</p>
            )}
            {saveError && (
              <p className="form-message error" role="alert">{saveError}</p>
            )}
            {saved && (
              <p className="form-message success" role="status">
                La inspección quedó guardada en Firebase y está disponible para el administrador.
              </p>
            )}

            <p className="saved-note">
              Inspecciones compartidas con el administrador:{" "}
              <b>{inspections.length}</b>
            </p>
          </div>

        </section>

        <footer>
          CREARTE BY CONFECCIONARTE
          <span>·</span>
          Sistema de inspección de telas
        </footer>

      </main>

      {standardsOpen && (
        <FabricStandardsDialog
          test={fabricTest}
          info={info}
          onChange={updateFabricTest}
          onChangeRow={updateFabricTestRow}
          onReset={handleResetStandards}
          onClose={() => setStandardsOpen(false)}
        />
      )}
      {fabricTestOpen && (
        <FabricTestDialog
          info={info}
          test={fabricTest}
          onChange={updateFabricTest}
          onChangeRow={updateFabricTestRow}
          onClose={() => setFabricTestOpen(false)}
        />
      )}
      {planillaOpen && (
        <Planilla4PuntosDialog
          value={planilla4Puntos}
          standards={fabricTest}
          info={info}
          onChange={updatePlanilla4Puntos}
          onReset={handleResetPlanilla4Puntos}
          onClose={() => setPlanillaOpen(false)}
        />
      )}
      {emailDialogOpen && (
        <EmailComposer
          recipient={info.email}
          onRecipientChange={(value) => {
            updateInfo("email", value);
            setEmailError("");
            setEmailSuccess("");
          }}
          observations={emailObservations}
          onObservationsChange={setEmailObservations}
          reportSubject={`Inspección de telas - ${info.fabric}`}
          reportHtml={reportHtml}
          onPrepareEmail={handleEmail}
          error={emailError}
          success={emailSuccess}
          sending={emailSending}
          onClose={() => setEmailDialogOpen(false)}
        />
      )}
      {databaseOpen && (
        <InspectionDatabase
          inspections={inspections}
          onEdit={handleEditInspection}
          onDelete={handleDeleteInspection}
          onDownloadPdf={downloadSavedInspectionPdf}
          onDownloadExcel={downloadInspectionExcel}
          onClose={() => setDatabaseOpen(false)}
        />
      )}
      {helpOpen && (
        <div
          className="help-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHelpOpen(false);
          }}
        >
          <section
            className="help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <header className="help-dialog-header">
              <div>
                <h2 id="help-title">Ayuda de inspección</h2>
                <p>Qué hace cada cuadro nuevo y cómo completar una inspección.</p>
              </div>
              <button
                type="button"
                className="roll-dialog-close"
                onClick={() => setHelpOpen(false)}
                aria-label="Cerrar ayuda"
              >
                <X size={20} />
              </button>
            </header>
            <ol className="help-steps">
              <li><strong>Identifica la inspección:</strong> completa fecha, proveedor, nombre de la tela y remisión. Elige la tela de las sugerencias del master. Si tela y proveedor coinciden con el master, se carga la ficha disponible (gramaje, tolerancia, ancho, rendimiento y composición); si hay varios proveedores para esa tela, selecciona también el correcto.</li>
              <li><strong>Módulo 01 · Prueba de rollo de las telas:</strong> revisa la ficha y define qué condiciones aplican y sus límites. Estos estándares alimentan las pruebas y la planilla 4 puntos. Los campos sin valor quedan como “Sin estándar”.</li>
              <li><strong>Módulo 02 · Pruebas de tela:</strong> registra cantidad de rollos muestreados y fecha. Para cada parámetro aplicable ingresa las tres mediciones; el sistema calcula el peor resultado y lo compara con los límites del módulo 01. Marca “NO” cuando una condición no aplique.</li>
              <li><strong>Módulo 03 · Planilla 4 puntos:</strong> abre “Detalle de rollos” y llena una fila por cada rollo revisado: metros, ancho útil, cantidades de defectos por categoría y pesos de empaque y real. Agrega observaciones si hace falta. Deja vacíos los rollos no inspeccionados.</li>
              <li><strong>Entiende los cálculos:</strong> puntos totales = defectos de 1 punto + 2×los de 2 puntos + 3×los de 3 puntos + 4×los de 4 puntos. Puntos/100 yd² se calcula con puntos, metros y ancho útil. También se calculan diferencia de peso y gramaje; los resultados se comparan con los estándares vigentes del módulo 01.</li>
              <li><strong>Revisa y guarda:</strong> consulta resúmenes, gráficos y decisión final. Pulsa “Guardar inspección” para conservarla en Firebase y compartirla con el administrador. Desde Base de datos puedes abrirla, editarla, iniciar una nueva o descargar reportes.</li>
              <li><strong>Comparte:</strong> “Enviar correo” prepara el reporte para compartir. “Imprimir / PDF” abre la impresión del navegador, donde puedes imprimir o guardar como PDF.</li>
            </ol>
            <div className="help-criteria">
              <strong>Qué contiene cada módulo</strong>
              <span><b>01 · Estándares:</b> color, lote/OM, composición, norma, auxiliar y tipo de tela; condiciones y parámetros aplicables; gramaje nominal y tolerancia, ancho mínimo y límites de puntos, promedio del lote, porcentaje de rollos sobre el límite y diferencia máxima de peso.</span>
              <span><b>02 · Pruebas:</b> resultados de laboratorio o mediciones de tela. Cada parámetro puede quedar ACEPTA, RECHAZA o SIN ESTÁNDAR; las condiciones marcadas NO se excluyen.</span>
              <span><b>03 · Planilla:</b> cada fila es un rollo. El resultado individual compara puntos/100 yd² con el máximo por rollo. El estado de gramaje y peso considera gramaje nominal con tolerancia, ancho mínimo y diferencia máxima de peso.</span>
              <span><b>Decisión final:</b> reúne Pruebas de tela y Planilla 4 puntos e indica criterios aprobados, rechazados o pendientes por datos/estándares.</span>
            </div>
            <div className="help-criteria">
              <strong>Panel y términos</strong>
              <span><b>Base de datos:</b> inspecciones sincronizadas con Firebase; el administrador puede consultar los registros de todos los usuarios.</span>
              <span><b>Tarjetas y gráficos:</b> resumen de rollos inspeccionados, aceptados, rechazados y promedio; los gráficos muestran la distribución de puntos y el estado de los rollos registrados.</span>
              <span><b>ACEPTA / RECHAZA:</b> cumple o excede el estándar. <b>SIN DATO:</b> faltan mediciones. <b>SIN ESTÁNDAR:</b> falta el límite necesario para comparar.</span>
              <span><b>yd²:</b> yardas cuadradas. Puntos/100 yd² normaliza los defectos por área para comparar rollos.</span>
              <span><b>Guardar:</b> sincroniza la inspección con Firebase para que aparezca en Base de datos y en el panel administrativo.</span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
