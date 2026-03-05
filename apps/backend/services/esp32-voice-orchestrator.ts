/**
 * ESP32 语音服务编排器
 * 负责语音识别（ASR）、大语言模型（LLM）和语音合成（TTS）的协调
 */

import { logger } from "@/Logger.js";
import type { ESP32Connection } from "@/lib/esp32/connection.js";
import { ASRService } from "./asr.service.js";
import { LLMService } from "./llm.service.js";
import { TTSService } from "./tts.service.js";

/**
 * ESP32 语音服务编排器
 * 协调 ASR、LLM 和 TTS 服务，处理语音输入输出流程
 */
export class ESP32VoiceOrchestrator {
  /** ASR 服务实例 */
  private asrService: ASRService;

  /** LLM 服务实例 */
  private llmService: LLMService;

  /** TTS 服务实例 */
  private ttsService: TTSService;

  /** 获取设备连接的回调 */
  private getConnection: (deviceId: string) => ESP32Connection | undefined;

  /**
   * 构造函数
   * @param getConnection - 获取设备连接的回调函数
   */
  constructor(
    getConnection: (deviceId: string) => ESP32Connection | undefined
  ) {
    this.getConnection = getConnection;

    // 初始化 LLM 服务
    this.llmService = new LLMService();

    // 初始化 ASR 和 TTS 服务
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
            const connection = this.getConnection(deviceId);

            // 异步发送 STT 消息到设备端（不阻塞主流程）
            if (connection) {
              connection
                .send({
                  session_id: connection.getSessionId(),
                  type: "stt",
                  text: text,
                })
                .catch((err) => {
                  logger.error(
                    `[ESP32VoiceOrchestrator] 发送 STT 消息失败: deviceId=${deviceId}`,
                    err
                  );
                });
            }

            try {
              const llmResponse = await this.llmService.chat(text);
              logger.info(
                `[ESP32VoiceOrchestrator] LLM 响应: deviceId=${deviceId}, response=${llmResponse}`
              );
              await this.ttsService.speak(deviceId, llmResponse);
            } catch (error) {
              logger.error(
                `[ESP32VoiceOrchestrator] LLM 或 TTS 调用失败: deviceId=${deviceId}`,
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
          logger.error(
            `[ESP32VoiceOrchestrator] ASR 错误: deviceId=${deviceId}`,
            error
          );
        },
      },
    });
  }

  /**
   * 重建 ASR 服务实例
   * 销毁当前实例并创建新实例，确保每次识别都从干净的状态开始
   */
  private recreateASRService(): void {
    logger.info("[ESP32VoiceOrchestrator] 重建 ASR 服务实例");
    if (this.asrService) {
      this.asrService.destroy();
    }
    this.asrService = this.createASRService();
    logger.info("[ESP32VoiceOrchestrator] ASR 服务实例已重建");
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
    });
  }

  /**
   * 重建 TTS 服务实例
   * 销毁当前实例并创建新实例，确保每次 TTS 都从干净的状态开始
   */
  private recreateTTSService(): void {
    logger.info("[ESP32VoiceOrchestrator] 重建 TTS 服务实例");
    if (this.ttsService) {
      this.ttsService.destroy();
    }
    this.ttsService = this.createTTSService();
    this.setupTTSGetConnection();
    logger.info("[ESP32VoiceOrchestrator] TTS 服务实例已重建");
  }

  /**
   * 设置 TTS 服务的获取连接回调
   */
  setupTTSGetConnection(): void {
    this.ttsService.setGetConnection(this.getConnection);
  }

  /**
   * 获取 ASR 服务实例
   * @returns ASR 服务实例
   */
  getASRService(): ASRService {
    return this.asrService;
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.asrService.destroy();
    this.ttsService.destroy();
    logger.debug("[ESP32VoiceOrchestrator] 服务已销毁");
  }
}
