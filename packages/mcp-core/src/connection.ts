/**
 * MCP 连接管理模块
 *
 * 提供 MCPConnection 类，负责管理单个 MCP 服务的连接生命周期
 * 包括连接建立、工具列表管理、工具调用、心跳检测等功能
 *
 * @module connection
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { type LoggerLike, createLogger } from "./logger.js";
import { TransportFactory } from "./transport-factory.js";
import type {
  MCPServerTransport,
  MCPServiceConfig,
  MCPServiceStatus,
  ToolCallResult,
} from "./types.js";
import { ConnectionState, MCPTransportType } from "./types.js";
import type {
  HeartbeatConfig,
  InternalMCPServiceConfig,
  MCPServiceEventCallbacks,
} from "./types.js";
import { inferTransportTypeFromConfig } from "./utils/index.js";

/**
 * MCP 连接类
 * 负责管理单个 MCP 服务的连接、工具管理和调用
 */
export class MCPConnection {
  private name: string; // 服务名称（独立字段）
  private config: MCPServiceConfig;
  private client: Client | null = null;
  private transport: MCPServerTransport | null = null;
  private tools: Map<string, Tool> = new Map();
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private initialized = false;
  private callbacks?: MCPServiceEventCallbacks;
  // 心跳检测相关
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatConfig?: HeartbeatConfig;
  private logger: LoggerLike;

  constructor(
    name: string,
    config: MCPServiceConfig,
    callbacks?: MCPServiceEventCallbacks
  ) {
    this.name = name;
    // 使用工具方法推断服务类型（传递服务名称用于日志）
    this.config = inferTransportTypeFromConfig(config, name);
    this.callbacks = callbacks;
    // 保存心跳配置 - 优先使用用户配置
    this.heartbeatConfig = {
      enabled: config.heartbeat?.enabled ?? true, // 默认启用
      interval: config.heartbeat?.interval ?? 30 * 1000, // 默认 30 秒
    };

    // 初始化日志记录器
    this.logger = createLogger(`MCP-${name}`);

    // 验证配置
    this.validateConfig();
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    // 验证服务名称
    if (!this.name || typeof this.name !== "string") {
      throw new Error("服务名称必须是非空字符串");
    }
    // 使用 TransportFactory 进行配置验证（传递包含 name 的完整配置）
    const fullConfig: InternalMCPServiceConfig = {
      name: this.name,
      ...this.config,
    };
    TransportFactory.validateConfig(fullConfig);
  }

  /**
   * 连接到 MCP 服务
   */
  async connect(): Promise<void> {
    // 如果正在连接中，等待当前连接完成
    if (this.connectionState === ConnectionState.CONNECTING) {
      throw new Error("连接正在进行中，请等待连接完成");
    }

    // 清理之前的连接
    this.cleanupConnection();

    return this.attemptConnection();
  }

  /**
   * 尝试建立连接
   */
  private async attemptConnection(): Promise<void> {
    this.connectionState = ConnectionState.CONNECTING;
    this.logger.debug(`正在连接 MCP 服务: ${this.name}`);

    return new Promise((resolve, reject) => {
      // 设置连接超时（使用固定默认值 30 秒）
      const CONNECTION_TIMEOUT = 30000;
      this.connectionTimeout = setTimeout(() => {
        const error = new Error(`连接超时 (${CONNECTION_TIMEOUT}ms)`);
        this.handleConnectionError(error);
        reject(error);
      }, CONNECTION_TIMEOUT);

      try {
        this.client = new Client(
          {
            name: `xiaozhi-${this.name}-client`,
            version: "1.0.0",
          },
          {
            capabilities: {},
          }
        );

        // 使用 TransportFactory 创建传输层（传递包含 name 的完整配置）
        const fullConfig: InternalMCPServiceConfig = {
          name: this.name,
          ...this.config,
        };
        this.transport = TransportFactory.create(fullConfig);

        // 连接到 MCP 服务
        this.client
          .connect(this.transport as MCPServerTransport)
          .then(async () => {
            this.handleConnectionSuccess();

            // 获取工具列表
            await this.refreshTools();

            // 发射连接成功事件
            this.callbacks?.onConnected?.({
              serviceName: this.name,
              tools: this.getTools(),
              connectionTime: new Date(),
            });

            resolve();
          })
          .catch((error) => {
            this.handleConnectionError(error);
            reject(error);
          });
      } catch (error) {
        this.handleConnectionError(error as Error);
        reject(error);
      }
    });
  }

  /**
   * 处理连接成功
   */
  private handleConnectionSuccess(): void {
    // 清理连接超时定时器
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.connectionState = ConnectionState.CONNECTED;
    this.initialized = true;

    this.logger.info(`MCP 服务 ${this.name} 连接已建立`);

    // 启动心跳检测
    this.startHeartbeat();
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(error: Error): void {
    this.connectionState = ConnectionState.DISCONNECTED;
    this.initialized = false;

    this.logger.debug(`MCP 服务 ${this.name} 连接错误:`, error.message);

    // 清理连接超时定时器
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // 清理当前连接
    this.cleanupConnection();

    // 发射连接失败事件
    this.callbacks?.onConnectionFailed?.({
      serviceName: this.name,
      error,
      attempt: 0,
    });
  }

  /**
   * 清理连接资源
   */
  private cleanupConnection(): void {
    // 停止心跳
    this.stopHeartbeat();

    // 清理客户端
    if (this.client) {
      try {
        this.client.close().catch(() => {
          // 忽略关闭时的错误
        });
      } catch (error) {
        // 忽略关闭时的错误
      }
      this.client = null;
    }

    // 清理传输层
    this.transport = null;

    // 清理连接超时定时器
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // 重置状态
    this.initialized = false;
  }

  /**
   * 刷新工具列表
   */
  private async refreshTools(): Promise<void> {
    if (!this.client) {
      throw new Error("客户端未初始化");
    }

    try {
      const toolsResult = await this.client.listTools();
      const tools: Tool[] = toolsResult.tools || [];

      // 清空现有工具
      this.tools.clear();

      // 注册工具到映射表
      for (const tool of tools) {
        this.tools.set(tool.name, tool);
      }

      this.logger.debug(
        `服务加载了 ${tools.length} 个工具: ${tools.map((t) => t.name).join(", ")}`
      );
    } catch (error) {
      this.logger.error(
        "获取工具列表失败:",
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.logger.info("主动断开 MCP 服务连接");

    // 清理连接资源
    this.cleanupConnection();

    // 设置状态为已断开
    this.connectionState = ConnectionState.DISCONNECTED;

    // 发射断开连接事件
    this.callbacks?.onDisconnected?.({
      serviceName: this.name,
      reason: "手动断开",
      disconnectionTime: new Date(),
    });
  }

  /**
   * 获取工具列表
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 检测是否为会话过期错误
   */
  private isSessionExpiredError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("session expired") ||
        message.includes("会话过期") ||
        message.includes("401") ||
        message.includes("unauthorized")
      );
    }
    return false;
  }

  /**
   * 自动重连
   */
  private async reconnect(): Promise<void> {
    this.connectionState = ConnectionState.RECONNECTING;
    this.logger.debug("检测到会话过期，正在重新连接...");

    // 清理旧连接
    this.cleanupConnection();

    // 建立新连接
    return this.attemptConnection();
  }

  /**
   * 启动心跳检测
   */
  private async startHeartbeat(): Promise<void> {
    // STDIO 不需要心跳（进程级连接稳定）
    if (this.config.type === "stdio") {
      return;
    }

    if (!this.heartbeatConfig?.enabled) {
      return;
    }
    const interval = this.heartbeatConfig?.interval ?? 30 * 1000;

    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat().catch((error) => {
        this.logger.error(
          "心跳检测执行异常：",
          error instanceof Error ? error.message : String(error)
        );
      });
    }, interval);

    this.logger.debug(`心跳检测已启动，间隔: ${interval}ms`);
  }

  /**
   * 执行一次心跳检查
   */
  private async performHeartbeat(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      // 调用 MCP SDK 的 ping() 方法
      await this.client.ping();
      this.logger.debug("心跳检测成功");
    } catch (error) {
      this.logger.warn(
        "心跳检测失败，尝试重连...",
        error instanceof Error ? error.message : String(error)
      );
      // 心跳失败，尝试重连
      await this.reconnect();
    }
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.logger.debug("心跳检测已停止");
    }
  }

  /**
   * 调用工具
   */
  async callTool(
    name: string,
    arguments_: Record<string, unknown>
  ): Promise<ToolCallResult> {
    if (!this.client) {
      throw new Error(`服务 ${this.name} 未连接`);
    }

    if (!this.tools.has(name)) {
      throw new Error(`工具 ${name} 在服务 ${this.name} 中不存在`);
    }

    this.logger.debug(
      `调用服务的工具 ${name}，参数:`,
      JSON.stringify(arguments_)
    );

    try {
      const result = await this.client.callTool({
        name,
        arguments: arguments_ || {},
      });

      this.logger.debug(
        `工具 ${name} 调用成功，结果:`,
        `${JSON.stringify(result).substring(0, 500)}...`
      );

      return result as ToolCallResult;
    } catch (error) {
      // 检测是否为会话过期错误
      if (this.isSessionExpiredError(error)) {
        this.logger.warn("检测到会话过期，尝试重新连接并重试...");

        // 自动重连
        await this.reconnect();

        // 重试工具调用
        return await this.client.callTool({
          name,
          arguments: arguments_ || {},
        });
      }

      // 其他错误正常抛出
      this.logger.error(
        `工具 ${name} 调用失败:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 获取服务配置
   */
  getConfig(): MCPServiceConfig & { name: string } {
    return {
      name: this.name,
      ...this.config,
    };
  }

  /**
   * 获取服务状态
   */
  getStatus(): MCPServiceStatus {
    return {
      name: this.name,
      connected: this.connectionState === ConnectionState.CONNECTED,
      initialized: this.initialized,
      transportType:
        (this.config.type as MCPTransportType) || MCPTransportType.HTTP,
      toolCount: this.tools.size,
      connectionState: this.connectionState,
    };
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return (
      this.connectionState === ConnectionState.CONNECTED && this.initialized
    );
  }
}
