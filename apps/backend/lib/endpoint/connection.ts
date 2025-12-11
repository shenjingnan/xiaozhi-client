import type { MCPServiceManager } from "@/lib/mcp/index.js";
import type { MCPMessage } from "@root/types/mcp.js";
import { sliceEndpoint } from "@utils/mcpServerUtils.js";
import WebSocket from "ws";

// 连接状态枚举
enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  FAILED = "failed",
}

export class ProxyMCPServer {
  private endpointUrl: string;
  private ws: WebSocket | null = null;
  private connectionStatus = false;
  private serviceManager: MCPServiceManager | null = null;

  // 连接状态管理
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  // 最后一次错误信息
  private lastError: string | null = null;

  // 连接超时定时器
  private connectionTimeout: NodeJS.Timeout | null = null;

  constructor(endpointUrl: string) {
    this.endpointUrl = endpointUrl;
  }

  /**
   * 设置 MCPServiceManager 实例
   * @param serviceManager MCPServiceManager 实例
   */
  setServiceManager(serviceManager: MCPServiceManager): void {
    this.serviceManager = serviceManager;
    console.info("已设置 MCPServiceManager");
  }

  /**
   * 连接小智接入点
   * @returns 连接成功后的 Promise
   */
  public async connect(): Promise<void> {
    // 连接前验证
    if (!this.serviceManager) {
      throw new Error("MCPServiceManager 未设置。请在连接前先设置服务管理器。");
    }

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
   * @returns 连接成功后的 Promise
   */
  private async attemptConnection(): Promise<void> {
    this.connectionState = ConnectionState.CONNECTING;
    console.debug(`正在连接小智接入点: ${sliceEndpoint(this.endpointUrl)}`);

    return new Promise((resolve, reject) => {
      // 设置连接超时
      this.connectionTimeout = setTimeout(() => {
        const error = new Error("连接超时 (10000ms)");
        this.handleConnectionError(error);
        reject(error);
      }, 10000);

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
          console.error("MCP 消息解析错误:", error);
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

    this.connectionStatus = true;
    this.connectionState = ConnectionState.CONNECTED;

    console.debug("MCP WebSocket 连接已建立");
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(error: Error): void {
    // 记录最后一次错误信息
    this.lastError = error.message;

    // 清理连接超时定时器
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    console.error("MCP WebSocket 错误:", error.message);

    // 清理当前连接
    this.cleanupConnection();
  }

  /**
   * 处理连接关闭
   */
  private handleConnectionClose(code: number, reason: string): void {
    this.connectionStatus = false;
    this.connectionState = ConnectionState.DISCONNECTED;
    console.info(`小智连接已关闭 (代码: ${code}, 原因: ${reason})`);
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
        console.debug("WebSocket 关闭时出现错误（已忽略）:", error);
      }

      this.ws = null;
    }

    // 清理连接超时定时器
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // 重置连接状态
    this.connectionStatus = false;
  }

  private async handleMessage(message: MCPMessage): Promise<void> {
    console.debug("收到 MCP 消息:", JSON.stringify(message, null, 2));

    if (!this.serviceManager) {
      console.error("MCPServiceManager 未设置，无法处理消息");
      return;
    }

    try {
      // 将消息转发给 MCP 层处理
      const response = await this.serviceManager.routeMessage(message);

      // 如果有响应，发送回客户端
      if (response && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(response));
        console.debug("响应已发送", {
          id: response.id,
          responseSize: JSON.stringify(response).length,
        });
      }
    } catch (error) {
      console.error("处理消息时发生错误:", error);
      // 可以选择发送错误响应给客户端
    }
  }

  /**
   * 检查连接状态
   * @returns 是否已连接
   */
  public isConnected(): boolean {
    return this.connectionStatus;
  }

  /**
   * 主动断开 小智连接
   */
  public disconnect(): void {
    console.info("主动断开 小智连接");

    // 清理连接资源
    this.cleanupConnection();

    // 设置状态为已断开
    this.connectionState = ConnectionState.DISCONNECTED;
  }
}
