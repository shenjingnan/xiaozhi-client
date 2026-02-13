/**
 * PCM转Opus TTS服务
 * 将PCM音频数据编码为Opus格式，支持逐帧发送
 */

import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "@/Logger.js";
import type { ITTSService } from "./ai-service.interface.js";
import type { OpusFrame } from "./ogg-opus-tts.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * PCM Opus TTS服务
 * 将PCM音频数据转换为Opus编码，支持逐帧发送
 */
export class PCOpusTTSService implements ITTSService {
  /** Opus编码器 */
  private encoder: any = null;
  /** 音频文件路径 */
  private readonly audioFilePath: string;
  /** 采样率 */
  private readonly sampleRate: number;
  /** 声道数 */
  private readonly channels: number;
  /** 每帧样本数（60ms = 960 samples @ 16kHz） */
  private readonly frameSize: number;
  /** 是否已初始化 */
  private initialized = false;
  /** 编码后的帧数组 */
  private frames: OpusFrame[] = [];

  constructor(options?: {
    audioFilePath?: string;
    sampleRate?: number;
    channels?: number;
  }) {
    // 支持自定义音频文件路径
    this.audioFilePath =
      options?.audioFilePath ?? join(__dirname, "../../assets/audio/test.pcm");
    // 默认使用16kHz采样率（与ESP32一致）
    this.sampleRate = options?.sampleRate ?? 16000;
    // 单声道
    this.channels = options?.channels ?? 1;
    // 60ms帧 = 16000 * 60 / 1000 = 960 samples
    this.frameSize = Math.floor((this.sampleRate * 60) / 1000);

    logger.info(
      `[PCOpusTTS] 初始化: audioPath=${this.audioFilePath}, sampleRate=${this.sampleRate}, channels=${this.channels}, frameSize=${this.frameSize}`
    );
  }

  /**
   * 初始化TTS服务
   * 加载PCM文件并编码为Opus
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug("[PCOpusTTS] 已初始化，跳过");
      return;
    }

    try {
      // 动态导入Opus编码器
      const Opus = await import("@discordjs/opus");
      this.encoder = new Opus.OpusEncoder(this.sampleRate, this.channels);

      logger.info(`[PCOpusTTS] 加载PCM音频: ${this.audioFilePath}`);

      if (!existsSync(this.audioFilePath)) {
        throw new Error(`PCM文件不存在: ${this.audioFilePath}`);
      }

      // 读取PCM文件
      const pcmBuffer = await fs.readFile(this.audioFilePath);
      const pcmData = new Uint8Array(pcmBuffer);

      logger.info(`[PCOpusTTS] PCM文件加载完成: size=${pcmData.length} 字节`);

      // 编码PCM为Opus帧
      this.frames = this.encodePCMToOpusFrames(pcmData);

      logger.info(
        `[PCOpusTTS] Opus编码完成: 帧数=${this.frames.length}, 总大小=${this.frames.reduce((sum, f) => sum + f.size, 0)} 字节`
      );

      this.initialized = true;
    } catch (error) {
      logger.error("[PCOpusTTS] 初始化失败:", error);
      throw new Error("PCOpus TTS初始化失败", { cause: error });
    }
  }

  /**
   * 将PCM数据编码为Opus帧数组
   * @param pcmData - PCM音频数据
   * @returns Opus帧数组
   */
  private encodePCMToOpusFrames(pcmData: Uint8Array): OpusFrame[] {
    const frames: OpusFrame[] = [];
    let offset = 0;
    const bytesPerFrame = this.frameSize * this.channels * 2; // 16bit = 2 bytes

    logger.info(
      `[PCOpusTTS] 开始编码: PCM大小=${pcmData.length}, 每帧字节数=${bytesPerFrame}`
    );

    while (offset + bytesPerFrame <= pcmData.length) {
      // 提取一帧PCM数据
      const pcmFrame = pcmData.slice(offset, offset + bytesPerFrame);

      // 编码为Opus
      const opusFrame = this.encoder.encode(pcmFrame, this.frameSize);

      frames.push({
        data: opusFrame,
        size: opusFrame.length,
        duration: 60, // 60ms
      });

      offset += bytesPerFrame;

      // 记录前几帧的编码结果
      if (frames.length <= 3) {
        logger.debug(
          `[PCOpusTTS] 帧 ${frames.length}: PCM=${bytesPerFrame} 字节 -> Opus=${opusFrame.length} 字节`
        );
      }
    }

    // 处理剩余数据（不足一帧的情况）
    if (offset < pcmData.length) {
      const remainingSize = pcmData.length - offset;
      logger.warn(
        `[PCOpusTTS] 剩余数据不足一帧: ${remainingSize} 字节，将填充静音`
      );

      // 用静音填充最后一帧
      const paddedFrame = new Uint8Array(bytesPerFrame);
      paddedFrame.fill(0);
      const remainingPCM = pcmData.slice(offset);
      paddedFrame.set(remainingPCM, 0);

      const opusFrame = this.encoder.encode(paddedFrame, this.frameSize);
      frames.push({
        data: opusFrame,
        size: opusFrame.length,
        duration: 60,
      });
    }

    // 记录最后几帧的信息
    const lastFrames = frames.slice(-3);
    for (const frame of lastFrames) {
      logger.debug(
        `[PCOpusTTS] 末尾帧: Opus=${frame.size} 字节, duration=${frame.duration}ms`
      );
    }

    return frames;
  }

  /**
   * 文本转语音（TTS）
   * 返回预加载的音频数据（兼容旧接口）
   * @param text - 要转换的文本（此参数未使用，仅用于模拟）
   * @returns Opus音频数据
   */
  async synthesize(text: string): Promise<Uint8Array> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.frames.length === 0) {
      throw new Error("Opus帧数据未初始化");
    }

    logger.debug(
      `[PCOpusTTS] 模拟TTS合成: input="${text}", frameCount=${this.frames.length}`
    );

    // 合并所有帧
    const totalSize = this.frames.reduce((sum, f) => sum + f.size, 0);
    const combinedOpus = new Uint8Array(totalSize);
    let offset = 0;
    for (const frame of this.frames) {
      combinedOpus.set(frame.data, offset);
      offset += frame.size;
    }

    // 模拟网络延迟
    await this.delay(100);

    return combinedOpus;
  }

  /**
   * 获取Opus帧数组（用于逐帧发送）
   * @param text - 要转换的文本（此参数未使用，仅用于模拟）
   * @returns Opus帧数组
   */
  async synthesizeFrames(text: string): Promise<OpusFrame[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.frames.length === 0) {
      throw new Error("Opus帧数据未初始化");
    }

    logger.debug(
      `[PCOpusTTS] 获取帧数组: input="${text}", frameCount=${this.frames.length}`
    );

    // 模拟网络延迟
    await this.delay(100);

    return this.frames;
  }

  /**
   * 获取帧数量
   */
  getFrameCount(): number {
    return this.frames.length;
  }

  /**
   * 获取估计时长（毫秒）
   */
  getEstimatedDuration(): number {
    return this.frames.reduce((sum, f) => sum + f.duration, 0);
  }

  /**
   * 模拟延迟
   * @param ms - 延迟毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取音频数据大小
   * @returns 音频数据大小（字节）
   */
  getAudioDataSize(): number {
    return this.frames.reduce((sum, f) => sum + f.size, 0);
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.encoder) {
      this.encoder.delete();
      this.encoder = null;
    }
    this.frames = [];
    this.initialized = false;
    logger.debug("[PCOpusTTS] 服务已销毁");
  }
}
