#!/usr/bin/env node

/**
 * 自动更新 Dockerfile 中的 xiaozhi-client 版本号
 * 该脚本会读取 package.json 中的版本号，并更新 Dockerfile 中的 ARG XIAOZHI_VERSION
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dockerDir = join(__dirname, "..");
const projectRoot = join(__dirname, "../..");

function updateDockerfileVersion() {
  try {
    // 读取 package.json 获取当前版本
    const packageJsonPath = join(projectRoot, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const currentVersion = packageJson.version;

    console.log(`📦 当前项目版本: ${currentVersion}`);

    // 读取 Dockerfile
    const dockerfilePath = join(dockerDir, "Dockerfile");
    const dockerfileContent = readFileSync(dockerfilePath, "utf8");

    // 使用正则表达式匹配并替换版本号
    const versionRegex = /^ARG XIAOZHI_VERSION=(.+)$/m;
    const match = dockerfileContent.match(versionRegex);

    if (!match) {
      console.error("❌ 未找到 Dockerfile 中的 ARG XIAOZHI_VERSION 行");
      process.exit(1);
    }

    const oldVersion = match[1];
    console.log(`🐳 Dockerfile 当前版本: ${oldVersion}`);

    if (oldVersion === currentVersion) {
      console.log("✅ 版本号已经是最新的，无需更新");
      return;
    }

    // 替换版本号
    const newDockerfileContent = dockerfileContent.replace(
      versionRegex,
      `ARG XIAOZHI_VERSION=${currentVersion}`
    );

    // 写回文件
    writeFileSync(dockerfilePath, newDockerfileContent, "utf8");

    console.log(
      `🔄 已更新 Dockerfile 版本号: ${oldVersion} → ${currentVersion}`
    );
    console.log("✅ Dockerfile 版本更新完成");
  } catch (error) {
    console.error("❌ 更新 Dockerfile 版本时发生错误:", error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  updateDockerfileVersion();
}

export { updateDockerfileVersion };
