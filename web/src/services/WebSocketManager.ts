import type { AppConfig, ClientStatus } from "../types";
import {
  buildWebSocketUrl,
  checkPortAvailability,
  extractPortFromUrl,
  pollPortUntilAvailable,
} from "../utils/portUtils";

/**
 * WebSocket 连接状态枚举
 */
export enum WebSocketState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  ERROR = "error",
}

/**
 * 重启状态接口
 */
export interface RestartStatus {
  status: "restarting" | "completed" | "failed";
  error?: string;
  timestamp: number;
}

/**
 * 端口切换状态接口
 */
export interface PortChangeStatus {
  status: "checking" | "polling" | "connecting" | "completed" | "failed";
  targetPort: number;
  currentAttempt?: number;
  maxAttempts?: number;
  timestamp: number;
  error?: string;
}

/**
 * WebSocket 事件接口
 */
export interface WebSocketEvents {
  stateChange: (state: WebSocketState) => void;
  message: (data: any) => void;
  configUpdate: (config: AppConfig) => void;
  statusUpdate: (status: ClientStatus) => void;
  restartStatusUpdate: (status: RestartStatus) => void;
  portChangeStatusUpdate: (status: PortChangeStatus) => void;
  error: (error: Error) => void;
}

/**
 * WebSocket 管理器单例类
 * 负责管理 WebSocket 连接的整个生命周期
 */
export class WebSocketManager {
  private static instance: WebSocketManager;
  private ws: WebSocket | null = null;
  private currentState: WebSocketState = WebSocketState.DISCONNECTED;
  private eventListeners: Map<
    keyof WebSocketEvents,
    ((...args: any[]) => void)[]
  > = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private currentUrl = "";
  private statusCheckInterval: NodeJS.Timeout | null = null;
  private statusCheckIntervalMs = 30000; // 30秒

  /**
   * 获取单例实例
   */
  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * 私有构造函数，确保单例模式
   */
  private constructor() {
    // 初始化时获取 WebSocket URL
    this.currentUrl = this.getWebSocketUrl();
  }

  /**
   * 连接到 WebSocket 服务器
   */
  async connect(url?: string): Promise<void> {
    if (
      this.currentState === WebSocketState.CONNECTING ||
      this.currentState === WebSocketState.CONNECTED
    ) {
      return;
    }

    const targetUrl = url || this.currentUrl;
    this.currentUrl = targetUrl;
    this.setState(WebSocketState.CONNECTING);

    try {
      await this.createWebSocketConnection(targetUrl);
    } catch (error) {
      this.setState(WebSocketState.ERROR);
      this.emit("error", error as Error);
      throw error;
    }
  }

  /**
   * 断开 WebSocket 连接
   */
  disconnect(): void {
    this.stopStatusCheck();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState(WebSocketState.DISCONNECTED);
    this.reconnectAttempts = 0;
  }

  /**
   * 重新连接
   */
  async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState(WebSocketState.ERROR);
      this.emit("error", new Error("达到最大重连次数"));
      return;
    }

    this.setState(WebSocketState.RECONNECTING);
    this.reconnectAttempts++;

    // 指数退避策略
    const delay = this.reconnectDelay * 2 ** (this.reconnectAttempts - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await this.connect(this.currentUrl);
      this.reconnectAttempts = 0; // 重连成功，重置计数
    } catch (error) {
      console.error(
        `[WebSocketManager] 重连失败 (${this.reconnectAttempts}/${this.maxReconnectAttempts}):`,
        error
      );
      // 继续尝试重连
      setTimeout(() => this.reconnect(), 1000);
    }
  }

  /**
   * 发送消息
   */
  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const messageStr =
        typeof message === "string" ? message : JSON.stringify(message);
      this.ws.send(messageStr);
      console.log("[WebSocketManager] 发送消息:", message);
    } else {
      console.warn(
        "[WebSocketManager] WebSocket 未连接，无法发送消息:",
        message
      );
      throw new Error("WebSocket 未连接");
    }
  }

  /**
   * 获取配置
   */
  sendGetConfig(): void {
    this.send({ type: "getConfig" });
  }

  /**
   * 获取状态
   */
  sendGetStatus(): void {
    this.send({ type: "getStatus" });
  }

  /**
   * 更新配置
   */
  async sendUpdateConfig(config: AppConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket 未连接"));
        return;
      }

      // 监听配置更新响应
      const handleConfigUpdate = (_updatedConfig: AppConfig) => {
        this.off("configUpdate", handleConfigUpdate);
        resolve();
      };

      this.on("configUpdate", handleConfigUpdate);

      // 设置超时
      const timeout = setTimeout(() => {
        this.off("configUpdate", handleConfigUpdate);
        reject(new Error("配置更新超时"));
      }, 10000);

      try {
        this.send({ type: "updateConfig", data: config });
      } catch (error) {
        this.off("configUpdate", handleConfigUpdate);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * 重启服务
   */
  async sendRestartService(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket 未连接"));
        return;
      }

      console.log("[WebSocketManager] 发送重启请求");
      this.send({ type: "restartService" });

      // 由于服务重启会断开WebSocket连接，我们等待一段时间让服务重启
      setTimeout(() => {
        console.log("[WebSocketManager] 服务重启等待时间结束");
        resolve();
      }, 5000);
    });
  }

  /**
   * 获取当前状态
   */
  getState(): WebSocketState {
    return this.currentState;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.currentState === WebSocketState.CONNECTED;
  }

  /**
   * 获取当前 URL
   */
  getCurrentUrl(): string {
    return this.currentUrl;
  }

  /**
   * 事件监听
   */
  on<K extends keyof WebSocketEvents>(
    event: K,
    listener: WebSocketEvents[K]
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * 移除事件监听
   */
  off<K extends keyof WebSocketEvents>(
    event: K,
    listener: WebSocketEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
  private emit<K extends keyof WebSocketEvents>(
    event: K,
    ...args: Parameters<WebSocketEvents[K]>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          (listener as any)(...args);
        } catch (error) {
          console.error(`[WebSocketManager] 事件监听器错误 (${event}):`, error);
        }
      }
    }
  }

  /**
   * 设置状态
   */
  private setState(newState: WebSocketState): void {
    if (this.currentState !== newState) {
      const oldState = this.currentState;
      this.currentState = newState;
      console.log(`[WebSocketManager] 状态变化: ${oldState} -> ${newState}`);
      this.emit("stateChange", newState);
    }
  }

  /**
   * 动态获取WebSocket连接地址
   */
  private getWebSocketUrl(configPort?: number): string {
    // 优先使用localStorage中保存的地址
    const savedUrl = localStorage.getItem("xiaozhi-ws-url");
    if (savedUrl) {
      return savedUrl;
    }

    // 确定要使用的端口号
    let targetPort = 9999; // 默认端口

    // 如果传入了配置端口，使用配置端口
    if (configPort) {
      targetPort = configPort;
    } else if (window.location.port) {
      // 如果当前页面有端口号，使用当前页面的端口号
      const currentPort = Number.parseInt(window.location.port);
      if (!Number.isNaN(currentPort)) {
        targetPort = currentPort;
      }
    } else if (window.location.protocol === "http:" && !window.location.port) {
      // 标准 HTTP 端口 (80)
      targetPort = 80;
    } else if (window.location.protocol === "https:" && !window.location.port) {
      // 标准 HTTPS 端口 (443)
      targetPort = 443;
    }

    return buildWebSocketUrl(targetPort);
  }

  /**
   * 创建 WebSocket 连接
   */
  private async createWebSocketConnection(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log(`[WebSocketManager] 连接已建立，URL: ${url}`);
          this.setState(WebSocketState.CONNECTED);

          // 发送初始请求
          this.sendGetConfig();
          this.sendGetStatus();

          // 开始定期查询状态
          this.startStatusCheck();

          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = () => {
          console.log("[WebSocketManager] 连接已断开");
          this.stopStatusCheck();

          if (this.currentState === WebSocketState.CONNECTED) {
            // 意外断开，尝试重连
            this.reconnect();
          } else {
            this.setState(WebSocketState.DISCONNECTED);
          }
        };

        this.ws.onerror = (error) => {
          console.error("[WebSocketManager] WebSocket 错误:", error);
          this.setState(WebSocketState.ERROR);
          this.emit("error", new Error("WebSocket 连接错误"));
          reject(new Error("WebSocket 连接失败"));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      console.log("[WebSocketManager] 收到消息:", message);

      this.emit("message", message);

      // 根据消息类型分发处理
      switch (message.type) {
        case "config":
          console.log("[WebSocketManager] 处理 config 更新:", message.data);
          this.emit("configUpdate", message.data);
          break;
        case "status":
          console.log("[WebSocketManager] 处理 status 更新:", message.data);
          this.emit("statusUpdate", message.data);
          break;
        case "restartStatus":
          console.log(
            "[WebSocketManager] 处理 restartStatus 更新:",
            message.data
          );
          this.emit("restartStatusUpdate", message.data);
          break;
        default:
          console.log("[WebSocketManager] 未处理的消息类型:", message.type);
      }
    } catch (error) {
      console.error("[WebSocketManager] 消息解析失败:", error);
      this.emit("error", error as Error);
    }
  }

  /**
   * 开始状态检查
   */
  private startStatusCheck(): void {
    this.stopStatusCheck(); // 确保没有重复的定时器

    this.statusCheckInterval = setInterval(() => {
      if (this.isConnected()) {
        this.sendGetStatus();
      }
    }, this.statusCheckIntervalMs);
  }

  /**
   * 停止状态检查
   */
  private stopStatusCheck(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  /**
   * 设置自定义 WebSocket URL
   */
  setCustomUrl(url: string): void {
    if (url) {
      localStorage.setItem("xiaozhi-ws-url", url);
    } else {
      localStorage.removeItem("xiaozhi-ws-url");
    }
    // 重新加载页面以应用新的连接地址
    window.location.reload();
  }

  /**
   * 端口切换核心函数
   */
  async changePort(newPort: number): Promise<void> {
    const currentPort = extractPortFromUrl(this.currentUrl) || 9999;

    // 如果端口号相同，直接返回
    if (currentPort === newPort) {
      return;
    }

    // 更新端口切换状态
    this.emit("portChangeStatusUpdate", {
      status: "checking",
      targetPort: newPort,
      timestamp: Date.now(),
    });

    try {
      console.log(
        `[WebSocketManager] 开始端口切换到 ${newPort}，当前连接状态: ${this.isConnected()}`
      );

      if (this.isConnected()) {
        // 场景2：已连接状态 - 先更新配置，然后重启服务，最后轮询新端口
        console.log("[WebSocketManager] 执行已连接状态下的端口切换");
        await this.handleConnectedPortChange(newPort);
      } else {
        // 场景1：未连接状态 - 直接检测新端口并连接
        console.log("[WebSocketManager] 执行未连接状态下的端口切换");
        await this.handleDisconnectedPortChange(newPort);
      }

      // 成功完成端口切换
      console.log(`[WebSocketManager] 端口切换到 ${newPort} 成功完成`);
      this.emit("portChangeStatusUpdate", {
        status: "completed",
        targetPort: newPort,
        timestamp: Date.now(),
      });
    } catch (error) {
      // 端口切换失败
      const errorMessage =
        error instanceof Error ? error.message : "端口切换失败";
      console.error(
        `[WebSocketManager] 端口切换到 ${newPort} 失败:`,
        errorMessage
      );

      this.emit("portChangeStatusUpdate", {
        status: "failed",
        targetPort: newPort,
        timestamp: Date.now(),
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * 处理已连接状态下的端口切换
   */
  private async handleConnectedPortChange(newPort: number): Promise<void> {
    // 1. 更新配置中的端口
    console.log("[WebSocketManager] 步骤1: 更新配置中的端口");
    // 这里需要获取当前配置并更新端口，但由于我们没有直接访问配置的方法
    // 我们假设调用方会处理配置更新，这里直接进行重启

    // 2. 发送重启请求
    console.log("[WebSocketManager] 步骤2: 重启服务");
    this.emit("portChangeStatusUpdate", {
      status: "polling",
      targetPort: newPort,
      currentAttempt: 0,
      maxAttempts: 45,
      timestamp: Date.now(),
    });

    try {
      await this.sendRestartService();
      console.log("[WebSocketManager] 服务重启请求已发送");
    } catch (error) {
      throw new Error(
        `服务重启失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }

    // 3. 轮询新端口 - 增加重试次数和总超时时间
    console.log(`[WebSocketManager] 开始轮询新端口 ${newPort}`);
    const isAvailable = await pollPortUntilAvailable(
      newPort,
      45, // 增加到45次重试
      2000, // 保持2秒间隔
      (attempt, maxAttempts) => {
        console.log(
          `[WebSocketManager] 端口轮询进度: ${attempt}/${maxAttempts}`
        );
        this.emit("portChangeStatusUpdate", {
          status: "polling",
          targetPort: newPort,
          currentAttempt: attempt,
          maxAttempts,
          timestamp: Date.now(),
        });
      }
    );

    if (!isAvailable) {
      throw new Error(
        `新端口 ${newPort} 在90秒超时时间内未可用，请检查服务是否正常启动`
      );
    }

    console.log(`[WebSocketManager] 新端口 ${newPort} 已可用`);

    // 4. 连接到新端口
    await this.connectToNewPort(newPort);
  }

  /**
   * 处理未连接状态下的端口切换
   */
  private async handleDisconnectedPortChange(newPort: number): Promise<void> {
    // 1. 检测新端口是否可用
    const isAvailable = await checkPortAvailability(newPort);

    if (!isAvailable) {
      throw new Error(`端口 ${newPort} 不可用，请检查服务端是否已启动`);
    }

    // 2. 连接到新端口
    await this.connectToNewPort(newPort);
  }

  /**
   * 连接到新端口
   */
  private async connectToNewPort(newPort: number): Promise<void> {
    console.log(`[WebSocketManager] 步骤4: 连接到新端口 ${newPort}`);

    this.emit("portChangeStatusUpdate", {
      status: "connecting",
      targetPort: newPort,
      timestamp: Date.now(),
    });

    try {
      // 构建新的 WebSocket URL
      const newUrl = buildWebSocketUrl(newPort);
      console.log(`[WebSocketManager] 新的WebSocket URL: ${newUrl}`);

      // 保存新的 URL 到 localStorage
      localStorage.setItem("xiaozhi-ws-url", newUrl);
      console.log("[WebSocketManager] 新URL已保存到localStorage");

      // 重新加载页面以建立新连接
      console.log("[WebSocketManager] 重新加载页面以建立新连接");
      window.location.reload();
    } catch (error) {
      throw new Error(
        `连接到新端口失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    }
  }

  /**
   * 重置管理器状态（主要用于测试）
   */
  reset(): void {
    this.disconnect();
    this.eventListeners.clear();
    this.reconnectAttempts = 0;
    this.currentUrl = this.getWebSocketUrl();
  }

  /**
   * 销毁管理器实例（主要用于测试）
   */
  static destroy(): void {
    if (WebSocketManager.instance) {
      WebSocketManager.instance.reset();
      WebSocketManager.instance = null as any;
    }
  }
}
