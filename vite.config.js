
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: process.env.PANEL_HOST || "0.0.0.0",
    port: Number(process.env.PANEL_PORT) || 5173,
    strictPort: true,

    // Conecta el panel con Crearte sin cambiar de dominio.
    proxy: {
      "/crearte": {
        target: "http://127.0.0.1:5174",
        changeOrigin: false,
        secure: false,
        ws: true,
      },
      "/tallas": {
        target: "http://127.0.0.1:5175",
        changeOrigin: false,
        secure: false,
        ws: true,
      },
      "/telas": {
        target: "http://127.0.0.1:5176",
        changeOrigin: false,
        secure: false,
        ws: true,
      },
    },
  },

  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    // En preview se sirven los archivos compilados; no se deben reutilizar
    // los proxies de desarrollo que apuntan a servidores Vite ya apagados.
    proxy: {},
  },
});
