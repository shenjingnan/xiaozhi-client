import { codecovVitePlugin } from "@codecov/vite-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: "xiaozhi-client-performance",
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    // 只包含性能测试
    include: ["src/performance/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "dist", "templates/**/*"],
    // 性能测试专用配置
    testTimeout: 300000, // 5分钟超时
    hookTimeout: 60000, // 1分钟钩子超时
    teardownTimeout: 60000, // 1分钟清理超时
    // 使用单线程避免资源竞争
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true,
      }
    },
    // 禁用覆盖率收集以提高性能
    coverage: {
      enabled: false,
    },
    // 性能测试专用报告
    reporter: ["verbose", "json"],
    outputFile: {
      json: "./performance-test-results.json",
    },
    // 设置环境变量
    env: {
      VITEST_INCLUDE_PERFORMANCE: "true",
      NODE_ENV: "test",
      // 性能测试专用环境变量
      XIAOZHI_LOG_LEVEL: "info",
      XIAOZHI_LOG_ASYNC: "true",
      XIAOZHI_LOG_BUFFER_SIZE: "32768",
      XIAOZHI_DAEMON: "false",
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
