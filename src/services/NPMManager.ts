import { exec } from "node:child_process";
import { promisify } from "node:util";
import crossSpawn from "cross-spawn";
import semver from "semver";
import { logger } from "../Logger.js";
import { PlatformUtils } from "../cli/utils/PlatformUtils.js";
import { type EventBus, getEventBus } from "./EventBus.js";

const execAsync = promisify(exec);

export class NPMManager {
  private logger = logger.withTag("NPMManager");
  private eventBus: EventBus;

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus || getEventBus();
  }

  /**
   * 获取跨平台的npm命令
   */
  private getNpmCommand(): string {
    // cross-spawn 会自动处理Windows下的.cmd扩展名
    return "npm";
  }

  /**
   * 检查npm命令是否可用
   */
  private async checkNpmAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const npmCommand = this.getNpmCommand();
      const child = crossSpawn(npmCommand, ["--version"], {
        stdio: "ignore",
        shell: false,
      });

      child.on("close", (code) => {
        resolve(code === 0);
      });

      child.on("error", () => {
        resolve(false);
      });
    });
  }

  /**
   * 获取详细的错误信息，帮助用户诊断问题
   */
  private getDetailedErrorMessage(error: any): string {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorMsg.includes("ENOENT") || errorMsg.includes("not found")) {
      const platform = PlatformUtils.getCurrentPlatform();
      const systemInfo = PlatformUtils.getSystemInfo();

      let helpMessage = "无法找到 npm 命令。请检查以下项目：\n";
      helpMessage += `1. 确保已安装 Node.js 和 npm (当前平台: ${platform})\n`;
      helpMessage += "2. 确保 npm 在系统 PATH 环境变量中\n";
      helpMessage += `3. 检查 Node.js 安装是否完整 (当前版本: ${systemInfo.nodeVersion})\n`;

      if (PlatformUtils.isWindows()) {
        helpMessage += "Windows 专用检查:\n";
        helpMessage += `- 尝试在命令提示符中运行 'npm --version'\n`;
        helpMessage += "- 检查环境变量 PATH 是否包含 Node.js 安装目录\n";
        helpMessage += "- 重新安装 Node.js 可能会解决问题\n";
      } else {
        helpMessage += "Unix/Linux/macOS 专用检查:\n";
        helpMessage += `- 尝试在终端中运行 'which npm' 和 'npm --version'\n`;
        helpMessage += "- 检查 ~/.bashrc 或 ~/.zshrc 中的 PATH 设置\n";
        helpMessage += "- 确保 Node.js 安装目录在 PATH 中\n";
      }

      return helpMessage;
    }

    return errorMsg;
  }

  /**
   * 安装指定版本 - 这是核心功能
   */
  async installVersion(version: string): Promise<void> {
    const installId = `install-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    this.logger.info(`开始安装: xiaozhi-client@${version} [${installId}]`);

    // 检查npm命令是否可用
    const npmAvailable = await this.checkNpmAvailable();
    if (!npmAvailable) {
      const errorMsg = this.getDetailedErrorMessage(new Error("npm命令不可用"));
      this.logger.error(errorMsg);

      // 发射安装失败事件
      this.eventBus.emitEvent("npm:install:failed", {
        version,
        installId,
        error: errorMsg,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      });

      throw new Error(errorMsg);
    }

    // 发射安装开始事件
    this.eventBus.emitEvent("npm:install:started", {
      version,
      installId,
      timestamp: Date.now(),
    });

    const npmCommand = this.getNpmCommand();
    this.logger.debug(`使用npm命令: ${npmCommand}`);

    const npmProcess = crossSpawn(
      npmCommand,
      [
        "install",
        "-g",
        `xiaozhi-client@${version}`,
        "--registry=https://registry.npmmirror.com",
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      }
    );

    return new Promise((resolve, reject) => {
      npmProcess.stdout?.on("data", (data) => {
        const message = data.toString();

        // 发射日志事件
        this.eventBus.emitEvent("npm:install:log", {
          version,
          installId,
          type: "stdout",
          message,
          timestamp: Date.now(),
        });
      });

      npmProcess.stderr?.on("data", (data) => {
        const message = data.toString();

        // 发射日志事件
        this.eventBus.emitEvent("npm:install:log", {
          version,
          installId,
          type: "stderr",
          message,
          timestamp: Date.now(),
        });
      });

      npmProcess.on("error", (error) => {
        const errorMsg = this.getDetailedErrorMessage(error);
        this.logger.error("npm进程启动失败:", errorMsg);

        // 发射安装失败事件
        this.eventBus.emitEvent("npm:install:failed", {
          version,
          installId,
          error: errorMsg,
          duration: Date.now() - startTime,
          timestamp: Date.now(),
        });

        reject(new Error(errorMsg));
      });

      npmProcess.on("close", (code) => {
        const duration = Date.now() - startTime;

        if (code === 0) {
          // 发射安装完成事件
          this.eventBus.emitEvent("npm:install:completed", {
            version,
            installId,
            success: true,
            duration,
            timestamp: Date.now(),
          });

          resolve();
        } else {
          const error = `安装失败，退出码: ${code}`;
          this.logger.error(error);

          // 发射安装失败事件
          this.eventBus.emitEvent("npm:install:failed", {
            version,
            installId,
            error,
            duration,
            timestamp: Date.now(),
          });

          reject(new Error(error));
        }
      });
    });
  }

  /**
   * 获取当前版本
   */
  async getCurrentVersion(): Promise<string> {
    // 检查npm命令是否可用
    const npmAvailable = await this.checkNpmAvailable();
    if (!npmAvailable) {
      this.logger.error("npm命令不可用，无法获取当前版本");
      return "unknown";
    }

    try {
      const npmCommand = this.getNpmCommand();
      const { stdout } = await execAsync(
        `${npmCommand} list -g xiaozhi-client --depth=0 --json --registry=https://registry.npmmirror.com`
      );
      const info = JSON.parse(stdout);
      return info.dependencies?.["xiaozhi-client"]?.version || "unknown";
    } catch (error) {
      const errorMsg = this.getDetailedErrorMessage(error);
      this.logger.error("获取当前版本失败:", errorMsg);
      return "unknown";
    }
  }

  /**
   * 版本类型枚举
   */
  static readonly VERSION_TYPES = {
    STABLE: "stable",
    RC: "rc",
    BETA: "beta",
    ALL: "all",
  } as const;

  /**
   * 获取可用版本列表
   */
  async getAvailableVersions(type = "stable"): Promise<string[]> {
    // 检查npm命令是否可用
    const npmAvailable = await this.checkNpmAvailable();
    if (!npmAvailable) {
      this.logger.error("npm命令不可用，无法获取可用版本列表");
      return [];
    }

    try {
      const npmCommand = this.getNpmCommand();
      const { stdout } = await execAsync(
        `${npmCommand} view xiaozhi-client versions --json --registry=https://registry.npmmirror.com`
      );

      const versions = JSON.parse(stdout) as string[];

      // 使用 semver 验证并过滤有效版本
      let filteredVersions = versions.filter((version) => {
        return version && typeof version === "string" && semver.valid(version);
      });

      // 根据类型过滤版本
      if (type !== "all") {
        filteredVersions = filteredVersions.filter((version) => {
          const prerelease = semver.prerelease(version);

          if (type === "stable") {
            // 正式版：没有预发布标识符的版本 (x.y.z)
            return prerelease === null;
          }

          if (type === "rc") {
            // 预览版：预发布标识符以 rc 开头
            return (
              prerelease !== null &&
              prerelease[0]?.toString()?.toLowerCase()?.startsWith("rc") ===
                true
            );
          }

          if (type === "beta") {
            // 测试版：预发布标识符以 beta 开头
            return (
              prerelease !== null &&
              prerelease[0]?.toString()?.toLowerCase()?.startsWith("beta") ===
                true
            );
          }

          return true;
        });
      }

      // 进行降序排列（最新的在前）
      return filteredVersions.sort((a, b) => semver.rcompare(a, b));
    } catch (error) {
      const errorMsg = this.getDetailedErrorMessage(error);
      this.logger.error("获取版本列表失败:", errorMsg);
      // 如果获取失败，返回空数组
      return [];
    }
  }

  /**
   * 检查是否有最新版本
   * 返回当前版本、最新版本以及是否有更新
   */
  async checkForLatestVersion(): Promise<{
    currentVersion: string;
    latestVersion: string | null;
    hasUpdate: boolean;
    error?: string;
  }> {
    try {
      // 获取当前版本
      const currentVersion = await this.getCurrentVersion();

      // 如果无法获取当前版本，返回错误
      if (!currentVersion || currentVersion === "unknown") {
        return {
          currentVersion: "unknown",
          latestVersion: null,
          hasUpdate: false,
          error: "无法获取当前版本信息",
        };
      }

      // 获取最新的正式版本
      const stableVersions = await this.getAvailableVersions("stable");

      if (stableVersions.length === 0) {
        return {
          currentVersion,
          latestVersion: null,
          hasUpdate: false,
          error: "无法获取可用版本列表",
        };
      }

      // 获取最新的正式版本（第一个元素）
      const latestVersion = stableVersions[0];

      // 比较版本
      let hasUpdate = false;
      try {
        // 使用 semver 比较版本
        hasUpdate = semver.gt(latestVersion, currentVersion);
      } catch (error) {
        this.logger.warn("版本比较失败:", error);
        // 如果比较失败，尝试字符串比较
        hasUpdate = latestVersion !== currentVersion;
      }

      this.logger.info(
        `版本检查完成: 当前版本 ${currentVersion}, 最新版本 ${latestVersion}, 有更新: ${hasUpdate}`
      );

      return {
        currentVersion,
        latestVersion,
        hasUpdate,
      };
    } catch (error) {
      this.logger.error("检查最新版本失败:", error);
      return {
        currentVersion: "unknown",
        latestVersion: null,
        hasUpdate: false,
        error:
          error instanceof Error ? error.message : "检查更新时发生未知错误",
      };
    }
  }
}
