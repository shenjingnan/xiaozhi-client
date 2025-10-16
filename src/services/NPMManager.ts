import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
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
   * 获取可用版本列表
   */
  async getAvailableVersions(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        "npm view xiaozhi-client versions --json --registry=https://registry.npmmirror.com"
      );

      const versions = JSON.parse(stdout) as string[];

      // 过滤掉预发布版本（如果需要的话），这里我们保留所有版本
      // 按版本号降序排列（最新的在前）
      return versions
        .filter(version => version && typeof version === 'string')
        .sort((a, b) => {
          // 简单的版本号比较，将版本号按点分割后比较
          const aParts = a.split('.').map(Number);
          const bParts = b.split('.').map(Number);

          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aPart = aParts[i] || 0;
            const bPart = bParts[i] || 0;

            if (aPart !== bPart) {
              return bPart - aPart; // 降序排列
            }
          }
          return 0;
        });
    } catch (error) {
      this.logger.error("获取版本列表失败:", error);
      // 如果获取失败，返回一些默认版本
      return ["1.7.8", "1.7.7"];
    }
  }
}
