#!/usr/bin/env node

/**
 * 发布脚本
 *
 * 功能：
 * - 执行 nx release 命令更新版本号和变更日志
 * - 推送代码和 tag 到远程仓库
 * - 支持预演模式
 * - 支持跳过推送步骤
 *
 * 使用方法：
 * tsx scripts/release.ts 1.10.7
 * tsx scripts/release.ts 1.10.8-beta.0
 * tsx scripts/release.ts 1.10.7 --dry-run
 * tsx scripts/release.ts 1.10.7 --skip-push
 */

import { consola } from "consola";
import { execa } from "execa";

/**
 * 日志级别
 */
type LogLevel = "info" | "success" | "error" | "warn";

/**
 * 日志函数
 */
function log(level: LogLevel, message: string): void {
  const methods: Record<LogLevel, keyof typeof consola> = {
    info: "info",
    success: "success",
    error: "error",
    warn: "warn",
  };
  (consola[methods[level]] as (msg: string) => void)(message);
}

/**
 * 发布选项接口
 */
interface ReleaseOptions {
  /** 版本号 */
  version: string;
  /** 预演模式，不实际执行 */
  dryRun?: boolean;
  /** 跳过推送步骤 */
  skipPush?: boolean;
}

/**
 * 验证版本号格式
 *
 * @param version - 版本号
 * @returns 是否有效
 */
function validateVersion(version: string): boolean {
  // 语义化版本正则：major.minor.patch
  // 支持 pre-release：1.10.8-beta.0, 1.10.8-rc.0
  const semverRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;

  return semverRegex.test(version);
}

/**
 * 获取当前分支名称
 *
 * @returns 当前分支名称
 * @throws 当无法获取当前分支时抛出错误
 */
async function getCurrentBranch(): Promise<string> {
  try {
    const { stdout: branch } = await execa("git", ["branch", "--show-current"]);
    return branch.trim();
  } catch (error) {
    throw new Error(`获取当前分支失败: ${(error as Error).message}`);
  }
}

/**
 * 获取主分支名称（main 或 master）
 *
 * @returns 主分支名称
 */
async function getBaseBranch(): Promise<string> {
  try {
    // 尝试获取远程的 HEAD 分支
    const { stdout: symbolicRef } = await execa("git", [
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
    ]);
    return symbolicRef.replace("refs/remotes/origin/", "").trim();
  } catch {
    // 如果无法获取，尝试检测 main 或 master
    try {
      await execa("git", ["rev-parse", "--verify", "origin/main"]);
      return "main";
    } catch {
      try {
        await execa("git", ["rev-parse", "--verify", "origin/master"]);
        return "master";
      } catch {
        // 默认返回 main
        return "main";
      }
    }
  }
}

/**
 * 检查工作目录是否干净
 *
 * @returns 是否干净（干净为 true，有未提交更改为 false）
 * @throws 当检查工作目录失败时抛出错误
 */
async function checkWorkingTreeClean(): Promise<boolean> {
  try {
    const { stdout: status } = await execa("git", ["status", "--porcelain"]);
    return status.trim().length === 0;
  } catch (error) {
    throw new Error(`检查工作目录失败: ${(error as Error).message}`);
  }
}

/**
 * 执行 nx release 命令
 *
 * @param version - 版本号
 * @param dryRun - 是否预演模式
 * @throws 当命令执行失败时抛出错误
 */
async function runNxRelease(version: string, dryRun = false): Promise<void> {
  const args = ["release", "--skip-publish", `--specifier=${version}`];

  if (dryRun) {
    args.push("--dry-run");
  }

  try {
    await execa("npx", ["nx", ...args], {
      stdio: "inherit",
    });
  } catch (error) {
    throw new Error(`nx release 执行失败: ${(error as Error).message}`);
  }
}

/**
 * 推送代码和 tag 到远程仓库
 *
 * @param version - 版本号
 * @param baseBranch - 主分支名称
 * @param dryRun - 是否预演模式
 * @throws 当推送失败时抛出错误
 */
async function pushToRemote(
  version: string,
  baseBranch: string,
  dryRun = false
): Promise<void> {
  const tagName = `v${version}`;

  if (dryRun) {
    log("info", `[预演] git push origin ${baseBranch}`);
    log("info", `[预演] git push origin ${tagName}`);
    return;
  }

  try {
    // 推送主分支
    log("info", `推送主分支到远程...`);
    await execa("git", ["push", "origin", baseBranch], {
      stdio: "inherit",
    });

    // 推送 tag
    log("info", `推送 tag ${tagName} 到远程...`);
    await execa("git", ["push", "origin", tagName], {
      stdio: "inherit",
    });
  } catch (error) {
    throw new Error(`推送失败: ${(error as Error).message}`);
  }
}

/**
 * 显示预览信息
 *
 * @param options - 发布选项
 * @param currentBranch - 当前分支
 * @param baseBranch - 主分支
 */
function showPreview(
  options: ReleaseOptions,
  currentBranch: string,
  baseBranch: string
): void {
  const tagName = `v${options.version}`;

  console.log(`\n${"=".repeat(60)}`);
  console.log("📋 发布预览");
  console.log("=".repeat(60));
  console.log(`版本: ${options.version}`);
  console.log(`Tag: ${tagName}`);
  console.log(`当前分支: ${currentBranch}`);
  console.log(`主分支: ${baseBranch}`);
  console.log(`预演模式: ${options.dryRun ? "是" : "否"}`);
  console.log(`跳过推送: ${options.skipPush ? "是" : "否"}`);
  console.log(`${"=".repeat(60)}\n`);
}

/**
 * 主函数
 *
 * @param options - 发布选项
 */
async function main(options: ReleaseOptions): Promise<void> {
  console.log("\n🚀 发布脚本启动");
  console.log("=".repeat(60));

  // 1. 验证版本号
  log("info", "🔍 验证版本号格式...");
  if (!validateVersion(options.version)) {
    log("error", `无效的版本号: ${options.version}`);
    log(
      "info",
      "版本号格式应为: major.minor.patch 或 major.minor.patch-prerelease"
    );
    log("info", "示例: 1.10.7, 1.10.8-beta.0, 1.10.8-rc.0");
    process.exit(1);
    return;
  }
  log("success", `版本号格式正确: ${options.version}`);

  // 2. 检查工作目录
  log("info", "🔍 检查工作目录状态...");
  const isClean = await checkWorkingTreeClean();
  if (!isClean) {
    log("error", "工作目录不干净，请先提交所有更改:");
    log("info", "  git add .");
    log("info", "  git commit -m 'chore: 准备发布'");
    process.exit(1);
    return;
  }
  log("success", "工作目录干净");

  // 3. 检查当前分支
  log("info", "🔍 检查当前分支...");
  const currentBranch = await getCurrentBranch();
  const baseBranch = await getBaseBranch();
  log("info", `  当前分支: ${currentBranch}`);
  log("info", `  主分支: ${baseBranch}`);

  if (currentBranch !== baseBranch) {
    log("warn", `当前分支不是主分支 (${baseBranch})，建议在主分支上进行发布`);
    log("info", "如需切换到主分支:");
    log("info", `  git checkout ${baseBranch}`);
  }

  // 4. 显示预览
  showPreview(options, currentBranch, baseBranch);

  // 5. 预演模式确认
  if (options.dryRun) {
    log("info", "💡 这是预演模式，将显示将要执行的命令");
  }

  // 6. 执行 nx release
  log("info", "📦 执行 nx release...");
  try {
    await runNxRelease(options.version, options.dryRun);
    log("success", "版本号和变更日志已更新");
  } catch (error) {
    log("error", (error as Error).message);
    process.exit(1);
    return;
  }

  // 7. 推送代码和 tag
  if (!options.skipPush) {
    log("info", "📤 推送代码和 tag 到远程...");
    try {
      await pushToRemote(options.version, baseBranch, options.dryRun);
      log("success", "推送成功");
    } catch (error) {
      log("error", (error as Error).message);
      process.exit(1);
      return;
    }
  } else {
    log("info", "⏭️  跳过推送步骤");
  }

  // 8. 完成
  if (options.dryRun) {
    log("info", "💡 预演完成，未实际执行发布");
    log("info", "如需实际发布，请移除 --dry-run 参数");
  } else {
    log("success", "✅ 发布完成！");
    log("info", `版本 ${options.version} 已推送到远程仓库`);
    log("info", "GitHub Actions 将自动执行发布流程");
  }

  console.log(`${"=".repeat(60)}\n`);
}

/**
 * 解析命令行参数
 *
 * @returns 解析后的选项
 */
function parseArgs(): ReleaseOptions {
  const args = process.argv.slice(2);

  // 位置参数：版本号
  const version = args[0];

  if (!version) {
    log("error", "缺少版本号参数");
    log("info", "使用方法: tsx scripts/release.ts <version> [选项]");
    log("info", "使用 --help 查看帮助信息");
    process.exit(1);
  }

  const options: ReleaseOptions = {
    version,
    dryRun: false,
    skipPush: false,
  };

  // 解析选项
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--dry-run":
      case "-n":
        options.dryRun = true;
        break;
      case "--skip-push":
        options.skipPush = true;
        break;
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
        break;
      default:
        log("error", `未知参数: ${arg}`);
        log("info", "使用 --help 查看帮助信息");
        process.exit(1);
    }
  }

  return options;
}

/**
 * 显示帮助信息
 */
function showHelp(): void {
  console.log(`
发布脚本 - 简化版本发布流程

使用方法：
  tsx scripts/release.ts <version> [选项]

参数：
  version               版本号（必需）
                       格式: major.minor.patch 或 major.minor.patch-prerelease
                       示例: 1.10.7, 1.10.8-beta.0, 1.10.8-rc.0

选项：
  -n, --dry-run         预演模式，不实际执行
  --skip-push           跳过推送步骤（仍会在本地创建 commit/tag）
  -h, --help            显示帮助信息

示例：
  # 发布正式版本
  tsx scripts/release.ts 1.10.7

  # 发布 Beta 版本
  tsx scripts/release.ts 1.10.8-beta.0

  # 发布 RC 版本
  tsx scripts/release.ts 1.10.8-rc.0

  # 预演模式（不实际执行）
  tsx scripts/release.ts 1.10.7 --dry-run

  # 仅更新版本号，不推送
  tsx scripts/release.ts 1.10.7 --skip-push

发布流程：
  1. 验证版本号格式
  2. 检查工作目录状态
  3. 执行 nx release 更新版本号和变更日志
  4. 推送代码和 tag 到远程仓库
  5. GitHub Actions 自动执行发布流程

注意事项：
  - 请确保工作目录干净（无未提交的更改）
  - 建议在主分支（main 或 master）上进行发布
  - 发布前请先运行 pnpm build 确保构建成功
`);
}

// 错误处理
process.on("uncaughtException", (error: Error) => {
  log("error", `未捕获的异常: ${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  log("error", `未处理的 Promise 拒绝: ${String(reason)}`);
  process.exit(1);
});

// 检查是否直接运行此脚本
const isMainModule = process.argv[1]?.endsWith("release.ts") ?? false;
if (isMainModule) {
  const options = parseArgs();
  main(options).catch((error: Error) => {
    log("error", `主函数执行失败: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

export { checkWorkingTreeClean, main, parseArgs, validateVersion };
