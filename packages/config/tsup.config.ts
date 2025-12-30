import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: true,
  minify: process.env.NODE_ENV === "production",
  splitting: false,
  bundle: true,
  keepNames: true,
  platform: "node",
  esbuildOptions: (options) => {
    // 在生产环境移除 console 和 debugger
    if (process.env.NODE_ENV === "production") {
      options.drop = ["console", "debugger"];
    }

    options.resolveExtensions = [".ts", ".js", ".json"];
  },
  outExtension() {
    return {
      js: ".js",
    };
  },
  external: [
    // Node.js 内置模块
    "fs",
    "path",
    "url",
    "process",
    "os",
    "stream",
    "events",
    "util",
    "crypto",
    "http",
    "https",
    "child_process",
  ],
});
