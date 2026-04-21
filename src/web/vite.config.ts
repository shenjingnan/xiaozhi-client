import path from "node:path";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

export default defineConfig({
  // 启用 Rolldown 作为底层打包引擎（替代 Rollup）
  // Rolldown 由 Rust 编写，构建速度显著更快
  experimental: {
    rolldown: true,
  },
  plugins: [
    react(),
    // Bundle analyzer - 只在需要时启用
    // 注意：rollup-plugin-visualizer 依赖 moduleParsed hook，
    // 在 rolldown 模式下可能无法正常工作。如需分析包体积，
    // 可临时禁用 experimental.rolldown 或使用其他分析工具。
    process.env.ANALYZE &&
      visualizer({
        filename: "dist/stats.html",
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://localhost:9999",
        ws: true,
      },
      "/api": {
        target: "http://localhost:9999",
      },
    },
  },
  build: {
    outDir: "../../dist/frontend",
    sourcemap: true,
    // 使用 Oxc 压缩器（与 Rolldown 集成更好，压缩速度更快）
    minify: "oxc",
    // 代码分割优化配置（使用 rolldown 原生配置）
    rolldownOptions: {
      output: {
        // 动态分包策略 - 只为实际使用的库创建 chunk
        manualChunks: (id) => {
          // React 相关库
          if (
            id.includes("react") ||
            id.includes("react-dom") ||
            id.includes("react-router")
          ) {
            return "react-vendor";
          }

          // Radix UI 组件库
          if (id.includes("@radix-ui")) {
            return "radix-ui";
          }

          // 表单相关库
          if (
            id.includes("react-hook-form") ||
            id.includes("@hookform") ||
            id.includes("zod")
          ) {
            return "form-utils";
          }

          // 图标库
          if (id.includes("lucide-react")) {
            return "icons";
          }

          // 图表库 - 只有在实际使用时才分包
          if (id.includes("recharts")) {
            return "charts";
          }

          // 拖拽库 - 只有在实际使用时才分包
          if (id.includes("@dnd-kit")) {
            return "dnd-kit";
          }

          // 表格库 - 只有在实际使用时才分包
          if (id.includes("@tanstack/react-table")) {
            return "table";
          }

          // 工具库和状态管理
          if (
            id.includes("zustand") ||
            id.includes("clsx") ||
            id.includes("tailwind-merge") ||
            id.includes("class-variance-authority") ||
            id.includes("next-themes") ||
            id.includes("sonner") ||
            id.includes("vaul")
          ) {
            return "utils";
          }

          // 移除兜底的 vendor chunk，让 Vite 自动处理剩余模块
          // 这样可以避免 circular chunk 警告
        },
        // 优化 chunk 文件名
        chunkFileNames: "assets/[name]-[hash].js",
      },
    },
    chunkSizeWarningLimit: 500,
  },
});
