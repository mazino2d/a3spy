import { defineConfig } from "vite";

// The web app is served by the Worker as static assets (wrangler.jsonc "assets").
// In development, `npm run dev` (wrangler, port 8787) serves the API and sockets.
export default defineConfig({
  root: import.meta.dirname,
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
  server: {
    proxy: { "/api": { target: "http://localhost:8787", ws: true } },
  },
});
