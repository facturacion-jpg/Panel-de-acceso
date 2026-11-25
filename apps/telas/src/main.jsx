import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import "./styles/global.css";
import "./styles/dark.css";

// Se aplica antes de renderizar para que también cubra la pantalla de acceso.
try {
  document.documentElement.dataset.theme = localStorage.getItem("crearte:tema") === "dark" ? "dark" : "light";
} catch (_) {
  document.documentElement.dataset.theme = "light";
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate><App /></AuthGate>
  </React.StrictMode>
);
