import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// ESM 兼容的 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    // 添加 tsconfig 路径解析插件
    tsconfigPaths(),
  ],
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10000,
    hookTimeout: 10000,
    include: ["packages/cli/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "dist"],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: resolve(__dirname, "../coverage"),
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.d.ts",
        "**/*.config.{js,ts}",
        "coverage/**",
      ],
      include: ["packages/cli/src/**/*.ts"],
      all: true,
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      // CLI 内部路径别名
      "@cli/commands": resolve(__dirname, "../packages/cli/src/commands"),
      "@cli/services": resolve(__dirname, "../packages/cli/src/services"),
      "@cli/utils": resolve(__dirname, "../packages/cli/src/utils"),
      "@cli/errors": resolve(__dirname, "../packages/cli/src/errors"),
      "@cli/interfaces": resolve(__dirname, "../packages/cli/src/interfaces"),
      // Backend 路径别名（与 backend vitest.config.ts 保持一致）
      "@handlers": resolve(__dirname, "../apps/backend/handlers"),
      "@middlewares": resolve(__dirname, "../apps/backend/middlewares"),
      "@services": resolve(__dirname, "../apps/backend/services"),
      "@errors": resolve(__dirname, "../apps/backend/errors"),
      "@utils": resolve(__dirname, "../apps/backend/utils"),
      "@core": resolve(__dirname, "../apps/backend/core"),
      "@transports": resolve(__dirname, "../apps/backend/lib/mcp/transports"),
      "@adapters": resolve(__dirname, "../apps/backend/adapters"),
      "@managers": resolve(__dirname, "../apps/backend/managers"),
      "@types": resolve(__dirname, "../apps/backend/types"),
      "@/lib": resolve(__dirname, "../apps/backend/lib"),
      "@root": resolve(__dirname, "../apps/backend"),
      "@routes": resolve(__dirname, "../apps/backend/routes"),
      "@constants": resolve(__dirname, "../apps/backend/constants"),
    },
  },
});
