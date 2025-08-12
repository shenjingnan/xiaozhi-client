import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "../logger.js";
import { TransportFactory } from "./TransportFactory.js";

// 通信方式枚举
export enum MCPTransportType {
  STDIO = "stdio",
  SSE = "sse",
  STREAMABLE_HTTP = "streamable-http",
}

// 连接状态枚举
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
}

// 重连配置接口
export interface ReconnectOptions {
  enabled: boolean;
  maxAttempts: number;
  initialInterval: number;
  maxInterval: number;
  backoffStrategy: "linear" | "exponential" | "fixed";
  backoffMultiplier: number;
  timeout: number;
  jitter: boolean;
}

// MCPService 配置接口
export interface MCPServiceConfig {
  name: string;
  type: MCPTransportType;
  // stdio 配置
  command?: string;
  args?: string[];
  // 网络配置
  url?: string;
  // 认证配置
  apiKey?: string;
  headers?: Record<string, string>;
  // 重连配置
  reconnect?: Partial<ReconnectOptions>;
}

// MCPService 状态接口
export interface MCPServiceStatus {
  name: string;
  connected: boolean;
  initialized: boolean;
  transportType: MCPTransportType;
  toolCount: number;
  lastError?: string;
  reconnectAttempts: number;
  connectionState: ConnectionState;
}

// MCPService 选项接口
export interface MCPServiceOptions {
  reconnect?: Partial<ReconnectOptions>;
}

// 重连状态接口
interface ReconnectState {
  attempts: number;
  nextInterval: number;
  timer: NodeJS.Timeout | null;
  lastError: Error | null;
  isManualDisconnect: boolean;
}

// 工具调用结果接口
export interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

/**
 * MCP 服务类
 * 负责管理单个 MCP 服务的连接、工具管理和调用
 */
export class MCPService {
  private config: MCPServiceConfig;
  private client: Client | null = null;
  private transport: any = null;
  private tools: Map<string, Tool> = new Map();
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectOptions: ReconnectOptions;
  private reconnectState: ReconnectState;
  private logger: Logger;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor(config: MCPServiceConfig, options?: MCPServiceOptions) {
    this.config = config;
    this.logger = new Logger().withTag(`MCP-${config.name}`);

    // 验证配置
    this.validateConfig();

    // 初始化重连配置
    this.reconnectOptions = {
      enabled: true,
      maxAttempts: 10,
      initialInterval: 3000,
      maxInterval: 30000,
      backoffStrategy: "exponential",
      backoffMultiplier: 1.5,
      timeout: 10000,
      jitter: true,
      ...options?.reconnect,
      ...config.reconnect,
    };

    // 初始化重连状态
    this.reconnectState = {
      attempts: 0,
      nextInterval: this.reconnectOptions.initialInterval,
      timer: null,
      lastError: null,
      isManualDisconnect: false,
    };
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    // 使用 TransportFactory 进行配置验证
    TransportFactory.validateConfig(this.config);
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

    // 重置手动断开标志
    this.reconnectState.isManualDisconnect = false;

    return this.attemptConnection();
  }

  /**
   * 尝试建立连接
   */
  private async attemptConnection(): Promise<void> {
    this.connectionState = ConnectionState.CONNECTING;
    this.logger.info(
      `正在连接 MCP 服务: ${this.config.name} (尝试 ${
        this.reconnectState.attempts + 1
      }/${this.reconnectOptions.maxAttempts})`
    );

    return new Promise((resolve, reject) => {
      // 设置连接超时
      this.connectionTimeout = setTimeout(() => {
        const error = new Error(
          `连接超时 (${this.reconnectOptions.timeout}ms)`
        );
        this.handleConnectionError(error);
        reject(error);
      }, this.reconnectOptions.timeout);

      try {
        this.client = new Client(
          {
            name: `xiaozhi-${this.config.name}-client`,
            version: "1.0.0",
          },
          {
            capabilities: {
              tools: {},
            },
          }
        );

        // 使用 TransportFactory 创建传输层
        this.transport = TransportFactory.create(this.config);

        // 连接到 MCP 服务
        this.client
          .connect(this.transport)
          .then(async () => {
            this.handleConnectionSuccess();

            // 获取工具列表
            await this.refreshTools();

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

    // 重置重连状态
    this.reconnectState.attempts = 0;
    this.reconnectState.nextInterval = this.reconnectOptions.initialInterval;
    this.reconnectState.lastError = null;

    this.logger.info(`MCP 服务 ${this.config.name} 连接已建立`);
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(error: Error): void {
    // 清理连接超时定时器
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.reconnectState.lastError = error;
    this.logger.error(`MCP 服务 ${this.config.name} 连接错误:`, error.message);

    // 清理当前连接
    this.cleanupConnection();

    // 检查是否需要重连
    if (this.shouldReconnect()) {
      this.scheduleReconnect();
    } else {
      this.connectionState = ConnectionState.FAILED;
      this.logger.warn(
        `${this.config.name} 已达到最大重连次数 (${this.reconnectOptions.maxAttempts})，停止重连`
      );
    }
  }

  /**
   * 检查是否应该重连
   */
  private shouldReconnect(): boolean {
    return (
      this.reconnectOptions.enabled &&
      this.reconnectState.attempts < this.reconnectOptions.maxAttempts &&
      !this.reconnectState.isManualDisconnect
    );
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    this.connectionState = ConnectionState.RECONNECTING;
    this.reconnectState.attempts++;

    // 计算下次重连间隔
    this.calculateNextInterval();

    this.logger.info(
      `${this.config.name} 将在 ${this.reconnectState.nextInterval}ms 后进行第 ${this.reconnectState.attempts} 次重连`
    );

    // 清理之前的重连定时器
    if (this.reconnectState.timer) {
      clearTimeout(this.reconnectState.timer);
    }

    // 设置重连定时器
    this.reconnectState.timer = setTimeout(async () => {
      try {
        await this.attemptConnection();
      } catch (error) {
        // 连接失败会触发 handleConnectionError，无需额外处理
      }
    }, this.reconnectState.nextInterval);
  }

  /**
   * 计算下次重连间隔
   */
  private calculateNextInterval(): void {
    let interval: number;

    switch (this.reconnectOptions.backoffStrategy) {
      case "fixed":
        interval = this.reconnectOptions.initialInterval;
        break;

      case "linear":
        interval =
          this.reconnectOptions.initialInterval +
          this.reconnectState.attempts *
            this.reconnectOptions.backoffMultiplier *
            1000;
        break;

      case "exponential":
        interval =
          this.reconnectOptions.initialInterval *
          this.reconnectOptions.backoffMultiplier **
            (this.reconnectState.attempts - 1);
        break;

      default:
        interval = this.reconnectOptions.initialInterval;
    }

    // 限制最大间隔
    interval = Math.min(interval, this.reconnectOptions.maxInterval);

    // 添加随机抖动
    if (this.reconnectOptions.jitter) {
      const jitterRange = interval * 0.1; // 10% 抖动
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      interval += jitter;
    }

    this.reconnectState.nextInterval = Math.max(interval, 1000); // 最小1秒
  }

  /**
   * 清理连接资源
   */
  private cleanupConnection(): void {
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
   * 停止重连
   */
  private stopReconnect(): void {
    if (this.reconnectState.timer) {
      clearTimeout(this.reconnectState.timer);
      this.reconnectState.timer = null;
    }
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

      this.logger.info(
        `${this.config.name} 服务加载了 ${tools.length} 个工具: ${tools
          .map((t) => t.name)
          .join(", ")}`
      );
    } catch (error) {
      this.logger.error(
        `${this.config.name} 获取工具列表失败:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.logger.info(`主动断开 MCP 服务 ${this.config.name} 连接`);

    // 标记为手动断开，阻止自动重连
    this.reconnectState.isManualDisconnect = true;

    // 停止重连定时器
    this.stopReconnect();

    // 清理连接资源
    this.cleanupConnection();

    // 设置状态为已断开
    this.connectionState = ConnectionState.DISCONNECTED;
  }

  /**
   * 手动重连
   */
  async reconnect(): Promise<void> {
    this.logger.info(`手动重连 MCP 服务 ${this.config.name}`);

    // 停止自动重连
    this.stopReconnect();

    // 重置重连状态
    this.reconnectState.attempts = 0;
    this.reconnectState.nextInterval = this.reconnectOptions.initialInterval;
    this.reconnectState.isManualDisconnect = false;

    // 清理现有连接
    this.cleanupConnection();

    // 尝试连接
    await this.connect();
  }

  /**
   * 获取工具列表
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 调用工具
   */
  async callTool(name: string, arguments_: any): Promise<ToolCallResult> {
    if (!this.client) {
      throw new Error(`服务 ${this.config.name} 未连接`);
    }

    if (!this.tools.has(name)) {
      throw new Error(`工具 ${name} 在服务 ${this.config.name} 中不存在`);
    }

    this.logger.info(
      `调用 ${this.config.name} 服务的工具 ${name}，参数:`,
      JSON.stringify(arguments_)
    );

    try {
      const result = await this.client.callTool({
        name,
        arguments: arguments_ || {},
      });

      this.logger.info(
        `工具 ${name} 调用成功，结果:`,
        `${JSON.stringify(result).substring(0, 500)}...`
      );

      return result as ToolCallResult;
    } catch (error) {
      this.logger.error(
        `工具 ${name} 调用失败:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 获取服务状态
   */
  getStatus(): MCPServiceStatus {
    return {
      name: this.config.name,
      connected: this.connectionState === ConnectionState.CONNECTED,
      initialized: this.initialized,
      transportType: this.config.type,
      toolCount: this.tools.size,
      lastError: this.reconnectState.lastError?.message,
      reconnectAttempts: this.reconnectState.attempts,
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

  /**
   * 启用自动重连
   */
  enableReconnect(): void {
    this.reconnectOptions.enabled = true;
    this.logger.info(`${this.config.name} 自动重连已启用`);
  }

  /**
   * 禁用自动重连
   */
  disableReconnect(): void {
    this.reconnectOptions.enabled = false;
    this.stopReconnect();
    this.logger.info(`${this.config.name} 自动重连已禁用`);
  }

  /**
   * 更新重连配置
   */
  updateReconnectOptions(options: Partial<ReconnectOptions>): void {
    this.reconnectOptions = { ...this.reconnectOptions, ...options };
    this.logger.info(`${this.config.name} 重连配置已更新`, options);
  }

  /**
   * 获取重连配置
   */
  getReconnectOptions(): ReconnectOptions {
    return { ...this.reconnectOptions };
  }

  /**
   * 重置重连状态
   */
  resetReconnectState(): void {
    this.stopReconnect();
    this.reconnectState.attempts = 0;
    this.reconnectState.nextInterval = this.reconnectOptions.initialInterval;
    this.reconnectState.lastError = null;
    this.logger.info(`${this.config.name} 重连状态已重置`);
  }
}
