import { defineConfig } from "tsup";
import { resolve } from "node:path";

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
    "ora",
    "express",
    "cli-table3",
  ],
  outExtension: () => ({
    js: ".js",
  }),
});
