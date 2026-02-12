import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
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
