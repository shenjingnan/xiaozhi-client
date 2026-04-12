/**
 * ESP32 设备连接管理
 * 管理单个 ESP32 设备的 WebSocket 连接
 */

import { randomBytes } from "node:crypto";
import type WebSocket from "ws";
import {
  encodeBinaryProtocol2,
  isBinaryProtocol2,
  isBinaryProtocol3,
  parseBinaryProtocol2,
  parseBinaryProtocol3,
} from "./audio-protocol.js";
import type { IDeviceConnection, ILogger } from "./interfaces.js";
import type { IASRService } from "./services/asr.interface.js";
import type {
  ESP32ConnectionState,
  ESP32HelloMessage,
  ESP32ServerHelloMessage,
  ESP32WSMessage,
} from "./types.js";
import { ESP32ErrorCode } from "./types.js";
import { camelToSnakeCase } from "./utils.js";

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
  /** 心跳超时时间（毫秒），默认 30 秒 */
  heartbeatTimeoutMs?: number;
  /** ASR 服务获取函数（用于获取最新的实例） */
  getASRService: () => IASRService;
  /** 日志器（可选） */
  logger?: ILogger;
}

/**
 * ESP32 设备连接类
 * 管理单个设备的 WebSocket 连接生命周期
 *
 * 同时实现 IDeviceConnection 接口，供 TTS 服务使用
 */
export class ESP32Connection implements IDeviceConnection {
  /** 设备 ID */
  private readonly deviceId: string;

  /** 客户端 ID */
  private readonly clientId: string;

  /** WebSocket 实例 */
  private readonly ws: WebSocket;

  /** 连接状态 */
  private state: ESP32ConnectionState = "connecting";

  /** 最后活动时间 */
  private lastActivity: Date;

  /** 会话 ID */
  private sessionId: string;

  /** 配置 */
  private config: ESP32ConnectionConfig & { heartbeatTimeoutMs: number };

  /** 心跳超时时间（毫秒） */
  private readonly heartbeatTimeoutMs: number;

  /** 是否已完成 Hello 握手 */
  private helloCompleted = false;

  /** ASR 服务获取函数（用于获取最新的实例） */
  private getASRService: () => IASRService;

  /** 日志器 */
  private readonly logger: ILogger;

  /**
   * 构造函数
   * @param deviceId - 设备 ID
   * @param clientId - 客户端 ID
   * @param ws - WebSocket 实例
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
    this.getASRService = config.getASRService;
    this.logger = config.logger ?? (console as unknown as ILogger);

    this.heartbeatTimeoutMs = config.heartbeatTimeoutMs ?? 30_000;

    this.config = {
      onMessage: config.onMessage,
      onClose: config.onClose,
      onError: config.onError,
      heartbeatTimeoutMs: this.heartbeatTimeoutMs,
      getASRService: config.getASRService,
      logger: this.logger,
    };

    this.setupWebSocket();
  }

  /**
   * 生成会话 ID
   * @returns 会话 ID
   */
  private generateSessionId(): string {
    const randomPart = randomBytes(8).toString("hex");
    return `${this.deviceId}-${Date.now()}-${randomPart}`;
  }

  /**
   * 设置 WebSocket 事件监听
   */
  private setupWebSocket(): void {
    this.ws.on("message", async (data: Buffer) => {
      await this.handleMessage(data);
    });

    this.ws.on("close", () => {
      this.logger.debug(`WebSocket连接关闭: deviceId=${this.deviceId}`);
      this.state = "disconnected";
      this.config.onClose();
    });

    this.ws.on("error", (error: Error) => {
      this.logger.error(`WebSocket连接错误: deviceId=${this.deviceId}`, error);
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
      // 尝试解析为 JSON 消息
      const text = data.toString("utf-8");
      const message: ESP32WSMessage = JSON.parse(text);

      this.logger.debug(
        `收到WebSocket消息: deviceId=${this.deviceId}, type=${message.type}`
      );

      // 处理 Hello 消息
      if (message.type === "hello") {
        await this.handleHello(message as ESP32HelloMessage);
        await this.config.onMessage(message);
        return;
      }

      // 检查是否已完成 Hello 握手
      if (!this.helloCompleted) {
        this.logger.warn(
          `收到消息但未完成Hello握手: deviceId=${this.deviceId}`
        );
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
        // 尝试解析为 BinaryProtocol2 音频协议
        if (isBinaryProtocol2(data)) {
          const parsed = parseBinaryProtocol2(data);
          if (parsed) {
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
          this.logger.info("协议2解析失败，尝试其他协议");
        }

        // 尝试解析为 BinaryProtocol3 音频协议
        if (isBinaryProtocol3(data)) {
          const parsed = parseBinaryProtocol3(data);
          if (parsed) {
            this.logger.info(
              `解析音频包成功(协议3): type=${parsed.type}, timestamp=${parsed.timestamp}, payloadSize=${parsed.payload.length}`
            );
            await this.config.onMessage({
              type: "audio",
              data: parsed.payload,
              _parsed: {
                protocolVersion: parsed.protocolVersion,
                dataType: parsed.type,
                timestamp: parsed.timestamp,
              },
            } as ESP32WSMessage);
            return;
          }
          this.logger.info("协议3解析失败，作为原始数据处理");
        }

        const version = data.readUInt16BE(0);
        this.logger.info(
          `音频协议解析失败，作为原始数据处理, version=${version}`
        );
        // 处理为原始音频消息
        await this.config.onMessage({
          type: "audio",
          data: new Uint8Array(data),
        });
      } else {
        this.logger.error(`消息解析失败: deviceId=${this.deviceId}`, error);
        await this.sendError(
          ESP32ErrorCode.INVALID_MESSAGE_FORMAT,
          error instanceof Error ? error.message : "消息解析失败"
        );
      }
    }
  }

  /**
   * 处理 Hello 消息
   * @param message - Hello 消息
   */
  private async handleHello(message: ESP32HelloMessage): Promise<void> {
    if (this.helloCompleted) {
      this.logger.warn(`[HELLO] 重复的Hello消息: deviceId=${this.deviceId}`);
      return;
    }

    this.logger.info(
      `[HELLO] 收到设备Hello消息: deviceId=${this.deviceId}, version=${message.version}`
    );
    this.logger.info(
      `[HELLO] 音频参数: format=${message.audioParams?.format}, sampleRate=${message.audioParams?.sampleRate}, channels=${message.audioParams?.channels}, frameDuration=${message.audioParams?.frameDuration}`
    );
    this.logger.info(
      `[HELLO] 特性: mcp=${message.features?.mcp}, transport=${message.transport}`
    );

    // 发送 ServerHello 响应
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

    this.logger.info(
      `[HELLO] 准备发送ServerHello响应: sessionId=${this.sessionId}`
    );
    await this.send(serverHello);
    this.logger.info("[HELLO] ServerHello响应已发送");

    // 在 Hello 阶段只准备 ASR 服务（不建立连接）
    // 连接会在 start 阶段建立，以支持多次语音交互
    const asrService = this.getASRService();
    if (asrService) {
      this.logger.info(`[HELLO] 准备 ASR 服务: deviceId=${this.deviceId}`);
      await asrService.prepare(this.deviceId);
    }

    this.helloCompleted = true;
    this.state = "connected";

    this.logger.info(
      `[HELLO] Hello握手完成: deviceId=${this.deviceId}, state=${this.state}`
    );
  }

  /**
   * 发送消息到设备（IDeviceConnection 接口实现）
   * @param message - 消息内容
   */
  async send(message: ESP32WSMessage): Promise<void> {
    if (this.state === "disconnected") {
      this.logger.error(
        `[SEND] 连接已断开，无法发送消息: deviceId=${this.deviceId}, type=${message.type}`
      );
      throw new Error(`连接已断开: ${this.deviceId}`);
    }

    try {
      // 转换为 snake_case 以匹配硬件期望
      const snakeCaseMessage = camelToSnakeCase(message);
      const data = JSON.stringify(snakeCaseMessage);

      this.logger.info(
        `[SEND] 发送消息: deviceId=${this.deviceId}, type=${message.type}, data=${data}`
      );

      this.ws.send(data);
      this.updateActivity();

      this.logger.debug(
        `[SEND] 消息已发送: deviceId=${this.deviceId}, type=${message.type}`
      );
    } catch (error) {
      this.logger.error(
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
      this.logger.debug(
        `二进制数据已发送: deviceId=${this.deviceId}, size=${data.length}`
      );
    } catch (error) {
      this.logger.error(`发送二进制数据失败: deviceId=${this.deviceId}`, error);
      throw error;
    }
  }

  /**
   * 发送 BinaryProtocol2 格式的音频数据到设备（IDeviceConnection 接口实现）
   * @param data - 音频载荷数据
   * @param timestamp - 时间戳（毫秒级累加值，用于音频播放顺序）
   */
  async sendBinaryProtocol2(
    data: Uint8Array,
    timestamp?: number
  ): Promise<void> {
    this.logger.debug(
      `[ESP32Connection] sendBinaryProtocol2: deviceId=${this.deviceId}, dataSize=${data.length}`
    );

    // 时间戳为累加值，每帧递增，用于音频播放顺序
    const timestampInMs = timestamp ?? 0;

    const packet = encodeBinaryProtocol2(data, timestampInMs, "opus");

    this.logger.debug(
      `[ESP32Connection] 协议编码完成: deviceId=${this.deviceId}, packetSize=${packet.length}`
    );

    await this.sendBinary(new Uint8Array(packet));
  }

  /**
   * 获取会话 ID（IDeviceConnection 接口实现）
   */
  getSessionId(): string {
    return this.sessionId;
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
      this.logger.error(`发送错误消息失败: deviceId=${this.deviceId}`, error);
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
      this.logger.warn(
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

    this.logger.info(`关闭连接: deviceId=${this.deviceId}`);

    // 如果连接已断开，直接返回
    if (
      this.ws.readyState !== this.ws.OPEN &&
      this.ws.readyState !== this.ws.CONNECTING
    ) {
      this.state = "disconnected";
      return;
    }

    this.state = "disconnected";

    // 等待实际的 close 事件，而不是依赖 setTimeout
    return new Promise<void>((resolve) => {
      // 监听 close 事件
      const onClose = () => {
        this.ws.removeListener("close", onClose);
        resolve();
      };

      this.ws.once("close", onClose);

      // 发起关闭
      this.ws.close(1000, "Normal closure");

      // 设置超时以防 close 事件未触发
      setTimeout(() => {
        this.ws.removeListener("close", onClose);
        resolve();
      }, 1000);
    });
  }

  /**
   * 获取设备 ID
   */
  getDeviceId(): string {
    return this.deviceId;
  }

  /**
   * 获取客户端 ID
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
   * 是否已完成 Hello 握手
   */
  isHelloCompleted(): boolean {
    return this.helloCompleted;
  }
}

/**
 * 检查 Buffer 是否为有效的 UTF-8
 * @param buffer - Buffer 对象
 * @returns 是否为有效 UTF-8
 */
function isValidUTF8(buffer: Buffer): boolean {
  try {
    // 尝试解码为 UTF-8 字符串
    const text = buffer.toString("utf-8");
    // 如果解码后能重新编码回相同的 Buffer，则认为是有效的
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
