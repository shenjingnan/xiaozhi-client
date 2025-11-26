import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import { getEventBus } from "@root/services/EventBus.js";
import { TransportFactory } from "@root/services/TransportFactory.js";
import type {
  MCPServerTransport,
  MCPServiceConfig,
  MCPServiceStatus,
  PingOptions,
  ToolCallResult,
} from "./types.js";
import { ConnectionState, MCPTransportType } from "./types.js";

/**
 * MCP 服务类
 * 负责管理单个 MCP 服务的连接、工具管理和调用
 */
export class MCPService {
  private config: MCPServiceConfig;
  private client: Client | null = null;
  private transport: MCPServerTransport | null = null;
  private tools: Map<string, Tool> = new Map();
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private logger: Logger;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private initialized = false;
  private eventBus = getEventBus();

  // Ping相关属性
  private pingOptions: PingOptions;
  private pingTimer: NodeJS.Timeout | null = null;
  private lastPingTime: Date | null = null;
  private isPinging = false;

  constructor(config: MCPServiceConfig) {
    this.logger = logger;

    // 自动推断服务类型（如果没有显式指定）
    const configWithInferredType = this.inferTransportType(config);
    this.config = configWithInferredType;

    // 验证配置
    this.validateConfig();

    // 初始化ping配置
    this.pingOptions = {
      enabled: true, // 默认启用
      interval: 60000, // 60秒
      startDelay: 5000, // 连接成功后5秒开始ping
      ...config.ping,
    };
  }

  /**
   * 带标签的日志方法
   */
  private logWithTag(
    level: "info" | "error" | "warn" | "debug",
    message: string,
    ...args: unknown[]
  ): void {
    const taggedMessage = `[MCP-${this.config.name}] ${message}`;
    this.logger[level](taggedMessage, ...args);
  }

  /**
   * 自动推断传输类型
   */
  private inferTransportType(config: MCPServiceConfig): MCPServiceConfig {
    // 如果已经显式指定了类型，直接返回原配置
    if (config.type) {
      return config;
    }

    this.logger.debug(`[MCP-${config.name}] 自动推断传输类型...`);

    // 根据配置特征推断类型
    let inferredType: MCPTransportType;

    if (config.command) {
      // 包含 command 字段 → stdio 类型
      inferredType = MCPTransportType.STDIO;
      this.logger.debug(
        `[MCP-${config.name}] 检测到 command 字段，推断为 stdio 类型`
      );
    } else if (config.url !== undefined && config.url !== null) {
      // 包含 url 字段，使用统一的 URL 路径推断逻辑
      inferredType = this.inferTransportTypeFromUrl(config.url, config.name);
    } else {
      // 无法推断，抛出错误
      throw new Error(
        `无法为服务 ${config.name} 推断传输类型。请显式指定 type 字段，或提供 command/url 配置`
      );
    }

    // 返回包含推断类型的新配置对象
    return {
      type: inferredType,
      ...config,
    };
  }

  /**
   * 根据 URL 路径推断传输类型（与 ConfigAdapter 保持一致）
   * 基于路径末尾推断，支持包含多个 / 的复杂路径
   */
  private inferTransportTypeFromUrl(
    url: string,
    serviceName: string
  ): MCPTransportType {
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;

      // 检查路径末尾
      if (pathname.endsWith("/sse")) {
        this.logger.info(
          `[MCP-${serviceName}] 检测到 URL 路径以 /sse 结尾，推断为 sse 类型`
        );
        return MCPTransportType.SSE;
      }
      if (pathname.endsWith("/mcp")) {
        this.logger.info(
          `[MCP-${serviceName}] 检测到 URL 路径以 /mcp 结尾，推断为 streamable-http 类型`
        );
        return MCPTransportType.STREAMABLE_HTTP;
      }
      this.logger.info(
        `[MCP-${serviceName}] URL 路径 ${pathname} 不匹配特定规则，默认推断为 streamable-http 类型`
      );
      return MCPTransportType.STREAMABLE_HTTP;
    } catch (error) {
      this.logger.warn(
        `[MCP-${serviceName}] URL 解析失败，默认推断为 streamable-http 类型`,
        error
      );
      return MCPTransportType.STREAMABLE_HTTP;
    }
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

    return this.attemptConnection();
  }

  /**
   * 尝试建立连接
   */
  private async attemptConnection(): Promise<void> {
    this.connectionState = ConnectionState.CONNECTING;
    this.logWithTag("debug", `正在连接 MCP 服务: ${this.config.name}`);

    return new Promise((resolve, reject) => {
      // 设置连接超时
      this.connectionTimeout = setTimeout(() => {
        const error = new Error(`连接超时 (${this.config.timeout || 10000}ms)`);
        this.handleConnectionError(error);
        reject(error);
      }, this.config.timeout || 10000);

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
          .connect(this.transport as MCPServerTransport)
          .then(async () => {
            this.handleConnectionSuccess();

            // 获取工具列表
            await this.refreshTools();

            // 发射连接成功事件（包含工具列表）
            this.eventBus.emitEvent("mcp:service:connected", {
              serviceName: this.config.name,
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

    // 重置ping状态
    this.lastPingTime = null;
    this.isPinging = false;

    this.logWithTag("info", `MCP 服务 ${this.config.name} 连接已建立`);

    // 启动ping监控
    this.startPingMonitoring();
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(error: Error): void {
    this.connectionState = ConnectionState.DISCONNECTED;
    this.initialized = false;

    this.logger.debug(`MCP 服务 ${this.config.name} 连接错误:`, error.message);

    // 清理连接超时定时器
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // 清理当前连接
    this.cleanupConnection();

    // 发射连接失败事件
    this.eventBus.emitEvent("mcp:service:connection:failed", {
      serviceName: this.config.name,
      error,
      attempt: 0,
    });
  }

  /**
   * 清理连接资源
   */
  private cleanupConnection(): void {
    // 停止ping监控
    this.stopPingMonitoring();

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

    // 停止ping监控
    this.stopPingMonitoring();

    // 清理连接资源
    this.cleanupConnection();

    // 设置状态为已断开
    this.connectionState = ConnectionState.DISCONNECTED;

    // 发射断开连接事件
    this.eventBus.emitEvent("mcp:service:disconnected", {
      serviceName: this.config.name,
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
   * 调用工具
   */
  async callTool(
    name: string,
    arguments_: Record<string, unknown>
  ): Promise<ToolCallResult> {
    if (!this.client) {
      throw new Error(`服务 ${this.config.name} 未连接`);
    }

    if (!this.tools.has(name)) {
      throw new Error(`工具 ${name} 在服务 ${this.config.name} 中不存在`);
    }

    this.logger.debug(
      `调用 ${this.config.name} 服务的工具 ${name}，参数:`,
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
  getConfig(): MCPServiceConfig {
    return this.config;
  }

  /**
   * 获取服务状态
   */
  getStatus(): MCPServiceStatus {
    return {
      name: this.config.name,
      connected: this.connectionState === ConnectionState.CONNECTED,
      initialized: this.initialized,
      transportType: this.config.type || MCPTransportType.STREAMABLE_HTTP,
      toolCount: this.tools.size,
      connectionState: this.connectionState,
      // ping状态
      pingEnabled: this.pingOptions.enabled,
      lastPingTime: this.lastPingTime || undefined,
      isPinging: this.isPinging,
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
   * 启动ping监控
   */
  private startPingMonitoring(): void {
    if (!this.pingOptions.enabled || this.pingTimer || !this.isConnected()) {
      return;
    }

    this.logger.debug(
      `${this.config.name} 启动ping监控，间隔: ${this.pingOptions.interval}ms`
    );

    // 延迟启动ping，让连接稳定
    setTimeout(() => {
      if (this.isConnected() && !this.pingTimer) {
        this.pingTimer = setInterval(() => {
          this.performPing();
        }, this.pingOptions.interval);
      }
    }, this.pingOptions.startDelay);
  }

  /**
   * 停止ping监控
   */
  private stopPingMonitoring(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
      this.logger.debug(`${this.config.name} 停止ping监控`);
    }
  }

  /**
   * 执行ping检查
   */
  private async performPing(): Promise<void> {
    if (!this.client || this.isPinging || !this.isConnected()) {
      return;
    }

    this.isPinging = true;
    const startTime = performance.now();

    try {
      await this.client.listTools();
      const duration = performance.now() - startTime;
      this.lastPingTime = new Date();
      this.logger.debug(
        `${this.config.name} ping成功，延迟: ${duration.toFixed(2)}ms`
      );
    } catch (error) {
      this.logger.debug(
        `${this.config.name} ping失败: ${error instanceof Error ? error.message : String(error)}`
      );
      // 只记录日志，不做任何其他操作
    } finally {
      this.isPinging = false;
    }
  }

  /**
   * 启用ping监控
   */
  enablePing(): void {
    this.pingOptions.enabled = true;
    this.logger.info(`${this.config.name} ping监控已启用`);

    // 如果当前已连接，立即启动ping监控
    if (this.isConnected()) {
      this.startPingMonitoring();
    }
  }

  /**
   * 禁用ping监控
   */
  disablePing(): void {
    this.pingOptions.enabled = false;
    this.stopPingMonitoring();
    this.logger.info(`${this.config.name} ping监控已禁用`);
  }

  /**
   * 更新ping配置
   */
  updatePingOptions(options: Partial<PingOptions>): void {
    const wasEnabled = this.pingOptions.enabled;
    this.pingOptions = { ...this.pingOptions, ...options };

    this.logger.info(`${this.config.name} ping配置已更新`, options);

    // 如果启用状态发生变化，相应地启动或停止监控
    if (wasEnabled !== this.pingOptions.enabled) {
      if (this.pingOptions.enabled && this.isConnected()) {
        this.startPingMonitoring();
      } else if (!this.pingOptions.enabled) {
        this.stopPingMonitoring();
      }
    }
  }

  /**
   * 获取ping配置
   */
  getPingOptions(): PingOptions {
    return { ...this.pingOptions };
  }
}
