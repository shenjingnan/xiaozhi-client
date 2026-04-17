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
  // 定义构建时注入的全局变量，用于测试环境
  define: {
    __VERSION__: JSON.stringify("1.0.0-test"),
    __APP_NAME__: JSON.stringify("xiaozhi-client"),
  },
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10000,
    hookTimeout: 10000,
    root: "../../src/cli",
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
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
      include: [resolve(__dirname, "../../src/cli/**/*.ts")],
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
      // Backend 路径别名（从 packages/cli 向上到项目根目录）
      "@handlers": resolve(__dirname, "../../src/server/handlers"),
      "@handlers/*": resolve(__dirname, "../../src/server/handlers/*"),
      "@services": resolve(__dirname, "../../src/server/services"),
      "@services/*": resolve(__dirname, "../../src/server/services/*"),
      "@errors": resolve(__dirname, "../../src/server/errors"),
      "@errors/*": resolve(__dirname, "../../src/server/errors/*"),
      "@utils": resolve(__dirname, "../../src/server/utils"),
      "@utils/*": resolve(__dirname, "../../src/server/utils/*"),
      "@core": resolve(__dirname, "../../src/server/core"),
      "@core/*": resolve(__dirname, "../../src/server/core/*"),
      "@transports": resolve(__dirname, "../../src/server/lib/mcp/transports"),
      "@transports/*": resolve(
        __dirname,
        "../../src/server/lib/mcp/transports/*"
      ),
      "@adapters": resolve(__dirname, "../../src/server/adapters"),
      "@adapters/*": resolve(__dirname, "../../src/server/adapters/*"),
      "@managers": resolve(__dirname, "../../src/server/managers"),
      "@managers/*": resolve(__dirname, "../../src/server/managers/*"),
      "@types": resolve(__dirname, "../../src/server/types"),
      "@types/*": resolve(__dirname, "../../src/server/types/*"),
      "@/lib": resolve(__dirname, "../../src/server/lib"),
      "@/lib/*": resolve(__dirname, "../../src/server/lib/*"),
      "@": resolve(__dirname, "../../src/server"),
      "@/*": resolve(__dirname, "../../src/server/*"),
      "@routes": resolve(__dirname, "../../src/server/routes"),
      "@routes/*": resolve(__dirname, "../../src/server/routes/*"),
      "@constants": resolve(__dirname, "../../src/server/constants"),
      "@constants/*": resolve(__dirname, "../../src/server/constants/*"),
    },
  },
});
