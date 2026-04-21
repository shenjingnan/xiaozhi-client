/**
 * calculator-mcp 构建配置
 *
 * 从 tsup 迁移至 tsdown（基于 Rolldown）
 */

import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["es"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  platform: "node",

  // 生产环境移除无害日志调用和 debugger
  // 注：oxc-minifier 的 dropConsole 会移除所有 console.* 调用（含 error/warn）
  // 原 tsup 配置使用 pure 仅移除 console.log/debug，此处行为略有差异
  minify:
    process.env.NODE_ENV === "production"
      ? {
          compress: {
            dropConsole: true,
            dropDebugger: true,
          },
        }
      : false,
});
