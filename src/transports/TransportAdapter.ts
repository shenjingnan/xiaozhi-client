/**
 * 传输适配器抽象基类
 * 定义了所有传输协议的统一接口，支持 stdio、SSE、HTTP、WebSocket 等多种传输方式
 * 这是阶段二重构的核心组件，用于抽象不同的传输层实现
 */

import { type Logger, logger } from "../Logger.js";
import type { MCPMessageHandler } from "../core/MCPMessageHandler.js";

// MCP 消息接口
export interface MCPMessage {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id?: string | number;
}

// MCP 响应接口
export interface MCPResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: MCPError;
  id: string | number | null;
}

// MCP 错误接口
export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// 连接状态枚举
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  ERROR = "error",
}

// 传输适配器配置接口
export interface TransportConfig {
  name: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * 传输适配器抽象基类
 * 所有具体的传输适配器都必须继承此类并实现抽象方法
 */
export abstract class TransportAdapter {
  protected logger: Logger;
  protected messageHandler: MCPMessageHandler;
  protected connectionId: string;
  protected config: TransportConfig;
  protected state: ConnectionState = ConnectionState.DISCONNECTED;

  constructor(messageHandler: MCPMessageHandler, config: TransportConfig) {
    this.messageHandler = messageHandler;
    this.config = config;
    this.connectionId = this.generateConnectionId();
    this.logger = logger;
  }

  /**
   * 初始化传输适配器
   * 子类应该在此方法中进行必要的初始化工作
   */
  abstract initialize(): Promise<void>;

  /**
   * 启动传输适配器
   * 子类应该在此方法中启动监听或连接
   */
  abstract start(): Promise<void>;

  /**
   * 停止传输适配器
   * 子类应该在此方法中清理资源和关闭连接
   */
  abstract stop(): Promise<void>;

  /**
   * 发送消息
   * 子类应该实现具体的消息发送逻辑
   */
  abstract sendMessage(message: MCPMessage | MCPResponse): Promise<void>;

  /**
   * 处理接收到的消息
   * 这是一个通用的消息处理方法，子类可以直接使用
   */
  protected async handleIncomingMessage(message: MCPMessage): Promise<void> {
    try {
      this.logger.debug(`处理接收到的消息: ${message.method}`, message);

      const response = await this.messageHandler.handleMessage(message);

      this.logger.debug("发送响应消息:", response);
      await this.sendMessage(response);
    } catch (error) {
      this.logger.error(`处理消息时出错: ${message.method}`, error);

      const errorResponse = this.createErrorResponse(
        error as Error,
        message.id
      );
      await this.sendMessage(errorResponse);
    }
  }

  /**
   * 创建错误响应
   * 统一的错误响应创建方法
   */
  protected createErrorResponse(
    error: Error,
    id?: string | number
  ): MCPResponse {
    // 根据错误类型确定错误代码
    let errorCode = -32603; // Internal error

    if (
      error.message.includes("未找到工具") ||
      error.message.includes("未知的方法")
    ) {
      errorCode = -32601; // Method not found
    } else if (
      error.message.includes("参数") ||
      error.message.includes("不能为空")
    ) {
      errorCode = -32602; // Invalid params
    }

    return {
      jsonrpc: "2.0",
      error: {
        code: errorCode,
        message: error.message,
        data: {
          stack: error.stack,
        },
      },
      id: id || null,
    };
  }

  /**
   * 生成唯一的连接ID
   */
  private generateConnectionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${this.config.name}_${timestamp}_${random}`;
  }

  /**
   * 获取连接ID
   */
  getConnectionId(): string {
    return this.connectionId;
  }

  /**
   * 获取连接状态
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * 设置连接状态
   */
  protected setState(state: ConnectionState): void {
    const oldState = this.state;
    this.state = state;

    if (oldState !== state) {
      this.logger.info(`连接状态变更: ${oldState} -> ${state}`);
      this.onStateChange(oldState, state);
    }
  }

  /**
   * 状态变更回调
   * 子类可以重写此方法来处理状态变更事件
   */
  protected onStateChange(
    oldState: ConnectionState,
    newState: ConnectionState
  ): void {
    // 默认实现为空，子类可以重写
  }

  /**
   * 获取配置
   */
  getConfig(): TransportConfig {
    return { ...this.config };
  }

  /**
   * 获取消息处理器
   */
  getMessageHandler(): MCPMessageHandler {
    return this.messageHandler;
  }

  /**
   * 解析 JSON 消息
   * 统一的 JSON 解析方法，包含错误处理
   */
  protected parseMessage(data: string): MCPMessage | null {
    try {
      const message = JSON.parse(data.trim());

      // 验证基本的 JSON-RPC 格式
      if (!message.jsonrpc || message.jsonrpc !== "2.0") {
        this.logger.warn("收到非 JSON-RPC 2.0 格式的消息", message);
        return null;
      }

      if (!message.method) {
        this.logger.warn("收到没有 method 字段的消息", message);
        return null;
      }

      return message;
    } catch (error) {
      this.logger.error("解析 JSON 消息失败", { data, error });
      return null;
    }
  }

  /**
   * 序列化消息
   * 统一的消息序列化方法
   */
  protected serializeMessage(message: MCPMessage | MCPResponse): string {
    try {
      return JSON.stringify(message);
    } catch (error) {
      this.logger.error("序列化消息失败", { message, error });
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`消息序列化失败: ${errorMessage}`);
    }
  }

  /**
   * 验证消息格式
   * 验证消息是否符合 MCP 协议规范
   */
  protected validateMessage(message: any): boolean {
    if (!message || typeof message !== "object") {
      return false;
    }

    if (message.jsonrpc !== "2.0") {
      return false;
    }

    // 请求消息必须有 method 字段
    if (message.method && typeof message.method !== "string") {
      return false;
    }

    // 响应消息必须有 result 或 error 字段
    if (!message.method && !message.result && !message.error) {
      return false;
    }

    return true;
  }

  /**
   * 处理超时
   * 统一的超时处理方法
   */
  protected createTimeoutPromise<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`操作超时: ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }
}
