/**
 * ESP32设备连接管理
 * 管理单个ESP32设备的WebSocket连接
 */

import { logger } from "@/Logger.js";
import {
  type ESP32ConnectionState,
  ESP32ErrorCode,
  type ESP32HelloMessage,
  type ESP32ServerHelloMessage,
  type ESP32WSMessage,
} from "@/types/esp32.js";
import type WebSocket from "ws";

/**
 * 连接配置
 */
interface ESP32ConnectionConfig {
  /** 消息回调 */
  onMessage: (message: ESP32WSMessage) => Promise<void>;
  /** 关闭回调 */
  onClose: () => void;
  /** 错误回调 */
  onError: (error: Error) => void;
  /** 心跳超时时间（毫秒），默认30秒 */
  heartbeatTimeoutMs?: number;
}

/**
 * ESP32设备连接类
 * 管理单个设备的WebSocket连接生命周期
 */
export class ESP32Connection {
  /** 设备ID */
  private readonly deviceId: string;

  /** 客户端ID */
  private readonly clientId: string;

  /** WebSocket实例 */
  private readonly ws: WebSocket;

  /** 连接状态 */
  private state: ESP32ConnectionState = "connecting";

  /** 最后活动时间 */
  private lastActivity: Date;

  /** 会话ID */
  private sessionId: string;

  /** 配置 */
  private config: Required<ESP32ConnectionConfig>;

  /** 心跳超时时间（毫秒） */
  private readonly heartbeatTimeoutMs: number;

  /** 是否已完成Hello握手 */
  private helloCompleted = false;

  /**
   * 构造函数
   * @param deviceId - 设备ID
   * @param clientId - 客户端ID
   * @param ws - WebSocket实例
   * @param config - 连接配置
   */
  constructor(
    deviceId: string,
    clientId: string,
    ws: WebSocket,
    config: ESP32ConnectionConfig
  ) {
    this.deviceId = deviceId;
    this.clientId = clientId;
    this.ws = ws;
    this.lastActivity = new Date();
    this.sessionId = this.generateSessionId();

    this.heartbeatTimeoutMs = config.heartbeatTimeoutMs ?? 30_000;

    this.config = {
      onMessage: config.onMessage,
      onClose: config.onClose,
      onError: config.onError,
      heartbeatTimeoutMs: this.heartbeatTimeoutMs,
    };

    this.setupWebSocket();
  }

  /**
   * 生成会话ID
   * @returns 会话ID
   */
  private generateSessionId(): string {
    return `${this.deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 设置WebSocket事件监听
   */
  private setupWebSocket(): void {
    this.ws.on("message", async (data: Buffer) => {
      await this.handleMessage(data);
    });

    this.ws.on("close", () => {
      logger.debug(`WebSocket连接关闭: deviceId=${this.deviceId}`);
      this.state = "disconnected";
      this.config.onClose();
    });

    this.ws.on("error", (error: Error) => {
      logger.error(`WebSocket连接错误: deviceId=${this.deviceId}`, error);
      this.config.onError(error);
    });

    this.ws.on("pong", () => {
      this.updateActivity();
    });
  }

  /**
   * 更新活动时间
   */
  private updateActivity(): void {
    this.lastActivity = new Date();
  }

  /**
   * 处理接收到的消息
   * @param data - 消息数据
   */
  private async handleMessage(data: Buffer): Promise<void> {
    this.updateActivity();

    try {
      // 尝试解析为JSON消息
      const text = data.toString("utf-8");
      const message: ESP32WSMessage = JSON.parse(text);

      logger.debug(
        `收到WebSocket消息: deviceId=${this.deviceId}, type=${message.type}`
      );

      // 处理Hello消息
      if (message.type === "hello") {
        await this.handleHello(message as ESP32HelloMessage);
        return;
      }

      // 检查是否已完成Hello握手
      if (!this.helloCompleted) {
        logger.warn(`收到消息但未完成Hello握手: deviceId=${this.deviceId}`);
        await this.sendError(
          ESP32ErrorCode.INVALID_MESSAGE_FORMAT,
          "必须先完成Hello握手"
        );
        return;
      }

      // 调用消息处理回调
      await this.config.onMessage(message);
    } catch (error) {
      // 可能是二进制数据（音频等）
      if (data.length > 0 && !isValidUTF8(data)) {
        logger.debug(
          `收到二进制消息: deviceId=${this.deviceId}, size=${data.length}`
        );
        // 处理为音频消息
        await this.config.onMessage({
          type: "audio",
          data: new Uint8Array(data),
        });
      } else {
        logger.error(`消息解析失败: deviceId=${this.deviceId}`, error);
        await this.sendError(
          ESP32ErrorCode.INVALID_MESSAGE_FORMAT,
          error instanceof Error ? error.message : "消息解析失败"
        );
      }
    }
  }

  /**
   * 处理Hello消息
   * @param message - Hello消息
   */
  private async handleHello(message: ESP32HelloMessage): Promise<void> {
    if (this.helloCompleted) {
      logger.warn(`重复的Hello消息: deviceId=${this.deviceId}`);
      return;
    }

    logger.info(
      `收到设备Hello消息: deviceId=${this.deviceId}, version=${message.version}`
    );

    // 发送ServerHello响应
    const serverHello: ESP32ServerHelloMessage = {
      type: "hello",
      version: 1,
      sessionId: this.sessionId,
    };

    await this.send(serverHello);

    this.helloCompleted = true;
    this.state = "connected";

    logger.info(`Hello握手完成: deviceId=${this.deviceId}`);
  }

  /**
   * 发送消息到设备
   * @param message - 消息内容
   */
  async send(message: ESP32WSMessage): Promise<void> {
    if (this.state === "disconnected") {
      throw new Error(`连接已断开: ${this.deviceId}`);
    }

    try {
      const data = JSON.stringify(message);
      this.ws.send(data);
      this.updateActivity();
      logger.debug(
        `消息已发送: deviceId=${this.deviceId}, type=${message.type}`
      );
    } catch (error) {
      logger.error(`发送消息失败: deviceId=${this.deviceId}`, error);
      throw error;
    }
  }

  /**
   * 发送错误消息
   * @param code - 错误代码
   * @param message - 错误消息
   */
  async sendError(code: ESP32ErrorCode, message: string): Promise<void> {
    try {
      await this.send({
        type: "error",
        code,
        message,
      });
    } catch (error) {
      logger.error(`发送错误消息失败: deviceId=${this.deviceId}`, error);
    }
  }

  /**
   * 检查连接是否超时
   * @returns 是否超时
   */
  checkTimeout(): boolean {
    if (this.state === "disconnected") {
      return false;
    }

    const now = Date.now();
    const elapsed = now - this.lastActivity.getTime();

    if (elapsed > this.heartbeatTimeoutMs) {
      logger.warn(
        `连接超时: deviceId=${this.deviceId}, elapsed=${elapsed}ms, timeout=${this.heartbeatTimeoutMs}ms`
      );
      return true;
    }

    return false;
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.state === "disconnected") {
      return;
    }

    logger.info(`关闭连接: deviceId=${this.deviceId}`);

    this.state = "disconnected";

    return new Promise<void>((resolve) => {
      if (this.ws.readyState === this.ws.OPEN) {
        this.ws.close(1000, "Normal closure");
        // 等待close事件触发
        setTimeout(resolve, 100);
      } else {
        resolve();
      }
    });
  }

  /**
   * 获取设备ID
   */
  getDeviceId(): string {
    return this.deviceId;
  }

  /**
   * 获取客户端ID
   */
  getClientId(): string {
    return this.clientId;
  }

  /**
   * 获取连接状态
   */
  getState(): ESP32ConnectionState {
    return this.state;
  }

  /**
   * 获取会话ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 是否已完成Hello握手
   */
  isHelloCompleted(): boolean {
    return this.helloCompleted;
  }
}

/**
 * 检查Buffer是否为有效的UTF-8
 * @param buffer - Buffer对象
 * @returns 是否为有效UTF-8
 */
function isValidUTF8(buffer: Buffer): boolean {
  try {
    // 尝试解码为UTF-8字符串
    buffer.toString("utf-8");
    // 如果解码后能重新编码回相同的Buffer，则认为是有效的
    const text = buffer.toString("utf-8");
    return Buffer.from(text, "utf-8").equals(buffer);
  } catch {
    return false;
  }
}
