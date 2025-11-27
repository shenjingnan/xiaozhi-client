import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "@root/Logger.js";
import { getEventBus } from "@root/services/EventBus.js";
import { TransportFactory } from "@root/services/TransportFactory.js";
import type {
  MCPServerTransport,
  MCPServiceConfig,
  MCPServiceStatus,
  ToolCallResult,
} from "./types.js";
import { ConnectionState, MCPTransportType } from "./types.js";
import { inferTransportTypeFromConfig } from "./utils.js";

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

  constructor(config: MCPServiceConfig, logger: Logger) {
    this.logger = logger;

    // 使用工具方法推断服务类型
    this.config = inferTransportTypeFromConfig(config);

    // 验证配置
    this.validateConfig();
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
    this.logger.debug(
      `[MCP-${this.config.name}] 正在连接 MCP 服务: ${this.config.name}`
    );

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

    this.logger.info(
      `[MCP-${this.config.name}] MCP 服务 ${this.config.name} 连接已建立`
    );
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
