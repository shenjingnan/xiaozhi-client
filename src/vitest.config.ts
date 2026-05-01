import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// 读取根目录 package.json 获取版本号
const rootPkgPath = resolve(__dirname, "../package.json");
const pkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    // Web 前端测试使用 jsdom 环境
    environmentMatchGlobs: [["src/web/**", "jsdom"]],
    // 全局 setup 文件（内部会根据环境条件执行）
    setupFiles: [resolve(__dirname, "./web/__tests__/setup.ts")],
    coverage: {
      // 排除构建工具文件（仅 tsdown 构建时使用，不应计入覆盖率）
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/build/**",
        "**/*.config.{js,ts}",
        "**/tsdown.config.ts",
        "template/**",
        "docs/**",
        "mcps/**",
        "tests/**",
      ],
    },
  },
  // 顶层 define 用于替换全局常量（Vitest 3.x 使用 oxc 而非 esbuild）
  define: {
    __VERSION__: JSON.stringify(pkg.version),
    __APP_NAME__: JSON.stringify(pkg.name),
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
