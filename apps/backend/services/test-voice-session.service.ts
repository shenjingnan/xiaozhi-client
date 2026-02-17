/**
 * 测试语音会话服务
 * 实现流式 TTS 音频下发给硬件端
 *
 * 功能：
 * 1. 检测硬件端开始发送音频数据
 * 2. 首次收到音频数据时触发流式 TTS
 * 3. 使用 synthesizeSpeechStream() 边收边发
 * 4. 每个 Ogg Opus 块解封装后立即下发
 */

import { logger } from "@/Logger.js";
import { demuxOggOpusChunk } from "@/lib/opus/ogg-demuxer.js";
import { synthesizeSpeechStream } from "@/lib/tts/binary.js";
import { configManager } from "@xiaozhi-client/config";
import type { ESP32Service } from "./esp32.service.js";
import type { IVoiceSessionService } from "./voice-session.interface.js";

/**
 * 测试语音会话服务
 *
 * 当硬件端开始发送音频数据时，触发流式 TTS 响应
 */
export class TestVoiceSessionService implements IVoiceSessionService {
  /** ESP32 服务引用（用于获取连接） */
  private esp32Service?: ESP32Service;

  /** 每个设备是否已触发 TTS（避免重复触发） */
  private readonly ttsTriggered = new Map<string, boolean>();

  /**
   * 设置 ESP32 服务引用
   * @param esp32Service - ESP32 服务实例
   */
  setESP32Service(esp32Service: ESP32Service): void {
    this.esp32Service = esp32Service;
  }

  /**
   * 处理音频数据
   * 首次收到音频数据时触发流式 TTS
   * @param deviceId - 设备 ID
   * @param audioData - 音频数据
   */
  async handleAudioData(
    deviceId: string,
    audioData: Uint8Array
  ): Promise<void> {
    logger.debug(
      `[TestVoiceSessionService] 收到音频数据: deviceId=${deviceId}, size=${audioData.length}`
    );

    // 首次收到音频时触发 TTS
    if (!this.ttsTriggered.get(deviceId)) {
      this.ttsTriggered.set(deviceId, true);
      logger.info(
        `[TestVoiceSessionService] 首次收到音频，触发流式 TTS: deviceId=${deviceId}`
      );

      // 获取设备连接
      const connection = this.getConnection(deviceId);
      if (!connection) {
        logger.warn(
          `[TestVoiceSessionService] 无法获取设备连接: deviceId=${deviceId}`
        );
        return;
      }

      // 获取 TTS 配置
      const ttsConfig = configManager.getTTSConfig();
      if (!ttsConfig.appid || !ttsConfig.accessToken || !ttsConfig.voice_type) {
        logger.error(
          "[TestVoiceSessionService] TTS 配置不完整，请检查配置文件"
        );
        return;
      }

      // 调用流式 TTS（边收边发）
      try {
        // 发送 TTS start 消息
        await connection.send({
          type: "tts",
          session_id: connection.getSessionId(),
          state: "start",
        });
        logger.debug(
          `[TestVoiceSessionService] 发送 TTS start 消息: deviceId=${deviceId}`
        );

        await synthesizeSpeechStream(
          {
            appid: ttsConfig.appid,
            accessToken: ttsConfig.accessToken,
            voice_type: ttsConfig.voice_type,
            text: "测试一下",
            encoding: "ogg_opus",
            cluster: ttsConfig.cluster,
            endpoint: ttsConfig.endpoint,
          },
          // 每收到一个音频块立即处理
          async (oggOpusChunk, isLast) => {
            // 使用 prism-media 解封装 Ogg，提取纯 Opus 数据
            const opusChunks = await demuxOggOpusChunk(oggOpusChunk);

            logger.debug(
              `[TestVoiceSessionService] 解封装 Ogg 块: deviceId=${deviceId}, opusChunks=${opusChunks.length}, isLast=${isLast}`
            );

            // 每个 Opus 块立即下发给硬件端
            for (const opusData of opusChunks) {
              await connection.sendBinaryProtocol2(opusData, Date.now());
            }

            // 最后一块时记录日志
            if (isLast) {
              logger.info(
                `[TestVoiceSessionService] TTS 流式下发完成: deviceId=${deviceId}`
              );
            }
          }
        );

        // 发送 TTS stop 消息
        await connection.send({
          type: "tts",
          session_id: connection.getSessionId(),
          state: "stop",
        });
        logger.debug(
          `[TestVoiceSessionService] 发送 TTS stop 消息: deviceId=${deviceId}`
        );
      } catch (error) {
        logger.error(
          `[TestVoiceSessionService] TTS 调用失败: deviceId=${deviceId}`,
          error
        );
      }
    }
  }

  /**
   * 获取设备连接
   * @param deviceId - 设备 ID
   * @returns ESP32 连接实例
   */
  private getConnection(deviceId: string) {
    if (!this.esp32Service) {
      logger.warn("[TestVoiceSessionService] ESP32 服务未设置");
      return undefined;
    }

    return this.esp32Service.getConnection(deviceId);
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.ttsTriggered.clear();
    logger.debug("[TestVoiceSessionService] 服务已销毁");
  }
}
