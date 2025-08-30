#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type SyncOptions, execaSync } from "execa";
import semver from "semver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

/**
 * 发布配置接口
 */
interface ReleaseConfig {
  version?: string;
  versionType?: "正式版" | "测试版" | "候选版";
  versionIncrement?: "patch" | "minor" | "major";
  isDryRun: boolean;
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
 * 自定义错误类型
 */
class VersionAlreadyExistsError extends Error {
  constructor(version: string) {
    super(`Version ${version} already exists in npm registry`);
    this.name = "VersionAlreadyExistsError";
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
        // 检查是否是 npm publish 的版本已存在错误
        if (
          command === "release-it" &&
          error.message.includes(
            "cannot publish over the previously published versions"
          )
        ) {
          // 从错误信息中提取版本号
          const versionMatch = error.message.match(
            /versions: ([^.]+\.[^.]+\.[^.\s]+(?:-[^\s]+)?)/
          );
          if (versionMatch) {
            throw new VersionAlreadyExistsError(versionMatch[1]);
          }
        }

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
 * 版本计算器
 */
class VersionCalculator {
  private static readonly PACKAGE_NAME = "xiaozhi-client";

  /**
   * 获取 npm 上的最新版本信息
   */
  static async getLatestVersions(): Promise<{
    latest: string;
    beta: string | null;
    rc: string | null;
  }> {
    try {
      // 获取所有版本
      const allVersionsOutput = CommandExecutor.runSilent("npm", [
        "view",
        VersionCalculator.PACKAGE_NAME,
        "versions",
        "--json",
      ]);

      const allVersions: string[] = JSON.parse(allVersionsOutput);

      // 获取最新正式版本
      const latestOutput = CommandExecutor.runSilent("npm", [
        "view",
        VersionCalculator.PACKAGE_NAME,
        "version",
      ]);
      const latest = latestOutput.trim();

      // 找到最新的 beta 版本
      const betaVersions = allVersions
        .filter((v) => v.includes("-beta."))
        .sort((a, b) => semver.compare(b, a));
      const beta = betaVersions.length > 0 ? betaVersions[0] : null;

      // 找到最新的 rc 版本
      const rcVersions = allVersions
        .filter((v) => v.includes("-rc."))
        .sort((a, b) => semver.compare(b, a));
      const rc = rcVersions.length > 0 ? rcVersions[0] : null;

      Logger.info("当前 npm 版本状态:");
      Logger.info(`  正式版: ${latest}`);
      Logger.info(`  beta: ${beta || "无"}`);
      Logger.info(`  rc: ${rc || "无"}`);

      return { latest, beta, rc };
    } catch (error) {
      Logger.error("获取 npm 版本信息失败");
      throw error;
    }
  }

  /**
   * 计算目标版本号
   */
  static async calculateTargetVersion(
    versionType: "正式版" | "测试版" | "候选版",
    versionIncrement: "patch" | "minor" | "major"
  ): Promise<string> {
    Logger.info(`计算目标版本: ${versionType} + ${versionIncrement}`);

    const { latest, beta, rc } = await VersionCalculator.getLatestVersions();

    let targetVersion: string;

    if (versionType === "正式版") {
      // 正式版：基于最新正式版本递增
      targetVersion = semver.inc(latest, versionIncrement)!;
    } else if (versionType === "测试版") {
      // beta 版本逻辑
      const baseVersion = semver.inc(latest, versionIncrement)!;

      if (beta) {
        const betaBase = `${semver.major(beta)}.${semver.minor(
          beta
        )}.${semver.patch(beta)}`;
        const targetBase = `${semver.major(baseVersion)}.${semver.minor(
          baseVersion
        )}.${semver.patch(baseVersion)}`;

        if (betaBase === targetBase) {
          // 如果 beta 版本的基础版本号与目标版本号相同，递增 beta 序号
          const betaMatch = beta.match(/-beta\.(\d+)$/);
          const betaNumber = betaMatch ? Number.parseInt(betaMatch[1]) : 0;
          targetVersion = `${targetBase}-beta.${betaNumber + 1}`;
        } else {
          // 如果不同，创建新的 beta.0
          targetVersion = `${baseVersion}-beta.0`;
        }
      } else {
        // 没有 beta 版本，创建新的 beta.0
        targetVersion = `${baseVersion}-beta.0`;
      }
    } else {
      // rc 版本逻辑
      const baseVersion = semver.inc(latest, versionIncrement)!;

      if (rc) {
        const rcBase = `${semver.major(rc)}.${semver.minor(rc)}.${semver.patch(
          rc
        )}`;
        const targetBase = `${semver.major(baseVersion)}.${semver.minor(
          baseVersion
        )}.${semver.patch(baseVersion)}`;

        if (rcBase === targetBase) {
          // 如果 rc 版本的基础版本号与目标版本号相同，递增 rc 序号
          const rcMatch = rc.match(/-rc\.(\d+)$/);
          const rcNumber = rcMatch ? Number.parseInt(rcMatch[1]) : 0;
          targetVersion = `${targetBase}-rc.${rcNumber + 1}`;
        } else {
          // 如果不同，创建新的 rc.0
          targetVersion = `${baseVersion}-rc.0`;
        }
      } else {
        // 没有 rc 版本，创建新的 rc.0
        targetVersion = `${baseVersion}-rc.0`;
      }
    }

    Logger.success(`计算得到目标版本: ${targetVersion}`);
    return targetVersion;
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
    Logger.step(4, "构建项目");
    CommandExecutor.runWithRetry("pnpm", ["run", "build"]);

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
    const versionExists = await VersionChecker.checkVersionExists(
      versionToCheck
    );

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

    try {
      CommandExecutor.run("release-it", releaseArgs);

      const finalVersion = VersionDetector.getCurrentVersion();

      // 验证版本是否成功发布到 npm registry
      Logger.info("验证版本是否成功发布到 npm registry...");
      const publishSuccess = await VersionChecker.checkVersionExists(
        finalVersion
      );

      if (publishSuccess) {
        Logger.success("预发布版本发布成功");
        return {
          success: true,
          version: finalVersion,
          skipped: false,
          isPrerelease: true,
        };
      }
      Logger.error("版本更新成功但 npm 发布失败");
      throw new Error(`版本 ${finalVersion} 未能成功发布到 npm registry`);
    } catch (error) {
      Logger.error("发布过程中出现错误");
      throw error;
    }
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
    const versionExists = await VersionChecker.checkVersionExists(
      versionToCheck
    );

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

    try {
      CommandExecutor.run("release-it", releaseArgs);

      const finalVersion = VersionDetector.getCurrentVersion();

      // 验证版本是否成功发布到 npm registry
      Logger.info("验证版本是否成功发布到 npm registry...");
      const publishSuccess = await VersionChecker.checkVersionExists(
        finalVersion
      );

      if (publishSuccess) {
        Logger.success("正式版本发布成功");
        return {
          success: true,
          version: finalVersion,
          skipped: false,
          isPrerelease: false,
        };
      }
      Logger.error("版本更新成功但 npm 发布失败");
      throw new Error(`版本 ${finalVersion} 未能成功发布到 npm registry`);
    } catch (error) {
      Logger.error("发布过程中出现错误");
      throw error;
    }
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

    CommandExecutor.run("release-it", releaseArgs);

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
      prereleaseOnly: false,
      checkVersionOnly: false,
    };

    // 解析参数
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === "--dry-run") {
        config.isDryRun = true;
      } else if (arg === "--prerelease-only") {
        config.prereleaseOnly = true;
      } else if (arg === "--check-version" || arg === "-c") {
        config.checkVersionOnly = true;
      } else if (arg.startsWith("--version-type=")) {
        const value = arg.split("=")[1] as "正式版" | "测试版" | "候选版";
        config.versionType = value;
      } else if (arg.startsWith("--version-increment=")) {
        const value = arg.split("=")[1] as "patch" | "minor" | "major";
        config.versionIncrement = value;
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
  --version-type=TYPE    版本类型 (正式版|测试版|候选版)
  --version-increment=INC 版本增量 (patch|minor|major)
  --dry-run              预演模式（仅预览，不实际发布）
  --prerelease-only      仅执行预发布流程
  --check-version, -c    仅检查版本是否存在于 npm registry
  --help, -h             显示此帮助信息

示例:
  npm-release.ts --version-type=测试版 --version-increment=patch    # 自动计算 beta 版本
  npm-release.ts --version-type=正式版 --version-increment=minor    # 自动计算正式版本
  npm-release.ts 1.0.0                                           # 发布指定版本号
  npm-release.ts 1.0.0-beta.1                                    # 发布预发布版本
  npm-release.ts patch --dry-run                                 # 预演模式递增补丁版本
  npm-release.ts --check-version                                 # 检查当前版本是否已存在

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

      let versionToCheck: string;

      if (config.versionType && config.versionIncrement) {
        // 使用新的自动计算逻辑
        Logger.info(`版本类型: ${config.versionType}`);
        Logger.info(`版本增量: ${config.versionIncrement}`);

        versionToCheck = await VersionCalculator.calculateTargetVersion(
          config.versionType,
          config.versionIncrement
        );
      } else {
        // 使用指定的版本号或当前版本号
        versionToCheck = config.version || VersionDetector.getCurrentVersion();
      }

      const result = await VersionChecker.checkVersionStandalone(
        versionToCheck
      );

      // 根据检查结果设置退出码（兼容原 shell 脚本的行为）
      process.exit(result.exists ? 0 : 1);
    }

    Logger.rocket("开始 NPM 发布流程");
    Logger.info(`预演模式: ${config.isDryRun}`);
    Logger.info(`仅预发布: ${config.prereleaseOnly}`);

    // 确定版本号
    let targetVersion: string;

    if (config.versionType && config.versionIncrement) {
      // 使用新的自动计算逻辑
      Logger.info(`版本类型: ${config.versionType}`);
      Logger.info(`版本增量: ${config.versionIncrement}`);

      targetVersion = await VersionCalculator.calculateTargetVersion(
        config.versionType,
        config.versionIncrement
      );

      // 更新配置中的版本号
      config.version = targetVersion;
    } else if (config.version) {
      // 使用指定的版本号
      targetVersion = config.version;
      Logger.info(`指定版本: ${config.version}`);
    } else {
      // 使用当前版本号
      targetVersion = VersionDetector.getCurrentVersion();
      Logger.info(`使用当前版本: ${targetVersion}`);
    }

    // 确定版本信息
    const versionInfo = VersionDetector.detectVersionType(targetVersion);

    // 执行构建
    QualityChecker.runAllChecks();

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
