import emailjs from "@emailjs/browser";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

const getFormValue = (form, name) =>
  String(form.elements.namedItem(name)?.value ?? "").trim();

export async function sendInspectionEmail({ form }) {
  if (!serviceId || !templateId || !publicKey) {
    throw new Error(
      "Faltan variables de EmailJS en la compilación publicada. Configura VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID y VITE_EMAILJS_PUBLIC_KEY en Environment de Render y vuelve a desplegar."
    );
  }

  const recipient = getFormValue(form, "to_email");
  if (!EMAIL_PATTERN.test(recipient)) {
    throw new Error("El correo del destinatario no tiene un formato válido.");
  }

  try {
    await emailjs.sendForm(serviceId, templateId, form, { publicKey });
  } catch (error) {
    throw new Error(
      error?.text ||
        error?.message ||
        "EmailJS no pudo enviar el correo. Verifica el servicio, la plantilla y sus límites."
    );
  }
}
