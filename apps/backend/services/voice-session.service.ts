/**
 * 语音会话服务
 * 管理ESP32设备的语音交互会话
 */

import { logger } from "@/Logger.js";
import type { ESP32STTMessage, ESP32TTSMessage } from "@/types/esp32.js";
import type { IAIService, ITTSService } from "./ai/index.js";
import type { OpusFrame } from "./ai/ogg-opus-tts.service.js";
import type { EventBus } from "./event-bus.service.js";

/**
 * 会话状态
 */
type SessionState = "IDLE" | "LISTENING" | "PROCESSING" | "SPEAKING";

/**
 * 语音会话信息
 */
interface VoiceSession {
  /** 会话ID */
  sessionId: string;
  /** 设备ID */
  deviceId: string;
  /** 会话状态 */
  state: SessionState;
  /** 监听模式 */
  mode: "auto" | "manual" | "realtime";
  /** 音频数据累积 */
  audioBuffer: Uint8Array[];
  /** 会话开始时间 */
  startTime: Date;
  /** 最后活动时间 */
  lastActivity: Date;
}

/**
 * 会话配置
 */
interface VoiceSessionConfig {
  /** 音频累积超时时间（毫秒），超过此时间无新音频则触发STT */
  audioTimeoutMs: number;
  /** 最大音频数据量（字节），超过则触发STT */
  maxAudioSize: number;
}

/**
 * 语音会话服务
 * 管理设备的语音交互会话生命周期
 */
export class VoiceSessionService {
  /** 活跃的会话映射（设备ID -> 会话信息） */
  private readonly sessions: Map<string, VoiceSession>;

  /** AI服务（STT + LLM） */
  private readonly aiService: IAIService;

  /** TTS服务 */
  private readonly ttsService: ITTSService;

  /** 事件总线 */
  private readonly eventBus: EventBus;

  /** 发送消息到设备的回调 */
  private readonly sendMessageCallback: (
    deviceId: string,
    message: ESP32STTMessage | ESP32TTSMessage
  ) => Promise<void>;

  /** 发送二进制音频到设备的回调 */
  private readonly sendBinaryCallback: (
    deviceId: string,
    data: Uint8Array
  ) => Promise<void>;

  /** 会话配置 */
  private readonly config: VoiceSessionConfig;

  /** 会话超时定时器映射（设备ID -> 定时器） */
  private readonly timeoutTimers: Map<string, NodeJS.Timeout>;

  /**
   * 构造函数
   * @param aiService - AI服务
   * @param ttsService - TTS服务
   * @param eventBus - 事件总线
   * @param sendMessageCallback - 发送消息回调
   * @param sendBinaryCallback - 发送二进制数据回调
   * @param config - 会话配置
   */
  constructor(
    aiService: IAIService,
    ttsService: ITTSService,
    eventBus: EventBus,
    sendMessageCallback: (
      deviceId: string,
      message: ESP32STTMessage | ESP32TTSMessage
    ) => Promise<void>,
    sendBinaryCallback: (deviceId: string, data: Uint8Array) => Promise<void>,
    config?: Partial<VoiceSessionConfig>
  ) {
    this.aiService = aiService;
    this.ttsService = ttsService;
    this.eventBus = eventBus;
    this.sendMessageCallback = sendMessageCallback;
    this.sendBinaryCallback = sendBinaryCallback;
    this.sessions = new Map();
    this.timeoutTimers = new Map();
    this.config = {
      audioTimeoutMs: config?.audioTimeoutMs ?? 2000, // 默认2秒
      maxAudioSize: config?.maxAudioSize ?? 65536, // 默认64KB
    };
  }

  /**
   * 生成会话ID
   * @param deviceId - 设备ID
   * @returns 会话ID
   */
  private generateSessionId(deviceId: string): string {
    return `${deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 开始新的语音会话
   * @param deviceId - 设备ID
   * @param mode - 监听模式
   * @returns 会话ID
   */
  async startSession(
    deviceId: string,
    mode: "auto" | "manual" | "realtime"
  ): Promise<string> {
    // 检查是否已有活跃会话
    const existingSession = this.sessions.get(deviceId);
    if (existingSession) {
      logger.warn(
        `[VoiceSession] 设备已有活跃会话，先结束旧会话: deviceId=${deviceId}, sessionId=${existingSession.sessionId}, state=${existingSession.state}`
      );
      await this.endSession(deviceId, "aborted");
    }

    // 创建新会话
    const sessionId = this.generateSessionId(deviceId);
    const session: VoiceSession = {
      sessionId,
      deviceId,
      state: "LISTENING",
      mode,
      audioBuffer: [],
      startTime: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(deviceId, session);

    // 发射会话开始事件
    this.eventBus.emitEvent("voice:session:started", {
      deviceId,
      sessionId,
      mode,
      timestamp: new Date(),
    });

    logger.info(
      `[VoiceSession] 语音会话已开始: deviceId=${deviceId}, sessionId=${sessionId}, mode=${mode}, timeoutMs=${this.config.audioTimeoutMs}, maxSize=${this.config.maxAudioSize}`
    );

    // 启动音频超时检测
    this.startAudioTimeout(deviceId);

    return sessionId;
  }

  /**
   * 处理音频数据
   * @param deviceId - 设备ID
   * @param audioData - 音频数据
   */
  async handleAudioData(
    deviceId: string,
    audioData: Uint8Array
  ): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session || session.state !== "LISTENING") {
      logger.debug(
        `[VoiceSession] 设备无活跃会话或状态不是LISTENING，忽略音频数据: deviceId=${deviceId}, hasSession=${!!session}, state=${session?.state}`
      );
      return;
    }

    // 更新最后活动时间
    session.lastActivity = new Date();

    // 累积音频数据
    session.audioBuffer.push(audioData);

    // 发射音频接收事件
    this.eventBus.emitEvent("voice:audio:received", {
      deviceId,
      sessionId: session.sessionId,
      size: audioData.length,
      timestamp: new Date(),
    });

    logger.debug(
      `[VoiceSession] 收到音频数据: deviceId=${deviceId}, sessionId=${session.sessionId}, size=${audioData.length}, bufferCount=${session.audioBuffer.length}`
    );

    // 重置超时定时器
    this.resetAudioTimeout(deviceId);

    // 检查是否达到最大音频数据量
    const totalSize = session.audioBuffer.reduce(
      (sum, data) => sum + data.length,
      0
    );
    if (totalSize >= this.config.maxAudioSize) {
      logger.info(
        `[VoiceSession] 达到最大音频数据量，触发STT: deviceId=${deviceId}, size=${totalSize}/${this.config.maxAudioSize}`
      );
      await this.processAudio(deviceId);
    }
  }

  /**
   * 处理唤醒词检测
   * @param deviceId - 设备ID
   * @param wakeWord - 唤醒词
   * @param mode - 监听模式
   */
  async handleWakeWord(
    deviceId: string,
    wakeWord: string,
    mode: "auto" | "manual" | "realtime"
  ): Promise<void> {
    logger.info(
      `[VoiceSession] 检测到唤醒词: deviceId=${deviceId}, word="${wakeWord}", mode=${mode}`
    );

    // 发射唤醒词检测事件
    this.eventBus.emitEvent("voice:wake-word:detected", {
      deviceId,
      wakeWord,
      mode,
      timestamp: new Date(),
    });

    // 开始新会话
    await this.startSession(deviceId, mode);
  }

  /**
   * 中断当前会话
   * @param deviceId - 设备ID
   * @param reason - 中断原因
   */
  async abortSession(deviceId: string, reason?: string): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session) {
      logger.debug(`设备无活跃会话，无法中断: deviceId=${deviceId}`);
      return;
    }

    logger.info(
      `中断会话: deviceId=${deviceId}, sessionId=${session.sessionId}, reason=${reason ?? "未指定"}`
    );

    await this.endSession(deviceId, "aborted");
  }

  /**
   * 启动音频超时检测
   * @param deviceId - 设备ID
   */
  private startAudioTimeout(deviceId: string): void {
    this.resetAudioTimeout(deviceId);
  }

  /**
   * 重置音频超时定时器
   * @param deviceId - 设备ID
   */
  private resetAudioTimeout(deviceId: string): void {
    // 清除现有定时器
    const existingTimer = this.timeoutTimers.get(deviceId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 设置新的定时器
    const timer = setTimeout(async () => {
      const session = this.sessions.get(deviceId);
      if (session && session.state === "LISTENING") {
        logger.debug(
          `音频超时，触发STT: deviceId=${deviceId}, sessionId=${session.sessionId}`
        );
        await this.processAudio(deviceId);
      }
    }, this.config.audioTimeoutMs);

    this.timeoutTimers.set(deviceId, timer);
  }

  /**
   * 处理音频数据（STT + LLM + TTS）
   * @param deviceId - 设备ID
   */
  private async processAudio(deviceId: string): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session) {
      return;
    }

    // 清除超时定时器
    const timer = this.timeoutTimers.get(deviceId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(deviceId);
    }

    // 更新会话状态
    session.state = "PROCESSING";

    // 合并音频数据
    const totalSize = session.audioBuffer.reduce(
      (sum, data) => sum + data.length,
      0
    );
    const combinedAudio = new Uint8Array(totalSize);
    let offset = 0;
    for (const data of session.audioBuffer) {
      combinedAudio.set(data, offset);
      offset += data.length;
    }
    session.audioBuffer = [];

    logger.debug(
      `开始处理音频: deviceId=${deviceId}, sessionId=${session.sessionId}, size=${combinedAudio.length}`
    );

    try {
      // STT：语音转文本
      const sttText = await this.aiService.recognize(combinedAudio);
      logger.info(`STT识别完成: deviceId=${deviceId}, text="${sttText}"`);

      // 发送STT结果到设备
      await this.sendSTTResult(deviceId, session.sessionId, sttText);

      // 发射STT完成事件
      this.eventBus.emitEvent("voice:stt:completed", {
        deviceId,
        sessionId: session.sessionId,
        text: sttText,
        timestamp: new Date(),
      });

      // LLM：生成回复
      const llmResponse = await this.aiService.generateResponse(sttText);
      logger.info(`LLM生成完成: deviceId=${deviceId}, text="${llmResponse}"`);

      // TTS：文本转语音
      await this.sendTTS(deviceId, session.sessionId, llmResponse);

      // 会话完成
      await this.endSession(deviceId, "completed");
    } catch (error) {
      logger.error(`处理音频失败: deviceId=${deviceId}`, error);
      await this.endSession(deviceId, "error");
    }
  }

  /**
   * 发送STT结果到设备
   * @param deviceId - 设备ID
   * @param sessionId - 会话ID
   * @param text - 识别文本
   */
  private async sendSTTResult(
    deviceId: string,
    sessionId: string,
    text: string
  ): Promise<void> {
    const message: ESP32STTMessage = {
      type: "stt",
      session_id: sessionId,
      text,
    };
    await this.sendMessageCallback(deviceId, message);
    logger.debug(`STT结果已发送: deviceId=${deviceId}, text="${text}"`);
  }

  /**
   * 发送TTS完整流程到设备（逐帧发送）
   * @param deviceId - 设备ID
   * @param sessionId - 会话ID
   * @param text - 要播放的文本
   */
  private async sendTTS(
    deviceId: string,
    sessionId: string,
    text: string
  ): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session) {
      logger.warn(`[VoiceSession] 发送TTS时设备无会话: deviceId=${deviceId}`);
      return;
    }

    session.state = "SPEAKING";
    logger.info(
      `[VoiceSession] 开始TTS流程: deviceId=${deviceId}, sessionId=${sessionId}, text="${text}"`
    );

    // 发射TTS开始事件
    this.eventBus.emitEvent("voice:tts:started", {
      deviceId,
      sessionId,
      text,
      timestamp: new Date(),
    });

    // 发送TTS开始消息
    const startMessage: ESP32TTSMessage = {
      type: "tts",
      session_id: sessionId,
      state: "start",
    };
    await this.sendMessageCallback(deviceId, startMessage);
    logger.info(`[VoiceSession] TTS开始消息已发送: deviceId=${deviceId}`);

    // 发送TTS句子消息
    const sentenceMessage: ESP32TTSMessage = {
      type: "tts",
      session_id: sessionId,
      state: "sentence_start",
      text,
    };
    await this.sendMessageCallback(deviceId, sentenceMessage);
    logger.info(
      `[VoiceSession] TTS句子消息已发送: deviceId=${deviceId}, text="${text}"`
    );

    // 获取音频帧数据
    logger.debug(`[VoiceSession] 开始合成音频: text="${text}"`);

    // 检查 TTS 服务是否支持逐帧合成
    if ("synthesizeFrames" in this.ttsService && typeof this.ttsService.synthesizeFrames === "function") {
      // 使用逐帧发送模式
      const frames = await (this.ttsService as ITTSService & { synthesizeFrames: (text: string) => Promise<OpusFrame[]> }).synthesizeFrames(text);
      logger.info(
        `[VoiceSession] 音频帧合成完成: deviceId=${deviceId}, frameCount=${frames.length}`
      );

      // 逐帧发送音频数据
      let totalBytes = 0;
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        await this.sendBinaryCallback(deviceId, frame.data);
        totalBytes += frame.size;

        // 帧间延迟，模拟实时播放节奏
        // 使用较小的延迟（1ms）避免阻塞，实际播放节奏由 ESP32 控制
        if (i < frames.length - 1) {
          await this.delay(1);
        }
      }

      logger.info(
        `[VoiceSession] TTS音频帧已全部发送: deviceId=${deviceId}, frameCount=${frames.length}, totalBytes=${totalBytes}`
      );
    } else {
      // 降级为一次性发送（兼容旧版 TTS 服务）
      const audioData = await this.ttsService.synthesize(text);
      logger.info(
        `[VoiceSession] 音频合成完成（兼容模式）: deviceId=${deviceId}, size=${audioData.length} 字节`
      );

      // 发送二进制音频数据
      await this.sendBinaryCallback(deviceId, audioData);
      logger.info(
        `[VoiceSession] TTS音频数据已发送: deviceId=${deviceId}, size=${audioData.length}`
      );
    }

    // 发送TTS结束消息
    const stopMessage: ESP32TTSMessage = {
      type: "tts",
      session_id: sessionId,
      state: "stop",
    };
    await this.sendMessageCallback(deviceId, stopMessage);
    logger.info(`[VoiceSession] TTS结束消息已发送: deviceId=${deviceId}`);

    // 发射TTS完成事件
    this.eventBus.emitEvent("voice:tts:completed", {
      deviceId,
      sessionId,
      timestamp: new Date(),
    });
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 结束会话
   * @param deviceId - 设备ID
   * @param reason - 结束原因
   */
  private async endSession(
    deviceId: string,
    reason: "completed" | "aborted" | "error"
  ): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session) {
      return;
    }

    // 清除超时定时器
    const timer = this.timeoutTimers.get(deviceId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(deviceId);
    }

    // 删除会话
    this.sessions.delete(deviceId);

    // 发射会话结束事件
    this.eventBus.emitEvent("voice:session:ended", {
      deviceId,
      sessionId: session.sessionId,
      reason,
      timestamp: new Date(),
    });

    logger.info(
      `语音会话已结束: deviceId=${deviceId}, sessionId=${session.sessionId}, reason=${reason}`
    );
  }

  /**
   * 获取设备当前会话状态
   * @param deviceId - 设备ID
   * @returns 会话信息，如果不存在则返回null
   */
  getSession(deviceId: string): VoiceSession | null {
    return this.sessions.get(deviceId) ?? null;
  }

  /**
   * 获取所有活跃会话
   * @returns 会话列表
   */
  getAllSessions(): VoiceSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    // 清除所有定时器
    for (const timer of this.timeoutTimers.values()) {
      clearTimeout(timer);
    }
    this.timeoutTimers.clear();

    // 结束所有会话
    const deviceIds = Array.from(this.sessions.keys());
    for (const deviceId of deviceIds) {
      this.endSession(deviceId, "aborted");
    }

    logger.debug("VoiceSessionService 已销毁");
  }
}
