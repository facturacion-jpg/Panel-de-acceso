
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const appDirectory = fileURLToPath(
  new URL(".", import.meta.url)
);

const projectRoot = resolve(appDirectory, "../..");

export default defineConfig({
  root: appDirectory,

  // Comparte las variables de entorno del proyecto principal.
  envDir: projectRoot,

  // En el Render independiente sirve desde /; el portal agrupado sobrescribe
  // esta base al iniciar el servidor y al compilar en /auditorias/.
  base: "/",

  // Todas las importaciones de Firebase deben resolver a la misma copia
  // instalada junto a Auditorías, aunque también exista otra en el panel.
  resolve: {
    dedupe: ["firebase"],
  },

  optimizeDeps: {
    include: ["firebase/app", "firebase/auth", "firebase/firestore"],
  },

  plugins: [react()],

  build: {
    outDir: "dist",
    emptyOutDir: true,
  },

  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    allowedHosts: true,

    fs: {
      allow: [projectRoot],
    },

    // Evita que el navegador intente conectarse a otro origen.
    hmr: {
      clientPort: 5173,
    },
  },
});
