import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Web 前端测试使用 jsdom 环境
    environmentMatchGlobs: [["src/web/**", "jsdom"]],
  },
  esbuild: {
    define: {
      // 构建时注入的版本号常量（测试环境使用固定值）
      __VERSION__: JSON.stringify("2.3.0-beta.6"),
      __APP_NAME__: JSON.stringify("xiaozhi-client"),
    },
  },
  resolve: {
    alias: {
      // 映射 @xiaozhi-client/* 包名到实际 src/ 目录
      "@xiaozhi-client/mcp-core": resolve(__dirname, "./mcp-core"),
      "@xiaozhi-client/config": resolve(__dirname, "./config"),
      "@xiaozhi-client/shared-types": resolve(__dirname, "./types"),
      "@xiaozhi-client/endpoint": resolve(__dirname, "./endpoint"),
      "@xiaozhi-client/esp32": resolve(__dirname, "./esp32"),
      "@xiaozhi-client/version": resolve(__dirname, "./utils/version.ts"),
      "@xiaozhi-client/cli": resolve(__dirname, "./cli"),
      // Web 前端路径别名
      "@/*": resolve(__dirname, "./web"),
    },
  },
});
