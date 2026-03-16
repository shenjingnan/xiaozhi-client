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
 *
 * @description
 * 负责管理单个 MCP 服务的连接生命周期，包括连接建立、工具列表管理、
 * 工具调用、心跳检测和自动重连等功能。
 *
 * @example
 * ```typescript
 * const connection = new MCPConnection('my-service', {
 *   type: 'http',
 *   url: 'https://api.example.com/mcp'
 * }, {
 *   onConnected: (event) => console.log('已连接', event),
 *   onDisconnected: (event) => console.log('已断开', event)
 * });
 *
 * await connection.connect();
 * const tools = connection.getTools();
 * const result = await connection.callTool('my_tool', { param: 'value' });
 * ```
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

  /**
   * 创建 MCP 连接实例
   *
   * @param name - 服务名称，用于标识和管理此 MCP 服务
   * @param config - MCP 服务配置，包含连接类型（http/stdio/modelscope）和相关参数
   * @param callbacks - 可选的事件回调函数，用于监听连接状态变化
   *
   * @throws {Error} 当服务名称为空或不是字符串时抛出错误
   * @throws {Error} 当配置验证失败时抛出错误
   *
   * @example
   * ```typescript
   * // HTTP 服务配置
   * const connection = new MCPConnection('weather-service', {
   *   type: 'http',
   *   url: 'https://api.example.com/mcp',
   *   heartbeat: { enabled: true, interval: 30000 }
   * });
   *
   * // STDIO 服务配置
   * const localConnection = new MCPConnection('local-service', {
   *   type: 'stdio',
   *   command: 'node',
   *   args: ['server.js']
   * });
   * ```
   */
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
   *
   * @description
   * 建立与服务器的连接，初始化 MCP 客户端并获取工具列表。
   * 连接成功后会启动心跳检测（非 STDIO 类型）。如果已经在连接中，
   * 会抛出错误。
   *
   * @throws {Error} 当连接正在进行中时抛出错误
   * @throws {Error} 当连接超时（30秒）时抛出错误
   * @throws {Error} 当获取工具列表失败时抛出错误
   *
   * @example
   * ```typescript
   * const connection = new MCPConnection('my-service', config);
   * try {
   *   await connection.connect();
   *   console.log('连接成功');
   *   console.log('可用工具:', connection.getTools());
   * } catch (error) {
   *   console.error('连接失败:', error.message);
   * }
   * ```
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
    console.debug(`[MCP-${this.name}] 正在连接 MCP 服务: ${this.name}`);

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

    console.info(`[MCP-${this.name}] MCP 服务 ${this.name} 连接已建立`);

    // 启动心跳检测
    this.startHeartbeat();
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(error: Error): void {
    this.connectionState = ConnectionState.DISCONNECTED;
    this.initialized = false;

    console.debug(`MCP 服务 ${this.name} 连接错误:`, error.message);

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

      console.debug(
        `${this.name} 服务加载了 ${tools.length} 个工具: ${tools
          .map((t) => t.name)
          .join(", ")}`
      );
    } catch (error) {
      console.error(
        `${this.name} 获取工具列表失败:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 断开连接
   *
   * @description
   * 主动断开与 MCP 服务的连接，清理所有资源（客户端、传输层、定时器等）。
   * 断开后会触发 `onDisconnected` 回调事件。
   *
   * @example
   * ```typescript
   * // 正常断开连接
   * await connection.disconnect();
   * console.log('已断开连接');
   *
   * // 应用关闭时断开所有连接
   * process.on('SIGINT', async () => {
   *   await connection.disconnect();
   *   process.exit(0);
   * });
   * ```
   */
  async disconnect(): Promise<void> {
    console.info(`主动断开 MCP 服务 ${this.name} 连接`);

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
   *
   * @description
   * 返回当前 MCP 服务提供的所有工具。工具列表在连接成功后自动获取，
   * 并在会话过期自动重连后更新。
   *
   * @returns 工具数组，每个工具包含 name、description、inputSchema 等属性
   *
   * @example
   * ```typescript
   * const tools = connection.getTools();
   * console.log(`可用工具数量: ${tools.length}`);
   *
   * // 查找特定工具
   * const weatherTool = tools.find(t => t.name === 'get_weather');
   * if (weatherTool) {
   *   console.log('工具描述:', weatherTool.description);
   *   console.log('参数 schema:', weatherTool.inputSchema);
   * }
   * ```
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
    console.debug(`[MCP-${this.name}] 检测到会话过期，正在重新连接...`);

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
        console.error(
          `[MCP-${this.name}] 心跳检测执行异常：`,
          error instanceof Error ? error.message : String(error)
        );
      });
    }, interval);

    console.debug(`[MCP-${this.name}] 心跳检测已启动，间隔: ${interval}ms`);
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
      console.debug(`[MCP-${this.name}] 心跳检测成功`);
    } catch (error) {
      console.warn(
        `[MCP-${this.name}] 心跳检测失败，尝试重连...`,
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
      console.debug(`[MCP-${this.name}] 心跳检测已停止`);
    }
  }

  /**
   * 调用 MCP 工具
   *
   * @description
   * 调用指定名称的 MCP 工具并传递参数。如果检测到会话过期错误，
   * 会自动重连并重试调用。
   *
   * @param name - 工具名称，必须存在于当前服务的工具列表中
   * @param arguments_ - 工具调用参数，应符合工具的 inputSchema 定义
   * @returns 工具调用结果，包含 content 数组和 isError 标志
   *
   * @throws {Error} 当服务未连接时抛出错误
   * @throws {Error} 当工具不存在时抛出错误
   * @throws {Error} 当工具调用失败时抛出错误
   *
   * @example
   * ```typescript
   * // 调用天气查询工具
   * const result = await connection.callTool('get_weather', {
   *   city: '北京',
   *   unit: 'celsius'
   * });
   *
   * if (result.isError) {
   *   console.error('工具调用失败');
   * } else {
   *   console.log('工具返回:', result.content);
   * }
   *
   * // 调用无参数工具
   * const status = await connection.callTool('get_status', {});
   * ```
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

    console.debug(
      `调用 ${this.name} 服务的工具 ${name}，参数:`,
      JSON.stringify(arguments_)
    );

    try {
      const result = await this.client.callTool({
        name,
        arguments: arguments_ || {},
      });

      console.debug(
        `工具 ${name} 调用成功，结果:`,
        `${JSON.stringify(result).substring(0, 500)}...`
      );

      return result as ToolCallResult;
    } catch (error) {
      // 检测是否为会话过期错误
      if (this.isSessionExpiredError(error)) {
        console.warn(
          `[MCP-${this.name}] 检测到会话过期，尝试重新连接并重试...`
        );

        // 自动重连
        await this.reconnect();

        // 重试工具调用
        return await this.client.callTool({
          name,
          arguments: arguments_ || {},
        });
      }

      // 其他错误正常抛出
      console.error(
        `工具 ${name} 调用失败:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 获取服务配置
   *
   * @description
   * 返回当前连接的完整配置信息，包括服务名称和连接参数。
   * 注意：返回的对象是配置的副本，修改它不会影响实际连接。
   *
   * @returns 服务配置对象，包含 name 字段和原始配置
   *
   * @example
   * ```typescript
   * const config = connection.getConfig();
   * console.log('服务名称:', config.name);
   * console.log('连接类型:', config.type);
   * console.log('是否启用心跳:', config.heartbeat?.enabled);
   * ```
   */
  getConfig(): MCPServiceConfig & { name: string } {
    return {
      name: this.name,
      ...this.config,
    };
  }

  /**
   * 获取服务状态
   *
   * @description
   * 返回当前连接的详细状态信息，包括连接状态、初始化状态、
   * 传输类型和可用工具数量等。
   *
   * @returns 服务状态对象，包含连接状态和统计信息
   *
   * @example
   * ```typescript
   * const status = connection.getStatus();
   * console.log('服务名称:', status.name);
   * console.log('是否已连接:', status.connected);
   * console.log('是否已初始化:', status.initialized);
   * console.log('传输类型:', status.transportType);
   * console.log('工具数量:', status.toolCount);
   * console.log('连接状态:', status.connectionState);
   * ```
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
   *
   * @description
   * 快速检查服务是否已连接并初始化完成。这比 `getStatus()` 更轻量，
   * 适合频繁调用的场景。
   *
   * @returns 如果已连接且初始化完成返回 true，否则返回 false
   *
   * @example
   * ```typescript
   * if (connection.isConnected()) {
   *   // 安全地调用工具
   *   const result = await connection.callTool('my_tool', {});
   * } else {
   *   console.log('服务未连接，请先调用 connect()');
   * }
   *
   * // 轮询等待连接
   * while (!connection.isConnected()) {
   *   await new Promise(resolve => setTimeout(resolve, 1000));
   * }
   * ```
   */
  isConnected(): boolean {
    return (
      this.connectionState === ConnectionState.CONNECTED && this.initialized
    );
  }
}
