/**
 * 服务管理服务
 */

import { ConfigError, ServiceError } from "../errors/index.js";
import type {
  ServiceManager as IServiceManager,
  ProcessManager,
  ServiceStartOptions,
  ServiceStatus,
} from "../interfaces/Service.js";
import { PathUtils } from "../utils/PathUtils.js";
import { PlatformUtils } from "../utils/PlatformUtils.js";
import { Validation } from "../utils/Validation.js";

/**
 * 服务管理器实现
 */
export class ServiceManagerImpl implements IServiceManager {
  constructor(
    private processManager: ProcessManager,
    private configManager: any,
    private logger: any
  ) {}

  /**
   * 数据库管理器实例（延迟初始化）
   */
  private databaseManager: any = null;

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
        console.log(`检测到服务已在运行 (PID: ${status.pid})，正在自动重启...`);

        try {
          // 优雅停止现有进程
          await this.processManager.gracefulKillProcess(status.pid!);

          // 清理 PID 文件
          this.processManager.cleanupPidFile();

          // 等待一下确保完全停止
          await new Promise((resolve) => setTimeout(resolve, 1000));

          console.log("现有服务已停止，正在启动新服务...");
        } catch (stopError) {
          console.warn(
            `停止现有服务时出现警告: ${stopError instanceof Error ? stopError.message : String(stopError)}`
          );
          // 继续尝试启动新服务，因为旧进程可能已经不存在了
        }
      }

      // 检查环境配置
      this.checkEnvironment();

      // 初始化数据库
      await this.initializeDatabase();

      // 根据模式启动服务
      switch (options.mode) {
        case "mcp-server":
          await this.startMcpServerMode(options);
          break;
        case "stdio":
          await this.startStdioMode(options);
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
      await this.processManager.gracefulKillProcess(status.pid!);

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
        await new Promise((resolve) => setTimeout(resolve, 1000));
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
  private checkEnvironment(): void {
    // 检查配置文件是否存在
    if (!this.configManager.configExists()) {
      throw ConfigError.configNotFound();
    }

    // 可以添加更多环境检查
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
    const { spawn } = await import("node:child_process");

    if (options.daemon) {
      // 后台模式
      await this.startWebServerInDaemon(options.ui || false);
    } else {
      // 前台模式
      await this.startWebServerInForeground(options.ui || false);
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
      this.processManager.savePidInfo(child.pid!, "daemon");

      // 完全分离子进程
      child.unref();

      // 输出启动信息后立即退出父进程
      console.log(
        `✅ MCP Server 已在后台启动 (PID: ${child.pid}, Port: ${port})`
      );
      console.log(`💡 使用 'xiaozhi status' 查看状态`);

      // 立即退出父进程，释放终端控制权
      process.exit(0);
    } else {
      // 前台模式 - 直接启动 MCP Server
      const { MCPServer } = await import("../../services/MCPServer.js");
      const server = new MCPServer(port);

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
   * 启动 stdio 模式
   */
  private async startStdioMode(options: ServiceStartOptions): Promise<void> {
    const { spawn } = await import("node:child_process");
    const mcpProxyPath = PathUtils.getMcpServerProxyPath();

    // 直接执行 mcpServerProxy，它已经支持 stdio
    const child = spawn("node", [mcpProxyPath], {
      stdio: "inherit",
      env: {
        ...process.env,
        XIAOZHI_CONFIG_DIR: PathUtils.getConfigDir(),
      },
    });

    // 保存 PID 信息
    this.processManager.savePidInfo(child.pid!, "foreground");
  }

  /**
   * 后台模式启动 WebServer
   */
  private async startWebServerInDaemon(openBrowser: boolean): Promise<void> {
    const { spawn } = await import("node:child_process");
    const webServerPath = PathUtils.getWebServerStandalonePath();

    const fs = await import("node:fs");
    if (!fs.default.existsSync(webServerPath)) {
      throw new ServiceError(`WebServer 文件不存在: ${webServerPath}`);
    }

    const args = [webServerPath];
    if (openBrowser) {
      args.push("--open-browser");
    }

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
    this.processManager.savePidInfo(child.pid!, "daemon");

    // 完全分离子进程
    child.unref();

    // 输出启动信息后立即退出父进程
    console.log(`✅ 后台服务已启动 (PID: ${child.pid})`);
    console.log(`💡 使用 'xiaozhi status' 查看状态`);
    console.log(`💡 使用 'xiaozhi attach' 查看日志`);

    // 立即退出父进程，释放终端控制权
    process.exit(0);
  }

  /**
   * 前台模式启动 WebServer
   */
  private async startWebServerInForeground(
    openBrowser: boolean
  ): Promise<void> {
    const { WebServer } = await import("../../WebServer.js");
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

    if (openBrowser) {
      const config = this.configManager.getConfig();
      const port = config?.webServer?.port || 9999;
      await this.openBrowserUrl(`http://localhost:${port}`);
    }
  }

  /**
   * 打开浏览器URL
   */
  private async openBrowserUrl(url: string): Promise<void> {
    try {
      const { spawn } = await import("node:child_process");
      const platform = PlatformUtils.getCurrentPlatform();

      let command: string;
      let args: string[];

      if (platform === "darwin") {
        command = "open";
        args = [url];
      } else if (platform === "win32") {
        command = "start";
        args = ["", url];
      } else {
        command = "xdg-open";
        args = [url];
      }

      spawn(command, args, { detached: true, stdio: "ignore" });
      console.log(`🌐 已尝试打开浏览器: ${url}`);
    } catch (error) {
      console.log(`⚠️  自动打开浏览器失败，请手动访问: ${url}`);
    }
  }

  /**
   * 初始化数据库服务
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // 从全局容器获取数据库管理器
      const { createContainer } = await import("../Container.js");
      const container = await createContainer();

      this.databaseManager = container.get("databaseManager");

      if (this.databaseManager) {
        console.log("✅ 数据库服务初始化成功");
      } else {
        console.log("ℹ️  数据库服务不可用，将在内存模式下运行");
      }
    } catch (error) {
      console.warn(
        "⚠️  数据库服务初始化失败:",
        error instanceof Error ? error.message : String(error)
      );
      this.databaseManager = null;
    }
  }

  /**
   * 获取数据库管理器实例
   */
  getDatabaseManager(): any {
    return this.databaseManager;
  }
}
