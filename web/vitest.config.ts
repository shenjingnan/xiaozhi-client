import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: "./src/test/setup.ts",
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/test/", "*.config.*"],
    },
  },
});
