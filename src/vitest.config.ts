import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    // Web 前端测试使用 jsdom 环境
    environmentMatchGlobs: [["src/web/**", "jsdom"]],
    // 全局 setup 文件（内部会根据环境条件执行）
    setupFiles: [resolve(__dirname, "./web/__tests__/setup.ts")],
  },
  // 顶层 define 用于替换全局常量（Vitest 3.x 使用 oxc 而非 esbuild）
  define: {
    __VERSION__: JSON.stringify("2.3.0-beta.6"),
    __APP_NAME__: JSON.stringify("xiaozhi-client"),
  },
  resolve: {
    alias: {
      // 统一的 @/ 跨模块路径别名
      "@/config": resolve(__dirname, "./config"),
      "@/types": resolve(__dirname, "./types"),
      "@/mcp-core": resolve(__dirname, "./mcp-core"),
      "@/endpoint": resolve(__dirname, "./endpoint"),
      "@/esp32": resolve(__dirname, "./esp32"),
      "@/cli": resolve(__dirname, "./cli"),
      // Web 前端路径别名（与 src/web/vitest.config.ts 保持一致）
      "@": resolve(__dirname, "./web"),
      "@components": resolve(__dirname, "./web/components"),
      "@hooks": resolve(__dirname, "./web/hooks"),
      "@services": resolve(__dirname, "./web/services"),
      "@stores": resolve(__dirname, "./web/stores"),
      "@utils": resolve(__dirname, "./web/utils"),
      "@types": resolve(__dirname, "./web/types"),
      "@lib": resolve(__dirname, "./web/lib"),
      "@pages": resolve(__dirname, "./web/pages"),
      "@providers": resolve(__dirname, "./web/providers"),
      "@ui": resolve(__dirname, "./web/components/ui"),
    },
  },
});
