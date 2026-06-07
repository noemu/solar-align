import fs from "node:fs";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const certPath = path.resolve(__dirname, "server.crt");
const keyPath = path.resolve(__dirname, "server.key");
const https =
  fs.existsSync(certPath) && fs.existsSync(keyPath)
    ? {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      }
    : undefined;

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    host: true,
    port: 5173,
    strictPort: true,
    https: https,
    hmr: {
      protocol: "ws",
      clientPort: 5173,
    },
  },
  define: {},
  build: {
    outDir: "docs",
  },
});
