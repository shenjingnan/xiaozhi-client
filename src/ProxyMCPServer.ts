import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import WebSocket from "ws";
import { type Logger, logger } from "./Logger.js";

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

// 工具调用错误码枚举
export enum ToolCallErrorCode {
  INVALID_PARAMS = -32602, // 无效参数
  TOOL_NOT_FOUND = -32601, // 工具不存在
  TOOL_EXECUTION_ERROR = -32000, // 工具执行错误
  SERVICE_UNAVAILABLE = -32001, // 服务不可用
  TIMEOUT = -32002, // 调用超时
}

// 工具调用错误类
export class ToolCallError extends Error {
  constructor(
    public code: ToolCallErrorCode,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = "ToolCallError";
  }
}

// 工具调用配置接口
interface ToolCallOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

// 性能指标接口
interface PerformanceMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate: number;
  lastUpdated: Date;
}

// 调用记录接口
interface CallRecord {
  id: string;
  toolName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  errorCode?: number;
  errorMessage?: string;
}

// 重试配置接口
interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: ToolCallErrorCode[];
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

  // 性能监控
  private performanceMetrics: PerformanceMetrics = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    averageResponseTime: 0,
    minResponseTime: Number.MAX_VALUE,
    maxResponseTime: 0,
    successRate: 0,
    lastUpdated: new Date(),
  };

  // 调用记录（保留最近100条）
  private callRecords: CallRecord[] = [];
  private readonly maxCallRecords = 100;

  // 重试配置
  private retryConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: [
      ToolCallErrorCode.SERVICE_UNAVAILABLE,
      ToolCallErrorCode.TIMEOUT,
    ],
  };

  // 工具调用配置
  private toolCallConfig: ToolCallOptions = {
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  };

  constructor(endpointUrl: string, options?: ProxyMCPServerOptions) {
    this.endpointUrl = endpointUrl;
    this.logger = logger;

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
   * 优化版本：支持增量同步和错误恢复
   */
  syncToolsFromServiceManager(): void {
    const serviceManager = (this as any).serviceManager;
    if (!serviceManager) {
      this.logger.debug("MCPServiceManager 未设置，跳过工具同步");
      return;
    }

    try {
      // 从 MCPServiceManager 获取所有工具
      const allTools = serviceManager.getAllTools();

      // 原子性更新：先构建新的工具映射，再替换
      const newTools = new Map<string, Tool>();

      for (const toolInfo of allTools) {
        newTools.set(toolInfo.name, {
          name: toolInfo.name,
          description: toolInfo.description,
          inputSchema: toolInfo.inputSchema,
        });
      }

      // 原子性替换
      this.tools = newTools;

      this.logger.info(`已从 MCPServiceManager 同步 ${this.tools.size} 个工具`);
    } catch (error) {
      this.logger.error(
        `同步工具失败: ${error instanceof Error ? error.message : String(error)}`
      );
      // 同步失败时保持现有工具不变，确保服务可用性
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
      case "notifications/initialized":
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
        this.logger.debug(`MCP 工具列表已发送 (${toolsList.length}个工具)`);
        break;
      }

      case "tools/call": {
        // 异步处理工具调用，避免阻塞其他消息
        this.handleToolCall(request).catch((error) => {
          this.logger.error("处理工具调用时发生未捕获错误:", error);
        });
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
    this.logger.debug(
      `尝试发送响应: id=${id}, isConnected=${this.isConnected}, wsReadyState=${this.ws?.readyState}`
    );

    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      const response: MCPMessage = {
        jsonrpc: "2.0",
        id,
        result,
      };

      try {
        this.ws.send(JSON.stringify(response));
        this.logger.info(`响应已发送: id=${id}`, {
          responseSize: JSON.stringify(response).length,
        });
      } catch (error) {
        this.logger.error(`发送响应失败: id=${id}`, error);
      }
    } else {
      this.logger.error(`无法发送响应: id=${id}, 连接状态检查失败`, {
        isConnected: this.isConnected,
        wsReadyState: this.ws?.readyState,
        wsReadyStateText:
          this.ws?.readyState === WebSocket.OPEN
            ? "OPEN"
            : this.ws?.readyState === WebSocket.CONNECTING
              ? "CONNECTING"
              : this.ws?.readyState === WebSocket.CLOSING
                ? "CLOSING"
                : this.ws?.readyState === WebSocket.CLOSED
                  ? "CLOSED"
                  : "UNKNOWN",
      });

      // 尝试重新连接并发送响应
      if (!this.isConnected || this.ws?.readyState !== WebSocket.OPEN) {
        this.logger.warn(`尝试重新连接以发送响应: id=${id}`);
        this.scheduleReconnect();
      }
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

  /**
   * 处理工具调用请求
   */
  private async handleToolCall(request: MCPMessage): Promise<void> {
    // 确保 request.id 存在且类型正确
    if (request.id === undefined || request.id === null) {
      throw new ToolCallError(
        ToolCallErrorCode.INVALID_PARAMS,
        "请求 ID 不能为空"
      );
    }

    // 保持原始 ID 类型（number | string），不进行类型转换
    const requestId = request.id;
    let callRecord: CallRecord | null = null;

    try {
      // 1. 验证请求格式
      const params = this.validateToolCallParams(request.params);

      // 2. 记录调用开始
      callRecord = this.recordCallStart(params.name, requestId);

      this.logger.info(`开始处理工具调用: ${params.name}`, {
        requestId,
        toolName: params.name,
        hasArguments: !!params.arguments,
      });

      // 3. 检查服务管理器是否可用
      const serviceManager = (this as any).serviceManager;
      if (!serviceManager) {
        throw new ToolCallError(
          ToolCallErrorCode.SERVICE_UNAVAILABLE,
          "MCPServiceManager 未设置"
        );
      }

      // 4. 执行工具调用（带重试机制）
      const result = await this.executeToolWithRetry(
        serviceManager,
        params.name,
        params.arguments || {}
      );

      // 5. 发送成功响应
      this.sendResponse(requestId, {
        content: result.content || [
          { type: "text", text: JSON.stringify(result) },
        ],
        isError: result.isError || false,
      });

      // 6. 记录调用成功
      if (callRecord) {
        this.recordCallEnd(callRecord, true);
      }

      this.logger.info(`工具调用成功: ${params.name}`, {
        requestId,
        duration: callRecord?.duration ? `${callRecord.duration}ms` : "unknown",
      });
    } catch (error) {
      // 7. 处理错误并发送错误响应
      if (callRecord) {
        const errorCode =
          error instanceof ToolCallError
            ? error.code
            : ToolCallErrorCode.TOOL_EXECUTION_ERROR;
        const errorMessage =
          error instanceof Error ? error.message : "未知错误";
        this.recordCallEnd(callRecord, false, errorCode, errorMessage);
      }

      this.handleToolCallError(error, requestId, callRecord?.duration || 0);
    }
  }

  /**
   * 验证工具调用参数
   */
  private validateToolCallParams(params: any): {
    name: string;
    arguments?: any;
  } {
    if (!params || typeof params !== "object") {
      throw new ToolCallError(
        ToolCallErrorCode.INVALID_PARAMS,
        "请求参数必须是对象"
      );
    }

    if (!params.name || typeof params.name !== "string") {
      throw new ToolCallError(
        ToolCallErrorCode.INVALID_PARAMS,
        "工具名称必须是非空字符串"
      );
    }

    if (
      params.arguments !== undefined &&
      (typeof params.arguments !== "object" || Array.isArray(params.arguments))
    ) {
      throw new ToolCallError(
        ToolCallErrorCode.INVALID_PARAMS,
        "工具参数必须是对象"
      );
    }

    return {
      name: params.name,
      arguments: params.arguments,
    };
  }

  /**
   * 带重试机制的工具执行
   */
  private async executeToolWithRetry(
    serviceManager: any,
    toolName: string,
    arguments_: any
  ): Promise<any> {
    let lastError: ToolCallError | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await this.executeToolWithTimeout(
          serviceManager,
          toolName,
          arguments_,
          this.toolCallConfig.timeout
        );
      } catch (error) {
        // 确保错误是 ToolCallError 类型
        if (error instanceof ToolCallError) {
          lastError = error;
        } else {
          // 如果不是 ToolCallError，转换为 ToolCallError
          lastError = new ToolCallError(
            ToolCallErrorCode.TOOL_EXECUTION_ERROR,
            error instanceof Error ? error.message : "未知错误"
          );
        }

        // 检查是否是可重试的错误
        if (
          this.retryConfig.retryableErrors.includes(lastError.code) &&
          attempt < this.retryConfig.maxAttempts
        ) {
          // 计算重试延迟
          const delay = Math.min(
            this.retryConfig.initialDelay *
              this.retryConfig.backoffMultiplier ** (attempt - 1),
            this.retryConfig.maxDelay
          );

          this.logger.warn(
            `工具调用失败，将在 ${delay}ms 后重试 (${attempt}/${this.retryConfig.maxAttempts})`,
            {
              toolName,
              error: lastError.message,
              attempt,
              delay,
            }
          );

          // 等待重试延迟
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // 不可重试的错误或已达到最大重试次数
        break;
      }
    }

    // 所有重试都失败了，抛出最后一个错误
    throw lastError;
  }

  /**
   * 带超时控制的工具执行
   */
  private async executeToolWithTimeout(
    serviceManager: any,
    toolName: string,
    arguments_: any,
    timeoutMs = 30000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // 设置超时定时器
      const timeoutId = setTimeout(() => {
        reject(
          new ToolCallError(
            ToolCallErrorCode.TIMEOUT,
            `工具调用超时 (${timeoutMs}ms): ${toolName}`
          )
        );
      }, timeoutMs);

      // 执行工具调用
      serviceManager
        .callTool(toolName, arguments_)
        .then((result: any) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error: any) => {
          clearTimeout(timeoutId);

          // 将内部错误转换为工具调用错误
          if (error.message?.includes("未找到工具")) {
            reject(
              new ToolCallError(
                ToolCallErrorCode.TOOL_NOT_FOUND,
                `工具不存在: ${toolName}`
              )
            );
          } else if (
            error.message?.includes("服务") &&
            error.message?.includes("不可用")
          ) {
            reject(
              new ToolCallError(
                ToolCallErrorCode.SERVICE_UNAVAILABLE,
                error.message
              )
            );
          } else if (error.message?.includes("暂时不可用")) {
            // 处理临时性错误，标记为服务不可用（可重试）
            reject(
              new ToolCallError(
                ToolCallErrorCode.SERVICE_UNAVAILABLE,
                error.message
              )
            );
          } else if (error.message?.includes("持续不可用")) {
            // 处理持续性错误，也标记为服务不可用（可重试）
            reject(
              new ToolCallError(
                ToolCallErrorCode.SERVICE_UNAVAILABLE,
                error.message
              )
            );
          } else {
            reject(
              new ToolCallError(
                ToolCallErrorCode.TOOL_EXECUTION_ERROR,
                `工具执行失败: ${error.message}`
              )
            );
          }
        });
    });
  }

  /**
   * 处理工具调用错误
   */
  private handleToolCallError(
    error: any,
    requestId: string | number | undefined,
    duration: number
  ): void {
    let errorResponse: any;

    if (error instanceof ToolCallError) {
      // 标准工具调用错误
      errorResponse = {
        code: error.code,
        message: error.message,
        data: error.data,
      };
    } else {
      // 未知错误
      errorResponse = {
        code: ToolCallErrorCode.TOOL_EXECUTION_ERROR,
        message: error?.message || "未知错误",
        data: { originalError: error?.toString() || "null" },
      };
    }

    // 发送错误响应
    this.sendErrorResponse(requestId, errorResponse);

    // 记录错误日志
    this.logger.error("工具调用失败", {
      requestId,
      duration: `${duration}ms`,
      error: errorResponse,
    });
  }

  /**
   * 发送错误响应
   */
  private sendErrorResponse(
    id: string | number | undefined,
    error: { code: number; message: string; data?: any }
  ): void {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      const response = {
        jsonrpc: "2.0",
        id,
        error,
      };
      this.ws.send(JSON.stringify(response));
      this.logger.debug("已发送错误响应:", response);
    }
  }

  /**
   * 记录工具调用开始
   */
  private recordCallStart(
    toolName: string,
    requestId: string | number
  ): CallRecord {
    const record: CallRecord = {
      id: String(requestId), // 内部记录时转换为字符串，但不影响响应 ID 类型
      toolName,
      startTime: new Date(),
      success: false,
    };

    // 添加到记录列表
    this.callRecords.push(record);

    // 保持记录数量在限制内
    if (this.callRecords.length > this.maxCallRecords) {
      this.callRecords.shift();
    }

    return record;
  }

  /**
   * 记录工具调用结束
   */
  private recordCallEnd(
    record: CallRecord,
    success: boolean,
    errorCode?: number,
    errorMessage?: string
  ): void {
    record.endTime = new Date();
    record.duration = record.endTime.getTime() - record.startTime.getTime();
    record.success = success;
    record.errorCode = errorCode;
    record.errorMessage = errorMessage;

    // 更新性能指标
    this.updatePerformanceMetrics(record);
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(record: CallRecord): void {
    this.performanceMetrics.totalCalls++;

    if (record.success) {
      this.performanceMetrics.successfulCalls++;
    } else {
      this.performanceMetrics.failedCalls++;
    }

    if (record.duration !== undefined) {
      // 更新响应时间统计
      if (record.duration < this.performanceMetrics.minResponseTime) {
        this.performanceMetrics.minResponseTime = record.duration;
      }
      if (record.duration > this.performanceMetrics.maxResponseTime) {
        this.performanceMetrics.maxResponseTime = record.duration;
      }

      // 计算平均响应时间
      const totalTime = this.callRecords
        .filter((r) => r.duration !== undefined)
        .reduce((sum, r) => sum + (r.duration || 0), 0);
      const completedCalls = this.callRecords.filter(
        (r) => r.duration !== undefined
      ).length;
      this.performanceMetrics.averageResponseTime =
        completedCalls > 0 ? totalTime / completedCalls : 0;
    }

    // 计算成功率
    this.performanceMetrics.successRate =
      this.performanceMetrics.totalCalls > 0
        ? (this.performanceMetrics.successfulCalls /
            this.performanceMetrics.totalCalls) *
          100
        : 0;

    this.performanceMetrics.lastUpdated = new Date();
  }

  /**
   * 获取性能指标
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * 获取调用记录
   */
  public getCallRecords(limit?: number): CallRecord[] {
    const records = [...this.callRecords].reverse(); // 最新的在前
    return limit ? records.slice(0, limit) : records;
  }

  /**
   * 重置性能指标
   */
  public resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageResponseTime: 0,
      minResponseTime: Number.MAX_VALUE,
      maxResponseTime: 0,
      successRate: 0,
      lastUpdated: new Date(),
    };
    this.callRecords = [];
  }

  /**
   * 更新工具调用配置
   */
  public updateToolCallConfig(config: Partial<ToolCallOptions>): void {
    this.toolCallConfig = { ...this.toolCallConfig, ...config };
    this.logger.info("工具调用配置已更新", this.toolCallConfig);
  }

  /**
   * 更新重试配置
   */
  public updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
    this.logger.info("重试配置已更新", this.retryConfig);
  }

  /**
   * 获取当前配置
   */
  public getConfiguration(): {
    toolCall: ToolCallOptions;
    retry: RetryConfig;
  } {
    return {
      toolCall: { ...this.toolCallConfig },
      retry: { ...this.retryConfig },
    };
  }

  /**
   * 获取服务器状态（增强版）
   */
  public getEnhancedStatus(): ProxyMCPServerStatus & {
    performance: PerformanceMetrics;
    configuration: {
      toolCall: ToolCallOptions;
      retry: RetryConfig;
    };
  } {
    return {
      connected: this.isConnected,
      initialized: this.serverInitialized,
      url: this.endpointUrl,
      availableTools: this.tools.size,
      connectionState: this.connectionState,
      reconnectAttempts: this.reconnectState.attempts,
      lastError: this.reconnectState.lastError?.message || null,
      performance: this.getPerformanceMetrics(),
      configuration: this.getConfiguration(),
    };
  }
}
