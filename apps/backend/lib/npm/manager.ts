/**
 * NPM 管理器
 *
 * 提供与 NPM 交互的功能，包括：
 * - 安装指定版本
 * - 获取当前版本
 * - 获取可用版本列表
 * - 检查最新版本
 *
 * @example
 * ```typescript
 * const npmManager = new NPMManager();
 * const versions = await npmManager.getAvailableVersions('stable');
 * await npmManager.installVersion('1.0.0');
 * ```
 */

import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { EventBus } from "@/services/event-bus.service.js";
import { getEventBus } from "@/services/event-bus.service.js";
import semver from "semver";

const execAsync = promisify(exec);

export class NPMManager {
  private eventBus: EventBus;

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus || getEventBus();
  }

  /**
   * 安装指定版本 - 这是核心功能
   */
  async installVersion(version: string): Promise<void> {
    const installId = `install-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    console.log("开始安装", { version, installId });

    // 发射安装开始事件
    this.eventBus.emitEvent("npm:install:started", {
      version,
      installId,
      timestamp: Date.now(),
    });

    const npmProcess = spawn("npm", [
      "install",
      "-g",
      `xiaozhi-client@${version}`,
      "--registry=https://registry.npmmirror.com",
    ]);

    return new Promise((resolve, reject) => {
      // 保存监听器引用以便清理
      const stdoutHandler = (data: Buffer) => {
        const message = data.toString();
        this.eventBus.emitEvent("npm:install:log", {
          version,
          installId,
          type: "stdout",
          message,
          timestamp: Date.now(),
        });
      };

      const stderrHandler = (data: Buffer) => {
        const message = data.toString();
        this.eventBus.emitEvent("npm:install:log", {
          version,
          installId,
          type: "stderr",
          message,
          timestamp: Date.now(),
        });
      };

      const closeHandler = (code: number | null) => {
        const duration = Date.now() - startTime;

        // 清理事件监听器
        npmProcess.stdout.off("data", stdoutHandler);
        npmProcess.stderr.off("data", stderrHandler);
        npmProcess.off("close", closeHandler);
        npmProcess.off("error", errorHandler);

        if (code === 0) {
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
          console.log(error);
          this.eventBus.emitEvent("npm:install:failed", {
            version,
            installId,
            error,
            duration,
            timestamp: Date.now(),
          });
          reject(new Error(error));
        }
      };

      const errorHandler = (error: Error) => {
        const errorMessage = `无法启动 npm 进程: ${error.message}`;

        // 清理事件监听器
        npmProcess.stdout.off("data", stdoutHandler);
        npmProcess.stderr.off("data", stderrHandler);
        npmProcess.off("close", closeHandler);
        npmProcess.off("error", errorHandler);

        console.log(errorMessage);
        this.eventBus.emitEvent("npm:install:failed", {
          version,
          installId,
          error: errorMessage,
          duration: Date.now() - startTime,
          timestamp: Date.now(),
        });
        reject(new Error(errorMessage));
      };

      // 添加事件监听器
      npmProcess.on("error", errorHandler);
      npmProcess.stdout.on("data", stdoutHandler);
      npmProcess.stderr.on("data", stderrHandler);
      npmProcess.on("close", closeHandler);
    });
  }

  /**
   * 获取当前版本
   */
  async getCurrentVersion(): Promise<string> {
    const { stdout } = await execAsync(
      "npm list -g xiaozhi-client --depth=0 --json --registry=https://registry.npmmirror.com"
    );
    const info = JSON.parse(stdout);
    return info.dependencies?.["xiaozhi-client"]?.version || "unknown";
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
    try {
      const { stdout } = await execAsync(
        "npm view xiaozhi-client versions --json --registry=https://registry.npmmirror.com"
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
      console.log("获取版本列表失败", { error });
      // 如果获取失败，返回一些默认版本
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
        console.log("版本比较失败", { error });
        // 如果比较失败，尝试字符串比较
        hasUpdate = latestVersion !== currentVersion;
      }

      console.log("版本检查完成", { currentVersion, latestVersion, hasUpdate });

      return {
        currentVersion,
        latestVersion,
        hasUpdate,
      };
    } catch (error) {
      console.log("检查最新版本失败", { error });
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
