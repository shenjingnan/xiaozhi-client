#!/usr/bin/env node
/**
 * postinstall 脚本
 *
 * 在 pnpm install 后自动构建 workspace 依赖包（如果尚未构建）
 * 这解决了在未构建 workspace 依赖时类型检查失败的问题
 *
 * @see {@link https://github.com/shenjingnan/xiaozhi-client/issues/2270}
 */

import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 需要构建的 workspace 包列表
const packagesToBuild = [
  "shared-types",
  "version",
  "config",
  "endpoint",
  "mcp-core",
  "asr",
  "tts",
  "cli",
];

/**
 * 检查是否需要构建
 * 只有当所有包的 dist 目录都不存在时才触发构建
 */
function checkNeedsBuild() {
  const rootDir = join(__dirname, "..");
  const missingPackages = [];

  for (const pkg of packagesToBuild) {
    const distPath = join(rootDir, "packages", pkg, "dist");
    if (!existsSync(distPath)) {
      missingPackages.push(pkg);
    }
  }

  return {
    needsBuild: missingPackages.length > 0,
    missingPackages,
  };
}

/**
 * 构建所有 workspace 包
 */
function buildWorkspacePackages() {
  const { needsBuild, missingPackages } = checkNeedsBuild();

  if (!needsBuild) {
    console.log("✓ workspace 依赖包已存在，跳过构建");
    return;
  }

  console.log(`⚠ 缺少以下包的构建产物: ${missingPackages.join(", ")}`);
  console.log("正在构建 workspace 依赖包...");

  try {
    // 使用 nx 构建所有需要的包
    const projects = packagesToBuild.join(",");
    execSync(
      `npx nx run-many -t build --projects=${projects} --parallel=false`,
      {
        stdio: "inherit",
        cwd: join(__dirname, ".."),
      }
    );
    console.log("✓ workspace 依赖包构建完成！");
  } catch (error) {
    console.error("✗ workspace 依赖包构建失败:", error.message);
    throw error;
  }
}

// 执行构建
buildWorkspacePackages();
