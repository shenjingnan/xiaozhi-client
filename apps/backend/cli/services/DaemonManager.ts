/**
 * 守护进程管理服务
 */

import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { ProcessError, ServiceError } from "@cli/errors/index.js";
import type {
  DaemonManager as IDaemonManager,
  ProcessManager,
} from "@cli/interfaces/Service.js";
import { PathUtils } from "@cli/utils/PathUtils.js";
import { PlatformUtils } from "@cli/utils/PlatformUtils.js";
import type { Logger } from "@root/Logger.js";
import type { WebServer } from "@root/WebServer.js";

/**
 * 守护进程选项
 */
export interface DaemonOptions {
  /** 日志文件名 */
  logFileName?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 是否打开浏览器 */
  openBrowser?: boolean;
  /** 工作目录 */
  cwd?: string;
}

/**
 * 守护进程管理器实现
 */
export class DaemonManagerImpl implements IDaemonManager {
  private currentDaemon: ChildProcess | null = null;

  constructor(
    private processManager: ProcessManager,
    private logger: Logger
  ) {}

  /**
   * 启动守护进程
   */
  async startDaemon(
    serverFactory: () => Promise<WebServer>,
    options: DaemonOptions = {}
  ): Promise<void> {
    try {
      // 检查是否已有守护进程在运行
      const status = this.processManager.getServiceStatus();
      if (status.running) {
        throw ServiceError.alreadyRunning(status.pid!);
      }

      // 启动守护进程
      const child = await this.spawnDaemonProcess(serverFactory, options);
      this.currentDaemon = child;

      // 保存 PID 信息
      this.processManager.savePidInfo(child.pid!, "daemon");

      // 设置日志重定向
      await this.setupLogging(child, options.logFileName || "xiaozhi.log");

      // 设置进程事件监听
      this.setupEventHandlers(child);

      // 分离进程
      child.unref();

      this.logger.info(`守护进程已启动 (PID: ${child.pid})`);
    } catch (error) {
      throw new ServiceError(
        `启动守护进程失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 停止守护进程
   */
  async stopDaemon(): Promise<void> {
    try {
      const status = this.processManager.getServiceStatus();

      if (!status.running) {
        throw ServiceError.notRunning();
      }

      // 优雅停止守护进程
      await this.processManager.gracefulKillProcess(status.pid!);

      // 清理 PID 文件
      this.processManager.cleanupPidFile();

      // 清理当前守护进程引用
      this.currentDaemon = null;

      this.logger.info("守护进程已停止");
    } catch (error) {
      throw new ServiceError(
        `停止守护进程失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 重启守护进程
   */
  async restartDaemon(
    serverFactory: () => Promise<WebServer>,
    options: DaemonOptions = {}
  ): Promise<void> {
    try {
      // 先停止现有守护进程
      const status = this.processManager.getServiceStatus();
      if (status.running) {
        await this.stopDaemon();
        // 等待一下确保完全停止
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // 重新启动守护进程
      await this.startDaemon(serverFactory, options);
    } catch (error) {
      throw new ServiceError(
        `重启守护进程失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 获取守护进程状态
   */
  getDaemonStatus(): { running: boolean; pid?: number; uptime?: string } {
    return this.processManager.getServiceStatus();
  }

  /**
   * 连接到守护进程日志
   */
  async attachToLogs(logFileName = "xiaozhi.log"): Promise<void> {
    try {
      const logFilePath = PathUtils.getLogFile();

      if (!fs.existsSync(logFilePath)) {
        throw new ServiceError("日志文件不存在");
      }

      // 使用平台相关的 tail 命令
      const { command, args } = PlatformUtils.getTailCommand(logFilePath);
      const tail = spawn(command, args, { stdio: "inherit" });

      // 处理中断信号
      process.on("SIGINT", () => {
        console.log("\n断开连接，服务继续在后台运行");
        tail.kill();
        process.exit(0);
      });

      tail.on("exit", () => {
        process.exit(0);
      });

      tail.on("error", (error) => {
        throw new ServiceError(`连接日志失败: ${error.message}`);
      });
    } catch (error) {
      throw new ServiceError(
        `连接日志失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 生成守护进程
   */
  private async spawnDaemonProcess(
    serverFactory: () => Promise<WebServer>,
    options: DaemonOptions
  ): Promise<ChildProcess> {
    // 获取启动脚本路径
    const scriptPath = PathUtils.getWebServerLauncherPath();

    // 构建启动参数
    const args = [scriptPath];
    if (options.openBrowser) {
      args.push("--open-browser");
    }

    // 构建环境变量
    const env = {
      ...process.env,
      XIAOZHI_CONFIG_DIR: PathUtils.getConfigDir(),
      XIAOZHI_DAEMON: "true",
      ...options.env,
    };

    // 启动子进程
    const child = spawn("node", args, {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env,
      cwd: options.cwd || process.cwd(),
    });

    if (!child.pid) {
      throw new ProcessError("无法启动守护进程", 0);
    }

    return child;
  }

  /**
   * 设置日志重定向
   */
  private async setupLogging(
    child: ChildProcess,
    logFileName: string
  ): Promise<void> {
    try {
      const logFilePath = PathUtils.getLogFile();

      // 确保日志目录存在
      const path = await import("node:path");
      const logDir = path.dirname(logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // 创建日志流
      const logStream = fs.createWriteStream(logFilePath, { flags: "a" });

      // 重定向标准输出和错误输出
      child.stdout?.pipe(logStream);
      child.stderr?.pipe(logStream);

      // 写入启动日志
      const timestamp = new Date().toISOString();
      logStream.write(`\n[${timestamp}] 守护进程启动 (PID: ${child.pid})\n`);
    } catch (error) {
      this.logger.warn(
        `设置日志重定向失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(child: ChildProcess): void {
    // 监听进程退出
    child.on("exit", (code, signal) => {
      if (code !== 0 && code !== null) {
        this.logger.error(`守护进程异常退出 (代码: ${code}, 信号: ${signal})`);
      } else {
        this.logger.info("守护进程正常退出");
      }

      // 清理 PID 文件
      this.processManager.cleanupPidFile();
      this.currentDaemon = null;
    });

    // 监听进程错误
    child.on("error", (error) => {
      this.logger.error(`守护进程错误: ${error.message}`);
      this.processManager.cleanupPidFile();
      this.currentDaemon = null;
    });

    // 监听进程断开连接
    child.on("disconnect", () => {
      this.logger.info("守护进程断开连接");
    });
  }

  /**
   * 检查守护进程健康状态
   */
  async checkHealth(): Promise<boolean> {
    try {
      const status = this.getDaemonStatus();

      if (!status.running || !status.pid) {
        return false;
      }

      // 检查进程是否真的在运行
      const processInfo = this.processManager.getProcessInfo(status.pid);
      return processInfo.exists && processInfo.isXiaozhi;
    } catch {
      return false;
    }
  }

  /**
   * 获取当前守护进程引用
   */
  getCurrentDaemon(): ChildProcess | null {
    return this.currentDaemon;
  }

  /**
   * 清理守护进程资源
   */
  cleanup(): void {
    if (this.currentDaemon) {
      try {
        this.currentDaemon.kill("SIGTERM");
      } catch (error) {
        this.logger.warn(
          `清理守护进程失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      this.currentDaemon = null;
    }
  }
}
