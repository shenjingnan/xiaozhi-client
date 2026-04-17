import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// ESM 兼容的 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    // 添加 tsconfig 路径解析插件
    tsconfigPaths(),
  ],
  // 定义构建时注入的常量，测试环境中使用占位符（version.ts 会自动回退到运行时读取）
  define: {
    __VERSION__: JSON.stringify("__VERSION__"),
    __APP_NAME__: JSON.stringify("__APP_NAME__"),
  },
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10000,
    hookTimeout: 10000,
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["**/node_modules", "dist", "templates/**/*"],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: resolve(__dirname, "../coverage"),
      exclude: [
        "node_modules/**",
        "dist/**",
        "templates/**",
        "**/*.d.ts",
        "**/*.config.{js,ts}",
        "coverage/**",
      ],
      include: [resolve(__dirname, "**/*.ts")],
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
});
