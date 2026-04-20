import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsup";
import { getVersionDefine } from "../build/version";

export default defineConfig({
  entry: {
    index: "index.ts",
  },
  format: ["esm"],
  target: "node22",
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

    // 在生产环境移除 console 和 debugger
    if (process.env.NODE_ENV === "production") {
      options.drop = ["console", "debugger"];
    }

    // 构建时注入版本号常量
    options.define = {
      ...options.define,
      ...getVersionDefine(import.meta.dirname ?? __dirname),
    };

    // 源码使用 @/ 路径别名体系（见根 tsconfig.json paths 配置）
  },
  external: [
    // 第三方依赖包（不打包，运行时从 node_modules 加载）
    // 注：Node.js 内置模块（fs, path, http 等）在 platform: "node" 下已被 esbuild 自动排除，无需手动声明
    "ws",
    "dotenv",
    "commander",
    "chalk",
    "consola",
    "ora",
    "express",
    "cli-table3",
    // src/config/ 依赖的第三方包（不打包，运行时从 node_modules 加载）
    "comment-json",
    "core-util-is",
    "dayjs",
    // src/mcp-core/ 依赖的第三方包（不打包，运行时从 node_modules 加载）
    "@modelcontextprotocol/sdk",
    "eventsource",
    // Backend 模块（运行时从 dist/backend 读取）
    "@/server/WebServer",
    "@/server/WebServer.js",
  ],
  outExtension: () => ({
    js: ".js",
  }),
  onSuccess: async () => {
    // 构建后处理：修复导入路径
    const filePath = resolve("../../dist/cli/index.js");
    let content = readFileSync(filePath, "utf-8");

    // 替换 @/server/WebServer 为指向正确位置的相对路径
    content = content
      .replace(
        /from\s*["']@\/server\/WebServer\.js["']/g,
        'from "../backend/WebServer.js"'
      )
      .replace(
        /from\s*["']@\/server\/WebServer["']/g,
        'from "../backend/WebServer.js"'
      )
      // 替换动态导入中的 @/server/WebServer.js
      .replace(
        /import\(["']@\/server\/WebServer\.js["']\)/g,
        'import("../backend/WebServer.js")'
      );

    writeFileSync(filePath, content);
    console.log("✅ 已修复 dist/cli/index.js 中的导入路径");

    // 版本同步已移至发布脚本（scripts/release.ts），避免构建产生工作区脏改动
  },
});
