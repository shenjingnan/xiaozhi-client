import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://localhost:9999",
        ws: true,
      },
      "/api": {
        target: "http://localhost:9999",
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
