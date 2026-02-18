import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 递归复制目录
 */
function copyDirRecursive(src: string, dest: string): void {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const items = readdirSync(src);

  for (const item of items) {
    const srcPath = join(src, item);
    const destPath = join(dest, item);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 复制构建产物到根目录 dist/shared-types
 */
export async function copyDirectory(): Promise<void> {
  const srcDir = resolve("dist");
  const destDir = resolve("../../dist/shared-types");

  copyDirRecursive(srcDir, destDir);
  console.log("✅ 已复制 shared-types 包构建产物到 dist/shared-types/");
}
