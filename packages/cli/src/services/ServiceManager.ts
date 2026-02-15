/**
 * 服务管理服务
 */

import type { ConfigManager } from "@xiaozhi-client/config";
import { ConfigInitializer } from "@xiaozhi-client/config";
import consola from "consola";
import { RETRY_CONSTANTS } from "../Constants";
import { ConfigError, ServiceError } from "../errors/index";
import type {
  ServiceManager as IServiceManager,
  ProcessManager,
  ServiceStartOptions,
  ServiceStatus,
} from "../interfaces/Service";
import { PathUtils } from "../utils/PathUtils";
import { Validation } from "../utils/Validation";

/**
 * 服务管理器实现
 */
export class ServiceManagerImpl implements IServiceManager {
  constructor(
    private processManager: ProcessManager,
    private configManager: ConfigManager
  ) {}

  /**
   * 启动服务
   */
  async start(options: ServiceStartOptions): Promise<void> {
    try {
      // 验证启动选项
      this.validateStartOptions(options);

      // 清理容器环境状态
      this.processManager.cleanupContainerState();

      // 检查服务是否已经在运行
      const status = this.getStatus();
      if (status.running) {
        // 自动停止现有服务并重新启动
        consola.info(
          `检测到服务已在运行 (PID: ${status.pid})，正在自动重启...`
        );

        try {
          // 优雅停止现有进程
          await this.processManager.gracefulKillProcess(status.pid || 0);

          // 清理 PID 文件
          this.processManager.cleanupPidFile();

          // 等待一下确保完全停止
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_CONSTANTS.DEFAULT_INTERVAL)
          );

          consola.success("现有服务已停止，正在启动新服务...");
        } catch (stopError) {
          consola.warn(
            `停止现有服务时出现警告: ${stopError instanceof Error ? stopError.message : String(stopError)}`
          );
          // 继续尝试启动新服务，因为旧进程可能已经不存在了
        }
      }

      // 检查环境配置
      await this.checkEnvironment();

      // 根据模式启动服务
      switch (options.mode) {
        case "mcp-server":
          await this.startMcpServerMode(options);
          break;
        case "stdio":
          // stdio 模式已废弃，改为启动 Web 服务
          await this.startNormalMode(options);
          break;
        case "normal":
          await this.startNormalMode(options);
          break;
        default:
          await this.startNormalMode(options);
          break;
      }
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw ServiceError.startFailed(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 停止服务
   */
  async stop(): Promise<void> {
    try {
      const status = this.getStatus();

      if (!status.running) {
        throw ServiceError.notRunning();
      }

      // 优雅停止进程
      await this.processManager.gracefulKillProcess(status.pid || 0);

      // 清理 PID 文件
      this.processManager.cleanupPidFile();
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError(
        `停止服务失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 重启服务
   */
  async restart(options: ServiceStartOptions): Promise<void> {
    try {
      // 先停止服务
      const status = this.getStatus();
      if (status.running) {
        await this.stop();
        // 等待一下确保完全停止
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_CONSTANTS.DEFAULT_INTERVAL)
        );
      }

      // 重新启动服务
      await this.start(options);
    } catch (error) {
      throw new ServiceError(
        `重启服务失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 获取服务状态
   */
  getStatus(): ServiceStatus {
    return this.processManager.getServiceStatus();
  }

  /**
   * 验证启动选项
   */
  private validateStartOptions(options: ServiceStartOptions): void {
    if (options.port !== undefined) {
      Validation.validatePort(options.port);
    }

    if (
      options.mode &&
      !["normal", "mcp-server", "stdio"].includes(options.mode)
    ) {
      throw new ServiceError(`无效的运行模式: ${options.mode}`);
    }
  }

  /**
   * 检查环境配置
   */
  private async checkEnvironment(): Promise<void> {
    // 检查配置文件是否存在
    if (!this.configManager.configExists()) {
      // 尝试初始化默认配置
      try {
        consola.info("未找到配置文件，正在创建默认配置...");

        const configPath = await ConfigInitializer.initializeDefaultConfig();

        consola.success(`默认配置已创建: ${configPath}`);
        consola.info("提示: 您可以稍后编辑此配置文件以自定义设置");

        // 重新加载配置管理器
        this.configManager.reloadConfig();
      } catch (error) {
        // 保留原始错误信息，方便调试
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        consola.error(`创建默认配置失败: ${errorMessage}`);

        // 抛出包含原始错误信息的异常
        throw new ConfigError(
          `无法创建默认配置: ${errorMessage}\n请手动运行 'xiaozhi create' 创建配置文件`
        );
      }
    }

    // 验证配置文件
    try {
      const config = this.configManager.getConfig();
      if (!config) {
        throw new ConfigError("配置文件无效");
      }
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }
      throw new ConfigError(
        `配置文件错误: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 启动普通模式
   */
  private async startNormalMode(options: ServiceStartOptions): Promise<void> {
    if (options.daemon) {
      // 后台模式 - 默认启动 WebUI
      await this.startWebServerInDaemon();
    } else {
      // 前台模式 - 默认启动 WebUI
      await this.startWebServerInForeground();
    }
  }

  /**
   * 启动 MCP Server 模式
   */
  private async startMcpServerMode(
    options: ServiceStartOptions
  ): Promise<void> {
    const port = options.port || 3000;
    const { spawn } = await import("node:child_process");

    if (options.daemon) {
      // 后台模式
      const scriptPath = PathUtils.getExecutablePath("cli");
      const child = spawn(
        "node",
        [scriptPath, "start", "--server", port.toString()],
        {
          detached: true,
          stdio: ["ignore", "ignore", "ignore"], // 完全忽略所有 stdio，避免阻塞
          env: {
            ...process.env,
            XIAOZHI_CONFIG_DIR: PathUtils.getConfigDir(),
            XIAOZHI_DAEMON: "true",
            MCP_SERVER_MODE: "true",
          },
        }
      );

      // 保存 PID 信息
      this.processManager.savePidInfo(child.pid || 0, "daemon");

      // 完全分离子进程
      child.unref();

      // 输出启动信息后立即退出父进程
      consola.success(
        `MCP Server 已在后台启动 (PID: ${child.pid}, Port: ${port})`
      );
      consola.info("使用 'xiaozhi status' 查看状态");

      // 立即退出父进程，释放终端控制权
      process.exit(0);
    } else {
      // 前台模式 - 直接启动 Web Server
      const { WebServer } = await import("@/WebServer");
      const server = new WebServer(port);

      // 处理退出信号
      const cleanup = async () => {
        await server.stop();
        process.exit(0);
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      await server.start();
    }
  }

  /**
   * 后台模式启动 WebServer
   */
  private async startWebServerInDaemon(): Promise<void> {
    const { spawn } = await import("node:child_process");
    const webServerPath = PathUtils.getWebServerLauncherPath();

    const fs = await import("node:fs");
    if (!fs.default.existsSync(webServerPath)) {
      throw new ServiceError(`WebServer 文件不存在: ${webServerPath}`);
    }

    const args = [webServerPath];

    const child = spawn("node", args, {
      detached: true,
      stdio: ["ignore", "ignore", "ignore"], // 完全忽略所有 stdio，避免阻塞
      env: {
        ...process.env,
        XIAOZHI_CONFIG_DIR: PathUtils.getConfigDir(),
        XIAOZHI_DAEMON: "true",
      },
    });

    // 保存 PID 信息
    this.processManager.savePidInfo(child.pid || 0, "daemon");

    // 完全分离子进程
    child.unref();

    // 输出启动信息后立即退出父进程
    consola.success(`后台服务已启动 (PID: ${child.pid})`);
    consola.info("使用 'xiaozhi status' 查看状态");
    consola.info("使用 'xiaozhi attach' 查看日志");

    // 立即退出父进程，释放终端控制权
    process.exit(0);
  }

  /**
   * 前台模式启动 WebServer
   */
  private async startWebServerInForeground(): Promise<void> {
    const { WebServer } = await import("@/WebServer");
    const server = new WebServer();

    // 处理退出信号
    const cleanup = async () => {
      await server.stop();
      this.processManager.cleanupPidFile();
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // 保存 PID 信息
    this.processManager.savePidInfo(process.pid, "foreground");

    await server.start();
  }
}
