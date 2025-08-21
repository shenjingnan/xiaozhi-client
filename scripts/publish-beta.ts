#!/usr/bin/env node

import { type ExecSyncOptions, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

/**
 * 包信息接口
 */
interface PackageJson {
  name: string;
  version: string;
  [key: string]: unknown;
}

/**
 * 命令执行选项接口
 */
interface CommandOptions extends ExecSyncOptions {
  cwd?: string;
  stdio?: "inherit" | "pipe" | "ignore";
}

/**
 * 执行命令并输出结果
 * @param command - 要执行的命令
 * @param options - 执行选项
 */
function executeCommand(
  command: string,
  options: CommandOptions = {}
): Buffer | null {
  console.log(`🔄 执行命令: ${command}`);
  try {
    const result = execSync(command, {
      cwd: rootDir,
      stdio: "inherit",
      ...options,
    });
    return result as Buffer;
  } catch (error: unknown) {
    console.error(`❌ 命令执行失败: ${command}`);
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

/**
 * 验证版本号格式
 * @param version - 版本号
 * @returns 是否为有效的版本号
 */
function isValidVersion(version: string): boolean {
  // 支持标准语义化版本号和预发布版本号
  const versionRegex = /^(\d+)\.(\d+)\.(\d+)(-[a-zA-Z0-9.-]+)?$/;
  return versionRegex.test(version);
}

/**
 * 获取当前 package.json 中的版本号
 * @returns 当前版本号
 */
function getCurrentVersion(): string {
  const packageJsonPath = join(rootDir, "package.json");
  const packageJson: PackageJson = JSON.parse(
    readFileSync(packageJsonPath, "utf8")
  );
  return packageJson.version;
}

/**
 * 主函数
 */
function main(): void {
  // 获取命令行参数中的版本号
  const args: string[] = process.argv.slice(2);

  if (args.length === 0) {
    console.error("❌ 错误: 请提供版本号参数");
    console.error(
      "用法: npx tsx scripts/publish-beta.ts <version> [--dry-run]"
    );
    console.error("示例: npx tsx scripts/publish-beta.ts 1.6.3-beta.2");
    console.error(
      "示例: npx tsx scripts/publish-beta.ts 1.6.3-beta.2 --dry-run"
    );
    process.exit(1);
  }

  const targetVersion: string = args[0];
  const isDryRun: boolean = args.includes("--dry-run");

  // 验证版本号格式
  if (!isValidVersion(targetVersion)) {
    console.error(`❌ 错误: 无效的版本号格式: ${targetVersion}`);
    console.error("版本号应该符合语义化版本规范，例如: 1.6.3-beta.2");
    process.exit(1);
  }

  const currentVersion: string = getCurrentVersion();
  console.log(`📦 当前版本: ${currentVersion}`);
  console.log(`🎯 目标版本: ${targetVersion}`);

  if (isDryRun) {
    console.log("🔍 模式: 预演模式 (不会实际发布)");
  }

  // 确认是否为 beta 版本
  if (
    !targetVersion.includes("beta") &&
    !targetVersion.includes("alpha") &&
    !targetVersion.includes("rc")
  ) {
    console.warn(
      "⚠️  警告: 该版本号看起来不像是预发布版本，但将发布到 beta 标签"
    );
  }

  console.log("\n🚀 开始发布 beta 版本...\n");

  if (isDryRun) {
    console.log("✅ 预演模式完成！");
    console.log("📋 实际执行时将会运行以下命令:");
    console.log(`   1. npm version ${targetVersion} --no-git-tag-version`);
    console.log("   2. pnpm publish --tag beta --no-git-checks");
    console.log("   3. git checkout package.json");
    console.log(`🎉 版本 ${targetVersion} 将会发布到 npm beta 标签`);
    console.log("📋 安装命令: npm install xiaozhi-client@beta");
    return;
  }

  try {
    // 步骤 1: 更新版本号（不创建 git tag）
    console.log("📝 步骤 1: 更新 package.json 版本号");
    executeCommand(`npm version ${targetVersion} --no-git-tag-version`);

    // 步骤 2: 发布到 npm beta 标签
    console.log("\n📤 步骤 2: 发布到 npm beta 标签");
    executeCommand("pnpm publish --tag beta --no-git-checks");

    // 步骤 3: 恢复 package.json
    console.log("\n🔄 步骤 3: 恢复 package.json 文件");
    executeCommand("git checkout package.json");

    console.log("\n✅ Beta 版本发布成功!");
    console.log(`🎉 版本 ${targetVersion} 已发布到 npm beta 标签`);
    console.log("📋 安装命令: npm install xiaozhi-client@beta");
  } catch (error: unknown) {
    console.error("\n❌ 发布过程中出现错误，正在恢复 package.json...");
    if (error instanceof Error) {
      console.error(`错误详情: ${error.message}`);
    }
    try {
      executeCommand("git checkout package.json");
      console.log("✅ package.json 已恢复");
    } catch (restoreError: unknown) {
      console.error("❌ 恢复 package.json 失败，请手动检查文件状态");
      if (restoreError instanceof Error) {
        console.error(`恢复错误详情: ${restoreError.message}`);
      }
    }
    process.exit(1);
  }
}

// 运行主函数
main();
