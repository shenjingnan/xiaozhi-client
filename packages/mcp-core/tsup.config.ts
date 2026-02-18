import { defineConfig } from "tsup";
import { resolve } from "node:path";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "./dist",
  clean: true,
  sourcemap: true,
  dts: false, // 使用 tsc 单独生成类型定义以支持项目引用
  bundle: true,
  splitting: false,
  minify: false,
  keepNames: true,
  platform: "node",
  esbuildOptions: (options) => {
    // 在生产环境移除 console 和 debugger
    if (process.env.NODE_ENV === "production") {
      options.drop = ["console", "debugger"];
    }
    options.resolveExtensions = [".ts", ".js", ".json"];
  },
  external: [
    // Node.js 内置模块
    "ws",
    "eventsource",
    "events",
    "node:events",
    "node:fs",
    "node:path",
    "node:url",
    "node:child_process",
    "node:stream",
    "node:http",
    "node:https",
    "node:net",
    // 外部依赖（peer dependencies）
    "@modelcontextprotocol/sdk",
    // Workspace 包依赖
    "@xiaozhi-client/shared-types",
  ],
  outExtension() {
    return { js: ".js" };
  },
  onSuccess: async () => {
    // 使用 tsc 生成类型定义
    const { execSync } = await import("node:child_process");
    try {
      execSync("tsc --emitDeclarationOnly", { cwd: resolve(".") });
      console.log("✅ 已生成类型定义文件");
    } catch (error) {
      console.error("❌ 类型定义生成失败:", error);
    }
  },
});
