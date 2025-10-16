import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import semver from "semver";
import { logger } from "../Logger.js";
import { type EventBus, getEventBus } from "./EventBus.js";

const execAsync = promisify(exec);

export class NPMManager {
  private logger = logger.withTag("NPMManager");
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

    this.logger.info(`开始安装: xiaozhi-client@${version} [${installId}]`);

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
      npmProcess.stdout.on("data", (data) => {
        const message = data.toString();
        console.log(message);

        // 发射日志事件
        this.eventBus.emitEvent("npm:install:log", {
          version,
          installId,
          type: "stdout",
          message,
          timestamp: Date.now(),
        });
      });

      npmProcess.stderr.on("data", (data) => {
        const message = data.toString();
        console.log(message);

        // 发射日志事件
        this.eventBus.emitEvent("npm:install:log", {
          version,
          installId,
          type: "stderr",
          message,
          timestamp: Date.now(),
        });
      });

      npmProcess.on("close", (code) => {
        const duration = Date.now() - startTime;

        if (code === 0) {
          console.log("安装完成！");

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
          console.log(error);

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
    STABLE: 'stable',
    RC: 'rc',
    BETA: 'beta',
    ALL: 'all'
  } as const;

  /**
   * 获取可用版本列表
   */
  async getAvailableVersions(type = 'stable'): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        "npm view xiaozhi-client versions --json --registry=https://registry.npmmirror.com"
      );

      const versions = JSON.parse(stdout) as string[];

      // 使用 semver 验证并过滤有效版本
      let filteredVersions = versions.filter(version => {
        return version && typeof version === 'string' && semver.valid(version);
      });

      // 根据类型过滤版本
      if (type !== 'all') {
        filteredVersions = filteredVersions.filter(version => {
          const prerelease = semver.prerelease(version);

          if (type === 'stable') {
            // 正式版：没有预发布标识符的版本 (x.y.z)
            return prerelease === null;
          }

          if (type === 'rc') {
            // 预览版：预发布标识符以 rc 开头
            return prerelease !== null && prerelease[0]?.toString()?.toLowerCase()?.startsWith('rc') === true;
          }

          if (type === 'beta') {
            // 测试版：预发布标识符以 beta 开头
            return prerelease !== null && prerelease[0]?.toString()?.toLowerCase()?.startsWith('beta') === true;
          }

          return true;
        });
      }

      // 进行降序排列（最新的在前）
      return filteredVersions.sort((a, b) => semver.rcompare(a, b));
    } catch (error) {
      this.logger.error("获取版本列表失败:", error);
      // 如果获取失败，返回一些默认版本
      return [];
    }
  }
}
