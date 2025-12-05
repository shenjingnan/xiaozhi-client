import { EventEmitter } from "node:events";
import { ProxyMCPServer } from "@/lib/endpoint/ProxyMCPServer.js";
import type { MCPServiceManager } from "@/lib/mcp";
import type { WebServer } from "@root/WebServer.js";
import { Logger } from "../Logger.js";
import { configManager } from "../configManager.js";

const logger = new Logger();

/**
 * MCP 服务器类（重构版）
 * 现在直接使用 WebServer 实现实例化的 HTTP 服务器
 * 保持向后兼容的 API，但内部使用新的 WebServer 架构
 */
export class MCPServer extends EventEmitter {
  private serviceManager: MCPServiceManager | null = null;
  private proxyMCPServer: ProxyMCPServer | null = null;
  private webServer: WebServer | null = null;
  private port: number;
  private isStarted = false;

  constructor(port = 3000) {
    super();
    this.port = port;
  }

  /**
   * 初始化服务管理器
   */
  private async initializeServiceManager(): Promise<void> {
    if (this.serviceManager) {
      return;
    }

    logger.info("初始化 MCP 服务管理器");

    try {
      // 创建服务管理器实例
      const { MCPServiceManager } = await import("@/lib/mcp");
      this.serviceManager = new MCPServiceManager();
      await this.serviceManager.start();

      logger.info(`MCP 服务管理器创建成功，端口: ${this.port}`);

      // 转发服务管理器的事件
      this.serviceManager.on("started", () => this.emit("started"));
      this.serviceManager.on("stopped", () => this.emit("stopped"));
      this.serviceManager.on("transportRegistered", (data) => {
        this.emit("connectionRegistered", data);
      });

      logger.debug("MCP 服务管理器初始化完成");
    } catch (error) {
      logger.error("初始化 MCP 服务管理器失败", error);
      throw error;
    }
  }

  /**
   * 初始化 Web 服务器
   */
  private async initializeWebServer(): Promise<void> {
    if (this.webServer) {
      return;
    }

    logger.info("初始化 Web 服务器");

    try {
      // 动态导入 WebServer 以避免循环依赖
      const { WebServer } = await import("../WebServer.js");

      // 创建 WebServer 实例（WebServer 构造函数只接受端口参数）
      this.webServer = new WebServer(this.port);

      // 启动 Web 服务器
      await this.webServer.start();

      logger.info(`Web 服务器启动成功，端口: ${this.port}`);
    } catch (error) {
      logger.error("初始化 Web 服务器失败", error);
      throw error;
    }
  }

  /**
   * 初始化小智接入点连接
   */
  private async initializeMCPClient(): Promise<void> {
    try {
      // 获取小智接入点配置
      let mcpEndpoint: string | null = null;
      try {
        if (configManager.configExists()) {
          const endpoints = configManager.getMcpEndpoints();
          mcpEndpoint =
            endpoints.find((ep) => ep && !ep.includes("<请填写")) || null;
        }
      } catch (error) {
        logger.warn("从配置中读取小智接入点失败:", error);
      }

      // 只有在配置了有效端点时才启动连接
      if (mcpEndpoint) {
        this.proxyMCPServer = new ProxyMCPServer(mcpEndpoint);

        // 设置服务管理器
        if (this.serviceManager) {
          this.proxyMCPServer.setServiceManager(this.serviceManager);
        }

        await this.proxyMCPServer.connect();
        logger.debug("小智接入点连接成功");
      } else {
        logger.debug("未配置有效的小智接入点，跳过连接");
      }
    } catch (error) {
      logger.error("初始化小智接入点连接失败:", error);
    }
  }

  /**
   * 启动服务器
   */
  public async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn("服务器已启动");
      return;
    }

    try {
      // 初始化服务管理器
      await this.initializeServiceManager();

      // 初始化 Web 服务器
      await this.initializeWebServer();

      // 初始化小智接入点连接（不阻塞服务器启动）
      this.initializeMCPClient().catch((error) => {
        logger.error("初始化小智接入点连接失败:", error);
      });

      this.isStarted = true;
      this.emit("started");
      logger.info(`MCP 服务器启动成功，端口: ${this.port}`);
    } catch (error) {
      logger.error("启动 MCP 服务器失败:", error);
      throw error;
    }
  }

  /**
   * 停止服务器
   */
  public async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn("服务器未启动");
      return;
    }

    try {
      logger.info("停止 MCP 服务器");

      // 停止 Web 服务器
      if (this.webServer) {
        await this.webServer.stop();
        this.webServer = null;
      }

      // 停止服务管理器
      if (this.serviceManager) {
        await this.serviceManager.stop();
      }

      // 停止小智接入点连接
      if (this.proxyMCPServer) {
        this.proxyMCPServer.disconnect();
        this.proxyMCPServer = null;
      }

      this.isStarted = false;
      this.emit("stopped");
      logger.info("MCP 服务器已停止");
    } catch (error) {
      logger.error("停止 MCP 服务器失败:", error);
      throw error;
    }
  }

  /**
   * 获取服务管理器（向后兼容）
   */
  getServiceManager() {
    return this.serviceManager || null;
  }

  /**
   * 获取消息处理器（向后兼容）
   */
  getMessageHandler() {
    return this.serviceManager?.getMessageHandler() || null;
  }

  /**
   * 获取服务器状态
   */
  getStatus() {
    if (!this.serviceManager) {
      return {
        isRunning: false,
        port: this.port,
        mode: "mcp-server",
      };
    }

    const status = this.serviceManager.getStatus();
    return {
      ...status,
      port: this.port,
      mode: "mcp-server",
      proxyConnected: this.proxyMCPServer !== null,
    };
  }

  /**
   * 检查服务器是否正在运行
   */
  isRunning(): boolean {
    return (
      this.isStarted &&
      (this.serviceManager?.isServerRunning() || false) &&
      this.webServer !== null
    );
  }
}
