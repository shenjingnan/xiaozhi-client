/**
 * 统一 MCP 服务器 - 重构版本
 * 职责：纯粹的消息路由器和协议转换器
 *
 * 重构后功能：
 * 1. 管理并委托给 MCPServiceManager
 * 2. 提供简化的对外接口
 * 3. 消息路由和协议转换
 * 4. 事件转发
 */

import { EventEmitter } from "node:events";
import type { MCPMessageHandler } from "@core/MCPMessageHandler.js";
import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import { MCPServiceManager } from "@services/MCPServiceManager.js";
import type { TransportAdapter } from "@transports/TransportAdapter.js";
import type { MCPMessage } from "@transports/TransportAdapter.js";

/**
 * 服务器配置接口（简化版）
 */
export interface UnifiedServerConfig {
  name?: string;
  enableLogging?: boolean;
  logLevel?: string;
  configs?: Record<string, any>; // MCPService 配置
}

/**
 * 统一 MCP 服务器 - 简化版本
 * 职责：纯粹的消息路由器和协议转换器
 */
export class UnifiedMCPServer extends EventEmitter {
  private serviceManager: MCPServiceManager;
  private messageHandler: MCPMessageHandler;
  private isRunning = false;
  private logger: Logger;
  private config: UnifiedServerConfig;

  constructor(config: UnifiedServerConfig = {}) {
    super();

    this.config = {
      name: "UnifiedMCPServer",
      enableLogging: true,
      logLevel: "info",
      ...config,
    };

    this.logger = logger;

    // 直接创建并管理服务管理器
    this.serviceManager = new MCPServiceManager(config.configs);
    this.messageHandler = this.serviceManager.getMessageHandler();

    // 转发服务管理器的事件
    this.setupEventForwarding();
  }

  /**
   * 设置事件转发
   */
  private setupEventForwarding(): void {
    // 转发服务管理器的所有重要事件
    this.serviceManager.on("mcp:service:connected", (data) => {
      this.emit("mcp:service:connected", data);
    });

    this.serviceManager.on("mcp:service:disconnected", (data) => {
      this.emit("mcp:service:disconnected", data);
    });

    this.serviceManager.on("mcp:service:connection:failed", (data) => {
      this.emit("mcp:service:connection:failed", data);
    });

    this.serviceManager.on("transportRegistered", (data) => {
      this.emit("transportRegistered", data);
    });
  }

  /**
   * 注册传输适配器（委托给服务管理器）
   */
  async registerTransport(
    name: string,
    adapter: TransportAdapter
  ): Promise<void> {
    return this.serviceManager.registerTransport(name, adapter);
  }

  /**
   * 启动服务器（委托给服务管理器）
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("服务器已在运行");
    }

    this.logger.info("启动统一 MCP 服务器");

    try {
      await this.serviceManager.start();
      this.isRunning = true;

      this.logger.info("统一 MCP 服务器启动成功");
      this.emit("started");
    } catch (error) {
      this.logger.error("统一 MCP 服务器启动失败", error);
      throw error;
    }
  }

  /**
   * 停止服务器（委托给服务管理器）
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info("停止统一 MCP 服务器");

    try {
      await this.serviceManager.stop();
      this.isRunning = false;

      this.logger.info("统一 MCP 服务器停止成功");
      this.emit("stopped");
    } catch (error) {
      this.logger.error("统一 MCP 服务器停止失败", error);
      throw error;
    }
  }

  /**
   * 消息路由核心功能
   */
  async routeMessage(message: MCPMessage): Promise<MCPMessage | null> {
    const response = await this.messageHandler.handleMessage(message);
    // 如果响应是 null，直接返回
    if (response === null) {
      return null;
    }
    // 将 MCPResponse 转换为 MCPMessage 格式
    return {
      jsonrpc: "2.0",
      method: "response", // 标识这是一个响应消息
      params: response,
    };
  }

  /**
   * 获取服务管理器（主要外部接口）
   */
  getServiceManager(): MCPServiceManager {
    return this.serviceManager;
  }

  /**
   * 获取消息处理器
   */
  getMessageHandler(): MCPMessageHandler {
    return this.messageHandler;
  }

  /**
   * 获取服务器状态
   */
  getStatus(): {
    isRunning: boolean;
    serviceStatus: any;
    transportCount: number;
    activeConnections: number;
    config: UnifiedServerConfig;
  } {
    return {
      isRunning: this.isRunning,
      serviceStatus: this.serviceManager.getStatus(),
      transportCount: this.serviceManager.getTransportAdapters().size,
      activeConnections: this.serviceManager.getActiveConnectionCount(),
      config: this.config,
    };
  }

  /**
   * 获取所有工具（委托给服务管理器）
   */
  getAllTools(): Array<{
    name: string;
    description?: string;
    inputSchema?: any;
    serviceName: string;
    originalName: string;
  }> {
    return this.serviceManager.getAllTools();
  }

  /**
   * 调用工具（委托给服务管理器）
   */
  async callTool(toolName: string, arguments_: any): Promise<any> {
    return this.serviceManager.callTool(toolName, arguments_);
  }

  /**
   * 检查服务器是否正在运行
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 获取活跃连接数（委托给服务管理器）
   */
  getActiveConnectionCount(): number {
    return this.serviceManager.getActiveConnectionCount();
  }

  /**
   * 获取传输适配器（委托给服务管理器）
   */
  getTransportAdapters(): Map<string, TransportAdapter> {
    return this.serviceManager.getTransportAdapters();
  }

  // ===== 向后兼容方法 =====

  /**
   * 初始化方法（向后兼容，实际调用 start）
   */
  async initialize(): Promise<void> {
    // 为了向后兼容，初始化时调用 start
    // 但不设置 isRunning 状态，保持原有逻辑
    await this.serviceManager.start();
  }

  /**
   * 获取工具注册表（向后兼容，返回服务管理器）
   */
  getToolRegistry(): MCPServiceManager {
    return this.serviceManager;
  }

  /**
   * 获取连接管理器（向后兼容，返回服务管理器）
   */
  getConnectionManager(): MCPServiceManager {
    return this.serviceManager;
  }
}

// 保持向后兼容的默认导出
export default UnifiedMCPServer;
