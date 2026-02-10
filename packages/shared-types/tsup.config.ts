import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    mcp: "src/mcp/index.ts",
    coze: "src/coze/index.ts",
    api: "src/api/index.ts",
    config: "src/config/index.ts",
    utils: "src/utils/index.ts",
  },
  format: ["esm"],
  target: "node18",
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
