#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type SyncOptions, execaSync } from "execa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

/**
 * 全局状态：是否需要恢复 package.json
 */
let needsPackageJsonRestore = false;

/**
 * 恢复 package.json 文件
 */
function restorePackageJson(): void {
  if (!needsPackageJsonRestore) {
    return;
  }

  console.log("\n🔄 正在恢复 package.json 文件...");
  try {
    const [cmd, ...args] = "git checkout package.json".split(" ");
    execaSync(cmd, args, {
      cwd: rootDir,
      stdio: "inherit",
    });
    console.log("✅ package.json 已成功恢复");
    needsPackageJsonRestore = false;
  } catch (error: unknown) {
    console.error("❌ 恢复 package.json 失败，请手动检查文件状态");
    if (error instanceof Error) {
      console.error(`恢复错误详情: ${error.message}`);
    }
  }
}

/**
 * 信号处理函数
 * @param signal - 接收到的信号
 */
function handleSignal(signal: string): void {
  console.log(`\n\n⚠️  接收到 ${signal} 信号，正在优雅地退出...`);

  // 恢复 package.json 文件
  restorePackageJson();

  console.log("👋 脚本已安全退出");
  process.exit(0);
}

/**
 * 注册信号处理器
 */
function setupSignalHandlers(): void {
  // 监听常见的进程终止信号
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGQUIT"];

  for (const signal of signals) {
    process.on(signal, () => handleSignal(signal));
  }
}

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
interface CommandOptions extends SyncOptions {
  cwd?: string;
  stdio?: "inherit" | "pipe" | "ignore";
}

/**
 * 执行命令并输出结果
 * @param command - 要执行的命令
 * @param options - 执行选项
 */
function executeCommand(command: string, options: CommandOptions = {}): string {
  console.log(`🔄 执行命令: ${command}`);
  try {
    // 将命令字符串分割为命令和参数
    const [cmd, ...args] = command.split(" ");
    const result = execaSync(cmd, args, {
      cwd: rootDir,
      stdio: "inherit",
      ...options,
    });
    return (result.stdout as string) || "";
  } catch (error: unknown) {
    console.error(`❌ 命令执行失败: ${command}`);
    if (error instanceof Error) {
      console.error(error.message);

      // 检查是否是由于信号中断导致的错误
      if (
        error.message.includes("SIGINT") ||
        error.message.includes("SIGTERM")
      ) {
        console.log("\n⚠️  检测到进程中断信号");
        restorePackageJson();
        console.log("👋 脚本已安全退出");
        process.exit(0);
      }
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
  // 注册信号处理器
  setupSignalHandlers();

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

    // 设置恢复标志，表示 package.json 已被修改，需要在异常时恢复
    needsPackageJsonRestore = true;

    // 步骤 2: 发布到 npm beta 标签
    console.log("\n📤 步骤 2: 发布到 npm beta 标签");
    executeCommand("pnpm publish --tag beta --no-git-checks");

    // 步骤 3: 恢复 package.json
    console.log("\n🔄 步骤 3: 恢复 package.json 文件");
    executeCommand("git checkout package.json");

    // 清除恢复标志，表示 package.json 已正常恢复
    needsPackageJsonRestore = false;

    console.log("\n✅ Beta 版本发布成功!");
    console.log(`🎉 版本 ${targetVersion} 已发布到 npm beta 标签`);
    console.log("📋 安装命令: npm install xiaozhi-client@beta");
  } catch (error: unknown) {
    console.error("\n❌ 发布过程中出现错误");
    if (error instanceof Error) {
      console.error(`错误详情: ${error.message}`);
    }

    // 使用统一的恢复函数
    restorePackageJson();
    process.exit(1);
  }
}

// 运行主函数
main();
