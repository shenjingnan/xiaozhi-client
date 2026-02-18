/**
 * 测试语音会话服务
 * 实现流式 TTS 音频下发给硬件端
 *
 * 功能：
 * 1. 检测硬件端开始发送音频数据
 * 2. 首次收到音频数据时触发流式 TTS
 * 3. 收集所有 Ogg 数据块并合并存储
 * 4. 完整合并后再按顺序逐个音频块下发到硬件端
 */

import { promises as fs } from "node:fs";
import { join as pathJoin } from "node:path";
import { logger } from "@/Logger.js";
import { demuxOggOpus } from "@/lib/opus/ogg-demuxer.js";
import { synthesizeSpeechStream } from "@/lib/tts/binary.js";
import { PathUtils } from "@/utils/path-utils.js";
import { configManager } from "@xiaozhi-client/config";
import type { ESP32Service } from "./esp32.service.js";
import type { IVoiceSessionService } from "./voice-session.interface.js";
import { Readable } from "node:stream";
import * as prism from "prism-media";

/**
 * 计算单个 Opus 数据包的时长（毫秒）
 * @param {Buffer} opusPacket - Opus 数据包
 * @returns {number} 时长（毫秒）
 */
function getOpusPacketDuration(opusPacket: Buffer) {
  if (!opusPacket || opusPacket.length === 0) {
    return 0;
  }

  const toc = opusPacket[0];

  // 提取配置信息
  const config = (toc >> 3) & 0x1F;
  const frameCount = toc & 0x03;

  // 根据 config 确定单帧时长（毫秒）
  const frameSizes = [
    10, 20, 40, 60,  // SILK-only: NB, MB, WB
    10, 20, 40, 60,  // Hybrid: SWB, FB
    10, 20, 40, 60,  // CELT-only: NB, WB
    10, 20,          // CELT-only: SWB, FB
    2.5, 5, 10, 20   // CELT-only: NB, MB, WB, SWB, FB
  ];

  // 简化版：大多数情况下的帧时长
  let frameDuration;

  if (config < 12) {
    frameDuration = 10;
  } else if (config < 16) {
    frameDuration = 20;
  } else {
    frameDuration = [2.5, 5, 10, 20][config & 0x03];
  }

  // 计算帧数量
  let numFrames;
  switch (frameCount) {
    case 0: // 1 帧
      numFrames = 1;
      break;
    case 1: // 2 帧
    case 2: // 2 帧（不等长）
      numFrames = 2;
      break;
    case 3: // 多帧（需要读取第二个字节）
      if (opusPacket.length > 1) {
        numFrames = opusPacket[1] & 0x3F;
      } else {
        numFrames = 1;
      }
      break;
    default:
      numFrames = 1;
  }

  return frameDuration * numFrames;
}

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

  /** 每个设备收集的 Ogg 数据块 */
  private readonly oggChunks = new Map<string, Uint8Array[]>();

  /** 每个设备收集的音频数据总时长 */
  private totalDuration = 0;

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

      // 初始化数据收集数组
      this.oggChunks.set(deviceId, []);

      // 调用流式 TTS，收集所有数据
      try {
        await synthesizeSpeechStream(
          {
            appid: ttsConfig.appid,
            accessToken: ttsConfig.accessToken,
            voice_type: ttsConfig.voice_type,
            text: "你好啊，我是小智客户端，我正在做测试",
            encoding: "ogg_opus",
            cluster: ttsConfig.cluster,
            endpoint: ttsConfig.endpoint,
          },
          // 收集所有 Ogg 数据块
          async (oggOpusChunk, isLast) => {
            const chunks = this.oggChunks.get(deviceId);
            if (chunks) {
              chunks.push(oggOpusChunk);
            }

            // 所有数据收集完成后，处理并发送
            if (isLast) {
              logger.info(
                `[TestVoiceSessionService] TTS 数据收集完成，开始处理: deviceId=${deviceId}`
              );
              await this.processAndSendAudio(deviceId, connection);
            }
          }
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
 * 计算单个包的时长
 */
  getPacketDuration(opusPacket: Buffer) {
    if (!opusPacket || opusPacket.length === 0) return 0;

    const toc = opusPacket[0];
    const config = (toc >> 3) & 0x1F;
    const c = toc & 0x03;

    // 单帧时长
    let frameSize: number;
    if (config < 12) {
      frameSize = 10;
    } else if (config < 16) {
      frameSize = 20;
    } else {
      frameSize = [2.5, 5, 10, 20][config & 0x03];
    }

    // 帧数
    let frameCount: number;
    switch (c) {
      case 0: frameCount = 1; break;
      case 1:
      case 2: frameCount = 2; break;
      case 3: frameCount = opusPacket.length > 1 ? (opusPacket[1] & 0x3F) : 1; break;
      default: frameCount = 1;
    }

    return frameSize * frameCount;
  }

  /**
   * 处理从 WebSocket 接收的完整音频数据
   * @param {Buffer} audioBuffer - 完整的 OGG Opus 数据
   * @param {Function} sendCallback - 发送到硬件的回调函数
   */
  async processAudioBuffer(audioBuffer: Buffer, sendCallback: (opusPacket: Buffer, metadata: { index: number, size: number, duration: number, timestamp: number }) => Promise<void>) {
    return new Promise((resolve, reject) => {
      const demuxer = new prism.opus.OggDemuxer();

      // 将 Buffer 转换为可读流
      const stream = Readable.from(audioBuffer);

      let packetIndex = 0;

      stream
        .pipe(demuxer)
        .on('data', async (opusPacket) => {
          const duration = this.getPacketDuration(opusPacket);

          // 暂停流，等待硬件发送完成
          demuxer.pause();

          try {
            await sendCallback(opusPacket, {
              index: packetIndex,
              size: opusPacket.length,
              duration: duration,
              timestamp: (packetIndex + 1) * duration
            });

            // console.log(`✅ 发送包 ${packetIndex + 1}: ${opusPacket.length} bytes, ${duration}ms`);

            packetIndex++;
            this.totalDuration += duration;

          } catch (error) {
            console.error(`❌ 发送包 ${packetIndex} 失败:`, error);
          }

          // 恢复流
          demuxer.resume();
        })
        .on('end', () => {
          console.log(`✅ 处理完成，共 ${packetIndex} 个包，总时长 ${(this.totalDuration / 1000).toFixed(2)}s`);
          resolve({
            packetCount: packetIndex,
            totalDuration: this.totalDuration
          });
        })
        .on('error', reject);
    });
  }


  /**
   * 处理并发送音频数据
   * 1. 合并所有 Ogg 数据块
   * 2. 存储到临时目录
   * 3. 解封装为 Opus 数据后分块下发
   * @param deviceId - 设备 ID
   * @param connection - ESP32 连接实例
   */
  private async processAndSendAudio(
    deviceId: string,
    connection: any
  ): Promise<void> {
    const chunks = this.oggChunks.get(deviceId);
    if (!chunks || chunks.length === 0) {
      logger.warn(
        `[TestVoiceSessionService] 无音频数据可处理: deviceId=${deviceId}`
      );
      return;
    }

    try {
      // 1. 合并所有 Ogg 数据块
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const mergedOgg = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        mergedOgg.set(chunk, offset);
        offset += chunk.length;
      }
      logger.debug(
        `[TestVoiceSessionService] 合并 Ogg 数据: deviceId=${deviceId}, totalSize=${totalLength}`
      );

      // 2. 存储到临时目录
      const tempDir = PathUtils.getTempDir();
      logger.info(`[TestVoiceSessionService] 临时目录: ${tempDir}`);
      const fileName = `tts-${deviceId}-${Date.now()}.ogg`;
      const filePath = pathJoin(tempDir, fileName);
      await fs.writeFile(filePath, mergedOgg);
      logger.info(`[TestVoiceSessionService] 已存储 TTS 音频到: ${filePath}`);

      await new Promise((resolve) => setTimeout(resolve, 2000));
      // 3. 发送 TTS start 消息
      await connection.send({
        type: "tts",
        session_id: connection.getSessionId(),
        state: "start",
      });
      logger.debug(
        `[TestVoiceSessionService] 发送 TTS start 消息: deviceId=${deviceId}`
      );

      // 4. 解封装为纯 Opus 数据
      const opusData = await demuxOggOpus(mergedOgg);
      logger.debug(
        `[TestVoiceSessionService] 解封装 Ogg 数据: deviceId=${deviceId}, opusSize=${opusData.length}`
      );

      // 5. 分块下发 Opus 数据
      // @ts-ignore
      const oggData = await fs.readFile(filePath);
      // logger.debug(
      //   `[TestVoiceSessionService] 读取 Ogg 数据: deviceId=${deviceId}, oggSize=${oggData.length}`
      // );

      await this.processAudioBuffer(oggData, async (opusPacket, metadata) => {
        await connection.sendBinaryProtocol2(opusPacket, metadata.timestamp);
      });
      // await connection.sendBinaryProtocol2(opusData, 3000);
      // const chunkSize = 1024;
      // let timestamp = 0;
      // for (let i = 0; i < opusData.length; i += chunkSize) {
      //   const chunk = opusData.slice(i, i + chunkSize);
      //   await connection.sendBinaryProtocol2(chunk, timestamp);
      //   timestamp += 60; // 每帧间隔 60ms
      // }

      // 6. 发送 TTS stop 消息
      await connection.send({
        type: "tts",
        session_id: connection.getSessionId(),
        state: "stop",
      });
      logger.debug(
        `[TestVoiceSessionService] 发送 TTS stop 消息: deviceId=${deviceId}`
      );

      logger.info(
        `[TestVoiceSessionService] TTS 音频下发完成: deviceId=${deviceId}, totalChunks=${Math.ceil(
          getOpusPacketDuration(opusData as Buffer)
        )}`
      );
    } catch (error) {
      logger.error(
        `[TestVoiceSessionService] 处理音频数据失败: deviceId=${deviceId}`,
        error
      );
    } finally {
      // 清理数据
      this.oggChunks.delete(deviceId);
    }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.ttsTriggered.clear();
    this.oggChunks.clear();
    logger.debug("[TestVoiceSessionService] 服务已销毁");
  }
}
