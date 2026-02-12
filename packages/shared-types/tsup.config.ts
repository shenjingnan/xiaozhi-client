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
      composite: false,
    },
  },
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
  // 在所有构建完成后复制到项目根 dist 目录
  async onSuccess() {
    const srcDir = resolve("dist");
    const destDir = resolve("../../dist/shared-types");

    // 等待一小段时间确保所有文件都已写入
    await new Promise((resolve) => setTimeout(resolve, 100));

    copyDirectory(srcDir, destDir);
    console.log("✅ 已复制 shared-types 包构建产物到 dist/shared-types/");
  },
});
