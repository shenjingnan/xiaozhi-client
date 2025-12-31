/**
 * 重构后的 WebSocket 管理器
 * 特性：
 * - 严格单例模式
 * - 全局事件总线机制
 * - 完善的错误处理和重连逻辑
 * - 支持多个 store 订阅 WebSocket 事件
 */

import type { AppConfig, ClientStatus } from "@xiaozhi-client/shared-types";

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
 * 接入点状态变更事件数据
 */
export interface EndpointStatusChangedEvent {
  endpoint: string;
  connected: boolean;
  operation: "connect" | "disconnect" | "reconnect";
  success: boolean;
  message?: string;
  timestamp: number;
}

/**
 * NPM 安装日志事件数据
 */
export interface NPMInstallLogEvent {
  version: string;
  installId: string;
  type: "stdout" | "stderr";
  message: string;
  timestamp: number;
}

/**
 * NPM 安装开始事件数据
 */
export interface NPMInstallStartedEvent {
  version: string;
  installId: string;
  timestamp: number;
}

/**
 * NPM 安装完成事件数据
 */
export interface NPMInstallCompletedEvent {
  version: string;
  installId: string;
  success: boolean;
  duration: number;
  timestamp: number;
}

/**
 * NPM 安装失败事件数据
 */
export interface NPMInstallFailedEvent {
  version: string;
  installId: string;
  error: string;
  duration: number;
  timestamp: number;
}

/**
 * 事件总线事件类型
 */
interface EventBusEvents {
  // 连接状态事件
  "connection:connecting": undefined;
  "connection:connected": undefined;
  "connection:disconnected": undefined;
  "connection:reconnecting": { attempt: number; maxAttempts: number };
  "connection:error": { error: Error; context?: string };

  // 数据更新事件
  "data:configUpdate": AppConfig;
  "data:statusUpdate": ClientStatus;
  "data:restartStatus": RestartStatus;

  // 接入点状态事件
  "data:endpointStatusChanged": EndpointStatusChangedEvent;

  // NPM 安装事件
  "data:npmInstallStarted": NPMInstallStartedEvent;
  "data:npmInstallLog": NPMInstallLogEvent;
  "data:npmInstallCompleted": NPMInstallCompletedEvent;
  "data:npmInstallFailed": NPMInstallFailedEvent;

  // 系统事件
  "system:heartbeat": { timestamp: number };
  "system:message": WebSocketMessage;
  "system:error": { error: Error; message?: WebSocketMessage };
}

/**
 * 事件监听器类型
 */
type EventListener<T = any> = (data: T) => void;

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
 * 事件总线类 - 支持多个订阅者
 */
class EventBus {
  private listeners: Map<string, Set<EventListener>> = new Map();

  /**
   * 订阅事件
   */
  on<K extends keyof EventBusEvents>(
    event: K,
    listener: EventListener<EventBusEvents[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // 返回取消订阅函数
    return () => {
      this.off(event, listener);
    };
  }

  /**
   * 取消订阅事件
   */
  off<K extends keyof EventBusEvents>(
    event: K,
    listener: EventListener<EventBusEvents[K]>
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * 发布事件
   */
  emit<K extends keyof EventBusEvents>(
    event: K,
    data: EventBusEvents[K]
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(data);
        } catch (error) {
          console.error(`[EventBus] 事件监听器执行失败 (${event}):`, error);
        }
      }
    }
  }

  /**
   * 清除所有监听器
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * 获取事件监听器数量
   */
  getListenerCount(event?: keyof EventBusEvents): number {
    if (event) {
      return this.listeners.get(event)?.size || 0;
    }
    return Array.from(this.listeners.values()).reduce(
      (total, listeners) => total + listeners.size,
      0
    );
  }
}

/**
 * WebSocket 管理器类 - 严格单例模式
 */
export class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private static isCreating = false;

  private ws: WebSocket | null = null;
  private url: string;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private eventBus: EventBus = new EventBus();
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectInterval: number;
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private heartbeatInterval: number;
  private heartbeatTimeout: number;
  private lastHeartbeat = 0;

  private constructor(config: WebSocketManagerConfig = {}) {
    this.url = config.url || this.getDefaultWebSocketUrl();
    this.maxReconnectAttempts = config.maxReconnectAttempts || 5;
    this.reconnectInterval = config.reconnectInterval || 3000;
    this.heartbeatInterval = config.heartbeatInterval || 30000; // 30秒
    this.heartbeatTimeout = config.heartbeatTimeout || 35000; // 35秒
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: WebSocketManagerConfig): WebSocketManager {
    if (WebSocketManager.instance) {
      return WebSocketManager.instance;
    }

    if (WebSocketManager.isCreating) {
      throw new Error("[WebSocketManager] 检测到循环创建，请检查代码逻辑");
    }

    WebSocketManager.isCreating = true;
    try {
      WebSocketManager.instance = new WebSocketManager(config);
      console.log("[WebSocketManager] 单例实例已创建");
      return WebSocketManager.instance;
    } finally {
      WebSocketManager.isCreating = false;
    }
  }

  /**
   * 重置单例实例（仅用于测试）
   */
  static resetInstance(): void {
    if (WebSocketManager.instance) {
      WebSocketManager.instance.disconnect();
      WebSocketManager.instance.eventBus.clear();
      WebSocketManager.instance = null;
      console.log("[WebSocketManager] 单例实例已重置");
    }
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
    // FIXME: 这里需要通过开发模式显式处理，否则用户如果设置5173端口，会导致强制变成9999端口
    const port = window.location.port === "5173" ? 9999 : window.location.port;
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }

  /**
   * 连接 WebSocket
   */
  connect(): void {
    if (
      this.state === ConnectionState.CONNECTED ||
      this.state === ConnectionState.CONNECTING
    ) {
      return;
    }

    this.state = ConnectionState.CONNECTING;
    console.log(`[WebSocket] 连接到: ${this.url}`);

    // 发布连接中事件
    this.eventBus.emit("connection:connecting", undefined);

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
   * 新的事件订阅方法 - 使用事件总线
   */
  subscribe<K extends keyof EventBusEvents>(
    event: K,
    listener: EventListener<EventBusEvents[K]>
  ): () => void {
    return this.eventBus.on(event, listener);
  }

  /**
   * 取消事件订阅
   */
  unsubscribe<K extends keyof EventBusEvents>(
    event: K,
    listener: EventListener<EventBusEvents[K]>
  ): void {
    this.eventBus.off(event, listener);
  }

  /**
   * 获取事件总线实例（用于高级用法）
   */
  getEventBus(): EventBus {
    return this.eventBus;
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
    return (
      this.state === ConnectionState.CONNECTED &&
      this.ws?.readyState === WebSocket.OPEN
    );
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
   * 发送消息
   */
  send(message: any): boolean {
    if (!this.isConnected()) {
      console.warn("[WebSocket] 连接未建立，无法发送消息");
      return false;
    }

    try {
      const messageStr =
        typeof message === "string" ? message : JSON.stringify(message);
      this.ws!.send(messageStr);
      return true;
    } catch (error) {
      console.error("[WebSocket] 发送消息失败:", error);
      this.eventBus.emit("connection:error", {
        error: error as Error,
        context: "send_message",
      });
      return false;
    }
  }

  /**
   * 获取当前 URL
   */
  getUrl(): string {
    return this.url;
  }

  /**
   * 获取连接统计信息
   */
  getConnectionStats() {
    return {
      state: this.state,
      url: this.url,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      lastHeartbeat: this.lastHeartbeat,
      eventListenerCount: this.eventBus.getListenerCount(),
    };
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

      // 发布连接成功事件
      this.eventBus.emit("connection:connected", undefined);
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

    // 发布原始消息事件
    this.eventBus.emit("system:message", message);

    try {
      switch (message.type) {
        case "configUpdate":
        case "config":
          if (message.data) {
            this.eventBus.emit("data:configUpdate", message.data);
          }
          break;

        case "statusUpdate":
        case "status":
          if (message.data) {
            this.eventBus.emit("data:statusUpdate", message.data);
          }
          break;

        case "restartStatus":
          if (message.data) {
            this.eventBus.emit("data:restartStatus", message.data);
          }
          break;

        case "endpoint_status_changed":
          if (message.data) {
            this.eventBus.emit("data:endpointStatusChanged", message.data);
          }
          break;

        case "npm:install:started":
          if (message.data) {
            this.eventBus.emit("data:npmInstallStarted", message.data);
          }
          break;

        case "npm:install:log":
          if (message.data) {
            this.eventBus.emit("data:npmInstallLog", message.data);
          }
          break;

        case "npm:install:completed":
          if (message.data) {
            this.eventBus.emit("data:npmInstallCompleted", message.data);
          }
          break;

        case "npm:install:failed":
          if (message.data) {
            this.eventBus.emit("data:npmInstallFailed", message.data);
          }
          break;

        case "heartbeatResponse":
          this.lastHeartbeat = Date.now();
          this.eventBus.emit("system:heartbeat", {
            timestamp: this.lastHeartbeat,
          });
          break;

        case "error": {
          const error = new Error(message.error?.message || "服务器错误");
          console.error("[WebSocket] 服务器错误:", message.error);
          this.eventBus.emit("system:error", { error, message });
          this.eventBus.emit("connection:error", {
            error,
            context: "server_error",
          });
          break;
        }

        default:
          console.log("[WebSocket] 未处理的消息类型:", message.type);
      }
    } catch (error) {
      console.error("[WebSocket] 消息处理失败:", error);
      this.eventBus.emit("system:error", {
        error: error as Error,
        message,
      });
    }
  }

  /**
   * 处理连接关闭
   */
  private handleConnectionClose(): void {
    this.state = ConnectionState.DISCONNECTED;
    this.clearTimers();

    // 发布连接断开事件
    this.eventBus.emit("connection:disconnected", undefined);

    // 如果不是主动断开连接，尝试重连
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      console.error("[WebSocket] 达到最大重连次数，停止重连");
      this.eventBus.emit("connection:error", {
        error: new Error("达到最大重连次数"),
        context: "max_reconnect_attempts",
      });
    }
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(error: Error): void {
    this.state = ConnectionState.DISCONNECTED;
    this.clearTimers();

    // 发布连接错误事件
    this.eventBus.emit("connection:error", {
      error,
      context: "connection_error",
    });

    // 尝试重连
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      console.error("[WebSocket] 达到最大重连次数，停止重连");
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

    // 发布重连事件
    this.eventBus.emit("connection:reconnecting", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
    });

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

// 创建默认的 WebSocket 管理器实例（使用单例模式）
export const webSocketManager = WebSocketManager.getInstance();

// 导出类型和枚举
export { ConnectionState };
export type {
  WebSocketMessage,
  RestartStatus,
  WebSocketManagerConfig,
  EventBusEvents,
  EventListener,
};
