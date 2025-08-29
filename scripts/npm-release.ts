#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type SyncOptions, execaSync } from "execa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

/**
 * 发布配置接口
 */
interface ReleaseConfig {
  version?: string;
  isDryRun: boolean;
  skipChecks: boolean;
  prereleaseOnly: boolean;
  checkVersionOnly: boolean;
}

/**
 * 版本信息接口
 */
interface VersionInfo {
  version: string;
  isPrerelease: boolean;
  versionType: "release" | "prerelease";
}

/**
 * 发布结果接口
 */
interface ReleaseResult {
  success: boolean;
  version?: string;
  skipped: boolean;
  isPrerelease: boolean;
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
 * 日志工具类
 */
class Logger {
  static info(message: string): void {
    console.log(`ℹ️  ${message}`);
  }

  static success(message: string): void {
    console.log(`✅ ${message}`);
  }

  static warning(message: string): void {
    console.log(`⚠️  ${message}`);
  }

  static error(message: string): void {
    console.error(`❌ ${message}`);
  }

  static step(step: number, message: string): void {
    console.log(`\n📋 步骤 ${step}: ${message}`);
  }

  static rocket(message: string): void {
    console.log(`🚀 ${message}`);
  }

  static package(message: string): void {
    console.log(`📦 ${message}`);
  }
}

/**
 * 命令执行工具类
 */
class CommandExecutor {
  static executeCommand(
    command: string,
    args: string[] = [],
    options: SyncOptions = {}
  ): string {
    try {
      const result = execaSync(command, args, {
        cwd: rootDir,
        stdio: "inherit",
        ...options,
      });
      return (result.stdout as string) || "";
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error(`命令执行失败: ${command} ${args.join(" ")}`);
        Logger.error(error.message);
      }
      throw error;
    }
  }

  static run(command: string, args: string[] = []): string {
    Logger.info(`执行命令: ${command} ${args.join(" ")}`);
    return CommandExecutor.executeCommand(command, args);
  }

  static runSilent(command: string, args: string[] = []): string {
    return CommandExecutor.executeCommand(command, args, { stdio: "pipe" });
  }

  static runWithRetry(
    command: string,
    args: string[] = [],
    maxAttempts = 2
  ): string {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          Logger.info(`重试第 ${attempt} 次: ${command} ${args.join(" ")}`);
        }
        return CommandExecutor.run(command, args);
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxAttempts) {
          Logger.warning(`第 ${attempt} 次尝试失败，准备重试...`);
        }
      }
    }

    throw lastError;
  }
}

/**
 * 版本检测器
 */
class VersionDetector {
  /**
   * 获取当前 package.json 中的版本号
   */
  static getCurrentVersion(): string {
    const packageJsonPath = join(rootDir, "package.json");
    const packageJson: PackageJson = JSON.parse(
      readFileSync(packageJsonPath, "utf8")
    );
    return packageJson.version;
  }

  /**
   * 检测版本类型
   */
  static detectVersionType(version: string): VersionInfo {
    Logger.info(`检测版本: ${version}`);

    // 检查是否为语义化版本关键词
    if (
      /^(patch|minor|major|prepatch|preminor|premajor|prerelease)$/.test(
        version
      )
    ) {
      Logger.info(`检测到语义化版本关键词: ${version}`);

      if (/^pre/.test(version)) {
        Logger.info("语义化预发布关键词，将执行预发布流程");
        return {
          version,
          isPrerelease: true,
          versionType: "prerelease",
        };
      }
      Logger.info("语义化正式版本关键词，将执行正式版本流程");
      return {
        version,
        isPrerelease: false,
        versionType: "release",
      };
    }

    // 检测是否为具体的预发布版本号（包含 -alpha, -beta, -rc 等）
    if (
      /^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+(\.[0-9]+)?)?$/.test(version) &&
      /-/.test(version)
    ) {
      Logger.info(`检测到预发布版本号: ${version}`);
      return {
        version,
        isPrerelease: true,
        versionType: "prerelease",
      };
    }

    Logger.info(`检测到正式版本号: ${version}`);
    return {
      version,
      isPrerelease: false,
      versionType: "release",
    };
  }
}

/**
 * 版本检查器
 */
class VersionChecker {
  private static readonly PACKAGE_NAME = "xiaozhi-client";

  /**
   * 检查版本是否已存在于 npm registry
   */
  static async checkVersionExists(version: string): Promise<boolean> {
    try {
      Logger.info(`检查版本 ${version} 是否已存在于 npm registry`);
      CommandExecutor.runSilent("npm", [
        "view",
        `${VersionChecker.PACKAGE_NAME}@${version}`,
        "version",
      ]);
      Logger.success(`版本 ${version} 已存在于 npm registry`);
      return true;
    } catch {
      Logger.info(`版本 ${version} 不存在，可以发布`);
      return false;
    }
  }

  /**
   * 版本检查
   * @param version 要检查的版本号，如果不提供则从 package.json 获取
   * @returns 检查结果信息
   */
  static async checkVersionStandalone(version?: string): Promise<{
    version: string;
    exists: boolean;
    npmUrl?: string;
  }> {
    const versionToCheck = version || VersionDetector.getCurrentVersion();

    Logger.info(`🔍 检查版本: ${versionToCheck}`);

    const exists = await VersionChecker.checkVersionExists(versionToCheck);
    const result = {
      version: versionToCheck,
      exists,
      npmUrl: exists
        ? `https://www.npmjs.com/package/${VersionChecker.PACKAGE_NAME}/v/${versionToCheck}`
        : undefined,
    };

    if (exists) {
      Logger.success(`✅ 版本 ${versionToCheck} 已存在于 npm registry`);
      if (result.npmUrl) {
        Logger.package(`📦 NPM: ${result.npmUrl}`);
      }
    } else {
      Logger.info(`📦 版本 ${versionToCheck} 不存在于 npm registry，可以发布`);
    }

    return result;
  }
}

/**
 * 质量检查器
 */
class QualityChecker {
  /**
   * 执行所有质量检查
   */
  static runAllChecks(): void {
    Logger.step(1, "代码格式检查");
    CommandExecutor.run("pnpm", ["run", "check"]);

    Logger.step(2, "拼写检查");
    CommandExecutor.run("pnpm", ["run", "spell:check"]);

    Logger.step(3, "代码重复率检查");
    CommandExecutor.run("pnpm", ["run", "duplicate:check"]);

    Logger.step(4, "构建项目");
    CommandExecutor.runWithRetry("pnpm", ["run", "build"]);

    Logger.step(5, "运行测试");
    CommandExecutor.runWithRetry("pnpm", ["run", "test"]);

    Logger.success("所有质量检查通过");
  }
}

/**
 * 发布执行器
 */
class ReleaseExecutor {
  /**
   * 配置 Git 用户
   */
  static configureGitUser(): void {
    Logger.info("配置 Git 用户");
    CommandExecutor.run("git", ["config", "user.name", "github-actions[bot]"]);
    CommandExecutor.run("git", [
      "config",
      "user.email",
      "github-actions[bot]@users.noreply.github.com",
    ]);
  }

  /**
   * 执行预发布版本发布（仅 NPM）
   */
  static async executePrerelease(
    config: ReleaseConfig,
    versionInfo: VersionInfo
  ): Promise<ReleaseResult> {
    Logger.rocket("执行预发布版本发布（仅 NPM）");
    Logger.info(`版本类型: ${versionInfo.versionType}`);

    if (config.isDryRun) {
      Logger.info("预演模式：仅预览，不实际发布");
      return ReleaseExecutor.executeDryRun(config, true);
    }

    // 检查版本是否已存在
    const versionToCheck =
      config.version || VersionDetector.getCurrentVersion();
    const versionExists =
      await VersionChecker.checkVersionExists(versionToCheck);

    if (versionExists) {
      Logger.warning(`版本 ${versionToCheck} 已存在于 npm registry`);
      Logger.success("跳过发布，标记为成功完成");
      return {
        success: true,
        version: versionToCheck,
        skipped: true,
        isPrerelease: true,
      };
    }

    // 执行发布
    Logger.package("开始发布新版本到 npm");
    const releaseArgs = ReleaseExecutor.buildReleaseArgs(config, true);

    Logger.rocket("开始执行预发布版本 release-it...");
    Logger.info(`参数: ${releaseArgs.join(" ")}`);

    CommandExecutor.run("npx", ["release-it", ...releaseArgs]);

    const finalVersion = VersionDetector.getCurrentVersion();
    Logger.success("预发布版本发布成功");

    return {
      success: true,
      version: finalVersion,
      skipped: false,
      isPrerelease: true,
    };
  }

  /**
   * 执行正式版本发布（完整流程）
   */
  static async executeRelease(
    config: ReleaseConfig,
    versionInfo: VersionInfo
  ): Promise<ReleaseResult> {
    Logger.rocket("执行正式版本发布（完整流程）");
    Logger.info(`版本类型: ${versionInfo.versionType}`);

    // 配置 Git 用户
    ReleaseExecutor.configureGitUser();

    if (config.isDryRun) {
      Logger.info("预演模式：仅预览，不实际发布");
      return ReleaseExecutor.executeDryRun(config, false);
    }

    // 检查版本是否已存在
    const versionToCheck =
      config.version || VersionDetector.getCurrentVersion();
    const versionExists =
      await VersionChecker.checkVersionExists(versionToCheck);

    if (versionExists) {
      Logger.warning(`版本 ${versionToCheck} 已存在于 npm registry`);
      Logger.success("跳过发布，标记为成功完成");
      return {
        success: true,
        version: versionToCheck,
        skipped: true,
        isPrerelease: false,
      };
    }

    // 执行发布
    Logger.package("开始发布新版本");
    const releaseArgs = ReleaseExecutor.buildReleaseArgs(config, false);

    Logger.rocket("开始执行正式版本 release-it...");
    Logger.info(`参数: ${releaseArgs.join(" ")}`);

    CommandExecutor.run("npx", ["release-it", ...releaseArgs]);

    const finalVersion = VersionDetector.getCurrentVersion();
    Logger.success("正式版本发布成功");

    return {
      success: true,
      version: finalVersion,
      skipped: false,
      isPrerelease: false,
    };
  }

  /**
   * 执行预演模式
   */
  static executeDryRun(
    config: ReleaseConfig,
    isPrerelease: boolean
  ): ReleaseResult {
    // 使用统一的参数构建方法，然后添加预演模式特定的参数
    const releaseArgs = ReleaseExecutor.buildReleaseArgs(config, isPrerelease);

    // 在开头插入 --dry-run 参数
    releaseArgs.unshift("--dry-run");

    // 添加 --npm.publish=false 以确保预演模式不会实际发布
    releaseArgs.push("--npm.publish=false");

    Logger.rocket(
      `开始执行${
        isPrerelease ? "预发布" : "正式"
      }版本 release-it（预演模式）...`
    );
    Logger.info(`参数: ${releaseArgs.join(" ")}`);

    CommandExecutor.run("npx", ["release-it", ...releaseArgs]);

    return {
      success: true,
      version: config.version || "dry-run",
      skipped: false,
      isPrerelease,
    };
  }

  /**
   * 构建 release-it 参数
   */
  static buildReleaseArgs(
    config: ReleaseConfig,
    isPrerelease: boolean
  ): string[] {
    const args: string[] = [];

    // 根据版本类型选择对应的配置文件
    if (isPrerelease) {
      Logger.info("使用预发布版本配置文件: .release-it.prerelease.json");
      args.push("--config", ".release-it.prerelease.json");
    } else {
      Logger.info("使用正式版本配置文件: .release-it.json");
      args.push("--config", ".release-it.json");
    }

    if (config.version) {
      Logger.info(`使用指定版本号: ${config.version}`);
      args.push(config.version);
    } else {
      Logger.info("使用自动版本号递增");
    }

    args.push("--ci");

    return args;
  }
}

/**
 * 结果输出器
 */
class ResultReporter {
  /**
   * 输出发布结果信息
   */
  static reportResult(result: ReleaseResult): void {
    if (result.skipped) {
      if (result.isPrerelease) {
        Logger.package(`预发布版本（已存在）: v${result.version}`);
        Logger.info(`版本 v${result.version} 已存在于 npm registry，跳过发布`);
      } else {
        Logger.package(`正式版本（已存在）: v${result.version}`);
        Logger.info(`版本 v${result.version} 已存在于 npm registry，跳过发布`);
      }
    } else {
      if (result.isPrerelease) {
        Logger.package(`预发布版本（新发布）: v${result.version}`);
        Logger.success("预发布版本发布完成！");
        Logger.info(
          "注意：预发布版本仅发布到 NPM，未创建 Git tag 和 GitHub release"
        );
      } else {
        Logger.package(`正式版本（新发布）: v${result.version}`);
        Logger.success("正式版本发布完成！");
      }
    }

    // 输出相关链接
    if (result.version && result.version !== "dry-run") {
      Logger.package(
        `NPM: https://www.npmjs.com/package/xiaozhi-client/v/${result.version}`
      );

      if (!result.isPrerelease && !result.skipped) {
        Logger.info(
          `GitHub Release: https://github.com/${
            process.env.GITHUB_REPOSITORY || "owner/repo"
          }/releases/tag/v${result.version}`
        );
        Logger.info(
          `Changelog: https://github.com/${
            process.env.GITHUB_REPOSITORY || "owner/repo"
          }/blob/main/CHANGELOG.md`
        );
      }
    }
  }
}

/**
 * 参数解析器
 */
class ArgumentParser {
  /**
   * 解析命令行参数
   */
  static parseArguments(): ReleaseConfig {
    const args = process.argv.slice(2);

    const config: ReleaseConfig = {
      isDryRun: false,
      skipChecks: false,
      prereleaseOnly: false,
      checkVersionOnly: false,
    };

    // 解析参数
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === "--dry-run") {
        config.isDryRun = true;
      } else if (arg === "--skip-checks") {
        config.skipChecks = true;
      } else if (arg === "--prerelease-only") {
        config.prereleaseOnly = true;
      } else if (arg === "--check-version" || arg === "-c") {
        config.checkVersionOnly = true;
      } else if (arg === "--help" || arg === "-h") {
        ArgumentParser.showHelp();
        process.exit(0);
      } else if (!arg.startsWith("--") && !config.version) {
        // 第一个非选项参数作为版本号
        config.version = arg;
      }
    }

    return config;
  }

  /**
   * 显示帮助信息
   */
  static showHelp(): void {
    console.log(`
使用方法: npm-release.ts [version] [options]

参数:
  version                 指定版本号 (例如: 1.0.0, 1.0.0-beta.1, patch, minor, major)

选项:
  --dry-run              预演模式（仅预览，不实际发布）
  --skip-checks          跳过质量检查（格式检查、拼写检查、构建、测试等）
  --prerelease-only      仅执行预发布流程
  --check-version, -c    仅检查版本是否存在于 npm registry
  --help, -h             显示此帮助信息

示例:
  npm-release.ts                           # 自动递增版本号并发布
  npm-release.ts 1.0.0                     # 发布指定版本号
  npm-release.ts 1.0.0-beta.1              # 发布预发布版本
  npm-release.ts patch --dry-run           # 预演模式递增补丁版本
  npm-release.ts --skip-checks             # 跳过质量检查直接发布
  npm-release.ts --check-version           # 检查当前版本是否已存在
  npm-release.ts 1.0.0 --check-version    # 检查指定版本是否已存在

环境变量:
  NODE_AUTH_TOKEN        NPM 认证 token
  GITHUB_TOKEN           GitHub 认证 token
  GITHUB_REPOSITORY      GitHub 仓库信息 (格式: owner/repo)
`);
  }
}

/**
 * 信号处理器
 */
class SignalHandler {
  /**
   * 设置信号处理器
   */
  static setup(): void {
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGQUIT"];

    for (const signal of signals) {
      process.on(signal, () => SignalHandler.handleSignal(signal));
    }
  }

  /**
   * 处理信号
   */
  static handleSignal(signal: string): void {
    Logger.warning(`接收到 ${signal} 信号，正在优雅地退出...`);
    Logger.info("脚本已安全退出");
    process.exit(0);
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    // 设置信号处理器
    SignalHandler.setup();

    // 解析命令行参数
    const config = ArgumentParser.parseArguments();

    // 如果只是检查版本，执行独立的版本检查功能
    if (config.checkVersionOnly) {
      Logger.rocket("开始版本检查");
      const result = await VersionChecker.checkVersionStandalone(
        config.version
      );

      // 根据检查结果设置退出码（兼容原 shell 脚本的行为）
      process.exit(result.exists ? 0 : 1);
    }

    Logger.rocket("开始 NPM 发布流程");
    Logger.info(`预演模式: ${config.isDryRun}`);
    Logger.info(`跳过检查: ${config.skipChecks}`);
    Logger.info(`仅预发布: ${config.prereleaseOnly}`);

    if (config.version) {
      Logger.info(`指定版本: ${config.version}`);
    }

    // 确定版本信息
    const versionToDetect =
      config.version || VersionDetector.getCurrentVersion();
    const versionInfo = VersionDetector.detectVersionType(versionToDetect);

    // 执行质量检查
    if (!config.skipChecks) {
      QualityChecker.runAllChecks();
    } else {
      Logger.warning("跳过质量检查");
    }

    // 执行发布流程
    let result: ReleaseResult;

    if (versionInfo.isPrerelease || config.prereleaseOnly) {
      result = await ReleaseExecutor.executePrerelease(config, versionInfo);
    } else {
      result = await ReleaseExecutor.executeRelease(config, versionInfo);
    }

    // 输出结果
    if (!config.isDryRun) {
      ResultReporter.reportResult(result);
    }

    Logger.success("NPM 发布流程完成");
  } catch (error: unknown) {
    Logger.error("发布过程中出现错误");
    if (error instanceof Error) {
      Logger.error(`错误详情: ${error.message}`);
    }
    process.exit(1);
  }
}

// 运行主函数
main();
