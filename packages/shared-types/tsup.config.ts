import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "mcp/index": "src/mcp/index.ts",
    "coze/index": "src/coze/index.ts",
    "api/index": "src/api/index.ts",
    "config/index": "src/config/index.ts",
    "utils/index": "src/utils/index.ts",
  },
  format: ["esm"],
  target: "node20",
  outDir: "./dist",
  dts: {
    compilerOptions: {
      composite: false
    }
  }, // 启用 DTS 生成
  clean: true,
  sourcemap: true,
  minify: process.env.NODE_ENV === "production",
  esbuildOptions: (options) => {
    // 在生产环境移除 console 和 debugger
    if (process.env.NODE_ENV === "production") {
      options.drop = ["console", "debugger"];
    }
    options.resolveExtensions = [".ts", ".js", ".json"];
  },
  external: [],
});
