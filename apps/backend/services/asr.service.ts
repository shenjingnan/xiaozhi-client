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
    this.audioQueues.set(deviceId, []);
    this.audioEnded.set(deviceId, false);
    state.prepared = true;

    logger.info(`[ASRService] ASR 服务已准备: deviceId=${deviceId}`);
  }

  /**
   * 建立 ASR 连接
   * 建立 WebSocket 连接并开始处理音频流
   * @param deviceId - 设备 ID
   */
  async connect(deviceId: string): Promise<void> {
    const state = this.getOrCreateDeviceState(deviceId);

    // 如果已经连接或正在连接，等待连接完成
    const existingClient = this.asrClients.get(deviceId);
    if (existingClient?.isConnected()) {
      logger.debug(`[ASRService] ASR 客户端已连接，跳过: deviceId=${deviceId}`);
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
    // 如果已存在但未连接，先关闭
    const existingClient = this.asrClients.get(deviceId);
    if (existingClient) {
      logger.warn(
        `[ASRService] ASR 客户端存在但未连接，关闭旧的: deviceId=${deviceId}`
      );
      await existingClient.close();
      this.asrClients.delete(deviceId);
    }

    // 确保已准备
    await this.prepare(deviceId);

    // 创建 ASR 客户端
    await this.createASRClient(deviceId);

    logger.info(`[ASRService] ASR 连接已建立: deviceId=${deviceId}`);
  }

  /**
   * 创建 ASR 客户端
   * @param deviceId - 设备 ID
   */
  private async createASRClient(deviceId: string): Promise<void> {
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
      this.events.onClose?.(deviceId);
    });

    // 保存 ASR 客户端
    this.asrClients.set(deviceId, asrClient);

    // 启动 listen 任务处理音频流
    const listenTask = this.startListenTask(deviceId, asrClient);
    this.listenTasks.set(deviceId, listenTask);

    logger.info(`[ASRService] ASR 客户端已创建（V2）: deviceId=${deviceId}`);
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
   * 将音频数据推入队列，由 listen() 异步生成器消费
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
        `[ASRService] 已将 PCM 推入队列: deviceId=${deviceId}, pcmSize=${pcmData.length}, queueLength=${queue.length}`
      );
    } catch (error) {
      logger.error(`[ASRService] PCM 解码失败: deviceId=${deviceId}`, error);
    }
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

      // 重置音频缓冲区状态，准备下一次识别
      // 注意：底层 ASR 客户端已关闭连接，下次识别需要重新 connect
      this.audioQueues.set(deviceId, []);
      this.audioEnded.set(deviceId, false);
      logger.info(
        `[ASRService] 音频缓冲区已重置，准备下一次识别: deviceId=${deviceId}`
      );
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
    // 清理 ASR 客户端
    for (const asrClient of this.asrClients.values()) {
      asrClient.close();
    }
    this.asrClients.clear();
    // 清理 V2 API 相关状态
    this.audioQueues.clear();
    this.audioEnded.clear();
    this.listenTasks.clear();
    this.deviceStates.clear();
    logger.debug("[ASRService] 服务已销毁");
  }
}
