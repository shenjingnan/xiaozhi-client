/**
 * TTS 服务实现
 * 处理语音合成功能
 */

import { Readable } from "node:stream";
import { logger } from "@/Logger.js";
import type { ESP32Connection } from "@/lib/esp32/connection.js";
import { configManager } from "@xiaozhi-client/config";
import { TTS } from "@xiaozhi-client/tts";
import * as prism from "prism-media";
import type { ITTSService, TTSServiceOptions } from "./tts.interface.js";

/**
 * TTS 服务
 * 处理语音合成功能，支持流式音频下发给硬件端
 */
export class TTSService implements ITTSService {
  /** 获取设备连接的回调 */
  private getConnection?: TTSServiceOptions["getConnection"];

  /** TTS 完成回调（stop 消息发送后触发） */
  private onTTSComplete?: TTSServiceOptions["onTTSComplete"];

  /** 每个设备是否已触发 TTS（避免重复触发） */
  private readonly ttsTriggered = new Map<string, boolean>();

  /** 每个设备对应一个流式 demuxer */
  private readonly audioDemuxers = new Map<string, prism.opus.OggDemuxer>();

  /** 每个设备的累计时间戳 */
  private readonly cumulativeTimestamps = new Map<string, number>();

  /** 每个设备的包索引 */
  private readonly packetIndices = new Map<string, number>();

  /** 每个设备是否已发送 start 消息 */
  private readonly ttsStarted = new Map<string, boolean>();

  /** 每个设备是否已完成 TTS（避免重复触发和处理） */
  private readonly ttsCompleted = new Map<string, boolean>();

  /** 每个设备的 Opus 包缓冲区 */
  private readonly opusPacketBuffer = new Map<string, Buffer[]>();

  /** 每个设备是否正在处理缓冲区 */
  private readonly isProcessingBuffer = new Map<string, boolean>();

  /** 每个设备的连接引用（用于缓冲区处理） */
  private readonly deviceConnections = new Map<string, ESP32Connection>();

  /**
   * 构造函数
   * @param options - 配置选项
   */
  constructor(options: TTSServiceOptions = {}) {
    this.getConnection = options.getConnection;
    this.onTTSComplete = options.onTTSComplete;
  }

  /**
   * 设置获取设备连接的回调
   * @param getConnection - 获取设备连接的回调函数
   */
  setGetConnection(getConnection: TTSServiceOptions["getConnection"]): void {
    this.getConnection = getConnection;
  }

  /**
   * 处理 TTS 数据
   * 首次收到音频数据时触发流式 TTS
   * @param deviceId - 设备 ID
   * @param text - 要转换为语音的文本
   */
  async speak(deviceId: string, text: string): Promise<void> {
    // 如果 TTS 正在进行中或已完成，忽略新的音频数据
    if (this.ttsTriggered.get(deviceId) || this.ttsCompleted.get(deviceId)) {
      logger.debug(
        `[TTSService] TTS 正在进行或已完成，忽略: deviceId=${deviceId}`
      );
      return;
    }

    // 首次收到音频时触发 TTS
    if (!this.ttsTriggered.get(deviceId)) {
      // 获取设备连接（先检查连接，避免提前设置 ttsTriggered 导致无法清理）
      const connection = this.getConnection?.(deviceId);
      if (!connection) {
        logger.warn(`[TTSService] 无法获取设备连接: deviceId=${deviceId}`);
        return;
      }

      // 获取 TTS 配置
      const ttsConfig = configManager.getTTSConfig();
      if (!ttsConfig.appid || !ttsConfig.accessToken || !ttsConfig.voice_type) {
        logger.error("[TTSService] TTS 配置不完整，请检查配置文件");
        return;
      }

      // 所有前置条件满足后，再设置 ttsTriggered 状态
      this.ttsTriggered.set(deviceId, true);
      logger.info(`[TTSService] 触发流式 TTS: deviceId=${deviceId}`);

      // 初始化流式处理所需的状态
      this.audioDemuxers.set(deviceId, new prism.opus.OggDemuxer());
      this.cumulativeTimestamps.set(deviceId, 0);
      this.packetIndices.set(deviceId, 0);
      this.ttsStarted.set(deviceId, false);
      this.opusPacketBuffer.set(deviceId, []);
      this.isProcessingBuffer.set(deviceId, false);
      this.deviceConnections.set(deviceId, connection);

      // 创建 demuxer 并设置事件处理
      const demuxer = this.audioDemuxers.get(deviceId)!;
      this.setupDemuxerEvents(deviceId, demuxer, connection);

      // 创建 TTS 客户端
      const ttsClient = new TTS({
        bytedance: {
          v1: {
            app: {
              appid: ttsConfig.appid!,
              accessToken: ttsConfig.accessToken!,
            },
            audio: {
              voice_type: ttsConfig.voice_type!,
              encoding: "ogg_opus",
            },
            cluster: ttsConfig.cluster,
            endpoint: ttsConfig.endpoint,
          },
        },
      });

      // 调用流式 TTS，边接收边处理
      try {
        for await (const result of ttsClient.bytedance.v1.speak(text)) {
          // 直接将数据写入 demuxer 进行解封装
          demuxer.write(Buffer.from(result.chunk));

          // logger.info(
          //   `[TTSService] TTS 数据接收: deviceId=${deviceId}, isFinal=${result.isFinal}`
          // );
          if (result.isFinal) {
            logger.info(`[TTSService] TTS 数据接收完成: deviceId=${deviceId}`);
            demuxer.end();
            break;
          }
        }
      } catch (error) {
        logger.error(`[TTSService] TTS 调用失败: deviceId=${deviceId}`, error);
        this.cleanup(deviceId);
      }
    }
  }

  /**
   * 设置 demuxer 事件处理
   * 使用缓冲区模式避免并发问题
   * @param deviceId - 设备 ID
   * @param demuxer - Ogg Demuxer 实例
   * @param connection - ESP32 连接实例
   */
  private setupDemuxerEvents(
    deviceId: string,
    demuxer: prism.opus.OggDemuxer,
    connection: ESP32Connection
  ) {
    demuxer.on("data", (opusPacket: Buffer) => {
      // 只负责将包推入缓冲区，不做异步操作
      const buffer = this.opusPacketBuffer.get(deviceId);
      if (buffer) {
        buffer.push(opusPacket);
      }

      // 触发缓冲区处理（如果尚未在处理中），使用 .catch() 捕获异步异常
      void this.processBuffer(deviceId).catch((error) => {
        logger.error(
          `[TTSService] processBuffer 执行失败: deviceId=${deviceId}`,
          error
        );
      });
    });

    demuxer.on("end", () => {
      // 使用轮询机制等待缓冲区处理完成
      this.waitForBufferDrain(deviceId);
    });

    demuxer.on("error", (err: Error) => {
      logger.error(`[TTSService] Demuxer 错误: deviceId=${deviceId}`, err);
      // 使用 .catch() 捕获异步异常
      void this.sendStopAndCleanup(deviceId).catch((error) => {
        logger.error(
          `[TTSService] sendStopAndCleanup 执行失败: deviceId=${deviceId}`,
          error
        );
      });
    });
  }

  /**
   * 等待缓冲区排空
   * 循环检查缓冲区是否处理完成，带超时保护
   * @param deviceId - 设备 ID
   */
  private waitForBufferDrain(deviceId: string): void {
    const checkInterval = 50; // 每 50ms 检查一次

    const check = (): boolean => {
      const buffer = this.opusPacketBuffer.get(deviceId);
      const isProcessing = this.isProcessingBuffer.get(deviceId);

      // 缓冲区已清空且不在处理中
      logger.info(
        `[TTSService] 缓冲区排空检查: deviceId=${deviceId}, buffer=${buffer?.length}, isProcessing=${isProcessing}`
      );
      if ((!buffer || buffer.length === 0) && !isProcessing) {
        this.sendStopAndCleanup(deviceId);
        return true;
      }

      return false;
    };

    // 如果当前不在处理中，立即检查
    if (!this.isProcessingBuffer.get(deviceId)) {
      if (check()) return;
    }

    // 循环检查
    const intervalId = setInterval(() => {
      if (check()) {
        clearInterval(intervalId);
      }
    }, checkInterval);
  }

  /**
   * 处理缓冲区中的 Opus 包
   * 使用顺序处理避免并发问题
   * @param deviceId - 设备 ID
   */
  private async processBuffer(deviceId: string): Promise<void> {
    // 防止并发处理
    if (this.isProcessingBuffer.get(deviceId)) {
      return;
    }

    const buffer = this.opusPacketBuffer.get(deviceId);
    const connection = this.deviceConnections.get(deviceId);

    if (!buffer || !connection) {
      return;
    }

    this.isProcessingBuffer.set(deviceId, true);

    try {
      while (buffer.length > 0) {
        // 首次收到 Opus 包时发送 start 消息
        if (!this.ttsStarted.get(deviceId)) {
          await connection.send({
            type: "tts",
            session_id: connection.getSessionId(),
            state: "start",
          });
          this.ttsStarted.set(deviceId, true);
          logger.info(`[TTSService] 发送 TTS start 消息: deviceId=${deviceId}`);
        }

        // 从缓冲区取出第一个包
        const opusPacket = buffer.shift()!;

        // 计算时间戳和时长
        const timestamp = this.cumulativeTimestamps.get(deviceId) || 0;
        const duration = this.getPacketDuration(opusPacket);

        // logger.info(
        //   `[TTSService] 发送 Opus 包: deviceId=${deviceId}, timestamp=${timestamp}, duration=${duration}, opusPacketLength=${opusPacket.length}`
        // );

        // 发送 Opus 包到硬件
        await connection.sendBinaryProtocol2(opusPacket, timestamp);

        // 更新状态
        const packetIndex = (this.packetIndices.get(deviceId) || 0) + 1;
        this.packetIndices.set(deviceId, packetIndex);
        this.cumulativeTimestamps.set(deviceId, timestamp + duration);

        // 流控：等待硬件处理
        await new Promise((resolve) => setTimeout(resolve, duration * 0.8));
      }
    } finally {
      this.isProcessingBuffer.set(deviceId, false);
    }
  }

  /**
   * 发送 stop 消息并清理状态
   * @param deviceId - 设备 ID
   */
  private async sendStopAndCleanup(deviceId: string): Promise<void> {
    const connection = this.deviceConnections.get(deviceId);
    if (!connection) {
      this.cleanup(deviceId);
      return;
    }

    // 等待缓冲区处理完成
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 如果缓冲区还有数据，继续处理
    const buffer = this.opusPacketBuffer.get(deviceId);
    if (buffer && buffer.length > 0) {
      await this.processBuffer(deviceId);
    }

    // 再次检查缓冲区是否已清空
    if (this.opusPacketBuffer.get(deviceId)?.length === 0) {
      // 发送 stop 消息
      await connection.send({
        type: "tts",
        session_id: connection.getSessionId(),
        state: "stop",
      });

      // 标记 TTS 完成，防止后续音频数据触发新的 TTS
      this.ttsCompleted.set(deviceId, true);

      logger.info(`[TTSService] TTS 音频流发送完成: deviceId=${deviceId}`);
    }

    // 清理状态
    this.cleanup(deviceId);

    // 通知 TTS 流程已完成，触发重建
    if (this.onTTSComplete) {
      this.onTTSComplete(deviceId);
    }
  }

  /**
   * 清理设备状态
   * 注意：不清理 ttsCompleted，让它保持标记防止重复触发
   * @param deviceId - 设备 ID
   */
  cleanup(deviceId: string): void {
    this.audioDemuxers.delete(deviceId);
    this.cumulativeTimestamps.delete(deviceId);
    this.packetIndices.delete(deviceId);
    this.ttsStarted.delete(deviceId);
    this.ttsTriggered.delete(deviceId);
    this.opusPacketBuffer.delete(deviceId);
    this.isProcessingBuffer.delete(deviceId);
    this.deviceConnections.delete(deviceId);
    // 注意：不删除 ttsCompleted，让它保持标记防止重复触发
  }

  /**
   * 计算单个包的时长
   */
  getPacketDuration(opusPacket: Buffer): number {
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
   * 使用暂停/恢复机制确保串行处理，避免并发执行导致顺序错乱
   * @param audioBuffer - 完整的 OGG Opus 数据
   * @param sendCallback - 发送到硬件的回调函数
   * @returns 包含包数量和总时长的结果
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
    return new Promise((resolve, reject) => {
      const demuxer = new prism.opus.OggDemuxer();

      // 将 Buffer 转换为可读流
      const stream = Readable.from(audioBuffer);

      let packetIndex = 0;
      // 使用累积时间戳，确保每个包的时间戳连续递增
      let cumulativeTimestamp = 0;
      // 使用局部变量记录总时长，避免跨设备累积
      let totalDuration = 0;

      // 暂停流，等待当前包处理完成后再恢复
      stream.pause();

      const processPacket = async (opusPacket: Buffer): Promise<void> => {
        const duration = this.getPacketDuration(opusPacket);

        try {
          await sendCallback(opusPacket, {
            index: packetIndex,
            size: opusPacket.length,
            duration: duration,
            timestamp: cumulativeTimestamp,
          });

          packetIndex++;
          cumulativeTimestamp += duration;
          totalDuration += duration;
        } catch (error) {
          logger.error(`发送包 ${packetIndex} 失败:`, error);
        }
      };

      // 使用 Promise 队列确保串行处理
      let isProcessing = false;
      const packetQueue: Buffer[] = [];

      const processQueue = async (): Promise<void> => {
        if (isProcessing || packetQueue.length === 0) return;

        isProcessing = true;
        while (packetQueue.length > 0) {
          const packet = packetQueue.shift()!;
          await processPacket(packet);
        }
        isProcessing = false;
      };

      stream
        .pipe(demuxer)
        .on("data", (opusPacket: Buffer) => {
          // 将包加入队列
          packetQueue.push(opusPacket);
          // 触发队列处理
          void processQueue();
        })
        .on("end", () => {
          // 等待所有包处理完成
          const checkEnd = (): void => {
            if (packetQueue.length > 0 || isProcessing) {
              setTimeout(checkEnd, 10);
            } else {
              logger.info(
                `处理完成，共 ${packetIndex} 个包，总时长 ${(totalDuration / 1000).toFixed(2)}s`
              );
              resolve({
                packetCount: packetIndex,
                totalDuration: totalDuration,
              });
            }
          };
          checkEnd();
        })
        .on("error", reject);
    });
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.ttsTriggered.clear();
    this.audioDemuxers.clear();
    this.cumulativeTimestamps.clear();
    this.packetIndices.clear();
    this.ttsStarted.clear();
    this.ttsCompleted.clear();
    this.opusPacketBuffer.clear();
    this.isProcessingBuffer.clear();
    this.deviceConnections.clear();
    logger.debug("[TTSService] 服务已销毁");
  }
}
