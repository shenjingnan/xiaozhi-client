import { resolve } from "node:path";
import { codecovVitePlugin } from "@codecov/vite-plugin";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    // 添加 Codecov 插件
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: "xiaozhi-client",
      uploadToken: process.env.CODECOV_TOKEN,
    }),
    // 添加 tsconfig 路径解析插件
    tsconfigPaths(),
  ],
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10000, // 减少默认测试超时时间
    hookTimeout: 10000, // 减少默认 hook 超时时间
    include: ["apps/backend/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "dist", "templates/**/*"],
    // 分组配置，将超时测试分离
    // 超时测试：包含"timeout"字样的测试文件
    // 普通测试：其他所有测试
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/**",
        "dist/**",
        "templates/**",
        "**/*.d.ts",
        "**/*.config.{js,ts}",
        "coverage/**",
      ],
      include: ["apps/backend/**/*.ts"],
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
      "@": resolve(__dirname, "../apps/backend"),
      "@cli": resolve(__dirname, "../apps/backend/cli"),
      "@cli/commands": resolve(__dirname, "../apps/backend/cli/commands"),
      "@cli/services": resolve(__dirname, "../apps/backend/cli/services"),
      "@cli/utils": resolve(__dirname, "../apps/backend/cli/utils"),
      "@cli/errors": resolve(__dirname, "../apps/backend/cli/errors"),
      "@cli/interfaces": resolve(__dirname, "../apps/backend/cli/interfaces"),
      "@handlers": resolve(__dirname, "../apps/backend/handlers"),
      "@services": resolve(__dirname, "../apps/backend/services"),
      "@errors": resolve(__dirname, "../apps/backend/errors"),
      "@utils": resolve(__dirname, "../apps/backend/utils"),
      "@core": resolve(__dirname, "../apps/backend/core"),
      "@transports": resolve(__dirname, "../apps/backend/transports"),
      "@adapters": resolve(__dirname, "../apps/backend/adapters"),
      "@managers": resolve(__dirname, "../apps/backend/managers"),
      "@types": resolve(__dirname, "../apps/backend/types"),
      "@root": resolve(__dirname, "../apps/backend"),
    },
  },
});
