import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import WebSocket from "ws";
import { Logger } from "./logger.js";

export type { Tool };

// MCP 消息接口
interface MCPMessage {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
}

// 连接状态枚举
enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
}

// 重连配置接口
interface ReconnectOptions {
  enabled: boolean; // 是否启用自动重连
  maxAttempts: number; // 最大重连次数
  initialInterval: number; // 初始重连间隔(ms)
  maxInterval: number; // 最大重连间隔(ms)
  backoffStrategy: "linear" | "exponential" | "fixed"; // 退避策略
  backoffMultiplier: number; // 退避倍数
  timeout: number; // 单次连接超时时间(ms)
  jitter: boolean; // 是否添加随机抖动
}

// 重连状态接口
interface ReconnectState {
  attempts: number; // 当前重连次数
  nextInterval: number; // 下次重连间隔
  timer: NodeJS.Timeout | null; // 重连定时器
  lastError: Error | null; // 最后一次错误
  isManualDisconnect: boolean; // 是否为主动断开
}

// 服务器选项接口
interface ProxyMCPServerOptions {
  reconnect?: Partial<ReconnectOptions>;
}

// 服务器状态接口
interface ProxyMCPServerStatus {
  connected: boolean;
  initialized: boolean;
  url: string;
  availableTools: number;
  connectionState: ConnectionState;
  reconnectAttempts: number;
  lastError: string | null;
}

export class ProxyMCPServer {
  private endpointUrl: string;
  private ws: WebSocket | null = null;
  private logger: Logger;
  private isConnected = false;
  private serverInitialized = false;

  // 工具管理
  private tools: Map<string, Tool> = new Map();

  // 连接状态管理
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  // 重连配置
  private reconnectOptions: ReconnectOptions;

  // 重连状态
  private reconnectState: ReconnectState = {
    attempts: 0,
    nextInterval: 0,
    timer: null,
    lastError: null,
    isManualDisconnect: false,
  };

  // 连接超时定时器
  private connectionTimeout: NodeJS.Timeout | null = null;

  constructor(endpointUrl: string, options?: ProxyMCPServerOptions) {
    this.endpointUrl = endpointUrl;
    this.logger = new Logger();

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
    };

    this.reconnectState.nextInterval = this.reconnectOptions.initialInterval;
  }

  /**
   * 设置 MCPServiceManager 实例
   * @param serviceManager MCPServiceManager 实例
   */
  setServiceManager(serviceManager: any): void {
    // 临时存储在一个变量中，避免类型检查问题
    (this as any).serviceManager = serviceManager;
    this.logger.info("已设置 MCPServiceManager");

    // 立即同步工具
    this.syncToolsFromServiceManager();
  }

  /**
   * 从 MCPServiceManager 同步工具
   */
  syncToolsFromServiceManager(): void {
    const serviceManager = (this as any).serviceManager;
    if (!serviceManager) {
      this.logger.warn("MCPServiceManager 未设置，无法同步工具");
      return;
    }

    try {
      // 清空现有工具
      this.tools.clear();

      // 从 MCPServiceManager 获取所有工具
      const allTools = serviceManager.getAllTools();

      for (const toolInfo of allTools) {
        this.tools.set(toolInfo.name, {
          name: toolInfo.name,
          description: toolInfo.description,
          inputSchema: toolInfo.inputSchema,
        });
      }

      this.logger.info(`已从 MCPServiceManager 同步 ${this.tools.size} 个工具`);
    } catch (error) {
      this.logger.error(
        `同步工具失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 添加单个工具
   * @param name 工具名称
   * @param tool 工具定义
   * @param options 工具选项（可选）
   * @returns 返回 this 支持链式调用
   */
  addTool(name: string, tool: Tool): this {
    this.validateTool(name, tool);
    this.tools.set(name, tool);
    this.logger.debug(`工具 '${name}' 已添加`);
    // TODO: 未来可以使用 options 参数来设置工具的启用状态、元数据等
    return this;
  }

  /**
   * 批量添加工具
   * @param tools 工具对象，键为工具名称，值为工具定义
   * @returns 返回 this 支持链式调用
   */
  addTools(tools: Record<string, Tool>): this {
    for (const [name, tool] of Object.entries(tools)) {
      this.addTool(name, tool);
    }
    return this;
  }

  /**
   * 移除单个工具
   * @param name 工具名称
   * @returns 返回 this 支持链式调用
   */
  removeTool(name: string): this {
    if (this.tools.delete(name)) {
      this.logger.debug(`工具 '${name}' 已移除`);
    } else {
      this.logger.warn(`尝试移除不存在的工具: '${name}'`);
    }
    return this;
  }

  /**
   * 获取当前所有工具列表
   * @returns 工具数组
   */
  getTools(): Tool[] {
    // 每次获取工具时都尝试从 MCPServiceManager 同步
    try {
      this.syncToolsFromServiceManager();
    } catch (error) {
      // 静默处理同步错误，不影响现有工具的返回
    }

    return Array.from(this.tools.values());
  }

  /**
   * 检查工具是否存在
   * @param name 工具名称
   * @returns 是否存在
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 验证工具的有效性
   * @param name 工具名称
   * @param tool 工具定义
   */
  private validateTool(name: string, tool: Tool): void {
    if (!name || typeof name !== "string" || name.trim() === "") {
      throw new Error("工具名称必须是非空字符串");
    }

    if (this.tools.has(name)) {
      throw new Error(`工具 '${name}' 已存在`);
    }

    if (!tool || typeof tool !== "object") {
      throw new Error("工具必须是有效的对象");
    }

    // 验证工具的必需字段
    if (!tool.name || typeof tool.name !== "string") {
      throw new Error("工具必须包含有效的 'name' 字段");
    }

    if (!tool.description || typeof tool.description !== "string") {
      throw new Error("工具必须包含有效的 'description' 字段");
    }

    if (!tool.inputSchema || typeof tool.inputSchema !== "object") {
      throw new Error("工具必须包含有效的 'inputSchema' 字段");
    }

    // 验证 inputSchema 的基本结构
    if (!tool.inputSchema.type || !tool.inputSchema.properties) {
      throw new Error(
        "工具的 inputSchema 必须包含 'type' 和 'properties' 字段"
      );
    }
  }

  /**
   * 连接 MCP 接入点
   * @returns 连接成功后的 Promise
   */
  public async connect(): Promise<void> {
    // 连接前验证
    if (this.tools.size === 0) {
      throw new Error("未配置任何工具。请在连接前至少添加一个工具。");
    }

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
   * @returns 连接成功后的 Promise
   */
  private async attemptConnection(): Promise<void> {
    this.connectionState = ConnectionState.CONNECTING;
    this.logger.info(
      `正在连接 MCP 接入点: ${this.endpointUrl} (尝试 ${
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

      this.ws = new WebSocket(this.endpointUrl);

      this.ws.on("open", () => {
        this.handleConnectionSuccess();
        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const message: MCPMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          this.logger.error("MCP 消息解析错误:", error);
        }
      });

      this.ws.on("close", (code, reason) => {
        this.handleConnectionClose(code, reason.toString());
      });

      this.ws.on("error", (error) => {
        this.handleConnectionError(error);
        reject(error);
      });
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

    this.isConnected = true;
    this.connectionState = ConnectionState.CONNECTED;

    // 重置重连状态
    this.reconnectState.attempts = 0;
    this.reconnectState.nextInterval = this.reconnectOptions.initialInterval;
    this.reconnectState.lastError = null;

    this.logger.info("MCP WebSocket 连接已建立");
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
    this.logger.error("MCP WebSocket 错误:", error.message);

    // 清理当前连接
    this.cleanupConnection();
  }

  /**
   * 处理连接关闭
   */
  private handleConnectionClose(code: number, reason: string): void {
    this.isConnected = false;
    this.serverInitialized = false;
    this.logger.info(`MCP 连接已关闭 (代码: ${code}, 原因: ${reason})`);

    // 如果是手动断开，不进行重连
    if (this.reconnectState.isManualDisconnect) {
      this.connectionState = ConnectionState.DISCONNECTED;
      return;
    }

    // 检查是否需要重连
    if (this.shouldReconnect()) {
      this.scheduleReconnect();
    } else {
      this.connectionState = ConnectionState.FAILED;
      this.logger.warn(
        `已达到最大重连次数 (${this.reconnectOptions.maxAttempts})，停止重连`
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
      `将在 ${this.reconnectState.nextInterval}ms 后进行第 ${this.reconnectState.attempts} 次重连`
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
    // 清理 WebSocket
    if (this.ws) {
      // 移除所有事件监听器，防止在关闭时触发错误事件
      this.ws.removeAllListeners();

      // 安全关闭 WebSocket
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close(1000, "Cleaning up connection");
        } else if (this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.terminate(); // 强制终止正在连接的 WebSocket
        }
      } catch (error) {
        // 忽略关闭时的错误
        this.logger.debug("WebSocket 关闭时出现错误（已忽略）:", error);
      }

      this.ws = null;
    }

    // 清理连接超时定时器
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // 重置连接状态
    this.isConnected = false;
    this.serverInitialized = false;
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

  private handleMessage(message: MCPMessage): void {
    this.logger.debug("收到 MCP 消息:", JSON.stringify(message, null, 2));

    if (message.method) {
      this.handleServerRequest(message);
    }
  }

  private handleServerRequest(request: MCPMessage): void {
    switch (request.method) {
      case "initialize":
        this.sendResponse(request.id, {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: true },
            logging: {},
          },
          serverInfo: {
            name: "xiaozhi-mcp-server",
            version: "1.0.0",
          },
        });
        this.serverInitialized = true;
        this.logger.info("MCP 服务器初始化完成");
        break;

      case "tools/list": {
        const toolsList = this.getTools();
        this.sendResponse(request.id, { tools: toolsList });
        this.logger.info(`MCP 工具列表已发送 (${toolsList.length}个工具)`);
        break;
      }

      case "ping":
        this.sendResponse(request.id, {});
        this.logger.debug("回应 MCP ping 消息");
        break;

      default:
        this.logger.warn(`未知的 MCP 请求: ${request.method}`);
    }
  }

  private sendResponse(id: number | string | undefined, result: any): void {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      const response: MCPMessage = {
        jsonrpc: "2.0",
        id,
        result,
      };
      this.ws.send(JSON.stringify(response));
    }
  }

  /**
   * 获取 MCP 服务器状态
   * @returns 服务器状态
   */
  public getStatus(): ProxyMCPServerStatus {
    return {
      connected: this.isConnected,
      initialized: this.serverInitialized,
      url: this.endpointUrl,
      availableTools: this.tools.size,
      connectionState: this.connectionState,
      reconnectAttempts: this.reconnectState.attempts,
      lastError: this.reconnectState.lastError?.message || null,
    };
  }

  /**
   * 主动断开 MCP 连接
   */
  public disconnect(): void {
    this.logger.info("主动断开 MCP 连接");

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
   * 手动重连 MCP 接入点
   */
  public async reconnect(): Promise<void> {
    this.logger.info("手动重连 MCP 接入点");

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
   * 启用自动重连
   */
  public enableReconnect(): void {
    this.reconnectOptions.enabled = true;
    this.logger.info("自动重连已启用");
  }

  /**
   * 禁用自动重连
   */
  public disableReconnect(): void {
    this.reconnectOptions.enabled = false;
    this.stopReconnect();
    this.logger.info("自动重连已禁用");
  }

  /**
   * 更新重连配置
   */
  public updateReconnectOptions(options: Partial<ReconnectOptions>): void {
    this.reconnectOptions = { ...this.reconnectOptions, ...options };
    this.logger.info("重连配置已更新", options);
  }

  /**
   * 获取重连配置
   */
  public getReconnectOptions(): ReconnectOptions {
    return { ...this.reconnectOptions };
  }

  /**
   * 重置重连状态
   */
  public resetReconnectState(): void {
    this.stopReconnect();
    this.reconnectState.attempts = 0;
    this.reconnectState.nextInterval = this.reconnectOptions.initialInterval;
    this.reconnectState.lastError = null;
    this.logger.info("重连状态已重置");
  }
}
