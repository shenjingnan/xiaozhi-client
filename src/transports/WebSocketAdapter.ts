/**
 * WebSocket 传输适配器
 * 阶段四重构：支持 WebSocket 双向通信和自动重连
 *
 * 主要功能：
 * 1. WebSocket 连接管理和自动重连
 * 2. 双向实时通信支持
 * 3. 连接池管理和性能优化
 * 4. 消息压缩和批量处理
 */

import type { MCPMessageHandler } from "@core/MCPMessageHandler.js";
import {
  ConnectionState,
  TransportAdapter,
} from "@transports/TransportAdapter.js";
import type {
  MCPMessage,
  MCPResponse,
  TransportConfig,
} from "@transports/TransportAdapter.js";
import WebSocket, { WebSocketServer } from "ws";

/**
 * WebSocket 连接状态枚举
 */
export enum WebSocketState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
}

/**
 * 重连配置接口
 */
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

/**
 * WebSocket 适配器配置
 */
export interface WebSocketConfig extends TransportConfig {
  endpointUrl: string;
  mode?: "client" | "server";
  reconnect?: Partial<ReconnectOptions>;
  compression?: boolean;
  batchSize?: number;
  batchTimeout?: number;
  maxConnections?: number;
}

/**
 * 重连状态接口
 */
interface ReconnectState {
  attempts: number;
  nextInterval: number;
  timer: NodeJS.Timeout | null;
  lastError: Error | null;
  isManualDisconnect: boolean;
}

/**
 * 消息批处理队列项
 */
interface BatchQueueItem {
  message: MCPMessage | MCPResponse;
  timestamp: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

/**
 * WebSocket 传输适配器实现
 * 支持客户端和服务器模式的 WebSocket 通信
 */
export class WebSocketAdapter extends TransportAdapter {
  private ws: WebSocket | null = null;
  private wsServer: WebSocketServer | null = null;
  private endpointUrl: string;
  private mode: "client" | "server";
  private wsState: WebSocketState = WebSocketState.DISCONNECTED;

  // 重连相关
  private reconnectOptions: ReconnectOptions;
  private reconnectState: ReconnectState;
  private connectionTimeout: NodeJS.Timeout | null = null;

  // 性能优化相关
  private compression: boolean;
  private batchQueue: BatchQueueItem[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private batchSize: number;
  private batchTimeout: number;

  // 连接池管理
  private connections: Map<string, WebSocket> = new Map();
  private maxConnections: number;

  constructor(messageHandler: MCPMessageHandler, config: WebSocketConfig) {
    super(messageHandler, config);

    this.endpointUrl = config.endpointUrl;
    this.mode = config.mode || "client";
    this.compression = config.compression || false;
    this.batchSize = config.batchSize || 10;
    this.batchTimeout = config.batchTimeout || 100;
    this.maxConnections = config.maxConnections || 100;

    // 初始化重连配置
    this.reconnectOptions = {
      enabled: true,
      maxAttempts: 5,
      initialInterval: 1000,
      maxInterval: 30000,
      backoffStrategy: "exponential",
      backoffMultiplier: 1.5,
      timeout: 10000,
      jitter: true,
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
   * 初始化 WebSocket 适配器
   */
  async initialize(): Promise<void> {
    this.logger.info(`初始化 WebSocket 适配器 (${this.mode} 模式)`);

    try {
      this.setState(ConnectionState.CONNECTING);
      this.wsState = WebSocketState.CONNECTING;

      if (this.mode === "client") {
        await this.initializeClient();
      } else {
        await this.initializeServer();
      }

      this.logger.info("WebSocket 适配器初始化完成");
    } catch (error) {
      this.logger.error("WebSocket 适配器初始化失败", error);
      this.setState(ConnectionState.ERROR);
      this.wsState = WebSocketState.FAILED;
      throw error;
    }
  }

  /**
   * 初始化客户端模式
   */
  private async initializeClient(): Promise<void> {
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

      // 启用压缩
      if (this.compression) {
        // WebSocket 压缩扩展会自动处理
      }

      this.ws.on("open", () => {
        this.handleConnectionSuccess();
        resolve();
      });

      this.ws.on("message", (data) => {
        this.handleIncomingData(data);
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
   * 初始化服务器模式
   */
  private async initializeServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(this.endpointUrl);
        const port = Number.parseInt(url.port) || 8080;

        this.wsServer = new WebSocketServer({
          port,
          perMessageDeflate: this.compression,
        });

        this.wsServer.on("connection", (ws, request) => {
          this.handleNewConnection(ws, request);
        });

        this.wsServer.on("error", (error) => {
          this.logger.error("WebSocket 服务器错误", error);
          reject(error);
        });

        this.logger.info(`WebSocket 服务器监听端口 ${port}`);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 启动 WebSocket 适配器
   */
  async start(): Promise<void> {
    if (this.wsState === WebSocketState.CONNECTED) {
      this.logger.warn("WebSocket 适配器已启动");
      return;
    }

    this.logger.info("启动 WebSocket 适配器");

    try {
      this.setState(ConnectionState.CONNECTED);
      this.wsState = WebSocketState.CONNECTED;

      this.logger.info("WebSocket 适配器启动成功");
    } catch (error) {
      this.logger.error("启动 WebSocket 适配器失败", error);
      this.setState(ConnectionState.ERROR);
      this.wsState = WebSocketState.FAILED;
      throw error;
    }
  }

  /**
   * 停止 WebSocket 适配器
   */
  async stop(): Promise<void> {
    this.logger.info("停止 WebSocket 适配器");

    try {
      // 标记为手动断开
      this.reconnectState.isManualDisconnect = true;

      // 清理重连定时器
      if (this.reconnectState.timer) {
        clearTimeout(this.reconnectState.timer);
        this.reconnectState.timer = null;
      }

      // 清理批处理定时器
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }

      // 处理剩余的批处理消息
      await this.flushBatchQueue();

      // 关闭客户端连接
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      // 关闭服务器
      if (this.wsServer) {
        this.wsServer.close();
        this.wsServer = null;
      }

      // 关闭所有连接
      for (const [id, connection] of this.connections) {
        connection.close();
      }
      this.connections.clear();

      this.setState(ConnectionState.DISCONNECTED);
      this.wsState = WebSocketState.DISCONNECTED;

      this.logger.info("WebSocket 适配器已停止");
    } catch (error) {
      this.logger.error("停止 WebSocket 适配器时出错", error);
      throw error;
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(message: MCPMessage | MCPResponse): Promise<void> {
    if (this.wsState !== WebSocketState.CONNECTED) {
      throw new Error(`WebSocket 未连接 (状态: ${this.wsState})`);
    }

    // 如果启用了批处理，添加到队列
    if (this.batchSize > 1) {
      return this.addToBatchQueue(message);
    }

    // 直接发送
    return this.sendMessageDirect(message);
  }

  /**
   * 直接发送消息
   */
  private async sendMessageDirect(
    message: MCPMessage | MCPResponse
  ): Promise<void> {
    try {
      const serializedMessage = this.serializeMessage(message);

      if (this.mode === "client" && this.ws) {
        this.ws.send(serializedMessage);
      } else if (this.mode === "server") {
        // 广播到所有连接
        for (const connection of this.connections.values()) {
          if (connection.readyState === WebSocket.OPEN) {
            connection.send(serializedMessage);
          }
        }
      }

      this.logger.debug("消息已发送", {
        messageId: message.id,
        method: "method" in message ? message.method : "response",
      });
    } catch (error) {
      this.logger.error("发送消息失败", error);
      throw error;
    }
  }

  /**
   * 添加消息到批处理队列
   */
  private async addToBatchQueue(
    message: MCPMessage | MCPResponse
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        message,
        timestamp: Date.now(),
        resolve,
        reject,
      });

      // 如果队列达到批处理大小，立即处理
      if (this.batchQueue.length >= this.batchSize) {
        this.flushBatchQueue();
      } else if (!this.batchTimer) {
        // 设置批处理超时
        this.batchTimer = setTimeout(() => {
          this.flushBatchQueue();
        }, this.batchTimeout);
      }
    });
  }

  /**
   * 刷新批处理队列
   */
  private async flushBatchQueue(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return;
    }

    // 清理定时器
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const batch = this.batchQueue.splice(0);

    try {
      // 批量发送消息
      const messages = batch.map((item) => item.message);
      const batchMessage = {
        jsonrpc: "2.0" as const,
        method: "batch",
        params: { messages },
        id: `batch_${Date.now()}`,
      };

      await this.sendMessageDirect(batchMessage);

      // 解析所有 Promise
      for (const item of batch) {
        item.resolve();
      }

      this.logger.debug(`批处理发送 ${batch.length} 条消息`);
    } catch (error) {
      // 拒绝所有 Promise
      for (const item of batch) {
        item.reject(error as Error);
      }
      this.logger.error("批处理发送失败", error);
    }
  }

  /**
   * 处理接收到的数据
   */
  private async handleIncomingData(data: WebSocket.Data): Promise<void> {
    try {
      const messageStr = data.toString();
      const message = this.parseMessage(messageStr);

      if (message) {
        // 检查是否是批处理消息
        if (message.method === "batch" && message.params?.messages) {
          // 处理批处理消息
          for (const batchedMessage of message.params.messages) {
            await this.handleIncomingMessage(batchedMessage);
          }
        } else {
          await this.handleIncomingMessage(message);
        }
      }
    } catch (error) {
      this.logger.error("处理接收数据失败", error);
    }
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

    this.setState(ConnectionState.CONNECTED);
    this.wsState = WebSocketState.CONNECTED;

    // 重置重连状态
    this.reconnectState.attempts = 0;
    this.reconnectState.nextInterval = this.reconnectOptions.initialInterval;
    this.reconnectState.lastError = null;

    this.logger.info("WebSocket 连接已建立");
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
    this.logger.error("WebSocket 连接错误", error);

    this.setState(ConnectionState.ERROR);
    this.wsState = WebSocketState.FAILED;

    // 清理当前连接
    this.cleanupConnection();
  }

  /**
   * 处理连接关闭
   */
  private handleConnectionClose(code: number, reason: string): void {
    this.setState(ConnectionState.DISCONNECTED);
    this.wsState = WebSocketState.DISCONNECTED;

    this.logger.info(`WebSocket 连接已关闭 (代码: ${code}, 原因: ${reason})`);

    // 如果是手动断开，不进行重连
    if (this.reconnectState.isManualDisconnect) {
      return;
    }

    // 检查是否需要重连
    if (this.shouldReconnect()) {
      this.scheduleReconnect();
    } else {
      this.wsState = WebSocketState.FAILED;
      this.logger.warn(
        `已达到最大重连次数 (${this.reconnectOptions.maxAttempts})，停止重连`
      );
    }
  }

  /**
   * 处理新连接（服务器模式）
   */
  private handleNewConnection(ws: WebSocket, request: any): void {
    // 检查连接数限制
    if (this.connections.size >= this.maxConnections) {
      this.logger.warn("达到最大连接数限制，拒绝新连接");
      ws.close(1013, "服务器繁忙");
      return;
    }

    const connectionId = `${this.getConnectionId()}_${this.connections.size}`;
    this.connections.set(connectionId, ws);

    this.logger.info(`新 WebSocket 连接: ${connectionId}`);

    ws.on("message", (data) => {
      this.handleIncomingData(data);
    });

    ws.on("close", () => {
      this.connections.delete(connectionId);
      this.logger.info(`WebSocket 连接已断开: ${connectionId}`);
    });

    ws.on("error", (error) => {
      this.logger.error(`WebSocket 连接错误 ${connectionId}:`, error);
      this.connections.delete(connectionId);
    });
  }

  /**
   * 清理连接
   */
  private cleanupConnection(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws = null;
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
    this.wsState = WebSocketState.RECONNECTING;
    this.reconnectState.attempts++;

    // 计算重连间隔
    let interval = this.calculateReconnectInterval();

    // 添加随机抖动
    if (this.reconnectOptions.jitter) {
      interval += Math.random() * 1000;
    }

    this.logger.info(
      `安排重连 (第 ${this.reconnectState.attempts} 次，${interval}ms 后)`
    );

    this.reconnectState.timer = setTimeout(async () => {
      try {
        await this.initializeClient();
      } catch (error) {
        this.logger.error("重连失败", error);

        if (this.shouldReconnect()) {
          this.scheduleReconnect();
        } else {
          this.wsState = WebSocketState.FAILED;
        }
      }
    }, interval);
  }

  /**
   * 计算重连间隔
   */
  private calculateReconnectInterval(): number {
    const { backoffStrategy, initialInterval, maxInterval, backoffMultiplier } =
      this.reconnectOptions;
    const attempts = this.reconnectState.attempts;

    let interval: number;

    switch (backoffStrategy) {
      case "linear":
        interval = initialInterval + attempts * 1000;
        break;
      case "exponential":
        interval = initialInterval * backoffMultiplier ** attempts;
        break;
      default:
        interval = initialInterval;
        break;
    }

    return Math.min(interval, maxInterval);
  }

  /**
   * 获取适配器状态
   */
  getStatus(): {
    wsState: WebSocketState;
    connectionState: ConnectionState;
    mode: string;
    endpointUrl: string;
    connectionCount: number;
    reconnectAttempts: number;
    batchQueueSize: number;
    compression: boolean;
  } {
    return {
      wsState: this.wsState,
      connectionState: this.state,
      mode: this.mode,
      endpointUrl: this.endpointUrl,
      connectionCount: this.connections.size,
      reconnectAttempts: this.reconnectState.attempts,
      batchQueueSize: this.batchQueue.length,
      compression: this.compression,
    };
  }

  /**
   * 强制重连
   */
  async forceReconnect(): Promise<void> {
    if (this.mode !== "client") {
      throw new Error("只有客户端模式支持重连");
    }

    this.logger.info("强制重连");

    // 重置重连状态
    this.reconnectState.attempts = 0;
    this.reconnectState.isManualDisconnect = false;

    // 关闭当前连接
    if (this.ws) {
      this.ws.close();
    }

    // 立即重连
    await this.initializeClient();
  }
}
