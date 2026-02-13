/**
 * OggOpus TTS服务
 * 提供Ogg格式Opus音频的TTS服务，支持Ogg解封装和帧元数据
 */

import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "@/Logger.js";
import type { ITTSService } from "./ai-service.interface.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 帧元数据
 */
interface FrameMetadata {
  /** 帧大小（字节） */
  size: number;
  /** 帧时长（毫秒） */
  duration: number;
}

/**
 * 音频元数据文件结构
 */
interface AudioMetadata {
  /** 音频ID */
  audioId: string;
  /** 帧数量 */
  frameCount: number;
  /** 总字节数 */
  totalBytes: number;
  /** 估计时长（毫秒） */
  estimatedDuration: number;
  /** 采样率 */
  sampleRate: number;
  /** 帧元数据列表 */
  frames: FrameMetadata[];
}

/**
 * Opus 帧数据
 */
export interface OpusFrame {
  /** 帧数据 */
  data: Uint8Array;
  /** 帧大小（字节） */
  size: number;
  /** 帧时长（毫秒） */
  duration: number;
}

/**
 * Ogg页头结构（用于解析Ogg容器）
 */
interface OggPageHeader {
  /** 捕获模式 */
  capturePattern: string;
  /** 版本 */
  version: number;
  /** 头类型标志 */
  headerType: number;
  /** 绝对颗粒位置 */
  absoluteGranulePosition: bigint;
  /** 位流序列号 */
  streamSerialNumber: number;
  /** 页序列号 */
  pageSequenceNumber: number;
  /** 校验和 */
  checksum: number;
  /** 段数 */
  pageSegments: number;
  /** 段表 */
  segmentTable: number[];
}

/**
 * OggOpus TTS服务
 * 从Ogg容器中提取纯Opus音频数据，支持逐帧发送
 */
export class OggOpusTTSService implements ITTSService {
  /** 纯Opus音频数据（解封装后或直接加载） */
  private opusData: Uint8Array | null = null;
  /** 原始Ogg文件数据 */
  private oggData: Uint8Array | null = null;
  /** 音频文件路径 */
  private readonly audioFilePath: string;
  /** 元数据文件路径 */
  private readonly metadataFilePath: string | null;
  /** 是否已初始化 */
  private initialized = false;
  /** 是否启用Ogg解封装 */
  private enableDemuxing: boolean;
  /** 是否使用预处理的Opus文件（带元数据） */
  private usePreprocessed: boolean;
  /** 解析后的帧数组 */
  private frames: OpusFrame[] = [];
  /** 音频元数据 */
  private metadata: AudioMetadata | null = null;

  constructor(options?: {
    enableDemuxing?: boolean;
    audioFilePath?: string;
    usePreprocessed?: boolean;
    metadataFilePath?: string;
  }) {
    // 默认启用解封装
    this.enableDemuxing = options?.enableDemuxing ?? true;
    // 支持自定义音频文件路径
    this.audioFilePath =
      options?.audioFilePath ?? join(__dirname, "../../assets/audio/test.opus");
    // 是否使用预处理的Opus文件
    this.usePreprocessed = options?.usePreprocessed ?? true;
    // 元数据文件路径（默认与音频文件同名，扩展名改为 .json）
    this.metadataFilePath = options?.metadataFilePath ?? null;

    logger.info(
      `[OggOpusTTS] 初始化: usePreprocessed=${this.usePreprocessed}, enableDemuxing=${this.enableDemuxing}, audioPath=${this.audioFilePath}`
    );
  }

  /**
   * 初始化TTS服务
   * 加载并解析测试音频文件
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug("[OggOpusTTS] 已初始化，跳过");
      return;
    }

    try {
      logger.info(`[OggOpusTTS] 加载测试音频: ${this.audioFilePath}`);
      const buffer = await fs.readFile(this.audioFilePath);
      this.oggData = new Uint8Array(buffer);

      // 检查音频文件格式
      const isOgg = this.checkOggFormat(this.oggData);
      logger.info(`[OggOpusTTS] 文件格式检查: isOgg=${isOgg}`);

      // 使用预处理的Opus文件模式（带元数据）
      if (this.usePreprocessed) {
        // 尝试加载元数据文件
        const metadataPath =
          this.metadataFilePath ??
          this.audioFilePath.replace(/\.opus$/, ".json");

        if (existsSync(metadataPath)) {
          logger.info(`[OggOpusTTS] 加载元数据文件: ${metadataPath}`);
          const metadataContent = await fs.readFile(metadataPath, "utf-8");
          this.metadata = JSON.parse(metadataContent) as AudioMetadata;

          // 根据元数据分割帧
          this.frames = this.splitIntoFrames(
            this.oggData,
            this.metadata.frames
          );
          this.opusData = this.oggData;

          logger.info(
            `[OggOpusTTS] 预处理模式完成: 帧数=${this.frames.length}, 总大小=${this.opusData.length} 字节, 时长=${this.metadata.estimatedDuration}ms`
          );
        } else {
          // 没有元数据文件，尝试使用 Ogg 解封装
          logger.warn(
            `[OggOpusTTS] 未找到元数据文件: ${metadataPath}，尝试 Ogg 解封装...`
          );

          if (this.enableDemuxing && isOgg) {
            // 执行 Ogg 解封装
            const result = this.demuxOggToOpus(this.oggData);
            this.opusData = result.opusData;
            this.frames = result.frames;
            logger.info(
              `[OggOpusTTS] 解封装完成: 帧数=${this.frames.length}, 总大小=${this.opusData.length} 字节`
            );
          } else {
            // 无法解封装，将整个数据作为单帧（兼容模式）
            logger.warn(
              "[OggOpusTTS] 无法解封装，将整个数据作为单帧（可能导致硬件解码失败）"
            );
            this.opusData = this.oggData;
            this.frames = [
              {
                data: this.opusData,
                size: this.opusData.length,
                duration: 60,
              },
            ];
          }
        }

        this.initialized = true;
        return;
      }

      // Ogg 解封装模式
      if (this.enableDemuxing && isOgg) {
        // 执行Ogg解封装，提取纯Opus数据和帧
        logger.info("[OggOpusTTS] 开始Ogg解封装...");
        const result = this.demuxOggToOpus(this.oggData);
        this.opusData = result.opusData;
        this.frames = result.frames;
        logger.info(
          `[OggOpusTTS] 解封装完成: 原始=${this.oggData.length} 字节, Opus=${this.opusData.length} 字节, 帧数=${this.frames.length}`
        );
      } else {
        // 直接使用原始数据
        logger.warn(
          "[OggOpusTTS] 解封装未启用或文件非Ogg格式，直接使用原始数据"
        );
        this.opusData = this.oggData;
        this.frames = [
          {
            data: this.opusData,
            size: this.opusData.length,
            duration: 60,
          },
        ];
      }

      this.initialized = true;
      logger.info(
        `[OggOpusTTS] 初始化完成，音频数据大小: ${this.opusData.length} 字节, 帧数: ${this.frames.length}`
      );
    } catch (error) {
      logger.error("[OggOpusTTS] 初始化失败:", error);
      throw new Error("OggOpus TTS初始化失败", { cause: error });
    }
  }

  /**
   * 根据元数据分割 Opus 数据为帧数组
   */
  private splitIntoFrames(
    data: Uint8Array,
    frameMetadata: FrameMetadata[]
  ): OpusFrame[] {
    const frames: OpusFrame[] = [];
    let offset = 0;

    for (const meta of frameMetadata) {
      if (offset + meta.size > data.length) {
        logger.warn(
          `[OggOpusTTS] 帧数据溢出: offset=${offset}, size=${meta.size}, total=${data.length}`
        );
        break;
      }

      frames.push({
        data: data.slice(offset, offset + meta.size),
        size: meta.size,
        duration: meta.duration,
      });
      offset += meta.size;
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

    if (!this.opusData) {
      throw new Error("Opus音频数据未初始化");
    }

    logger.debug(
      `[OggOpusTTS] 模拟TTS合成: input="${text}", outputSize=${this.opusData.length} 字节, frameCount=${this.frames.length}`
    );

    // 模拟网络延迟
    await this.delay(100);

    return this.opusData;
  }

  /**
   * 获取 Opus 帧数组（用于逐帧发送）
   * @param text - 要转换的文本（此参数未使用，仅用于模拟）
   * @returns Opus 帧数组
   */
  async synthesizeFrames(text: string): Promise<OpusFrame[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.frames.length === 0) {
      throw new Error("Opus帧数据未初始化");
    }

    logger.debug(
      `[OggOpusTTS] 获取帧数组: input="${text}", frameCount=${this.frames.length}`
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
    return (
      this.metadata?.estimatedDuration ??
      this.frames.reduce((sum, f) => sum + f.duration, 0)
    );
  }

  /**
   * 检查是否为Ogg格式文件
   * @param data - 文件数据
   * @returns 是否为Ogg格式
   */
  private checkOggFormat(data: Uint8Array): boolean {
    if (data.length < 4) {
      return false;
    }
    // Ogg文件以 "OggS" 开头
    const header = String.fromCharCode(data[0], data[1], data[2], data[3]);
    return header === "OggS";
  }

  /**
   * 解封装Ogg文件，提取纯Opus数据和帧数组
   * @param oggData - Ogg文件数据
   * @returns Opus数据和帧数组
   */
  private demuxOggToOpus(oggData: Uint8Array): {
    opusData: Uint8Array;
    frames: OpusFrame[];
  } {
    logger.info("[OggOpusTTS] 开始解封装Ogg文件...");

    const opusFrames: OpusFrame[] = [];
    let offset = 0;

    try {
      // 跳过Ogg头页（通常包含ID头和Comment头）
      let pageCount = 0;

      while (offset < oggData.length) {
        // 检查Ogg页头
        if (offset + 4 > oggData.length) {
          logger.warn("[OggOpusTTS] 到达文件末尾");
          break;
        }

        const capturePattern = String.fromCharCode(
          oggData[offset],
          oggData[offset + 1],
          oggData[offset + 2],
          oggData[offset + 3]
        );

        if (capturePattern !== "OggS") {
          logger.warn(
            `[OggOpusTTS] 无效的Ogg页头: offset=${offset}, pattern="${capturePattern}"`
          );
          break;
        }

        // 解析Ogg页头
        const header = this.parseOggPageHeader(oggData, offset);
        if (!header) {
          logger.error(`[OggOpusTTS] 解析Ogg页头失败: offset=${offset}`);
          break;
        }

        pageCount++;
        logger.debug(
          `[OggOpusTTS] 页 ${pageCount}: seq=${header.pageSequenceNumber}, segments=${header.pageSegments}`
        );

        // 跳过Ogg头页（包含ID头和Comment）
        // Opus音频数据通常从第3页开始
        if (pageCount <= 2) {
          // 计算页数据大小
          const pageSize = this.calculatePageSize(header);
          offset += pageSize;
          logger.debug(`[OggOpusTTS] 跳过头页 ${pageCount}: size=${pageSize}`);
          continue;
        }

        // 提取Opus数据（跳过Ogg页头）
        const headerSize = 27 + header.pageSegments;
        const dataSize = this.calculatePageDataSize(header);
        const pageData = oggData.slice(
          offset + headerSize,
          offset + headerSize + dataSize
        );

        // 将页数据添加到Opus帧列表
        opusFrames.push({
          data: pageData,
          size: dataSize,
          duration: 60, // Opus 帧时长通常为 60ms
        });
        logger.debug(
          `[OggOpusTTS] 提取Opus数据: 页=${pageCount}, size=${dataSize}`
        );

        // 移动到下一页
        const pageSize = this.calculatePageSize(header);
        offset += pageSize;
      }

      // 合并所有Opus帧
      const totalSize = opusFrames.reduce((sum, frame) => sum + frame.size, 0);
      const combinedOpus = new Uint8Array(totalSize);
      let writeOffset = 0;
      for (const frame of opusFrames) {
        combinedOpus.set(frame.data, writeOffset);
        writeOffset += frame.size;
      }

      logger.info(
        `[OggOpusTTS] 解封装完成: 总页数=${pageCount}, Opus帧=${opusFrames.length}, 总大小=${combinedOpus.length}`
      );

      return { opusData: combinedOpus, frames: opusFrames };
    } catch (error) {
      logger.error("[OggOpusTTS] 解封装失败:", error);
      // 失败时返回原始数据作为单帧
      return {
        opusData: oggData,
        frames: [{ data: oggData, size: oggData.length, duration: 60 }],
      };
    }
  }

  /**
   * 解析Ogg页头
   * @param data - 文件数据
   * @param offset - 页头偏移
   * @returns 解析后的页头
   */
  private parseOggPageHeader(
    data: Uint8Array,
    offset: number
  ): OggPageHeader | null {
    try {
      const view = new DataView(data.buffer, offset);

      // 读取捕获模式 (4字节)
      const capturePattern = String.fromCharCode(
        data[offset],
        data[offset + 1],
        data[offset + 2],
        data[offset + 3]
      );

      // 读取版本 (1字节)
      const version = view.getUint8(4);

      // 读取头类型 (1字节)
      const headerType = view.getUint8(5);

      // 读取绝对颗粒位置 (8字节)
      const absoluteGranulePosition = view.getBigUint64(6, true);

      // 读取位流序列号 (4字节)
      const streamSerialNumber = view.getUint32(14, true);

      // 读取页序列号 (4字节)
      const pageSequenceNumber = view.getUint32(18, true);

      // 读取校验和 (4字节)
      const checksum = view.getUint32(22, true);

      // 读取段数 (1字节)
      const pageSegments = view.getUint8(26);

      // 读取段表
      const segmentTable: number[] = [];
      for (let i = 0; i < pageSegments; i++) {
        segmentTable.push(view.getUint8(27 + i));
      }

      return {
        capturePattern,
        version,
        headerType,
        absoluteGranulePosition,
        streamSerialNumber,
        pageSequenceNumber,
        checksum,
        pageSegments,
        segmentTable,
      };
    } catch (error) {
      logger.error(`[OggOpusTTS] 解析页头失败: offset=${offset}`, error);
      return null;
    }
  }

  /**
   * 计算Ogg页总大小
   * @param header - 页头
   * @returns 页总大小
   */
  private calculatePageSize(header: OggPageHeader): number {
    // 页头大小 (27) + 段表大小 + 数据大小
    const dataTotal = header.segmentTable.reduce((sum, size) => sum + size, 0);
    return 27 + header.pageSegments + dataTotal;
  }

  /**
   * 计算页数据大小
   * @param header - 页头
   * @returns 数据大小
   */
  private calculatePageDataSize(header: OggPageHeader): number {
    return header.segmentTable.reduce((sum, size) => sum + size, 0);
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
    return this.opusData?.length ?? 0;
  }

  /**
   * 重置服务（用于测试）
   */
  reset(): void {
    this.initialized = false;
    this.opusData = null;
    this.oggData = null;
    this.frames = [];
    this.metadata = null;
    logger.debug("[OggOpusTTS] 服务已重置");
  }
}
