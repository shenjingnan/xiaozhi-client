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

import { Readable } from "node:stream";
import { logger } from "@/Logger.js";
import { synthesizeSpeechStream } from "@/lib/tts/binary.js";
import { ASR, AudioFormat, AuthMethod } from "@xiaozhi-client/asr";
import { configManager } from "@xiaozhi-client/config";
import * as prism from "prism-media";
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
  private readonly deviceConnections = new Map<string, any>();

  /** 每个设备的 ASR 客户端（用于语音识别） */
  private readonly asrClients = new Map<string, ASR>();

  /**
   * 设置 ESP32 服务引用
   * @param esp32Service - ESP32 服务实例
   */
  setESP32Service(esp32Service: ESP32Service): void {
    this.esp32Service = esp32Service;
  }

  /**
   * 开始语音会话
   * 在会话开始时初始化 ASR
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
    await this.endASR(deviceId);
  }

  /**
   * 处理 TTS 音频数据
   * 首次收到音频数据时触发流式 TTS
   * @param deviceId - 设备 ID
   * @param audioData - 音频数据
   */
  async handleTTSData(deviceId: string, audioData: Uint8Array): Promise<void> {
    logger.debug(
      `[TestVoiceSessionService] 收到音频数据: deviceId=${deviceId}, size=${audioData.length}`
    );

    // 如果 TTS 正在进行中或已完成，忽略新的音频数据
    if (this.ttsTriggered.get(deviceId) || this.ttsCompleted.get(deviceId)) {
      logger.debug(
        `[TestVoiceSessionService] TTS 正在进行或已完成，忽略音频数据: deviceId=${deviceId}`
      );
      return;
    }

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
      this.opusPacketBuffer.set(deviceId, []);
      this.isProcessingBuffer.set(deviceId, false);
      this.deviceConnections.set(deviceId, connection);

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
   * 处理音频数据（ASR 语音识别）
   * 平滑发送音频到 ASR 服务
   * @param deviceId - 设备 ID
   * @param audioData - 裸 Opus 音频数据
   */
  async handleAudioData(
    deviceId: string,
    audioData: Uint8Array
  ): Promise<void> {
    const audioBuffer = Buffer.from(audioData);
    logger.debug(
      `[TestVoiceSessionService] 收到音频数据(ASR): deviceId=${deviceId}, size=${audioData.length}`
    );

    // ASR 相关逻辑：首次收到音频数据时，初始化ASR客户端
    if (!this.asrClients.has(deviceId)) {
      await this.initASR(deviceId);
    }

    // 获取 ASR 客户端
    const asrClient = this.asrClients.get(deviceId);
    if (!asrClient) {
      logger.warn(
        `[TestVoiceSessionService] ASR 客户端初始化失败: deviceId=${deviceId}`
      );
      return;
    }

    // 解码 Opus 为 PCM 并发送
    try {
      const pcmData = await this.decodeOpusToPcm(audioBuffer);
      await asrClient.sendFrame(pcmData);
      logger.debug(
        `[TestVoiceSessionService] 已发送PCM数据: deviceId=${deviceId}, pcmSize=${pcmData.length}`
      );
    } catch (error) {
      logger.error(
        `[TestVoiceSessionService] PCM解码或发送失败: deviceId=${deviceId}`,
        error
      );
    }
  }

  /**
   * 将 Opus 音频数据解码为 PCM
   * @param opusData - 裸 Opus 数据
   * @param sampleRate - 采样率（默认16000）
   * @param channels - 声道数（默认1）
   * @returns PCM 数据
   */
  private async decodeOpusToPcm(
    opusData: Buffer,
    sampleRate = 16000,
    channels = 1
  ): Promise<Buffer> {
    const frameSize = Math.floor(sampleRate * 0.02); // 16kHz * 20ms = 320
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      const stream = Readable.from(opusData);
      const decoder = new prism.opus.Decoder({
        rate: sampleRate,
        channels: channels,
        frameSize: frameSize,
      });

      decoder.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      decoder.on("end", () => resolve());
      decoder.on("error", reject);

      stream.pipe(decoder);
    });

    return Buffer.concat(chunks);
  }

  /**
   * 初始化 ASR 语音识别服务
   * 如果已存在 ASR 客户端且已连接，则跳过初始化
   * @param deviceId - 设备 ID
   */
  async initASR(deviceId: string): Promise<void> {
    // 检查是否已存在 ASR 客户端且已连接
    const existingClient = this.asrClients.get(deviceId);
    if (existingClient?.isConnected()) {
      logger.debug(
        `[TestVoiceSessionService] ASR 客户端已存在且已连接，跳过初始化: deviceId=${deviceId}`
      );
      return;
    }

    // 如果已存在但未连接，先关闭
    if (existingClient) {
      logger.warn(
        `[TestVoiceSessionService] ASR 客户端存在但未连接，关闭旧的: deviceId=${deviceId}`
      );
      await existingClient.close();
      this.asrClients.delete(deviceId);
    }

    const asrConfig = configManager.getASRConfig();

    if (!asrConfig.appid || !asrConfig.accessToken) {
      logger.error("[TestVoiceSessionService] ASR 配置不完整，请检查配置文件");
      return;
    }

    const asrClient = new ASR({
      wsUrl: asrConfig.wsUrl || "wss://openspeech.bytedance.com/api/v2/asr",
      cluster: asrConfig.cluster || "volcengine_streaming_common",
      appid: asrConfig.appid,
      token: asrConfig.accessToken,
      format: AudioFormat.RAW, // 裸 Opus 数据
      authMethod: AuthMethod.TOKEN,
      sampleRate: 16000,
      language: "zh-CN",
      channel: 1,
      bits: 16,
      codec: "raw", // RAW 编解码（发送PCM数据）
      segDuration: 15000,
      nbest: 1,
      resultType: "full",
      workflow: "audio_in,resample,partition,vad,fe,decode,itn,nlu_punctuate",
      showLanguage: false,
      showUtterances: false,
    });

    // 设置事件监听
    asrClient.on("result", (result) => {
      logger.info(
        `[TestVoiceSessionService] ASR 识别结果: ${JSON.stringify(result)}`
      );
    });

    asrClient.on("full_response", (response) => {
      logger.info(
        `[TestVoiceSessionService] ASR 完整响应: ${JSON.stringify(response)}`
      );
    });

    asrClient.on("audio_end", () => {
      logger.info(
        `[TestVoiceSessionService] ASR 音频发送完成: deviceId=${deviceId}`
      );
    });

    asrClient.on("error", (error: Error) => {
      logger.error(`[TestVoiceSessionService] ASR 错误: ${error.message}`);
    });

    asrClient.on("close", () => {
      logger.info(
        `[TestVoiceSessionService] ASR 连接关闭: deviceId=${deviceId}`
      );
      this.asrClients.delete(deviceId);
    });

    await asrClient.connect();
    this.asrClients.set(deviceId, asrClient);

    logger.info(
      `[TestVoiceSessionService] ASR 客户端已创建: deviceId=${deviceId}`
    );
  }

  /**
   * 结束 ASR 语音识别
   * 发送结束信号、关闭连接并清理资源
   * @param deviceId - 设备 ID
   */
  async endASR(deviceId: string): Promise<void> {
    const asrClient = this.asrClients.get(deviceId);
    if (asrClient) {
      try {
        const result = await asrClient.end();
        logger.info(
          `[TestVoiceSessionService] ASR 最终识别结果: ${JSON.stringify(result)}`
        );
      } catch (error) {
        logger.error(
          `[TestVoiceSessionService] ASR 结束失败: deviceId=${deviceId}`,
          error
        );
      } finally {
        await asrClient.close();
        this.asrClients.delete(deviceId);
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
   * 使用缓冲区模式避免并发问题
   * @param deviceId - 设备 ID
   * @param demuxer - Ogg Demuxer 实例
   * @param connection - ESP32 连接实例
   */
  private setupDemuxerEvents(
    deviceId: string,
    demuxer: prism.opus.OggDemuxer,
    connection: any
  ) {
    demuxer.on("data", (opusPacket: Buffer) => {
      // 只负责将包推入缓冲区，不做异步操作
      const buffer = this.opusPacketBuffer.get(deviceId);
      if (buffer) {
        buffer.push(opusPacket);
      }

      // 触发缓冲区处理（如果尚未在处理中）
      this.processBuffer(deviceId);
    });

    demuxer.on("end", () => {
      // 使用轮询机制等待缓冲区处理完成
      this.waitForBufferDrain(deviceId);
    });

    demuxer.on("error", (err: Error) => {
      logger.error(
        `[TestVoiceSessionService] Demuxer 错误: deviceId=${deviceId}`,
        err
      );
      this.sendStopAndCleanup(deviceId);
    });
  }

  /**
   * 等待缓冲区排空
   * 循环检查缓冲区是否处理完成，带超时保护
   * @param deviceId - 设备 ID
   */
  private waitForBufferDrain(deviceId: string): void {
    const maxWaitTime = 1000; // 最大等待 1 秒
    const checkInterval = 50; // 每 50ms 检查一次
    const startTime = Date.now();

    const check = () => {
      const buffer = this.opusPacketBuffer.get(deviceId);
      const isProcessing = this.isProcessingBuffer.get(deviceId);

      // 缓冲区已清空且不在处理中
      if ((!buffer || buffer.length === 0) && !isProcessing) {
        this.sendStopAndCleanup(deviceId);
        return true;
      }

      // 超时，强制发送 stop
      if (Date.now() - startTime >= maxWaitTime) {
        logger.warn(
          `[TestVoiceSessionService] 缓冲区排空超时，强制发送 stop: deviceId=${deviceId}`
        );
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
          logger.info(
            `[TestVoiceSessionService] 发送 TTS start 消息: deviceId=${deviceId}`
          );
        }

        // 从缓冲区取出第一个包
        const opusPacket = buffer.shift()!;

        // 计算时间戳和时长
        const timestamp = this.cumulativeTimestamps.get(deviceId) || 0;
        const duration = this.getPacketDuration(opusPacket);

        logger.info(
          `[TestVoiceSessionService] 发送 Opus 包: deviceId=${deviceId}, timestamp=${timestamp}, duration=${duration}, opusPacketLength=${opusPacket.length}`
        );

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
      this.cleanupDeviceState(deviceId);
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

      logger.info(
        `[TestVoiceSessionService] TTS 音频流发送完成: deviceId=${deviceId}`
      );
    }

    // 清理状态
    this.cleanupDeviceState(deviceId);
  }

  /**
   * 清理设备状态
   * 注意：不清理 ttsCompleted，让它保持标记防止重复触发
   * @param deviceId - 设备 ID
   */
  private cleanupDeviceState(deviceId: string) {
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
            logger.error(`发送包 ${packetIndex} 失败:`, error);
          }
        })
        .on("end", () => {
          logger.info(
            `处理完成，共 ${packetIndex} 个包，总时长 ${(totalDuration / 1000).toFixed(2)}s`
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
  // private async processAndSendAudio(
  //   deviceId: string,
  //   connection: any
  // ): Promise<void> {
  //   const chunks = this.oggChunks.get(deviceId);
  //   if (!chunks || chunks.length === 0) {
  //     logger.warn(
  //       `[TestVoiceSessionService] 无音频数据可处理: deviceId=${deviceId}`
  //     );
  //     return;
  //   }

  //   try {
  //     // 1. 合并所有 Ogg 数据块
  //     const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  //     const mergedOgg = new Uint8Array(totalLength);
  //     let offset = 0;
  //     for (const chunk of chunks) {
  //       mergedOgg.set(chunk, offset);
  //       offset += chunk.length;
  //     }
  //     logger.debug(
  //       `[TestVoiceSessionService] 合并 Ogg 数据: deviceId=${deviceId}, totalSize=${totalLength}`
  //     );

  //     // 2. 存储到临时目录
  //     const tempDir = PathUtils.getTempDir();
  //     logger.info(`[TestVoiceSessionService] 临时目录: ${tempDir}`);
  //     const fileName = `tts-${deviceId}-${Date.now()}.ogg`;
  //     const filePath = pathJoin(tempDir, fileName);
  //     await fs.writeFile(filePath, mergedOgg);
  //     logger.info(`[TestVoiceSessionService] 已存储 TTS 音频到: ${filePath}`);

  //     await new Promise((resolve) => setTimeout(resolve, 2000));
  //     // 3. 发送 TTS start 消息
  //     await connection.send({
  //       type: "tts",
  //       session_id: connection.getSessionId(),
  //       state: "start",
  //     });
  //     logger.debug(
  //       `[TestVoiceSessionService] 发送 TTS start 消息: deviceId=${deviceId}`
  //     );

  //     // 4. 解封装为纯 Opus 数据
  //     // const opusData = await demuxOggOpus(mergedOgg);
  //     // logger.debug(
  //     //   `[TestVoiceSessionService] 解封装 Ogg 数据: deviceId=${deviceId}, opusSize=${opusData.length}`
  //     // );

  //     // 5. 分块下发 Opus 数据
  //     // @ts-ignore
  //     // const oggData = await fs.readFile(filePath);
  //     // const oggData = await fs.readFile('~/Downloads/activation.ogg'); // 可以播放 frame_duration:10ms
  //     // const oggData = await fs.readFile('~/Downloads/activation-20ms.ogg'); // 可以播放 frame_duration:10ms
  //     // const oggData = await fs.readFile('~/Downloads/activation-60ms.ogg'); // 可以播放 frame_duration:10ms
  //     // const oggData = await fs.readFile('~/Downloads/activation-24khz-2.ogg'); // 可以播放 frame_duration:10ms
  //     // const oggData = await fs.readFile('~/Downloads/activation-60ms-24khz.ogg'); // 可以播放 frame_duration:10ms
  //     // const oggData = await fs.readFile('~/Downloads/activation-60ms-16khz.ogg'); // 可以播放 frame_duration:10ms
  //     // const oggData = await fs.readFile('~/Downloads/music.ogg'); // 可以播放 frame_duration:10ms ****
  //     // const oggData = await fs.readFile('~/Downloads/music-20ms-24khz.ogg'); // 可以播放 frame_duration:10ms ****
  //     // const oggData = await fs.readFile('~/Downloads/welcome-ar-sa.ogg'); // 可以播放
  //     // const oggData = await fs.readFile('~/Downloads/welcome-ar-sa-20ms.ogg');
  //     // const oggData = await fs.readFile('~/Downloads/welcome-ar-sa-24.ogg');
  //     // const oggData = await fs.readFile('~/Downloads/tts-24.ogg');
  //     // logger.debug(
  //     //   `[TestVoiceSessionService] 读取 Ogg 数据: deviceId=${deviceId}, oggSize=${oggData.length}`
  //     // );

  //     // let cumulativeTimestamp = 0;
  //     // for (const chunk of chunks) {
  //     //   const duration = this.getPacketDuration(Buffer.from(chunk));
  //     //   await connection.sendBinaryProtocol2(Buffer.from(chunk), cumulativeTimestamp);
  //     //   cumulativeTimestamp += duration;
  //     // }
  //     // return;
  //     // logger.info(`[TestVoiceSessionService] oggData size: ${oggData.length}`);
  //     // // 用于收集重新组装的 opus 包
  //     // const reassembledPackets: Buffer[] = [];

  //     // await this.processAudioBuffer(
  //     //   Buffer.from(mergedOgg),
  //     //   async (opusPacket, metadata) => {
  //     //     console.log(metadata, opusPacket.length);
  //     //     // if (metadata.index < 30) return;
  //     //     // 原有逻辑：发送到硬件
  //     //     await connection.sendBinaryProtocol2(opusPacket, metadata.timestamp);
  //     //     await new Promise((resolve) =>
  //     //       setTimeout(resolve, metadata.duration * 0.8)
  //     //     );

  //     //     // 新增：收集包用于验证
  //     //     // reassembledPackets.push(opusPacket);
  //     //   }
  //     // );

  //     // // 6. 重新封装成 ogg 文件进行验证
  //     // if (reassembledPackets.length > 0) {
  //     //   const outputPath = pathJoin(
  //     //     PathUtils.getTempDir(),
  //     //     `reassembled_${Date.now()}.ogg`
  //     //   );
  //     //   const rawOpusPath = pathJoin(
  //     //     PathUtils.getTempDir(),
  //     //     `raw_${Date.now()}.opus`
  //     //   );

  //     //   // 将所有 opus 包合并成一个原始 opus 文件
  //     //   const mergedOpus = Buffer.concat(reassembledPackets);
  //     //   await fs.writeFile(rawOpusPath, mergedOpus);

  //     //   // 使用 ffmpeg 将原始 opus 转换为 ogg
  //     //   try {
  //     //     await execAsync(
  //     //       `ffmpeg -y -acodec opus -i "${rawOpusPath}" -acodec copy "${outputPath}" 2>/dev/null`
  //     //     );

  //     //     // 获取文件大小
  //     //     const stats = await fs.stat(outputPath);

  //     //     logger.info(
  //     //       `[Test] 重新封装 ogg 文件完成: ${outputPath}, 原始文件大小=${oggData.length}, 重新封装后大小=${stats.size}, 包数量=${reassembledPackets.length}`
  //     //     );
  //     //   } catch (error) {
  //     //     logger.warn(
  //     //       `[Test] ffmpeg 转换失败，直接使用原始 opus 文件: ${rawOpusPath}`,
  //     //       error
  //     //     );
  //     //   } finally {
  //     //     // 清理临时原始 opus 文件
  //     //     try {
  //     //       await fs.unlink(rawOpusPath);
  //     //     } catch {
  //     //       // 忽略删除错误
  //     //     }
  //     //   }
  //     // }
  //     // await connection.sendBinaryProtocol2(opusData, 3000);
  //     // const chunkSize = 1024;
  //     // let timestamp = 0;
  //     // for (let i = 0; i < opusData.length; i += chunkSize) {
  //     //   const chunk = opusData.slice(i, i + chunkSize);
  //     //   await connection.sendBinaryProtocol2(chunk, timestamp);
  //     //   timestamp += 60; // 每帧间隔 60ms
  //     // }

  //     // 6. 发送 TTS stop 消息
  //     await connection.send({
  //       type: "tts",
  //       session_id: connection.getSessionId(),
  //       state: "stop",
  //     });
  //     logger.debug(
  //       `[TestVoiceSessionService] 发送 TTS stop 消息: deviceId=${deviceId}`
  //     );

  //     // logger.info(
  //     //   `[TestVoiceSessionService] TTS 音频下发完成: deviceId=${deviceId}, totalChunks=${Math.ceil(
  //     //     getOpusPacketDuration(opusData as Buffer)
  //     //   )}`
  //     // );
  //   } catch (error) {
  //     logger.error(
  //       `[TestVoiceSessionService] 处理音频数据失败: deviceId=${deviceId}`,
  //       error
  //     );
  //   } finally {
  //     // 清理数据
  //     this.oggChunks.delete(deviceId);
  //   }
  // }

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
    // 清理 ASR 客户端
    for (const asrClient of this.asrClients.values()) {
      asrClient.close();
    }
    this.asrClients.clear();
    logger.debug("[TestVoiceSessionService] 服务已销毁");
  }
}
