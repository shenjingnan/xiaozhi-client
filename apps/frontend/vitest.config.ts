import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { pathAliases } from "./vite.config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: pathAliases },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "dist", "templates/**/*"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/test/", "*.config.*"],
    },
  },
});
