import { codecovVitePlugin } from "@codecov/vite-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    // 添加 Codecov 插件
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: "xiaozhi-client",
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "dist", "templates/**/*"],
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
        "**/*.example.ts",
      ],
      include: ["src/**/*.ts"],
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
      "@": "/src",
    },
  },
});
