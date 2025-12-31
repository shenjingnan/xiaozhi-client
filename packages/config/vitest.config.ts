import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// ESM 兼容的 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10000,
    hookTimeout: 10000,
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["**/node_modules", "dist"],
  },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
});
