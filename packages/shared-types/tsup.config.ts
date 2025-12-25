import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["esm"],
  outDir: "../../dist/shared-types",
  dts: false, // 暂时禁用DTS生成，稍后解决
  clean: true,
  sourcemap: true,
  minify: false,
  external: [],
});
