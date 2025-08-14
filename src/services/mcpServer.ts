import { EventEmitter } from "node:events";
import { ProxyMCPServer } from "../ProxyMCPServer.js";
import { configManager } from "../configManager.js";
import { createHTTPServer } from "../core/ServerFactory.js";
import type { UnifiedMCPServer } from "../core/UnifiedMCPServer.js";
import { Logger } from "../logger.js";
import type { HTTPConfig } from "../transports/HTTPAdapter.js";

const logger = new Logger();

/**
 * MCP 服务器类（重构版）
 * 现在基于 UnifiedMCPServer 和传输层抽象实现
 * 保持向后兼容的 API，但内部使用新的统一架构
 */
export class MCPServer extends EventEmitter {
  private unifiedServer: UnifiedMCPServer | null = null;
  private proxyMCPServer: ProxyMCPServer | null = null;
  private port: number;
  private isStarted = false;

  constructor(port = 3000) {
    super();
    this.port = port;
  }

  /**
   * 初始化统一服务器
   */
  private async initializeUnifiedServer(): Promise<void> {
    if (this.unifiedServer) {
      return;
    }

    logger.info("初始化统一 MCP 服务器");

    try {
      // 创建 HTTP 模式的统一服务器
      const httpConfig: HTTPConfig = {
        name: "http",
        port: this.port,
        host: "0.0.0.0",
        enableSSE: true,
        enableRPC: true,
      };

      this.unifiedServer = await createHTTPServer(httpConfig);

      // 转发统一服务器的事件
      this.unifiedServer.on("started", () => this.emit("started"));
      this.unifiedServer.on("stopped", () => this.emit("stopped"));
      this.unifiedServer.on("connectionRegistered", (connection) => {
        this.emit("connectionRegistered", connection);
      });

      logger.info("统一 MCP 服务器初始化完成");
    } catch (error) {
      logger.error("初始化统一 MCP 服务器失败", error);
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
        if (this.unifiedServer) {
          this.proxyMCPServer.setServiceManager(
            this.unifiedServer.getServiceManager()
          );
        }

        await this.proxyMCPServer.connect();
        logger.info("小智接入点连接成功");
      } else {
        logger.info("未配置有效的小智接入点，跳过连接");
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
      logger.info("启动 MCP 服务器");

      // 初始化统一服务器
      await this.initializeUnifiedServer();

      // 启动统一服务器
      if (this.unifiedServer) {
        await this.unifiedServer.start();
      }

      // 初始化小智接入点连接（不阻塞服务器启动）
      this.initializeMCPClient().catch((error) => {
        logger.error("初始化小智接入点连接失败:", error);
      });

      this.isStarted = true;
      this.emit("started");
      logger.info("MCP 服务器启动成功");
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

      // 停止统一服务器
      if (this.unifiedServer) {
        await this.unifiedServer.stop();
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
    return this.unifiedServer?.getServiceManager() || null;
  }

  /**
   * 获取消息处理器（向后兼容）
   */
  getMessageHandler() {
    return this.unifiedServer?.getMessageHandler() || null;
  }

  /**
   * 获取服务器状态
   */
  getStatus() {
    if (!this.unifiedServer) {
      return {
        isRunning: false,
        port: this.port,
        mode: "mcp-server",
      };
    }

    const status = this.unifiedServer.getStatus();
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
    return this.isStarted && (this.unifiedServer?.isServerRunning() || false);
  }
}
