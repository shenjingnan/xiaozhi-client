/**
 * ESP32设备服务
 * 负责ESP32设备的连接管理和消息路由
 */

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
import { ASRService } from "./asr.service.js";
import type { DeviceRegistryService } from "./device-registry.service.js";
import { LLMService } from "./llm.service.js";
import { TTSService } from "./tts.service.js";

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

  /** ASR 服务实例 */
  private asrService: ASRService;

  /** LLM 服务实例 */
  private llmService: LLMService;

  /** TTS 服务实例 */
  private ttsService: TTSService;

  /**
   * 构造函数
   * @param deviceRegistry - 设备注册服务
   */
  constructor(deviceRegistry: DeviceRegistryService) {
    this.deviceRegistry = deviceRegistry;
    this.connections = new Map();
    this.clientIdToDeviceId = new Map();

    // 初始化语音服务
    this.llmService = new LLMService();
    this.asrService = new ASRService({
      events: {
        onResult: async (deviceId, text, isFinal) => {
          // 如果是最终结果，触发 LLM 和 TTS
          if (isFinal && text) {
            try {
              const llmResponse = await this.llmService.chat(text);
              await this.ttsService.speak(deviceId, llmResponse);
            } catch (error) {
              logger.error(
                `[ESP32Service] LLM 或 TTS 调用失败: deviceId=${deviceId}`,
                error
              );
            }
          }
        },
        onError: (deviceId, error) => {
          logger.error(`[ESP32Service] ASR 错误: deviceId=${deviceId}`, error);
        },
      },
    });
    this.ttsService = new TTSService();
  }

  /**
   * 设置 TTS 服务的获取连接回调
   * 需要在 ESP32Service 创建后调用
   */
  setupTTSGetConnection(): void {
    this.ttsService.setGetConnection((deviceId: string) => {
      return this.getConnection(deviceId);
    });
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
        token: "", // 简化为空字符串（向后兼容）
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

    // 如果提供了 Token，记录警告但继续连接（向后兼容）
    if (token) {
      logger.debug(
        `[ESP32Service] 收到Token（已忽略），设备已通过注册验证: deviceId=${deviceId}`
      );
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
      asrService: this.asrService,
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
        // ASR 初始化现在在 ESP32Connection.handleHello() 中处理
        // 这里不再需要重复调用
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
        // 检测到唤醒词，初始化 ASR
        if (text) {
          logger.info(
            `[ESP32Service] 处理唤醒词检测: deviceId=${deviceId}, word="${text}"`
          );
          // 初始化 ASR 服务
          await this.asrService.init(deviceId);
        } else {
          logger.warn(
            `[ESP32Service] 唤醒词消息缺少必要字段: text="${text}", mode=${mode}`
          );
        }
        break;
      case "start":
        logger.info(
          `[ESP32Service] 收到start消息: message=${JSON.stringify(message)}`
        );
        // 开始监听（如果是手动模式，直接开始会话）
        if (mode === "manual" || mode === "realtime") {
          logger.info(
            `[ESP32Service] 开始手动/实时监听会话: deviceId=${deviceId}, mode=${mode}`
          );
          // 开始会话
          const sessionId = `session_${deviceId}_${Date.now()}`;
          logger.info(
            `[ESP32Service] 语音会话已开始: deviceId=${deviceId}, sessionId=${sessionId}`
          );
        } else {
          logger.debug(
            `[ESP32Service] 忽略auto模式的start状态: deviceId=${deviceId}`
          );
        }
        break;
      case "stop":
        // 停止监听，中断当前会话
        logger.info(`[ESP32Service] 停止监听，中断会话: deviceId=${deviceId}`);
        await this.asrService.end(deviceId);
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
    logger.info(`handleAudioMessage 收到音频消息: type=${message.type}`);
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

    // 交给 ASR 服务处理
    await this.asrService.handleAudioData(deviceId, audioData);
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

    // 销毁语音服务
    this.asrService.destroy();
    this.ttsService.destroy();

    logger.debug("ESP32服务已销毁");
  }
}
