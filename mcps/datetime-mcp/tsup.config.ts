import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  bundle: true,
  platform: "node",
  minify: process.env.NODE_ENV === "production",
  // ESM 模块不支持在文件开头添加 shebang
  // 改为生成单独的可执行文件
  esbuildOptions: (options) => {
    // 生产环境移除无害日志调用，但保留 console.error 等错误日志
    if (process.env.NODE_ENV === "production") {
      options.pure = [...(options.pure ?? []), "console.log", "console.debug"];
      options.drop = ["debugger"];
    }
  },
});
