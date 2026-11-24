const { createHash } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");

initializeApp();

const smtpUser = defineSecret("SMTP_USER");
const smtpAppPassword = defineSecret("SMTP_APP_PASSWORD");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const maxDailyEmailsPerIp = 20;

function normalizeText(value, maxLength) {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "Faltan datos válidos para preparar el correo.");
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new HttpsError("invalid-argument", "El texto del correo supera el límite permitido.");
  }
  return text;
}

async function applyRateLimit(request) {
  const ip = request.rawRequest.ip || "unknown";
  const date = new Date().toISOString().slice(0, 10);
  const documentId = createHash("sha256").update(ip).digest("hex");
  const ref = getFirestore().collection("emailRateLimits").doc(documentId);

  await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const previous = snapshot.exists ? snapshot.data() : null;
    const count = previous?.date === date ? Number(previous.count) : 0;
    if (count >= maxDailyEmailsPerIp) {
      throw new HttpsError("resource-exhausted", "Se alcanzó el límite diario de envíos desde esta conexión.");
    }
    transaction.set(ref, {
      count: count + 1,
      date
    });
  });
}

exports.sendInspectionEmail = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    maxInstances: 3,
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [smtpUser, smtpAppPassword]
  },
  async (request) => {
    if (!request.app) {
      throw new HttpsError("unauthenticated", "No se pudo validar el origen de la aplicación.");
    }

    const recipient = normalizeText(request.data?.recipient, 254);
    const subject = normalizeText(request.data?.subject, 180);
    const message = normalizeText(request.data?.message, 4000);
    const observations = normalizeText(request.data?.observations ?? "", 1000);
    if (!emailPattern.test(recipient)) {
      throw new HttpsError("invalid-argument", "El correo del destinatario no es válido.");
    }
    if (!subject || !message) {
      throw new HttpsError("invalid-argument", "El asunto o el mensaje están vacíos.");
    }

    await applyRateLimit(request);

    const user = smtpUser.value().trim();
    const password = smtpAppPassword.value().replace(/\s/g, "");
    if (!user || !password) {
      logger.error("SMTP sender secrets are not configured.");
      throw new HttpsError("failed-precondition", "El servicio de correo aún no está configurado.");
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass: password }
    });

    try {
      await transporter.sendMail({
        from: `"Crearte By Confeccionarte" <${user}>`,
        to: recipient,
        subject,
        text: observations ? `${message}\n\nObservaciones:\n${observations}` : message,
        attachments: []
      });
      return { sent: true };
    } catch (error) {
      logger.error("Failed to send inspection email.", {
        message: error instanceof Error ? error.message : "Unknown SMTP error"
      });
      throw new HttpsError("internal", "Gmail no pudo enviar el correo. Revisa la configuración del remitente.");
    }
  }
);
