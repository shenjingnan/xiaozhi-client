/**
 * ESP32设备服务
 * 负责ESP32设备的连接管理和消息路由
 */

import { randomBytes } from "node:crypto";
import { logger } from "@/Logger.js";
import { ESP32Connection } from "@/lib/esp32/connection.js";
import type {
  ESP32DeviceReport,
  ESP32ListenMessage,
  ESP32OTAResponse,
  ESP32WSMessage,
} from "@/types/esp32.js";
import { camelToSnakeCase, extractDeviceInfo } from "@/utils/esp32-utils.js";
import type WebSocket from "ws";
import type { DeviceRegistryService } from "./device-registry.service.js";
import {
  type IVoiceSessionService,
  NoOpVoiceSessionService,
} from "./voice-session.interface.js";

/**
 * WebSocket认证Token有效期（毫秒）
 */
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24小时

/**
 * 生成认证Token
 * @returns 随机Token
 */
function generateToken(
  tokenMap: Map<string, { deviceId: string; expiresAt: number }>
): string {
  // 清理过期的 Token
  const now = Date.now();
  for (const [token, info] of tokenMap.entries()) {
    if (now > info.expiresAt) {
      tokenMap.delete(token);
    }
  }

  const randomPart = randomBytes(16).toString("hex");
  return `${Date.now()}-${randomPart}`;
}

/**
 * ESP32设备服务
 * 管理所有ESP32设备的连接和通信
 */
export class ESP32Service {
  /** 设备注册服务 */
  private deviceRegistry: DeviceRegistryService;

  /** 活跃的设备连接映射（设备ID -> 连接实例） */
  private connections: Map<string, ESP32Connection>;

  /** 客户端ID到设备ID的映射 */
  private clientIdToDeviceId: Map<string, string>;

  /** Token到设备ID的映射（用于WebSocket认证） */
  private tokenToDeviceId: Map<string, { deviceId: string; expiresAt: number }>;

  /** 语音会话服务（可选） */
  private voiceSessionService: IVoiceSessionService;

  /**
   * 构造函数
   * @param deviceRegistry - 设备注册服务
   * @param voiceSessionService - 语音会话服务（可选，默认使用空实现）
   */
  constructor(
    deviceRegistry: DeviceRegistryService,
    voiceSessionService?: IVoiceSessionService
  ) {
    this.deviceRegistry = deviceRegistry;
    this.connections = new Map();
    this.clientIdToDeviceId = new Map();
    this.tokenToDeviceId = new Map();

    // 使用传入的语音会话服务或空实现
    this.voiceSessionService =
      voiceSessionService ?? new NoOpVoiceSessionService();
  }

  /**
   * 处理OTA请求
   * 设备首次连接时自动激活，直接返回WebSocket配置
   * @param deviceId - 设备ID（MAC地址）
   * @param clientId - 客户端ID（设备UUID）
   * @param report - 设备上报信息
   * @param headerInfo - 从请求头获取的设备信息（优先级高于 body）
   * @param host - 请求的 Host 头（格式：IP:PORT 或 DOMAIN:PORT）
   * @returns OTA响应
   */
  async handleOTARequest(
    deviceId: string,
    clientId: string,
    report: ESP32DeviceReport,
    headerInfo?: { deviceModel?: string; deviceVersion?: string },
    host?: string
  ): Promise<ESP32OTAResponse> {
    logger.info(`收到OTA请求: deviceId=${deviceId}, clientId=${clientId}`);

    // 使用工具方法提取设备信息（支持多级回退机制）
    const { boardType, appVersion } = extractDeviceInfo(report, headerInfo);

    // 检查设备是否已存在
    let device = this.deviceRegistry.getDevice(deviceId);

    if (!device) {
      // 设备不存在，自动创建并激活
      device = this.deviceRegistry.createDevice(
        deviceId,
        boardType,
        appVersion
      );
      logger.info(`新设备自动激活: deviceId=${deviceId}`);
    }

    // 更新最后活跃时间
    this.deviceRegistry.updateLastSeen(deviceId);

    // 生成新的WebSocket认证Token
    const token = generateToken(this.tokenToDeviceId);
    const expiresAt = Date.now() + TOKEN_EXPIRY_MS;
    this.tokenToDeviceId.set(token, { deviceId, expiresAt });

    // 获取服务器地址（从请求中获取）
    if (!host) {
      throw new Error("无法获取服务器地址：缺少 Host 头", {
        cause: "MISSING_HOST_HEADER",
      });
    }

    // 如果 host 不包含端口，添加默认端口
    const serverAddress = host.includes(":") ? host : `${host}:9999`;

    // 构建完整的 WebSocket URL
    const wsUrl = `ws://${serverAddress}/ws`;

    logger.info(
      `返回WebSocket配置: deviceId=${deviceId}, clientId=${clientId}, wsUrl=${wsUrl}`
    );

    const response = {
      websocket: {
        url: wsUrl,
        token,
        version: 2,
      },
      serverTime: {
        timestamp: Date.now(),
        // getTimezoneOffset() 返回本地时区与 UTC 的分钟差
        // 乘以 -60 * 1000 转换为毫秒，并取负值使偏移量为正（东时区为正）
        timezoneOffset: new Date().getTimezoneOffset() * -60 * 1000,
      },
      firmware: {
        version: "2.2.2",
        url: "",
        force: false,
      },
    };

    // 转换为下划线命名后返回
    return camelToSnakeCase(response) as ESP32OTAResponse;
  }

  /**
   * 处理WebSocket连接
   * @param ws - WebSocket实例
   * @param deviceId - 设备ID
   * @param clientId - 客户端ID
   * @param token - 认证Token
   */
  async handleWebSocketConnection(
    ws: WebSocket,
    deviceId: string,
    clientId: string,
    token?: string
  ): Promise<void> {
    logger.info(
      `[ESP32Service] 收到WebSocket连接请求: deviceId=${deviceId}, clientId=${clientId}, hasToken=${!!token}`
    );

    // 验证设备是否存在
    const device = this.deviceRegistry.getDevice(deviceId);
    if (!device) {
      logger.warn(`[ESP32Service] 设备未注册，拒绝连接: deviceId=${deviceId}`);
      ws.close(1008, "Device not registered");
      return;
    }

    logger.info(
      `[ESP32Service] 设备已注册: deviceId=${deviceId}, status=${device.status}`
    );

    // 如果提供了Token，验证Token
    if (token) {
      const tokenInfo = this.tokenToDeviceId.get(token);
      if (!tokenInfo) {
        logger.warn(`[ESP32Service] Token无效，拒绝连接: deviceId=${deviceId}`);
        ws.close(1008, "Invalid token");
        return;
      }

      // 检查Token是否过期
      if (Date.now() > tokenInfo.expiresAt) {
        logger.warn(
          `[ESP32Service] Token已过期，拒绝连接: deviceId=${deviceId}`
        );
        this.tokenToDeviceId.delete(token);
        ws.close(1008, "Token expired");
        return;
      }

      // 验证Token对应的设备ID
      if (tokenInfo.deviceId !== deviceId) {
        logger.warn(
          `[ESP32Service] Token与设备ID不匹配，拒绝连接: deviceId=${deviceId}, tokenDeviceId=${tokenInfo.deviceId}`
        );
        ws.close(1008, "Token mismatch");
        return;
      }

      // Token验证通过，删除Token（一次性使用）
      this.tokenToDeviceId.delete(token);
      logger.debug(`[ESP32Service] Token验证通过: deviceId=${deviceId}`);
    }

    // 检查设备是否已有连接
    const existingConnection = this.connections.get(deviceId);
    if (existingConnection) {
      logger.info(
        `[ESP32Service] 设备已有连接，断开旧连接: deviceId=${deviceId}`
      );
      await existingConnection.close();
      this.connections.delete(deviceId);
    }

    // 更新设备状态
    this.deviceRegistry.updateDeviceStatus(deviceId, "active");
    this.deviceRegistry.updateLastSeen(deviceId);

    // 创建新的连接
    const connection = new ESP32Connection(deviceId, clientId, ws, {
      onMessage: async (message) => {
        await this.handleDeviceMessage(deviceId, message);
      },
      onClose: () => {
        this.handleDeviceDisconnect(deviceId, clientId);
      },
      onError: (error) => {
        logger.error(
          `[ESP32Service] 设备连接错误: deviceId=${deviceId}`,
          error
        );
      },
    });

    this.connections.set(deviceId, connection);
    this.clientIdToDeviceId.set(clientId, deviceId);

    logger.info(
      `[ESP32Service] ESP32设备连接已建立: deviceId=${deviceId}, clientId=${clientId}`
    );
  }

  /**
   * 处理设备消息
   * @param deviceId - 设备ID
   * @param message - 消息内容
   */
  private async handleDeviceMessage(
    deviceId: string,
    message: ESP32WSMessage
  ): Promise<void> {
    logger.debug(`收到设备消息: deviceId=${deviceId}, type=${message.type}`);

    // 更新设备最后活跃时间
    this.deviceRegistry.updateLastSeen(deviceId);

    // 根据消息类型处理
    switch (message.type) {
      case "hello":
        // Hello消息在连接层处理
        break;
      case "listen":
        // Listen消息处理（唤醒词检测和监听状态）
        await this.handleListenMessage(deviceId, message as ESP32ListenMessage);
        break;
      case "audio":
        // 音频消息处理
        await this.handleAudioMessage(deviceId, message);
        break;
      case "text":
      case "stt":
      case "tts":
      case "llm":
      case "mcp":
      case "system":
      case "custom":
        // 文本消息处理
        logger.debug(
          `收到文本消息: deviceId=${deviceId}, subtype=${message.type}`
        );
        break;
      default:
        logger.warn(`未知消息类型: ${message.type}`);
    }
  }

  /**
   * 处理Listen消息（唤醒词检测和监听状态）
   * @param deviceId - 设备ID
   * @param message - Listen消息
   */
  private async handleListenMessage(
    deviceId: string,
    message: ESP32ListenMessage
  ): Promise<void> {
    const { state, mode, text } = message;

    logger.info(
      `[ESP32Service] 收到Listen消息: deviceId=${deviceId}, state=${state}, mode=${mode}, text="${text ?? ""}"`
    );

    switch (state) {
      case "detect":
        // 检测到唤醒词，交给VoiceSessionService处理
        if (text) {
          // 使用默认模式 auto（如果没有提供 mode）
          const listenMode = mode ?? "auto";
          logger.info(
            `[ESP32Service] 处理唤醒词检测: deviceId=${deviceId}, word="${text}", mode=${listenMode}`
          );
          await this.voiceSessionService.handleWakeWord?.(
            deviceId,
            text,
            listenMode
          );
        } else {
          logger.warn(
            `[ESP32Service] 唤醒词消息缺少必要字段: text="${text}", mode=${mode}`
          );
        }
        break;
      case "start":
        // 开始监听（如果是手动模式，直接开始会话）
        if (mode === "manual" || mode === "realtime") {
          logger.info(
            `[ESP32Service] 开始手动/实时监听会话: deviceId=${deviceId}, mode=${mode}`
          );
          await this.voiceSessionService.startSession?.(deviceId, mode);
        } else {
          logger.debug(
            `[ESP32Service] 忽略auto模式的start状态: deviceId=${deviceId}`
          );
        }
        break;
      case "stop":
        // 停止监听，中断当前会话
        logger.info(`[ESP32Service] 停止监听，中断会话: deviceId=${deviceId}`);
        await this.voiceSessionService.abortSession?.(deviceId, "用户停止");
        break;
      default:
        logger.warn(`[ESP32Service] 未知的监听状态: ${state}`);
    }
  }

  /**
   * 处理音频消息
   * @param deviceId - 设备ID
   * @param message - 音频消息
   */
  private async handleAudioMessage(
    deviceId: string,
    message: ESP32WSMessage
  ): Promise<void> {
    // 类型守卫：确保消息是音频消息
    if (message.type !== "audio") {
      logger.warn(`handleAudioMessage 收到非音频消息: type=${message.type}`);
      return;
    }

    // 提取音频数据
    const audioData = (message as { data?: Uint8Array }).data;
    if (!audioData) {
      logger.warn(`音频消息无数据: deviceId=${deviceId}`);
      return;
    }

    // 检查是否有解析信息（来自 BinaryProtocol2）
    const parsedInfo = (message as { _parsed?: unknown })._parsed as
      | { protocolVersion: number; dataType: string; timestamp: number }
      | undefined;

    if (parsedInfo) {
      logger.debug(
        `收到解析后的音频消息: deviceId=${deviceId}, protocolVersion=${parsedInfo.protocolVersion}, dataType=${parsedInfo.dataType}, timestamp=${parsedInfo.timestamp}, size=${audioData.length}`
      );
    } else {
      logger.debug(
        `收到原始音频消息: deviceId=${deviceId}, size=${audioData.length}`
      );
    }

    // 交给VoiceSessionService处理
    await this.voiceSessionService.handleAudioData?.(deviceId, audioData);
  }

  /**
   * 处理设备断开连接
   * @param deviceId - 设备ID
   * @param clientId - 客户端ID
   */
  private handleDeviceDisconnect(deviceId: string, clientId: string): void {
    logger.info(`设备断开连接: deviceId=${deviceId}, clientId=${clientId}`);

    this.connections.delete(deviceId);
    this.clientIdToDeviceId.delete(clientId);

    // 更新设备状态
    this.deviceRegistry.updateDeviceStatus(deviceId, "offline");
  }

  /**
   * 获取设备连接
   * @param deviceId - 设备ID
   * @returns 设备连接实例，如果不存在则返回 undefined
   */
  getConnection(deviceId: string): ESP32Connection | undefined {
    return this.connections.get(deviceId);
  }

  /**
   * 销毁服务
   */
  async destroy(): Promise<void> {
    // 断开所有设备连接
    const disconnectPromises = Array.from(
      this.connections.values(),
      (connection) => connection.close()
    );

    await Promise.all(disconnectPromises);

    this.connections.clear();
    this.clientIdToDeviceId.clear();
    this.tokenToDeviceId.clear();

    // 销毁语音会话服务
    this.voiceSessionService.destroy();

    logger.debug("ESP32服务已销毁");
  }
}
