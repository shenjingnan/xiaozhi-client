/**
 * 测试语音会话服务
 * 实现流式 TTS 音频下发给硬件端
 *
 * 功能：
 * 1. 检测硬件端开始发送音频数据
 * 2. 首次收到音频数据时触发流式 TTS
 * 3. 边接收 Ogg 数据块边解封装为 Opus 包
 * 4. 逐个 Opus 包发送到硬件端
 */

import { logger } from "@/Logger.js";
import { ASRService } from "./asr.service.js";
import type { ESP32Service } from "./esp32.service.js";
import { LLMService } from "./llm.service.js";
import { TTSService } from "./tts.service.js";
import type { IVoiceSessionService } from "./voice-session.interface.js";

/**
 * 测试语音会话服务
 *
 * 当硬件端开始发送音频数据时，触发流式 TTS 响应
 */
export class TestVoiceSessionService implements IVoiceSessionService {
  /** ASR 服务实例 */
  private asrService: ASRService;

  /** TTS 服务实例 */
  private ttsService: TTSService;

  /** LLM 服务实例 */
  private llmService: LLMService;

  /** ESP32 服务引用（用于获取连接） */
  private esp32Service?: ESP32Service;

  constructor() {
    this.llmService = new LLMService();

    // 初始化 ASR 服务，设置结果回调
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
                `[TestVoiceSessionService] LLM 或 TTS 调用失败: deviceId=${deviceId}`,
                error
              );
            }
          }
        },
        onError: (deviceId, error) => {
          logger.error(
            `[TestVoiceSessionService] ASR 错误: deviceId=${deviceId}`,
            error
          );
        },
      },
    });

    // 初始化 TTS 服务
    this.ttsService = new TTSService();
  }

  /**
   * 设置 ESP32 服务引用
   * @param esp32Service - ESP32 服务实例
   */
  setESP32Service(esp32Service: ESP32Service): void {
    this.esp32Service = esp32Service;
    // 设置 TTS 服务的获取连接回调
    this.ttsService.setGetConnection((deviceId: string) => {
      return this.esp32Service?.getConnection(deviceId);
    });
  }

  /**
   * 开始语音会话
   * 生成会话 ID，实际 ASR 初始化在 hello 时进行
   * @param deviceId - 设备 ID
   * @param mode - 监听模式
   * @returns 会话 ID
   */
  async startSession(
    deviceId: string,
    mode: "auto" | "manual" | "realtime"
  ): Promise<string> {
    const sessionId = `session_${deviceId}_${Date.now()}`;
    logger.info(
      `[TestVoiceSessionService] 开始语音会话: deviceId=${deviceId}, mode=${mode}, sessionId=${sessionId}`
    );

    return sessionId;
  }

  /**
   * 中断语音会话
   * 清理 ASR 资源
   * @param deviceId - 设备 ID
   * @param reason - 中断原因
   */
  async abortSession(deviceId: string, reason?: string): Promise<void> {
    logger.info(
      `[TestVoiceSessionService] 中断语音会话: deviceId=${deviceId}, reason=${reason || "未指定"}`
    );

    // 清理 ASR 资源
    await this.asrService.end(deviceId);
  }

  /**
   * 处理 TTS 数据
   * 首次收到音频数据时触发流式 TTS
   * @param deviceId - 设备 ID
   * @param text - 要转换为语音的文本
   */
  async handleTTSData(deviceId: string, text: string): Promise<void> {
    await this.ttsService.speak(deviceId, text);
  }

  /**
   * 处理音频数据（ASR 语音识别）
   * 将音频数据推入队列，由 listen() 异步生成器消费
   * @param deviceId - 设备 ID
   * @param audioData - 裸 Opus 音频数据
   */
  async handleAudioData(
    deviceId: string,
    audioData: Uint8Array
  ): Promise<void> {
    await this.asrService.handleAudioData(deviceId, audioData);
  }

  /**
   * 初始化 ASR 语音识别服务
   * 如果已存在 ASR 客户端且已连接，则跳过初始化
   * @param deviceId - 设备 ID
   */
  async initASR(deviceId: string): Promise<void> {
    await this.asrService.init(deviceId);
  }

  /**
   * 结束 ASR 语音识别
   * 标记音频结束，由 listen() 任务自动处理关闭
   * @param deviceId - 设备 ID
   */
  async endASR(deviceId: string): Promise<void> {
    await this.asrService.end(deviceId);
  }

  /**
   * 处理完整音频缓冲区
   * @param audioBuffer - 完整的 OGG Opus 数据
   * @param sendCallback - 发送到硬件的回调函数
   */
  async processAudioBuffer(
    audioBuffer: Buffer,
    sendCallback: (
      opusPacket: Buffer,
      metadata: {
        index: number;
        size: number;
        duration: number;
        timestamp: number;
      }
    ) => Promise<void>
  ): Promise<{ packetCount: number; totalDuration: number }> {
    return this.ttsService.processAudioBuffer(audioBuffer, sendCallback);
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.asrService.destroy();
    this.ttsService.destroy();
    logger.debug("[TestVoiceSessionService] 服务已销毁");
  }
}
