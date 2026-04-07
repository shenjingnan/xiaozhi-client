/**
 * ASR 服务实现
 * 处理语音识别功能，使用 univoice SDK
 */

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
 * 设备 ASR 状态
 */
interface DeviceASRState {
  /** 是否已准备（缓冲区已初始化） */
  prepared: boolean;
  /** 是否正在连接 */
  connecting: boolean;
  /** 连接 Promise（用于等待连接完成） */
  connectPromise?: Promise<void>;
}

/**
 * ASR 服务
 * 处理语音识别功能，通过回调通知识别结果
 */
export class ASRService implements IASRService {
  /** 事件回调 */
  private events: ASRServiceEvents;

  /** 每个设备的 ASR 状态 */
  private readonly deviceStates = new Map<string, DeviceASRState>();

  /** 每个设备的 ASR 连接（预建立连接模式） */
  private readonly asrConnections = new Map<string, ASRConnection>();

  /** 每个设备的 Opus 音频数据队列 */
  private readonly opusQueues = new Map<string, Buffer[]>();

  /** 每个设备是否已结束音频输入 */
  private readonly audioEnded = new Map<string, boolean>();

  /** 每个设备的 listen 任务 */
  private readonly listenTasks = new Map<string, Promise<void>>();

  /**
   * 构造函数
   * @param options - 配置选项
   */
  constructor(options: ASRServiceOptions = {}) {
    this.events = options.events || {};
  }

  /**
   * 准备 ASR 服务
   * 只准备配置和缓冲区，不建立连接
   * 用于在连接建立前缓存音频数据
   * @param deviceId - 设备 ID
   */
  async prepare(deviceId: string): Promise<void> {
    const state = this.getOrCreateDeviceState(deviceId);

    // 如果已经准备好，跳过
    if (state.prepared) {
      logger.debug(`[ASRService] ASR 已准备好，跳过: deviceId=${deviceId}`);
      return;
    }

    // 初始化音频队列
    this.opusQueues.set(deviceId, []);
    this.audioEnded.set(deviceId, false);
    state.prepared = true;

    logger.info(`[ASRService] ASR 服务已准备: deviceId=${deviceId}`);
  }

  /**
   * 建立 ASR 连接
   * 使用 univoice 的 connect() 预建立 WebSocket 连接
   * @param deviceId - 设备 ID
   */
  async connect(deviceId: string): Promise<void> {
    const state = this.getOrCreateDeviceState(deviceId);

    // 如果已有连接，跳过
    const existingConnection = this.asrConnections.get(deviceId);
    if (existingConnection && existingConnection.state === "connected") {
      logger.debug(`[ASRService] ASR 已连接，跳过: deviceId=${deviceId}`);
      return;
    }

    // 如果正在连接，等待连接完成
    if (state.connecting && state.connectPromise) {
      logger.debug(`[ASRService] ASR 正在连接，等待: deviceId=${deviceId}`);
      await state.connectPromise;
      return;
    }

    // 标记正在连接
    state.connecting = true;
    state.connectPromise = this.doConnect(deviceId);

    try {
      await state.connectPromise;
    } finally {
      state.connecting = false;
      state.connectPromise = undefined;
    }
  }

  /**
   * 执行实际的连接
   * @param deviceId - 设备 ID
   */
  private async doConnect(deviceId: string): Promise<void> {
    // 如果已存在连接，先关闭
    const existingConnection = this.asrConnections.get(deviceId);
    if (existingConnection) {
      logger.warn(
        `[ASRService] ASR 连接存在但状态异常，关闭旧的: deviceId=${deviceId}`
      );
      existingConnection.close();
      this.asrConnections.delete(deviceId);
    }

    // 确保已准备
    await this.prepare(deviceId);

    // 创建 ASR 实例并建立连接
    await this.createASRConnection(deviceId);

    const connection = this.asrConnections.get(deviceId);
    if (!connection || connection.state !== "connected") {
      throw new Error(`[ASRService] ASR 连接建立失败: deviceId=${deviceId}`);
    }

    logger.info(`[ASRService] ASR 连接已建立: deviceId=${deviceId}`);
  }

  /**
   * 创建 ASR 实例并建立连接
   * @param deviceId - 设备 ID
   */
  private async createASRConnection(deviceId: string): Promise<void> {
    const asrConfig = configManager.getASRConfig();

    if (!asrConfig.appid || !asrConfig.accessToken) {
      throw new Error("[ASRService] ASR 配置不完整，请检查配置文件");
    }

    // 创建 ASR 实例，配置字段映射：
    // asrConfig.appid → appKey
    // asrConfig.accessToken → accessKey
    const asr = createASR({
      provider: "doubao",
      appKey: asrConfig.appid,
      accessKey: asrConfig.accessToken,
      language: "zh-CN",
      format: "pcm",
      codec: "raw",
    });

    // 使用 connect() 预建立连接
    try {
      const connection = await asr.connect();
      this.asrConnections.set(deviceId, connection);

      // 启动 listen 任务处理音频流
      const listenTask = this.startListenTask(deviceId, connection);
      this.listenTasks.set(deviceId, listenTask);

      logger.info(
        `[ASRService] ASR 连接已创建（univoice doubao）: deviceId=${deviceId}`
      );
    } catch (error) {
      logger.error(
        `[ASRService] ASR 连接建立失败: deviceId=${deviceId}`,
        error
      );
      this.events.onError?.(deviceId, error as Error);
      throw error;
    }
  }

  /**
   * 初始化 ASR 语音识别服务（已弃用，请使用 prepare + connect）
   * 如果已存在 ASR 客户端且已连接，则跳过初始化
   * @param deviceId - 设备 ID
   * @deprecated 使用 prepare() + connect() 替代
   */
  async init(deviceId: string): Promise<void> {
    // 兼容旧接口：准备 + 连接
    await this.prepare(deviceId);
    await this.connect(deviceId);
  }

  /**
   * 处理音频数据
   * 将 Opus 音频数据推入队列，由 listen 任务通过 decodeOpusStream 消费
   * 如果连接未建立，数据会被缓存直到连接建立
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

    const state = this.getOrCreateDeviceState(deviceId);

    // 检查是否已准备好
    if (!state.prepared) {
      logger.warn(`[ASRService] ASR 未准备好，自动准备: deviceId=${deviceId}`);
      await this.prepare(deviceId);
    }

    // 检查是否已经结束
    if (this.audioEnded.get(deviceId)) {
      logger.debug(`[ASRService] 音频已结束，忽略新数据: deviceId=${deviceId}`);
      return;
    }

    // 获取或创建队列，直接缓存 Opus 数据
    let queue = this.opusQueues.get(deviceId);
    if (!queue) {
      queue = [];
      this.opusQueues.set(deviceId, queue);
    }

    queue.push(audioBuffer);
    logger.debug(
      `[ASRService] 已将 Opus 数据推入队列: deviceId=${deviceId}, queueLength=${queue.length}`
    );
  }

  /**
   * 获取或创建设备状态
   */
  private getOrCreateDeviceState(deviceId: string): DeviceASRState {
    let state = this.deviceStates.get(deviceId);
    if (!state) {
      state = { prepared: false, connecting: false };
      this.deviceStates.set(deviceId, state);
    }
    return state;
  }

  /**
   * 创建异步生成器，从队列中读取 Opus 数据
   * @param deviceId - 设备 ID
   * @returns 异步生成器
   */
  private async *createOpusStream(
    deviceId: string
  ): AsyncGenerator<Buffer, void, unknown> {
    let queue = this.opusQueues.get(deviceId);
    if (!queue) {
      queue = [];
      this.opusQueues.set(deviceId, queue);
    }

    while (true) {
      // 等待队列中有数据
      while (queue.length === 0) {
        // 检查是否已结束
        if (this.audioEnded.get(deviceId)) {
          logger.debug(`[ASRService] Opus 流结束: deviceId=${deviceId}`);
          return;
        }
        // 短暂等待
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // 从队列取出数据
      const opusData = queue.shift()!;
      yield opusData;
    }
  }

  /**
   * 启动 listen 任务
   * 使用 univoice 的 connection.listen() 处理音频流
   * @param deviceId - 设备 ID
   * @param connection - ASR 连接
   */
  private async startListenTask(
    deviceId: string,
    connection: ASRConnection
  ): Promise<void> {
    try {
      // 创建 Opus 数据流
      const opusStream = this.createOpusStream(deviceId);

      // 使用 univoice 的 decodeOpusStream 将 Opus 解码为 PCM
      const pcmStream = decodeOpusStream(opusStream, {
        sampleRate: 24000,
        channels: 1,
      });

      // 使用 connection.listen() 进行流式识别
      for await (const result of connection.listen(pcmStream, {
        stream: true,
      })) {
        logger.info(
          `[ASRService] ASR 识别结果: deviceId=${deviceId}, isFinal=${result.isFinal}, text=${result.text}`
        );

        // isFinal 时标记音频结束，停止 listen 循环，避免重复触发 LLM
        if (result.isFinal) {
          this.audioEnded.set(deviceId, true);
          logger.info(
            `[ASRService] ASR 识别完成，停止 listen: deviceId=${deviceId}`
          );
        }

        // 触发结果回调，使用异常隔离避免回调抛错导致整条链路终止
        try {
          this.events.onResult?.(deviceId, result.text || "", result.isFinal);
        } catch (callbackError) {
          logger.error(
            `[ASRService] onResult 回调执行失败: deviceId=${deviceId}`,
            callbackError
          );
        }

        // isFinal 时 break 停止 listen 循环
        if (result.isFinal) {
          break;
        }
      }

      logger.info(`[ASRService] listen 任务完成: deviceId=${deviceId}`);
    } catch (error) {
      logger.error(`[ASRService] listen 任务出错: deviceId=${deviceId}`, error);
      this.events.onError?.(deviceId, error as Error);
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

    // 关闭 ASR 连接
    const connection = this.asrConnections.get(deviceId);
    if (connection) {
      try {
        connection.close();
      } catch (error) {
        logger.error(
          `[ASRService] ASR 连接关闭失败: deviceId=${deviceId}`,
          error
        );
      }
    }

    // 清理资源
    this.asrConnections.delete(deviceId);
    this.opusQueues.delete(deviceId);
    this.audioEnded.delete(deviceId);
    this.listenTasks.delete(deviceId);

    logger.info(`[ASRService] ASR 资源已清理: deviceId=${deviceId}`);
  }

  /**
   * 重置 ASR 服务状态
   * 清理资源但保留配置，准备下一次语音交互
   * @param deviceId - 设备 ID
   */
  async reset(deviceId: string): Promise<void> {
    logger.info(`[ASRService] 重置 ASR 服务状态: deviceId=${deviceId}`);

    // 先结束当前会话
    await this.end(deviceId);

    // 重置状态
    const state = this.deviceStates.get(deviceId);
    if (state) {
      state.prepared = false;
      state.connecting = false;
      state.connectPromise = undefined;
    }

    // 重新准备
    await this.prepare(deviceId);

    logger.info(`[ASRService] ASR 服务已重置: deviceId=${deviceId}`);
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    // 关闭所有 ASR 连接
    for (const connection of this.asrConnections.values()) {
      connection.close();
    }
    this.asrConnections.clear();
    // 清理音频队列相关状态
    this.opusQueues.clear();
    this.audioEnded.clear();
    this.listenTasks.clear();
    this.deviceStates.clear();
    logger.debug("[ASRService] 服务已销毁");
  }
}
