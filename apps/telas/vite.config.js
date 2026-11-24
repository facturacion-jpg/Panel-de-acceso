
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // El Render independiente sirve desde /; el portal agrupado sobrescribe
  // esta base al iniciar el servidor y al compilar en /telas/.
  base: '/',
  server: {
    host: '127.0.0.1',
    port: 5176,
    strictPort: true,
    allowedHosts: true,
    hmr: { clientPort: 5173 },
  },
});
