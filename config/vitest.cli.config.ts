import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10000,
    hookTimeout: 10000,
    include: ["packages/cli/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "dist"],
    coverage: {
      enabled: false,
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage/cli",
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
      "@": resolve(__dirname, "../packages/cli/src"),
      "@cli/commands": resolve(__dirname, "../packages/cli/src/commands"),
      "@cli/commands/*": resolve(__dirname, "../packages/cli/src/commands/*"),
      "@cli/services": resolve(__dirname, "../packages/cli/src/services"),
      "@cli/services/*": resolve(__dirname, "../packages/cli/src/services/*"),
      "@cli/utils": resolve(__dirname, "../packages/cli/src/utils"),
      "@cli/utils/*": resolve(__dirname, "../packages/cli/src/utils/*"),
      "@cli/errors": resolve(__dirname, "../packages/cli/src/errors"),
      "@cli/errors/*": resolve(__dirname, "../packages/cli/src/errors/*"),
      "@cli/interfaces": resolve(__dirname, "../packages/cli/src/interfaces"),
      "@cli/interfaces/*": resolve(__dirname, "../packages/cli/src/interfaces/*"),
      // 过渡期：backend 别名（用于访问依赖）
      "@/lib/config": resolve(__dirname, "../apps/backend/lib/config"),
      "@/lib/config/*": resolve(__dirname, "../apps/backend/lib/config/*"),
      "@root": resolve(__dirname, "../apps/backend"),
      "@root/*": resolve(__dirname, "../apps/backend/*"),
    },
  },
});
