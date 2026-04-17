import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@components": path.resolve(__dirname, "./components"),
      "@hooks": path.resolve(__dirname, "./hooks"),
      "@services": path.resolve(__dirname, "./services"),
      "@stores": path.resolve(__dirname, "./stores"),
      "@utils": path.resolve(__dirname, "./utils"),
      "@types": path.resolve(__dirname, "./types"),
      "@lib": path.resolve(__dirname, "./lib"),
      "@pages": path.resolve(__dirname, "./pages"),
      "@providers": path.resolve(__dirname, "./providers"),
      "@ui": path.resolve(__dirname, "./components/ui"),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: "./test/setup.ts",
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "dist", "templates/**/*"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/test/", "*.config.*"],
    },
  },
});
