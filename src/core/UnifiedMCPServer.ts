/**
 * 统一 MCP 服务器
 * 阶段三重构：整合所有传输协议和服务管理的统一服务器实现
 *
 * 这是整个 MCP 系统的核心类，负责：
 * 1. 管理多种传输适配器（HTTP、Stdio、WebSocket等）
 * 2. 统一的工具注册和管理
 * 3. 连接生命周期管理
 * 4. 消息路由和处理
 */

import { EventEmitter } from "node:events";
import type { Logger } from "../Logger.js";
import { logger } from "../Logger.js";
import { MCPServiceManager } from "../services/MCPServiceManager.js";
import type { TransportAdapter } from "../transports/TransportAdapter.js";
import { ConnectionState } from "../transports/TransportAdapter.js";
import type {
  MCPMessage,
  MCPResponse,
} from "../transports/TransportAdapter.js";
import { MCPMessageHandler } from "./MCPMessageHandler.js";

/**
 * 工具信息接口
 */
export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: any;
  serviceName: string;
  originalName: string;
}

/**
 * 连接信息接口
 */
export interface ConnectionInfo {
  id: string;
  transportName: string;
  state: ConnectionState;
  connectedAt: Date;
  lastActivity: Date;
}

/**
 * 服务器配置接口
 */
export interface UnifiedServerConfig {
  name?: string;
  enableLogging?: boolean;
  logLevel?: string;
  maxConnections?: number;
  connectionTimeout?: number;
}

/**
 * 简化的工具注册表
 * 基于现有的 MCPServiceManager 提供统一的工具管理接口
 */
export class ToolRegistry {
  private serviceManager: MCPServiceManager;
  private logger: Logger;

  constructor(serviceManager: MCPServiceManager) {
    this.serviceManager = serviceManager;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info("初始化工具注册表");
    // 工具注册表的初始化由 MCPServiceManager 处理
  }

  /**
   * 获取所有工具
   */
  getAllTools(): ToolInfo[] {
    return this.serviceManager.getAllTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      serviceName: tool.serviceName,
      originalName: tool.originalName,
    }));
  }

  /**
   * 查找工具
   */
  findTool(toolName: string): ToolInfo | null {
    const tools = this.getAllTools();
    return tools.find((tool) => tool.name === toolName) || null;
  }

  /**
   * 检查工具是否存在
   */
  hasTool(toolName: string): boolean {
    return this.findTool(toolName) !== null;
  }
}

/**
 * 简化的连接管理器
 * 管理传输适配器的连接状态和生命周期
 */
export class ConnectionManager extends EventEmitter {
  private connections: Map<string, ConnectionInfo> = new Map();
  private logger: Logger;

  constructor() {
    super();
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info("初始化连接管理器");
  }

  /**
   * 注册连接
   */
  registerConnection(
    id: string,
    transportName: string,
    state: ConnectionState
  ): void {
    const connectionInfo: ConnectionInfo = {
      id,
      transportName,
      state,
      connectedAt: new Date(),
      lastActivity: new Date(),
    };

    this.connections.set(id, connectionInfo);
    this.emit("connectionRegistered", connectionInfo);
    this.logger.debug(`连接已注册: ${id} (${transportName})`);
  }

  /**
   * 更新连接状态
   */
  updateConnectionState(id: string, state: ConnectionState): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.state = state;
      connection.lastActivity = new Date();
      this.emit("connectionStateChanged", connection);
      this.logger.debug(`连接状态更新: ${id} -> ${state}`);
    }
  }

  /**
   * 移除连接
   */
  removeConnection(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      this.connections.delete(id);
      this.emit("connectionRemoved", connection);
      this.logger.debug(`连接已移除: ${id}`);
    }
  }

  /**
   * 获取所有连接
   */
  getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * 获取活跃连接数
   */
  getActiveConnectionCount(): number {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.state === ConnectionState.CONNECTED
    ).length;
  }

  /**
   * 关闭所有连接
   */
  async closeAllConnections(): Promise<void> {
    this.logger.info("关闭所有连接");
    this.connections.clear();
    this.emit("allConnectionsClosed");
  }
}

/**
 * 统一 MCP 服务器
 * 整合所有传输协议和服务管理的核心服务器类
 */
export class UnifiedMCPServer extends EventEmitter {
  private serviceManager: MCPServiceManager;
  private messageHandler: MCPMessageHandler;
  private transportAdapters: Map<string, TransportAdapter> = new Map();
  private toolRegistry: ToolRegistry;
  private connectionManager: ConnectionManager;
  private isRunning = false;
  private logger: Logger;
  private config: UnifiedServerConfig;

  constructor(config: UnifiedServerConfig = {}) {
    super();

    this.config = {
      name: "UnifiedMCPServer",
      enableLogging: true,
      logLevel: "info",
      maxConnections: 100,
      connectionTimeout: 30000,
      ...config,
    };

    this.logger = logger;

    // 初始化核心组件
    this.serviceManager = new MCPServiceManager();
    this.messageHandler = new MCPMessageHandler(this.serviceManager);
    this.toolRegistry = new ToolRegistry(this.serviceManager);
    this.connectionManager = new ConnectionManager();

    // 设置事件监听
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听连接管理器事件
    this.connectionManager.on(
      "connectionRegistered",
      (connection: ConnectionInfo) => {
        this.emit("connectionRegistered", connection);
      }
    );

    this.connectionManager.on(
      "connectionStateChanged",
      (connection: ConnectionInfo) => {
        this.emit("connectionStateChanged", connection);
      }
    );

    this.connectionManager.on(
      "connectionRemoved",
      (connection: ConnectionInfo) => {
        this.emit("connectionRemoved", connection);
      }
    );
  }

  /**
   * 初始化服务器
   */
  async initialize(): Promise<void> {
    this.logger.info("初始化统一 MCP 服务器");

    try {
      // 初始化核心组件
      await this.serviceManager.startAllServices();
      await this.toolRegistry.initialize();
      await this.connectionManager.initialize();

      this.logger.debug("统一 MCP 服务器初始化完成");
      this.emit("initialized");
    } catch (error) {
      this.logger.error("统一 MCP 服务器初始化失败", error);
      throw error;
    }
  }

  /**
   * 注册传输适配器
   */
  async registerTransport(
    name: string,
    adapter: TransportAdapter
  ): Promise<void> {
    if (this.transportAdapters.has(name)) {
      throw new Error(`传输适配器 ${name} 已存在`);
    }

    this.logger.info(`注册传输适配器: ${name}`);

    try {
      // 初始化适配器
      await adapter.initialize();

      // 注册适配器
      this.transportAdapters.set(name, adapter);

      // 注册连接到连接管理器
      this.connectionManager.registerConnection(
        adapter.getConnectionId(),
        name,
        adapter.getState()
      );

      this.logger.info(`传输适配器 ${name} 注册成功`);
      this.emit("transportRegistered", { name, adapter });
    } catch (error) {
      this.logger.error(`注册传输适配器 ${name} 失败`, error);
      throw error;
    }
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("服务器已在运行");
    }

    this.logger.info("启动统一 MCP 服务器");

    try {
      // 启动所有传输适配器
      for (const [name, adapter] of this.transportAdapters) {
        try {
          await adapter.start();

          // 更新连接状态
          this.connectionManager.updateConnectionState(
            adapter.getConnectionId(),
            adapter.getState()
          );

          this.logger.info(`传输适配器 ${name} 启动成功`);
        } catch (error) {
          this.logger.error(`传输适配器 ${name} 启动失败`, error);
          throw error;
        }
      }

      this.isRunning = true;
      this.logger.info("统一 MCP 服务器启动成功");
      this.emit("started");
    } catch (error) {
      this.logger.error("统一 MCP 服务器启动失败", error);
      throw error;
    }
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info("停止统一 MCP 服务器");

    try {
      // 停止所有传输适配器
      for (const [name, adapter] of this.transportAdapters) {
        try {
          await adapter.stop();

          // 更新连接状态
          this.connectionManager.updateConnectionState(
            adapter.getConnectionId(),
            adapter.getState()
          );

          this.logger.info(`传输适配器 ${name} 停止成功`);
        } catch (error) {
          this.logger.error(`传输适配器 ${name} 停止失败`, error);
        }
      }

      // 关闭所有连接
      await this.connectionManager.closeAllConnections();

      // 停止服务管理器
      await this.serviceManager.stopAllServices();

      this.isRunning = false;
      this.logger.info("统一 MCP 服务器停止成功");
      this.emit("stopped");
    } catch (error) {
      this.logger.error("统一 MCP 服务器停止失败", error);
      throw error;
    }
  }

  /**
   * 获取服务管理器
   */
  getServiceManager(): MCPServiceManager {
    return this.serviceManager;
  }

  /**
   * 获取工具注册表
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  /**
   * 获取连接管理器
   */
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
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
    transportCount: number;
    activeConnections: number;
    toolCount: number;
    config: UnifiedServerConfig;
  } {
    return {
      isRunning: this.isRunning,
      transportCount: this.transportAdapters.size,
      activeConnections: this.connectionManager.getActiveConnectionCount(),
      toolCount: this.toolRegistry.getAllTools().length,
      config: this.config,
    };
  }

  /**
   * 获取所有传输适配器
   */
  getTransportAdapters(): Map<string, TransportAdapter> {
    return new Map(this.transportAdapters);
  }

  /**
   * 检查服务器是否正在运行
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }
}
