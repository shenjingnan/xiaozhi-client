import { codecovVitePlugin } from "@codecov/vite-plugin";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";

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
    include: [
      "src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
      "tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
    ],
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
      include: ["src/**/*.ts", "tests/**/*.ts"],
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
      "@": resolve(__dirname, "src"),
      "@handlers": resolve(__dirname, "src/handlers"),
      "@services": resolve(__dirname, "src/services"),
      "@utils": resolve(__dirname, "src/utils"),
      "@core": resolve(__dirname, "src/core"),
      "@transports": resolve(__dirname, "src/transports"),
      "@adapters": resolve(__dirname, "src/adapters"),
      "@managers": resolve(__dirname, "src/managers"),
      "@types": resolve(__dirname, "src/types"),
      "@root": resolve(__dirname, "src")
    },
  },
});
