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

import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import { join as pathJoin } from "node:path";
import { Readable } from "node:stream";
import { promisify } from "node:util";
import { logger } from "@/Logger.js";
import { synthesizeSpeechStream } from "@/lib/tts/binary.js";
import { PathUtils } from "@/utils/path-utils.js";
import { configManager } from "@xiaozhi-client/config";
import * as prism from "prism-media";
import type { ESP32Service } from "./esp32.service.js";
import type { IVoiceSessionService } from "./voice-session.interface.js";

const execAsync = promisify(exec);

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
  const config = (toc >> 3) & 0x1f;
  const frameCount = toc & 0x03;

  // 根据 config 确定单帧时长（毫秒）
  const frameSizes = [
    10,
    20,
    40,
    60, // SILK-only: NB, MB, WB
    10,
    20,
    40,
    60, // Hybrid: SWB, FB
    10,
    20,
    40,
    60, // CELT-only: NB, WB
    10,
    20, // CELT-only: SWB, FB
    2.5,
    5,
    10,
    20, // CELT-only: NB, MB, WB, SWB, FB
  ];

  // 简化版：大多数情况下的帧时长
  let frameDuration: number;

  if (config < 12) {
    frameDuration = 10;
  } else if (config < 16) {
    frameDuration = 20;
  } else {
    frameDuration = [2.5, 5, 10, 20][config & 0x03];
  }

  // 计算帧数量
  let numFrames: number;
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
        numFrames = opusPacket[1] & 0x3f;
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

  /** 每个设备对应一个流式 demuxer */
  private readonly audioDemuxers = new Map<string, prism.opus.OggDemuxer>();

  /** 每个设备的累计时间戳 */
  private readonly cumulativeTimestamps = new Map<string, number>();

  /** 每个设备的包索引 */
  private readonly packetIndices = new Map<string, number>();

  /** 每个设备是否已发送 start 消息 */
  private readonly ttsStarted = new Map<string, boolean>();

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

      // 初始化流式处理所需的状态
      this.audioDemuxers.set(deviceId, new prism.opus.OggDemuxer());
      this.cumulativeTimestamps.set(deviceId, 0);
      this.packetIndices.set(deviceId, 0);
      this.ttsStarted.set(deviceId, false);

      // 创建 demuxer 并设置事件处理
      const demuxer = this.audioDemuxers.get(deviceId)!;
      this.setupDemuxerEvents(deviceId, demuxer, connection);

      // 调用流式 TTS，边接收边处理
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
          // 边接收边处理：直接写入 demuxer
          async (oggOpusChunk, isLast) => {
            // 直接将数据写入 demuxer 进行解封装
            demuxer.write(oggOpusChunk);

            if (isLast) {
              demuxer.end();
              logger.info(
                `[TestVoiceSessionService] TTS 数据接收完成: deviceId=${deviceId}`
              );
            }
          }
        );
      } catch (error) {
        logger.error(
          `[TestVoiceSessionService] TTS 调用失败: deviceId=${deviceId}`,
          error
        );
        this.cleanupDeviceState(deviceId);
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
   * 设置 demuxer 事件处理
   * @param deviceId - 设备 ID
   * @param demuxer - Ogg Demuxer 实例
   * @param connection - ESP32 连接实例
   */
  private setupDemuxerEvents(
    deviceId: string,
    demuxer: prism.opus.OggDemuxer,
    connection: any
  ) {
    demuxer.on("data", async (opusPacket: Buffer) => {
      // 首次收到 Opus 包时发送 start 消息
      if (!this.ttsStarted.get(deviceId)) {
        await connection.send({
          type: "tts",
          session_id: connection.getSessionId(),
          state: "start",
        });
        this.ttsStarted.set(deviceId, true);
        logger.debug(
          `[TestVoiceSessionService] 发送 TTS start 消息: deviceId=${deviceId}`
        );
      }

      const timestamp = this.cumulativeTimestamps.get(deviceId) || 0;
      const duration = this.getPacketDuration(opusPacket);

      logger.info(`[TestVoiceSessionService] 发送 Opus 包: deviceId=${deviceId}, timestamp=${timestamp}, duration=${duration}, opusPacketLength=${opusPacket.length}`);
      // 发送 Opus 包到硬件
      await connection.sendBinaryProtocol2(opusPacket, timestamp);

      // 更新状态
      const packetIndex = (this.packetIndices.get(deviceId) || 0) + 1;
      this.packetIndices.set(deviceId, packetIndex);
      this.cumulativeTimestamps.set(deviceId, timestamp + duration);

      // 流控：等待硬件处理
      await new Promise((resolve) => setTimeout(resolve, duration * 0.8));
    });

    demuxer.on("end", async () => {
      // 发送 stop 消息
      await connection.send({
        type: "tts",
        session_id: connection.getSessionId(),
        state: "stop",
      });

      // 清理状态
      this.cleanupDeviceState(deviceId);
      logger.info(
        `[TestVoiceSessionService] TTS 音频流发送完成: deviceId=${deviceId}`
      );
    });

    demuxer.on("error", (err: Error) => {
      logger.error(
        `[TestVoiceSessionService] Demuxer 错误: deviceId=${deviceId}`,
        err
      );
      this.cleanupDeviceState(deviceId);
    });
  }

  /**
   * 清理设备状态
   * @param deviceId - 设备 ID
   */
  private cleanupDeviceState(deviceId: string) {
    this.audioDemuxers.delete(deviceId);
    this.cumulativeTimestamps.delete(deviceId);
    this.packetIndices.delete(deviceId);
    this.ttsStarted.delete(deviceId);
    this.ttsTriggered.delete(deviceId);
    this.oggChunks.delete(deviceId);
  }

  /**
   * 计算单个包的时长
   */
  getPacketDuration(opusPacket: Buffer) {
    if (!opusPacket || opusPacket.length === 0) return 0;

    const toc = opusPacket[0];
    const config = (toc >> 3) & 0x1f;
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
      case 0:
        frameCount = 1;
        break;
      case 1:
      case 2:
        frameCount = 2;
        break;
      case 3:
        frameCount = opusPacket.length > 1 ? opusPacket[1] & 0x3f : 1;
        break;
      default:
        frameCount = 1;
    }

    return frameSize * frameCount;
  }

  /**
   * 处理从 WebSocket 接收的完整音频数据
   * @param {Buffer} audioBuffer - 完整的 OGG Opus 数据
   * @param {Function} sendCallback - 发送到硬件的回调函数
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
  ) {
    return new Promise((resolve, reject) => {
      const demuxer = new prism.opus.OggDemuxer();

      // 将 Buffer 转换为可读流
      const stream = Readable.from(audioBuffer);

      let packetIndex = 0;
      // 使用累积时间戳，确保每个包的时间戳连续递增
      let cumulativeTimestamp = 0;
      // 使用局部变量记录总时长，避免跨设备累积
      let totalDuration = 0;

      stream
        .pipe(demuxer)
        .on("data", async (opusPacket) => {
          const duration = this.getPacketDuration(opusPacket);

          // 暂停流，等待硬件发送完成
          demuxer.pause();

          try {
            await sendCallback(opusPacket, {
              index: packetIndex,
              size: opusPacket.length,
              duration: duration,
              timestamp: cumulativeTimestamp,
            });

            // console.log(`✅ 发送包 ${packetIndex + 1}: ${opusPacket.length} bytes, ${duration}ms, timestamp=${cumulativeTimestamp}ms`);

            packetIndex++;
            cumulativeTimestamp += duration;
            totalDuration += duration;
          } catch (error) {
            console.error(`❌ 发送包 ${packetIndex} 失败:`, error);
          }

          // 恢复流
          demuxer.resume();
        })
        .on("end", () => {
          console.log(
            `✅ 处理完成，共 ${packetIndex} 个包，总时长 ${(totalDuration / 1000).toFixed(2)}s`
          );
          resolve({
            packetCount: packetIndex,
            totalDuration: totalDuration,
          });
        })
        .on("error", reject);
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
      // const opusData = await demuxOggOpus(mergedOgg);
      // logger.debug(
      //   `[TestVoiceSessionService] 解封装 Ogg 数据: deviceId=${deviceId}, opusSize=${opusData.length}`
      // );

      // 5. 分块下发 Opus 数据
      // @ts-ignore
      // const oggData = await fs.readFile(filePath);
      // const oggData = await fs.readFile('~/Downloads/activation.ogg'); // 可以播放 frame_duration:10ms
      // const oggData = await fs.readFile('~/Downloads/activation-20ms.ogg'); // 可以播放 frame_duration:10ms
      // const oggData = await fs.readFile('~/Downloads/activation-60ms.ogg'); // 可以播放 frame_duration:10ms
      // const oggData = await fs.readFile('~/Downloads/activation-24khz-2.ogg'); // 可以播放 frame_duration:10ms
      // const oggData = await fs.readFile('~/Downloads/activation-60ms-24khz.ogg'); // 可以播放 frame_duration:10ms
      // const oggData = await fs.readFile('~/Downloads/activation-60ms-16khz.ogg'); // 可以播放 frame_duration:10ms
      // const oggData = await fs.readFile('~/Downloads/music.ogg'); // 可以播放 frame_duration:10ms ****
      // const oggData = await fs.readFile('~/Downloads/music-20ms-24khz.ogg'); // 可以播放 frame_duration:10ms ****
      // const oggData = await fs.readFile('~/Downloads/welcome-ar-sa.ogg'); // 可以播放
      // const oggData = await fs.readFile('~/Downloads/welcome-ar-sa-20ms.ogg');
      // const oggData = await fs.readFile('~/Downloads/welcome-ar-sa-24.ogg');
      // const oggData = await fs.readFile('~/Downloads/tts-24.ogg');
      // logger.debug(
      //   `[TestVoiceSessionService] 读取 Ogg 数据: deviceId=${deviceId}, oggSize=${oggData.length}`
      // );

      // let cumulativeTimestamp = 0;
      // for (const chunk of chunks) {
      //   const duration = this.getPacketDuration(Buffer.from(chunk));
      //   await connection.sendBinaryProtocol2(Buffer.from(chunk), cumulativeTimestamp);
      //   cumulativeTimestamp += duration;
      // }
      // return;
      // logger.info(`[TestVoiceSessionService] oggData size: ${oggData.length}`);
      // // 用于收集重新组装的 opus 包
      // const reassembledPackets: Buffer[] = [];

      // await this.processAudioBuffer(
      //   Buffer.from(mergedOgg),
      //   async (opusPacket, metadata) => {
      //     console.log(metadata, opusPacket.length);
      //     // if (metadata.index < 30) return;
      //     // 原有逻辑：发送到硬件
      //     await connection.sendBinaryProtocol2(opusPacket, metadata.timestamp);
      //     await new Promise((resolve) =>
      //       setTimeout(resolve, metadata.duration * 0.8)
      //     );

      //     // 新增：收集包用于验证
      //     // reassembledPackets.push(opusPacket);
      //   }
      // );

      // // 6. 重新封装成 ogg 文件进行验证
      // if (reassembledPackets.length > 0) {
      //   const outputPath = pathJoin(
      //     PathUtils.getTempDir(),
      //     `reassembled_${Date.now()}.ogg`
      //   );
      //   const rawOpusPath = pathJoin(
      //     PathUtils.getTempDir(),
      //     `raw_${Date.now()}.opus`
      //   );

      //   // 将所有 opus 包合并成一个原始 opus 文件
      //   const mergedOpus = Buffer.concat(reassembledPackets);
      //   await fs.writeFile(rawOpusPath, mergedOpus);

      //   // 使用 ffmpeg 将原始 opus 转换为 ogg
      //   try {
      //     await execAsync(
      //       `ffmpeg -y -acodec opus -i "${rawOpusPath}" -acodec copy "${outputPath}" 2>/dev/null`
      //     );

      //     // 获取文件大小
      //     const stats = await fs.stat(outputPath);

      //     logger.info(
      //       `[Test] 重新封装 ogg 文件完成: ${outputPath}, 原始文件大小=${oggData.length}, 重新封装后大小=${stats.size}, 包数量=${reassembledPackets.length}`
      //     );
      //   } catch (error) {
      //     logger.warn(
      //       `[Test] ffmpeg 转换失败，直接使用原始 opus 文件: ${rawOpusPath}`,
      //       error
      //     );
      //   } finally {
      //     // 清理临时原始 opus 文件
      //     try {
      //       await fs.unlink(rawOpusPath);
      //     } catch {
      //       // 忽略删除错误
      //     }
      //   }
      // }
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

      // logger.info(
      //   `[TestVoiceSessionService] TTS 音频下发完成: deviceId=${deviceId}, totalChunks=${Math.ceil(
      //     getOpusPacketDuration(opusData as Buffer)
      //   )}`
      // );
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
    this.audioDemuxers.clear();
    this.cumulativeTimestamps.clear();
    this.packetIndices.clear();
    this.ttsStarted.clear();
    logger.debug("[TestVoiceSessionService] 服务已销毁");
  }
}
