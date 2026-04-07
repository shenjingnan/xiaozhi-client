/**
 * ASR 服务实现（单会话模式）
 * 每个实例管理一次语音识别会话，使用 univoice SDK
 */

import { Readable } from "node:stream";
import { logger } from "@/Logger.js";
import { configManager } from "@xiaozhi-client/config";
import { createASR, decodeOpusStream } from "univoice/asr";
import "univoice/asr/providers";
import type { ASRConnection } from "univoice/asr";
import type {
  ASRServiceEvents,
  ASRServiceOptions,
  IASRService,
} from "./asr.interface.js";

/**
 * ASR 服务（单会话模式）
 * 每个实例只管理一次语音识别，ESP32Service 每次识别时创建新实例
 */
export class ASRService implements IASRService {
  /** 事件回调 */
  private events: ASRServiceEvents;

  /** ASR 连接实例 */
  private connection?: ASRConnection;

  /** 音频数据输入流（替代队列轮询） */
  private feedingStream?: Readable;

  /** listen 任务 */
  private listenTask?: Promise<void>;

  /**
   * 构造函数
   * @param options - 配置选项
   */
  constructor(options: ASRServiceOptions = {}) {
    this.events = options.events || {};
  }

  /**
   * 启动 ASR 识别会话
   * 创建 ASR 连接并开始处理音频流
   */
  async start(): Promise<void> {
    const asrConfig = configManager.getASRConfig();

    if (!asrConfig.appid || !asrConfig.accessToken) {
      throw new Error("[ASRService] ASR 配置不完整，请检查配置文件");
    }

    // 创建音频数据输入流
    this.feedingStream = new Readable({
      read() {},
    });

    // 创建 ASR 实例
    const asr = createASR({
      provider: "doubao",
      appKey: asrConfig.appid,
      accessKey: asrConfig.accessToken,
      language: "zh-CN",
      format: "pcm",
      codec: "raw",
    });

    try {
      // 建立 ASR 连接
      this.connection = await asr.connect();

      // 将 feedingStream 转为 AsyncIterable 供 decodeOpusStream 使用
      const pcmStream = decodeOpusStream(Readable.from(this.feedingStream), {
        sampleRate: 24000,
        channels: 1,
      });

      // 启动 listen 任务
      this.listenTask = this.startListen(pcmStream);

      logger.info("[ASRService] ASR 会话已启动");
    } catch (error) {
      logger.error("[ASRService] ASR 连接建立失败", error);
      this.events.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * 处理音频数据
   * 将 Opus 音频数据推入流中
   * @param audioData - 裸 Opus 音频数据
   */
  async handleAudioData(audioData: Uint8Array): Promise<void> {
    if (!this.feedingStream) {
      logger.warn("[ASRService] 流未初始化，忽略音频数据");
      return;
    }

    this.feedingStream.push(Buffer.from(audioData));
  }

  /**
   * 结束 ASR 识别会话
   * 结束音频流并等待识别完成
   */
  async end(): Promise<void> {
    // 结束音频输入流
    this.feedingStream?.push(null);

    // 等待 listen 任务完成
    if (this.listenTask) {
      try {
        await this.listenTask;
      } catch (error) {
        logger.error("[ASRService] 等待 listen 任务失败", error);
      }
    }

    // 关闭连接
    this.connection?.close();

    logger.info("[ASRService] ASR 会话已结束");
  }

  /**
   * 启动 listen 任务
   * 使用 ASR 连接处理音频流并回调识别结果
   * @param pcmStream - PCM 音频流
   */
  private async startListen(pcmStream: AsyncIterable<Buffer>): Promise<void> {
    if (!this.connection) return;

    try {
      for await (const result of this.connection.listen(pcmStream, {
        stream: true,
      })) {
        logger.info(
          `[ASRService] ASR 识别结果: isFinal=${result.isFinal}, text=${result.text}`
        );

        // isFinal 时标记结束，避免重复触发 LLM
        if (result.isFinal) {
          logger.info("[ASRService] ASR 识别完成");
        }

        // 触发结果回调
        try {
          this.events.onResult?.(result.text || "", result.isFinal);
        } catch (callbackError) {
          logger.error("[ASRService] onResult 回调执行失败", callbackError);
        }

        if (result.isFinal) {
          break;
        }
      }

      logger.info("[ASRService] listen 任务完成");
    } catch (error) {
      logger.error("[ASRService] listen 任务出错", error);
      this.events.onError?.(error as Error);
    }
  }

  /**
   * 销毁服务
   * 清理所有资源
   */
  destroy(): void {
    // 结束音频流
    this.feedingStream?.push(null);
    this.feedingStream?.destroy();
    this.feedingStream = undefined;

    // 关闭连接
    this.connection?.close();
    this.connection = undefined;

    this.listenTask = undefined;

    logger.debug("[ASRService] 服务已销毁");
  }
}
