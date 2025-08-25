/**
 * 优化后的 WebSocket 管理器
 * 专注于实时通知：configUpdate、statusUpdate、restartStatus、心跳检测
 */

import type { AppConfig, ClientStatus } from "../types";

/**
 * WebSocket 消息类型
 */
interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
  error?: {
    code: string;
    message: string;
    timestamp?: number;
  };
}

/**
 * 重启状态接口
 */
interface RestartStatus {
  status: "restarting" | "completed" | "failed";
  error?: string;
  timestamp: number;
}

/**
 * WebSocket 事件监听器类型
 */
interface WebSocketEventListeners {
  connected: () => void;
  disconnected: () => void;
  configUpdate: (config: AppConfig) => void;
  statusUpdate: (status: ClientStatus) => void;
  restartStatus: (status: RestartStatus) => void;
  error: (error: Error) => void;
}

/**
 * WebSocket 连接状态
 */
enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
}

/**
 * WebSocket 管理器配置
 */
interface WebSocketManagerConfig {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
}

/**
 * WebSocket 管理器类
 */
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private listeners: Partial<WebSocketEventListeners> = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectInterval: number;
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private heartbeatInterval: number;
  private heartbeatTimeout: number;
  private lastHeartbeat = 0;

  constructor(config: WebSocketManagerConfig = {}) {
    this.url = config.url || this.getDefaultWebSocketUrl();
    this.maxReconnectAttempts = config.maxReconnectAttempts || 5;
    this.reconnectInterval = config.reconnectInterval || 3000;
    this.heartbeatInterval = config.heartbeatInterval || 30000; // 30秒
    this.heartbeatTimeout = config.heartbeatTimeout || 35000; // 35秒
  }

  /**
   * 获取默认的 WebSocket URL
   */
  private getDefaultWebSocketUrl(): string {
    // 从 localStorage 获取自定义 URL
    const savedUrl = localStorage.getItem("xiaozhi-ws-url");
    if (savedUrl) {
      return savedUrl;
    }

    // 根据当前页面 URL 构建 WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname;
    const port = window.location.port;
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }

  /**
   * 连接 WebSocket
   */
  connect(): void {
    if (this.state === ConnectionState.CONNECTED || this.state === ConnectionState.CONNECTING) {
      return;
    }

    this.state = ConnectionState.CONNECTING;
    console.log(`[WebSocket] 连接到: ${this.url}`);

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error("[WebSocket] 连接失败:", error);
      this.handleConnectionError(error as Error);
    }
  }

  /**
   * 断开 WebSocket 连接
   */
  disconnect(): void {
    console.log("[WebSocket] 主动断开连接");

    this.clearTimers();
    this.state = ConnectionState.DISCONNECTED;
    this.reconnectAttempts = 0;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 设置事件监听器
   */
  on<K extends keyof WebSocketEventListeners>(
    event: K,
    listener: WebSocketEventListeners[K]
  ): void {
    this.listeners[event] = listener;
  }

  /**
   * 移除事件监听器
   */
  off<K extends keyof WebSocketEventListeners>(event: K): void {
    delete this.listeners[event];
  }

  /**
   * 获取连接状态
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 更新 WebSocket URL
   */
  setUrl(url: string): void {
    if (this.url !== url) {
      this.url = url;
      localStorage.setItem("xiaozhi-ws-url", url);

      // 如果当前已连接，重新连接到新 URL
      if (this.isConnected()) {
        this.disconnect();
        setTimeout(() => this.connect(), 1000);
      }
    }
  }

  /**
   * 设置 WebSocket 事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log("[WebSocket] 连接已建立");
      this.state = ConnectionState.CONNECTED;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.listeners.connected?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error("[WebSocket] 消息解析失败:", error);
      }
    };

    this.ws.onclose = (event) => {
      console.log(`[WebSocket] 连接已关闭 (code: ${event.code})`);
      this.handleConnectionClose();
    };

    this.ws.onerror = (error) => {
      console.error("[WebSocket] 连接错误:", error);
      this.handleConnectionError(new Error("WebSocket 连接错误"));
    };
  }

  /**
   * 处理 WebSocket 消息
   */
  private handleMessage(message: WebSocketMessage): void {
    console.log("[WebSocket] 收到消息:", message.type);

    switch (message.type) {
      case "configUpdate":
        if (message.data) {
          this.listeners.configUpdate?.(message.data);
        }
        break;

      case "statusUpdate":
        if (message.data) {
          this.listeners.statusUpdate?.(message.data);
        }
        break;

      case "restartStatus":
        if (message.data) {
          this.listeners.restartStatus?.(message.data);
        }
        break;

      case "heartbeatResponse":
        this.lastHeartbeat = Date.now();
        break;

      case "error":
        console.error("[WebSocket] 服务器错误:", message.error);
        this.listeners.error?.(new Error(message.error?.message || "服务器错误"));
        break;

      default:
        console.log("[WebSocket] 未处理的消息类型:", message.type);
    }
  }

  /**
   * 处理连接关闭
   */
  private handleConnectionClose(): void {
    this.state = ConnectionState.DISCONNECTED;
    this.clearTimers();
    this.listeners.disconnected?.();

    // 如果不是主动断开连接，尝试重连
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      console.error("[WebSocket] 达到最大重连次数，停止重连");
    }
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(error: Error): void {
    this.state = ConnectionState.DISCONNECTED;
    this.clearTimers();
    this.listeners.error?.(error);

    // 尝试重连
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    this.state = ConnectionState.RECONNECTING;

    console.log(
      `[WebSocket] 安排重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts}) 在 ${this.reconnectInterval}ms 后`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  /**
   * 开始心跳检测
   */
  private startHeartbeat(): void {
    this.lastHeartbeat = Date.now();

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        // 发送心跳消息
        this.sendHeartbeat();

        // 检查心跳超时
        const now = Date.now();
        if (now - this.lastHeartbeat > this.heartbeatTimeout) {
          console.warn("[WebSocket] 心跳超时，重新连接");
          this.disconnect();
          this.connect();
        }
      }
    }, this.heartbeatInterval);
  }

  /**
   * 发送心跳消息
   */
  private sendHeartbeat(): void {
    if (this.isConnected()) {
      const heartbeatMessage = {
        type: "clientStatus",
        data: {
          status: "connected" as const,
          timestamp: Date.now(),
        },
      };

      this.ws?.send(JSON.stringify(heartbeatMessage));
    }
  }

  /**
   * 清理定时器
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}

// 创建默认的 WebSocket 管理器实例
export const webSocketManager = new WebSocketManager();

// 导出类型和枚举
export { ConnectionState };
export type {
  WebSocketMessage,
  RestartStatus,
  WebSocketEventListeners,
  WebSocketManagerConfig,
};
