import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "./dist",
  clean: true,
  sourcemap: true,
  dts: {
    entry: ["src/index.ts"],
    compilerOptions: {
      composite: false,
    },
  },
  bundle: true,
  splitting: false,
  minify: false,
  keepNames: true,
  platform: "node",
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
  ],
  outExtension() {
    return { js: ".js" };
  },
});
