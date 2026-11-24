import { useRef, useState } from "react";
import { Mail, Send, X } from "lucide-react";

export default function EmailComposer({
  recipient,
  onRecipientChange,
  observations,
  onObservationsChange,
  reportSubject,
  reportHtml,
  onPrepareEmail,
  error,
  success,
  sending,
  onClose
}) {
  const formRef = useRef(null);
  const [recipientName, setRecipientName] = useState("");
  const greetingName = recipientName.trim() || recipient.trim();
  const emailMessage = [
    `Hola, ${greetingName}:`,
    "",
    "Incluimos el reporte de inspección completo en el cuerpo de este correo.",
  ].join("\n");
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  const emailReportHtml = `
    <div style="font-family:Arial,sans-serif;color:#243044;line-height:1.45;max-width:900px;">
      <p style="margin:0 0 20px;white-space:pre-line;">${escapeHtml(emailMessage)}</p>
    </div>
    ${reportHtml}
    <div style="font-family:Arial,sans-serif;color:#243044;line-height:1.45;max-width:900px;">
      <p style="margin:20px 0 12px;">Quedamos atentos a tus comentarios.</p>
      <p style="margin:0;">Saludos cordiales,<br>Crearte By Confeccionarte</p>
    </div>
  `;

  const handleSubmit = (event) => {
    event.preventDefault();
    onPrepareEmail(formRef.current);
  };

  const handleObservationsChange = (value) => {
    onObservationsChange(value);
  };

  return (
    <div
      className="roll-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !sending) onClose();
      }}
    >
      <section
        className="roll-dialog email-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-dialog-title"
      >
        <header className="roll-dialog-header">
          <div className="roll-dialog-title">
            <Mail size={21} />
            <div>
              <h2 id="email-dialog-title">Enviar reporte por correo</h2>
              <p>El reporte se mostrará completo dentro del correo.</p>
            </div>
          </div>
          <button
            className="roll-dialog-close"
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={sending}
          >
            <X size={19} />
          </button>
        </header>

        <form ref={formRef} className="email-composer" onSubmit={handleSubmit}>
          <input type="hidden" name="subject" value={reportSubject} />
          <input type="hidden" name="report_html" value={emailReportHtml} />
          <label className="email-field">
            Correo del destinatario
            <input
              type="email"
              name="to_email"
              value={recipient}
              onChange={(event) => onRecipientChange(event.target.value)}
              placeholder="correo@ejemplo.com"
              autoComplete="email"
              required
              disabled={sending}
            />
          </label>

          <label className="email-field">
            Nombre del destinatario (opcional)
            <input
              type="text"
              name="to_name"
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              placeholder="Nombre de la persona"
              autoComplete="name"
              maxLength={120}
              disabled={sending}
            />
          </label>

          <label className="email-field">
            Observaciones
            <textarea
              name="observations"
              value={observations}
              onChange={(event) => handleObservationsChange(event.target.value)}
              placeholder="Agrega comentarios para el destinatario..."
              maxLength={1000}
              disabled={sending}
            />
          </label>

          {error && <p className="form-message error" role="alert">{error}</p>}
          {success && <p className="form-message success" role="status">{success}</p>}

          <div className="email-dialog-actions">
            <button
              className="button secondary"
              type="button"
              onClick={onClose}
              disabled={sending}
            >
              Cancelar
            </button>
            <button
              className="button primary"
              type="submit"
              disabled={sending}
            >
              <Send size={16} />
              {sending ? "Enviando..." : "Enviar correo"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
