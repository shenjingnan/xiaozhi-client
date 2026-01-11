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
    "events",
    "node:events",
    // 外部依赖（peer dependencies）
    "@modelcontextprotocol/sdk",
    // 工作区依赖
    "@xiaozhi-client/config",
    "@xiaozhi-client/mcp-core",
  ],
  outExtension() {
    return { js: ".js" };
  },
});
