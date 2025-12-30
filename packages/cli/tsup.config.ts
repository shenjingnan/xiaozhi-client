import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["esm"],
  target: "node18",
  outDir: "../../dist/cli",
  clean: true,
  sourcemap: true,
  dts: false,
  minify: process.env.NODE_ENV === "production",
  splitting: false,
  bundle: true,
  keepNames: true,
  platform: "node",
  esbuildOptions: (options) => {
    options.resolveExtensions = [".ts", ".js", ".json"];
    // 使用 esbuild 的别名机制
    // 由于 esbuild 的 alias 不支持通配符，我们需要注入多个具体的别名
  },
  external: [
    // Node.js 内置模块
    "ws",
    "child_process",
    "fs",
    "path",
    "url",
    "process",
    "dotenv",
    "os",
    "stream",
    "events",
    "util",
    "crypto",
    "http",
    "https",
    // 依赖的外部包（不打包）
    "commander",
    "chalk",
    "consola",
    "ora",
    "express",
    "cli-table3",
    // Backend 模块（运行时从 dist/backend 读取）
    "@/lib/config/manager",
    "@/lib/config/manager.js",
    "@root/WebServer",
    "@root/WebServer.js",
  ],
  outExtension: () => ({
    js: ".js",
  }),
  onSuccess: async () => {
    // 构建后处理：修复导入路径
    const filePath = resolve("../../dist/cli/index.js");
    let content = readFileSync(filePath, "utf-8");

    // 替换 @root/* 为指向 dist/backend 的相对路径
    content = content
      .replace(
        /from "@\/lib\/config\/manager\.js"/g,
        'from "../backend/lib/config/manager.js"'
      )
      .replace(
        /from "@\/lib\/config\/manager"/g,
        'from "../backend/lib/config/manager.js"'
      )
      .replace(/from "@root\/WebServer\.js"/g, 'from "../backend/WebServer.js"')
      .replace(/from "@root\/WebServer"/g, 'from "../backend/WebServer.js"')
      // 替换动态导入中的 @root/WebServer.js
      .replace(
        /import\("@root\/WebServer\.js"\)/g,
        'import("../backend/WebServer.js")'
      )
      .replace(
        /import\("@root\/WebServer"\)/g,
        'import("../backend/WebServer.js")'
      );

    writeFileSync(filePath, content);
    console.log("✅ 已修复 dist/cli/index.js 中的导入路径");
  },
});
