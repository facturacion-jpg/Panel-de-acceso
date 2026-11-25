
import { useState } from "react";
import { Bell, CircleHelp, X } from "lucide-react";

export default function Header({
  userEmail = "",
  theme = "light",
  onToggleTheme,
  onHelp,
  notifications = [],
  onOpenRolls,
  onOpenDatabase
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const initials = (userEmail || "")
    .split("@")[0]
    .split(/[.\-_\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "US";

  return (
    <>
      <header className="topbar">

        <div className="brand">
          <img
            className="brand-logo"
            src={`${import.meta.env.BASE_URL}crearte-logo.png`}
            alt="Logo de Crearte"
          />
          <div>
            <strong className="brand-name">
              <span className="brand-cre">CRE</span>
              <span className="brand-arte">ARTE</span>
            </strong>
            <span className="brand-byline">by confeccionarte</span>
          </div>
        </div>

        <div className="topbar-title">
          INSPECCIÓN DE TELAS
        </div>

        <div className="header-tools">
          <a
            className="back-to-panel"
            href="/?retornoAplicativo=1"
            data-tip="Volver al panel"
            aria-label="Volver al panel"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" />
              <path d="M10 16l-4-4 4-4M6 12h9" />
            </svg>
          </a>
          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
            aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
            aria-pressed={theme === "dark"}
          >
            <span className="theme-icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
          </button>
          <button aria-label="Ayuda" onClick={onHelp}>
            <CircleHelp size={18} />
          </button>
          <div className="notification-menu">
            <button
              aria-label={`Notificaciones${notifications.length ? ` (${notifications.length})` : ""}`}
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell size={18} />
              {notifications.length > 0 && (
                <span className="notification-badge">{notifications.length}</span>
              )}
            </button>
            {notificationsOpen && (
              <section className="notification-popover" aria-label="Notificaciones">
                <div className="notification-heading">
                  <strong>Notificaciones</strong>
                  <button
                    type="button"
                    aria-label="Cerrar notificaciones"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    <X size={15} />
                  </button>
                </div>
                {notifications.length ? (
                  <div className="notification-list">
                    {notifications.map((notification) => (
                      <article
                        key={notification.id}
                        className={`notification-item ${notification.tone || ""}`}
                      >
                        <strong>{notification.title}</strong>
                        <span>{notification.message}</span>
                        {notification.action && (
                          <button
                            type="button"
                            onClick={() => {
                              if (notification.action === "rolls") {
                                onOpenRolls();
                              } else {
                                onOpenDatabase();
                              }
                              setNotificationsOpen(false);
                            }}
                          >
                            {notification.action === "rolls" ? "Abrir planilla" : "Ver inspecciones"}
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="notifications-empty">Todo está al día. No hay avisos pendientes.</p>
                )}
              </section>
            )}
          </div>
          <div className="user-menu">
            <div className="avatar" title={userEmail || undefined} aria-label={userEmail ? `Usuario: ${userEmail}` : "Usuario"}>{initials}</div>
          </div>
        </div>

      </header>

      <div className="header-info-bar">
        <strong>Criterios de calificación</strong>
        <span>
          Defecto: hasta 7,5 cm = 1 punto; hasta 15 cm = 2; hasta 23 cm = 3;
          más de 23 cm = 4.
        </span>
        <span>Hueco: hasta 2,5 cm = 2 puntos; mayor de 2,5 cm = 4.</span>
        <span className="criteria-limit">Máximo 4 puntos por metro lineal.</span>
      </div>
    </>
  );
}
