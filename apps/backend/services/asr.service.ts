/**
 * ASR 服务实现
 * 处理语音识别功能
 */

import { logger } from "@/Logger.js";
import { ASR, AudioFormat, AuthMethod, OpusDecoder } from "@xiaozhi-client/asr";
import { configManager } from "@xiaozhi-client/config";
import type {
  ASRServiceEvents,
  ASRServiceOptions,
  IASRService,
} from "./asr.interface.js";

/**
 * ASR 服务
 * 处理语音识别功能，通过回调通知识别结果
 */
export class ASRService implements IASRService {
  /** 事件回调 */
  private events: ASRServiceEvents;

  /** 每个设备的 ASR 客户端（用于语音识别） */
  private readonly asrClients = new Map<string, ASR>();

  /** 每个设备的音频数据队列（用于 V2 listen API） */
  private readonly audioQueues = new Map<string, Buffer[]>();

  /** 每个设备的是否已结束音频输入 */
  private readonly audioEnded = new Map<string, boolean>();

  /** 每个设备的 V2 listen 任务 */
  private readonly listenTasks = new Map<string, Promise<void>>();

  /**
   * 构造函数
   * @param options - 配置选项
   */
  constructor(options: ASRServiceOptions = {}) {
    this.events = options.events || {};
  }

  /**
   * 初始化 ASR 语音识别服务
   * 如果已存在 ASR 客户端且已连接，则跳过初始化
   * @param deviceId - 设备 ID
   */
  async init(deviceId: string): Promise<void> {
    // 检查是否已存在 ASR 客户端且已连接
    const existingClient = this.asrClients.get(deviceId);
    if (existingClient?.isConnected()) {
      logger.debug(
        `[ASRService] ASR 客户端已存在且已连接，跳过初始化: deviceId=${deviceId}`
      );
      return;
    }

    // 如果已存在但未连接，先关闭
    if (existingClient) {
      logger.warn(
        `[ASRService] ASR 客户端存在但未连接，关闭旧的: deviceId=${deviceId}`
      );
      await existingClient.close();
      this.asrClients.delete(deviceId);
    }

    // 执行初始化
    await this.doInitASR(deviceId);
  }

  /**
   * 执行实际的 ASR 初始化
   * 使用 V2 API 配置
   * @param deviceId - 设备 ID
   */
  private async doInitASR(deviceId: string): Promise<void> {
    const asrConfig = configManager.getASRConfig();

    if (!asrConfig.appid || !asrConfig.accessToken) {
      logger.error("[ASRService] ASR 配置不完整，请检查配置文件");
      return;
    }

    // 使用 V2 配置格式
    const asrClient = new ASR({
      bytedance: {
        v2: {
          app: {
            appid: asrConfig.appid,
            token: asrConfig.accessToken,
            cluster: asrConfig.cluster || "volcengine_streaming_common",
          },
          user: {
            uid: `device_${deviceId}`,
          },
          audio: {
            format: AudioFormat.RAW,
            language: "zh-CN",
          },
          request: {
            reqid: `req_${deviceId}_${Date.now()}`,
            sequence: 1,
          },
        },
      },
      authMethod: AuthMethod.TOKEN,
    });

    // 设置事件监听
    asrClient.on("error", (error: Error) => {
      logger.error(
        `[ASRService] ASR 错误: deviceId=${deviceId}, error=${error.message}`
      );
      this.events.onError?.(deviceId, error);
    });

    asrClient.on("close", () => {
      logger.info(`[ASRService] ASR 连接关闭: deviceId=${deviceId}`);
      this.asrClients.delete(deviceId);
      this.audioQueues.delete(deviceId);
      this.audioEnded.delete(deviceId);
      this.listenTasks.delete(deviceId);
      this.events.onClose?.(deviceId);
    });

    // 初始化音频队列
    this.audioQueues.set(deviceId, []);
    this.audioEnded.set(deviceId, false);

    // 保存 ASR 客户端
    this.asrClients.set(deviceId, asrClient);

    // 启动 listen 任务处理音频流
    const listenTask = this.startListenTask(deviceId, asrClient);
    this.listenTasks.set(deviceId, listenTask);

    logger.info(`[ASRService] ASR 客户端已创建（V2）: deviceId=${deviceId}`);
  }

  /**
   * 处理音频数据
   * 将音频数据推入队列，由 listen() 异步生成器消费
   * @param deviceId - 设备 ID
   * @param audioData - 裸 Opus 音频数据
   */
  async handleAudioData(
    deviceId: string,
    audioData: Uint8Array
  ): Promise<void> {
    const audioBuffer = Buffer.from(audioData);
    logger.debug(
      `[ASRService] 收到音频数据: deviceId=${deviceId}, size=${audioData.length}`
    );

    // 检查 ASR 客户端是否存在
    const asrClient = this.asrClients.get(deviceId);
    if (!asrClient) {
      logger.warn(`[ASRService] ASR 客户端未初始化: deviceId=${deviceId}`);
      return;
    }

    // 检查是否已经结束
    if (this.audioEnded.get(deviceId)) {
      logger.debug(`[ASRService] 音频已结束，忽略新数据: deviceId=${deviceId}`);
      return;
    }

    // 解码 Opus 为 PCM 并推入队列
    try {
      // 使用 OpusDecoder 解码
      const pcmData = await OpusDecoder.toPcm(audioBuffer);

      // 获取或创建队列
      let queue = this.audioQueues.get(deviceId);
      if (!queue) {
        queue = [];
        this.audioQueues.set(deviceId, queue);
      }

      // 推入队列
      queue.push(pcmData);
      logger.debug(
        `[ASRService] 已将PCM推入队列: deviceId=${deviceId}, pcmSize=${pcmData.length}, queueLength=${queue.length}`
      );
    } catch (error) {
      logger.error(`[ASRService] PCM解码失败: deviceId=${deviceId}`, error);
    }
  }

  /**
   * 创建异步生成器，从队列中读取 PCM 数据
   * @param deviceId - 设备 ID
   * @returns 异步生成器
   */
  private async *createAudioStream(
    deviceId: string
  ): AsyncGenerator<Buffer, void, unknown> {
    const queue = this.audioQueues.get(deviceId) || [];

    while (true) {
      // 等待队列中有数据
      while (queue.length === 0) {
        // 检查是否已结束
        if (this.audioEnded.get(deviceId)) {
          logger.debug(`[ASRService] 音频流结束: deviceId=${deviceId}`);
          return;
        }
        // 短暂等待
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // 从队列取出数据
      const pcmData = queue.shift()!;
      yield pcmData;
    }
  }

  /**
   * 启动 listen 任务
   * 使用 V2 API 的 listen() 方法处理音频流
   * @param deviceId - 设备 ID
   * @param asrClient - ASR 客户端
   */
  private async startListenTask(
    deviceId: string,
    asrClient: ASR
  ): Promise<void> {
    try {
      // 创建音频流生成器
      const audioStream = this.createAudioStream(deviceId);

      // 使用 V2 listen API 进行流式识别
      for await (const result of asrClient.bytedance.v2.listen(audioStream)) {
        logger.info(
          `[ASRService] ASR 识别结果: deviceId=${deviceId}, isFinal=${result.isFinal}, text=${result.text}`
        );

        // 触发结果回调
        this.events.onResult?.(deviceId, result.text || "", result.isFinal);
      }

      logger.info(`[ASRService] listen 任务完成: deviceId=${deviceId}`);
    } catch (error) {
      logger.error(`[ASRService] listen 任务出错: deviceId=${deviceId}`, error);
    }
  }

  /**
   * 结束 ASR 语音识别
   * 标记音频结束，由 listen() 任务自动处理关闭
   * @param deviceId - 设备 ID
   */
  async end(deviceId: string): Promise<void> {
    // 标记音频已结束
    this.audioEnded.set(deviceId, true);

    // 等待 listen 任务完成
    const listenTask = this.listenTasks.get(deviceId);
    if (listenTask) {
      try {
        await listenTask;
        logger.info(`[ASRService] ASR listen 任务已结束: deviceId=${deviceId}`);
      } catch (error) {
        logger.error(
          `[ASRService] 等待 listen 任务失败: deviceId=${deviceId}`,
          error
        );
      }
    }

    // 关闭 ASR 客户端
    const asrClient = this.asrClients.get(deviceId);
    if (asrClient) {
      try {
        await asrClient.close();
      } catch (error) {
        logger.error(`[ASRService] ASR 关闭失败: deviceId=${deviceId}`, error);
      }
    }

    // 清理资源
    this.asrClients.delete(deviceId);
    this.audioQueues.delete(deviceId);
    this.audioEnded.delete(deviceId);
    this.listenTasks.delete(deviceId);

    logger.info(`[ASRService] ASR 资源已清理: deviceId=${deviceId}`);
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    // 清理 ASR 客户端
    for (const asrClient of this.asrClients.values()) {
      asrClient.close();
    }
    this.asrClients.clear();
    // 清理 V2 API 相关状态
    this.audioQueues.clear();
    this.audioEnded.clear();
    this.listenTasks.clear();
    logger.debug("[ASRService] 服务已销毁");
  }
}
