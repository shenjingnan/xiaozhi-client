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
  outDir: "../../dist/shared-types",
  dts: true, // 启用 DTS 生成
  clean: true,
  sourcemap: true,
  minify: false,
  external: [],
});
