import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig } from "tsup";

/**
 * 递归复制目录
 */
function copyDirectory(src: string, dest: string): void {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const items = readdirSync(src);

  for (const item of items) {
    const srcPath = join(src, item);
    const destPath = join(dest, item);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

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
  onSuccess: async () => {
    // 复制构建产物到 dist/config
    const srcDir = resolve("dist");
    const destDir = resolve("../../dist/config");

    copyDirectory(srcDir, destDir);
    console.log("✅ 已复制 config 包构建产物到 dist/config/");
  },
});
