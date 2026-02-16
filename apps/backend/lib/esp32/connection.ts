/**
 * ESP32设备连接管理
 * 管理单个ESP32设备的WebSocket连接
 */

import { randomBytes } from "node:crypto";
import { logger } from "@/Logger.js";
import {
  isBinaryProtocol2,
  parseBinaryProtocol2,
} from "@/lib/esp32/audio-protocol-stub.js";
import {
  type ESP32ConnectionState,
  ESP32ErrorCode,
  type ESP32HelloMessage,
  type ESP32ServerHelloMessage,
  type ESP32WSMessage,
} from "@/types/esp32.js";
import { camelToSnakeCase } from "@/utils/esp32-utils.js";
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
    const randomPart = randomBytes(8).toString("hex");
    return `${this.deviceId}-${Date.now()}-${randomPart}`;
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

        // 尝试解析为 BinaryProtocol2 音频协议
        if (isBinaryProtocol2(data)) {
          const parsed = parseBinaryProtocol2(data);
          if (parsed) {
            logger.debug(
              `解析音频包成功: type=${parsed.type}, timestamp=${parsed.timestamp}, payloadSize=${parsed.payload.length}`
            );
            // 处理为解析后的音频消息（附加解析信息）
            await this.config.onMessage({
              type: "audio",
              data: parsed.payload,
              // 附加解析信息供服务层使用
              _parsed: {
                protocolVersion: parsed.protocolVersion,
                dataType: parsed.type,
                timestamp: parsed.timestamp,
              },
            } as ESP32WSMessage);
            return;
          }
          logger.debug("音频协议解析失败，作为原始数据处理");
        }

        // 处理为原始音频消息
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
      logger.warn(`[HELLO] 重复的Hello消息: deviceId=${this.deviceId}`);
      return;
    }

    logger.info(
      `[HELLO] 收到设备Hello消息: deviceId=${this.deviceId}, version=${message.version}`
    );
    logger.info(
      `[HELLO] 音频参数: format=${message.audioParams?.format}, sampleRate=${message.audioParams?.sampleRate}, channels=${message.audioParams?.channels}, frameDuration=${message.audioParams?.frameDuration}`
    );
    logger.info(
      `[HELLO] 特性: mcp=${message.features?.mcp}, transport=${message.transport}`
    );

    // 发送ServerHello响应
    const serverHello: ESP32ServerHelloMessage = {
      type: "hello",
      version: 1,
      transport: "websocket",
      sessionId: this.sessionId,
      audioParams: {
        format: "opus",
        sampleRate: 24000,
        channels: 1,
        frameDuration: 60,
      },
    };

    logger.info(`[HELLO] 准备发送ServerHello响应: sessionId=${this.sessionId}`);
    await this.send(serverHello);
    logger.info("[HELLO] ServerHello响应已发送");

    this.helloCompleted = true;
    this.state = "connected";

    logger.info(
      `[HELLO] Hello握手完成: deviceId=${this.deviceId}, state=${this.state}`
    );
  }

  /**
   * 发送消息到设备
   * @param message - 消息内容
   */
  async send(message: ESP32WSMessage): Promise<void> {
    if (this.state === "disconnected") {
      logger.error(
        `[SEND] 连接已断开，无法发送消息: deviceId=${this.deviceId}, type=${message.type}`
      );
      throw new Error(`连接已断开: ${this.deviceId}`);
    }

    try {
      // 转换为 snake_case 以匹配硬件期望
      const snakeCaseMessage = camelToSnakeCase(message);
      const data = JSON.stringify(snakeCaseMessage);

      logger.info(
        `[SEND] 发送消息: deviceId=${this.deviceId}, type=${message.type}, data=${data}`
      );

      this.ws.send(data);
      this.updateActivity();

      logger.debug(
        `[SEND] 消息已发送: deviceId=${this.deviceId}, type=${message.type}`
      );
    } catch (error) {
      logger.error(
        `[SEND] 发送消息失败: deviceId=${this.deviceId}, type=${message.type}`,
        error
      );
      throw error;
    }
  }

  /**
   * 发送二进制数据到设备
   * @param data - 二进制数据
   */
  async sendBinary(data: Uint8Array): Promise<void> {
    if (this.state === "disconnected") {
      throw new Error(`连接已断开: ${this.deviceId}`);
    }

    try {
      const buffer = Buffer.from(data);
      this.ws.send(buffer);
      this.updateActivity();
      logger.debug(
        `二进制数据已发送: deviceId=${this.deviceId}, size=${data.length}`
      );
    } catch (error) {
      logger.error(`发送二进制数据失败: deviceId=${this.deviceId}`, error);
      throw error;
    }
  }

  /**
   * 发送BinaryProtocol2格式的音频数据到设备
   * @param data - 音频载荷数据
   * @param timestamp - 时间戳（毫秒级，将使用模运算避免uint32溢出）
   */
  async sendBinaryProtocol2(
    data: Uint8Array,
    timestamp?: number
  ): Promise<void> {
    logger.debug(
      `[ESP32Connection] sendBinaryProtocol2: deviceId=${this.deviceId}, dataSize=${data.length}`
    );

    const { encodeBinaryProtocol2 } = await import(
      "@/lib/esp32/audio-protocol-stub.js"
    );

    // 使用毫秒级时间戳，通过模运算避免 uint32 溢出
    // uint32 最大值为 4294967295（约 4294967296 毫秒 ≈ 49.7 天）
    const timestampInMs = (timestamp ?? Date.now()) % 4294967296;

    logger.debug(`[ESP32Connection] 时间戳: ${timestampInMs}ms (uint32范围内)`);

    const packet = encodeBinaryProtocol2(data, timestampInMs, "opus");

    logger.debug(
      `[ESP32Connection] 协议编码完成: deviceId=${this.deviceId}, packetSize=${packet.length}`
    );

    await this.sendBinary(new Uint8Array(packet));
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
    const text = buffer.toString("utf-8");
    // 如果解码后能重新编码回相同的Buffer，则认为是有效的
    const reEncoded = Buffer.from(text, "utf-8");
    if (!reEncoded.equals(buffer)) {
      return false;
    }
    // 检查是否包含 UTF-8 替换字符 \uFFFD
    // 如果存在替换字符，说明原始数据包含无效的 UTF-8 序列
    return !text.includes("\uFFFD");
  } catch {
    return false;
  }
}
