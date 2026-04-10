/**
 * ESP32 设备管理器
 * 负责所有 ESP32 设备的连接管理和消息路由（编排层）
 *
 * 这是新包的核心导出类，整合了：
 * - OTA 配置下发
 * - WebSocket 连接管理
 * - ASR → LLM → TTS 语音交互流水线
 */

import type { ILogger, IESP32ConfigProvider } from "./interfaces.js";
import { noopLogger } from "./interfaces.js";
import { ESP32Connection } from "./connection.js";
import type {
  ESP32DeviceReport,
  ESP32ListenMessage,
  ESP32OTAResponse,
  ESP32WSMessage,
} from "./types.js";
import { camelToSnakeCase, extractDeviceInfo } from "./utils.js";
import type WebSocket from "ws";
import { ASRService } from "./services/asr.service.js";
import { DeviceRegistryService } from "./device-registry.js";
import { LLMService } from "./services/llm.service.js";
import { TTSService } from "./services/tts.service.js";

/**
 * ESP32 设备管理器配置选项
 */
export interface ESP32DeviceManagerOptions {
  /** 日志器（可选） */
  logger?: ILogger;
  /** 配置提供者（可选） */
  configProvider?: IESP32ConfigProvider;
  /** 自定义 WebSocket URL 构建函数（可选） */
  buildWebSocketUrl?: (host: string) => string;
  /** 固件版本（可选，用于 OTA 响应） */
  firmwareVersion?: string;
  /** 固件下载 URL（可选，用于 OTA 响应） */
  firmwareUrl?: string;
  /** 是否强制更新固件（可选） */
  forceUpdate?: boolean;
}

/**
 * ESP32 设备管理器
 * 管理所有 ESP32 设备的连接和通信
 *
 * 设计原则：
 * - 不绑定任何 HTTP 框架
 * - 通过接口注入实现解耦
 * - 核心逻辑完全独立
 */
export class ESP32DeviceManager {
  /** 设备注册服务 */
  private deviceRegistry: DeviceRegistryService;

  /** 活跃的设备连接映射（设备ID -> 连接实例） */
  private connections: Map<string, ESP32Connection>;

  /** 客户端 ID 到设备 ID 的映射 */
  private clientIdToDeviceId: Map<string, string>;

  /** ASR 服务实例 */
  private asrService: ASRService;

  /** LLM 服务实例 */
  private llmService: LLMService | null;

  /** TTS 服务实例 */
  private ttsService: TTSService;

  /** 配置选项 */
  private options: Required<
    Pick<ESP32DeviceManagerOptions, "firmwareVersion" | "firmwareUrl" | "forceUpdate">
  > & {
    buildWebSocketUrl: (host: string) => string;
    logger: ILogger;
    configProvider?: IESP32ConfigProvider;
  };

  /**
   * 构造函数
   * @param options - 配置选项
   */
  constructor(options: ESP32DeviceManagerOptions = {}) {
    this.options = {
      firmwareVersion: options.firmwareVersion ?? "2.2.2",
      firmwareUrl: options.firmwareUrl ?? "",
      forceUpdate: options.forceUpdate ?? false,
      buildWebSocketUrl:
        options.buildWebSocketUrl ??
        ((host: string) => `ws://${host}/ws`),
      logger: options.logger ?? noopLogger,
      configProvider: options.configProvider,
    };

    // 初始化设备注册服务
    this.deviceRegistry = new DeviceRegistryService(this.options.logger);
    this.connections = new Map();
    this.clientIdToDeviceId = new Map();

    // 初始化语音服务
    this.llmService = this.createLLMService();
    this.asrService = this.createASRService();
    this.ttsService = this.createTTSService();
    this.setupTTSGetConnection();
  }

  /**
   * 创建 ASR 服务实例
   * @returns ASR 服务实例
   */
  private createASRService(): ASRService {
    return new ASRService({
      events: {
        onResult: async (deviceId, text, isFinal) => {
          // 如果是最终结果，触发 LLM 和 TTS
          if (isFinal && text) {
            const connection = this.connections.get(deviceId);

            // 异步发送 STT 消息到设备端（不阻塞主流程）
            if (connection) {
              connection
                .send({
                  session_id: connection.getSessionId(),
                  type: "stt",
                  text: text,
                })
                .catch((err) => {
                  this.options.logger.error(
                    `[ESP32DeviceManager] 发送 STT 消息失败: deviceId=${deviceId}`,
                    err
                  );
                });
            }

            try {
              // 在调用 LLM 前重建服务，确保获取最新配置（支持配置热更新）
              this.recreateLLMService();
              if (this.llmService) {
                const llmResponse = await this.llmService.chat(text);
                this.options.logger.info(
                  `[ESP32DeviceManager] LLM 响应: deviceId=${deviceId}, response=${llmResponse}`
                );
                await this.ttsService.speak(deviceId, llmResponse);
              }
            } catch (error) {
              this.options.logger.error(
                `[ESP32DeviceManager] LLM 或 TTS 调用失败: deviceId=${deviceId}`,
                error
              );
            }
          }

          // isFinal 后重建 ASR 服务实例
          if (isFinal) {
            this.recreateASRService();
          }
        },
        onError: (deviceId, error) => {
          this.options.logger.error(`[ESP32DeviceManager] ASR 错误: deviceId=${deviceId}`, error);
        },
      },
      logger: this.options.logger,
      configProvider: this.options.configProvider,
    });
  }

  /**
   * 重建 ASR 服务实例
   * 销毁当前实例并创建新实例，确保每次识别都从干净的状态开始
   */
  private recreateASRService(): void {
    this.options.logger.info("[ESP32DeviceManager] 重建 ASR 服务实例");
    if (this.asrService) {
      this.asrService.destroy();
    }
    this.asrService = this.createASRService();
    this.options.logger.info("[ESP32DeviceManager] ASR 服务实例已重建");
  }

  /**
   * 创建 TTS 服务实例
   * @returns TTS 服务实例
   */
  private createTTSService(): TTSService {
    return new TTSService({
      onTTSComplete: () => {
        // TTS 完成后重建服务实例
        this.recreateTTSService();
      },
      logger: this.options.logger,
      configProvider: this.options.configProvider,
    });
  }

  /**
   * 重建 TTS 服务实例
   * 销毁当前实例并创建新实例，确保每次 TTS 都从干净的状态开始
   */
  private recreateTTSService(): void {
    this.options.logger.info("[ESP32DeviceManager] 重建 TTS 服务实例");
    if (this.ttsService) {
      this.ttsService.destroy();
    }
    this.ttsService = this.createTTSService();
    this.setupTTSGetConnection();
    this.options.logger.info("[ESP32DeviceManager] TTS 服务实例已重建");
  }

  /**
   * 创建 LLM 服务实例
   * @returns LLM 服务实例，如果配置不可用则返回 null
   */
  private createLLMService(): LLMService | null {
    if (!this.options.configProvider) {
      this.options.logger.warn("[ESP32DeviceManager] 未提供配置提供者，LLM 服务不可用");
      return null;
    }

    return new LLMService({
      logger: this.options.logger,
      configProvider: this.options.configProvider,
    });
  }

  /**
   * 重建 LLM 服务实例
   * 确保 LLM 配置更新后能获取最新配置
   */
  private recreateLLMService(): void {
    this.options.logger.info("[ESP32DeviceManager] 重建 LLM 服务实例");
    this.llmService = this.createLLMService();
    this.options.logger.info("[ESP32DeviceManager] LLM 服务实例已重建");
  }

  /**
   * 获取 ASR 服务实例
   * @returns ASR 服务实例
   */
  getASRService(): ASRService {
    return this.asrService;
  }

  /**
   * 设置 TTS 服务的获取连接回调
   * 需要在 ESP32DeviceManager 创建后调用
   */
  setupTTSGetConnection(): void {
    this.ttsService.setGetConnection((deviceId: string) => {
      return this.getConnection(deviceId);
    });
  }

  /**
   * 处理 OTA 请求
   * 设备首次连接时自动激活，直接返回 WebSocket 配置
   * @param deviceId - 设备 ID（MAC 地址）
   * @param clientId - 客户端 ID（设备 UUID）
   * @param report - 设备上报信息
   * @param headerInfo - 从请求头获取的设备信息（优先级高于 body）
   * @param host - 请求的 Host 头（格式：IP:PORT 或 DOMAIN:PORT）
   * @returns OTA 响应
   */
  async handleOTARequest(
    deviceId: string,
    clientId: string,
    report: ESP32DeviceReport,
    headerInfo?: { deviceModel?: string; deviceVersion?: string },
    host?: string
  ): Promise<ESP32OTAResponse> {
    this.options.logger.info(`收到OTA请求: deviceId=${deviceId}, clientId=${clientId}`);

    // 使用工具方法提取设备信息（支持多级回退机制）
    const { boardType, appVersion } = extractDeviceInfo(report, headerInfo);

    // 检查设备是否已存在
    let device = this.deviceRegistry.getDevice(deviceId);

    if (!device) {
      // 设备不存在，自动创建并激活
      device = this.deviceRegistry.createDevice(deviceId, boardType, appVersion);
      this.options.logger.info(`新设备自动激活: deviceId=${deviceId}`);
    }

    // 更新最后活跃时间
    this.deviceRegistry.updateLastSeen(deviceId);

    // 获取服务器地址（从请求中获取）
    if (!host) {
      throw new Error("无法获取服务器地址：缺少 Host 头", {
        cause: "MISSING_HOST_HEADER",
      });
    }

    // 使用自定义或默认的 URL 构建方式
    const wsUrl = this.options.buildWebSocketUrl(host);

    this.options.logger.info(
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
        version: this.options.firmwareVersion,
        url: this.options.firmwareUrl,
        force: this.options.forceUpdate,
      },
    };

    // 转换为下划线命名后返回
    return camelToSnakeCase(response) as ESP32OTAResponse;
  }

  /**
   * 处理 WebSocket 连接
   * @param ws - WebSocket 实例
   * @param deviceId - 设备 ID
   * @param clientId - 客户端 ID
   * @param token - 认证 Token
   */
  async handleWebSocketConnection(
    ws: WebSocket,
    deviceId: string,
    clientId: string,
    token?: string
  ): Promise<void> {
    this.options.logger.info(
      `[ESP32DeviceManager] 收到WebSocket连接请求: deviceId=${deviceId}, clientId=${clientId}, hasToken=${!!token}`
    );

    // 验证设备是否存在
    const device = this.deviceRegistry.getDevice(deviceId);
    if (!device) {
      this.options.logger.warn(`[ESP32DeviceManager] 设备未注册，拒绝连接: deviceId=${deviceId}`);
      ws.close(1008, "Device not registered");
      return;
    }

    this.options.logger.info(
      `[ESP32DeviceManager] 设备已注册: deviceId=${deviceId}, status=${device.status}`
    );

    // 如果提供了 Token，记录警告但继续连接（向后兼容）
    if (token) {
      this.options.logger.debug(
        `[ESP32DeviceManager] 收到Token（已忽略），设备已通过注册验证: deviceId=${deviceId}`
      );
    }

    // 检查设备是否已有连接
    const existingConnection = this.connections.get(deviceId);
    if (existingConnection) {
      this.options.logger.info(
        `[ESP32DeviceManager] 设备已有连接，断开旧连接: deviceId=${deviceId}`
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
        this.options.logger.error(
          `[ESP32DeviceManager] 设备连接错误: deviceId=${deviceId}`,
          error
        );
      },
      // 使用 getter 函数获取最新的 ASR 服务实例
      getASRService: () => this.asrService,
      logger: this.options.logger,
    });

    this.connections.set(deviceId, connection);
    this.clientIdToDeviceId.set(clientId, deviceId);

    this.options.logger.info(
      `[ESP32DeviceManager] ESP32设备连接已建立: deviceId=${deviceId}, clientId=${clientId}`
    );
  }

  /**
   * 处理设备消息
   * @param deviceId - 设备 ID
   * @param message - 消息内容
   */
  private async handleDeviceMessage(
    deviceId: string,
    message: ESP32WSMessage
  ): Promise<void> {
    this.options.logger.debug(`收到设备消息: deviceId=${deviceId}, type=${message.type}`);

    // 更新设备最后活跃时间
    this.deviceRegistry.updateLastSeen(deviceId);

    // 根据消息类型处理
    switch (message.type) {
      case "hello":
        // ASR 初始化现在在 ESP32Connection.handleHello() 中处理
        // 这里不再需要重复调用
        break;
      case "listen":
        // Listen 消息处理（唤醒词检测和监听状态）
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
        this.options.logger.debug(
          `收到文本消息: deviceId=${deviceId}, subtype=${message.type}`
        );
        break;
      default:
        this.options.logger.warn(`未知消息类型: ${message.type}`);
    }
  }

  /**
   * 处理 Listen 消息（唤醒词检测和监听状态）
   * @param deviceId - 设备 ID
   * @param message - Listen 消息
   */
  private async handleListenMessage(
    deviceId: string,
    message: ESP32ListenMessage
  ): Promise<void> {
    const { state, mode, text } = message;

    this.options.logger.info(
      `[ESP32DeviceManager] 收到Listen消息: deviceId=${deviceId}, state=${state}, mode=${mode}, text="${text ?? ""}"`
    );

    switch (state) {
      case "detect":
        // 检测到唤醒词，初始化 ASR
        if (text) {
          this.options.logger.info(
            `[ESP32DeviceManager] 处理唤醒词检测: deviceId=${deviceId}, word="${text}"`
          );
          // 初始化 ASR 服务
          await this.asrService.init(deviceId);
        } else {
          this.options.logger.warn(
            `[ESP32DeviceManager] 唤醒词消息缺少必要字段: text="${text}", mode=${mode}`
          );
        }
        break;
      case "start":
        this.options.logger.info(
          `[ESP32DeviceManager] 收到start消息: message=${JSON.stringify(message)}`
        );
        // 开始监听，建立 ASR 连接
        // 注意：硬件端会在发送 start 消息后立刻发送音频数据
        // 所以这里需要尽快建立连接，音频数据会在缓冲区中等待
        await this.asrService.connect(deviceId);
        if (mode === "manual" || mode === "realtime") {
          this.options.logger.info(
            `[ESP32DeviceManager] 开始手动/实时监听会话: deviceId=${deviceId}, mode=${mode}`
          );
          // 开始会话
          const sessionId = `session_${deviceId}_${Date.now()}`;
          this.options.logger.info(
            `[ESP32DeviceManager] 语音会话已开始: deviceId=${deviceId}, sessionId=${sessionId}`
          );
        } else {
          this.options.logger.debug(
            `[ESP32DeviceManager] 忽略auto模式的start状态: deviceId=${deviceId}`
          );
        }
        break;
      case "stop":
        // 停止监听，中断当前会话
        this.options.logger.info(`[ESP32DeviceManager] 停止监听，中断会话: deviceId=${deviceId}`);
        await this.asrService.end(deviceId);
        break;
      default:
        this.options.logger.warn(`[ESP32DeviceManager] 未知的监听状态: ${state}`);
    }
  }

  /**
   * 处理音频消息
   * @param deviceId - 设备 ID
   * @param message - 音频消息
   */
  private async handleAudioMessage(
    deviceId: string,
    message: ESP32WSMessage
  ): Promise<void> {
    // 类型守卫：确保消息是音频消息
    if (message.type !== "audio") {
      this.options.logger.warn(`handleAudioMessage 收到非音频消息: type=${message.type}`);
      return;
    }

    // 提取音频数据
    const audioData = (message as { data?: Uint8Array }).data;
    if (!audioData) {
      this.options.logger.warn(`音频消息无数据: deviceId=${deviceId}`);
      return;
    }

    // 检查是否有解析信息（来自 BinaryProtocol2）
    const parsedInfo = (message as { _parsed?: unknown })._parsed as
      | { protocolVersion: number; dataType: string; timestamp: number }
      | undefined;

    if (parsedInfo) {
      this.options.logger.debug(
        `收到解析后的音频消息: deviceId=${deviceId}, protocolVersion=${parsedInfo.protocolVersion}, dataType=${parsedInfo.dataType}, timestamp=${parsedInfo.timestamp}, size=${audioData.length}`
      );
    } else {
      this.options.logger.debug(
        `收到原始音频消息: deviceId=${deviceId}, size=${audioData.length}`
      );
    }

    // 交给 ASR 服务处理
    await this.asrService.handleAudioData(deviceId, audioData);
  }

  /**
   * 处理设备断开连接
   * @param deviceId - 设备 ID
   * @param clientId - 客户端 ID
   */
  private handleDeviceDisconnect(deviceId: string, clientId: string): void {
    this.options.logger.info(`设备断开连接: deviceId=${deviceId}, clientId=${clientId}`);

    this.connections.delete(deviceId);
    this.clientIdToDeviceId.delete(clientId);

    // 更新设备状态
    this.deviceRegistry.updateDeviceStatus(deviceId, "offline");
  }

  /**
   * 获取设备连接
   * @param deviceId - 设备 ID
   * @returns 设备连接实例，如果不存在则返回 undefined
   */
  getConnection(deviceId: string): ESP32Connection | undefined {
    return this.connections.get(deviceId);
  }

  /**
   * 获取设备信息
   * @param deviceId - 设备 ID
   * @returns 设备信息，如果不存在则返回 null
   */
  getDevice(deviceId: string): import("./types.js").ESP32Device | null {
    return this.deviceRegistry.getDevice(deviceId);
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

    this.deviceRegistry.destroy();

    this.options.logger.debug("ESP32 设备管理器已销毁");
  }
}
