/**
 * ASR 服务实现
 * 处理语音识别功能
 */

import type { BaseASR } from "univoice";
import { createASR, decodeOpusStream } from "univoice/asr";
// 触发 ASR 提供商自动注册（doubao/qwen/glm/xfyun 等）
import "univoice/asr/providers";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { IESP32ConfigProvider, ILogger } from "../interfaces.js";
import { noopLogger } from "../interfaces.js";
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
 * ASR 客户端实例包装
 * 封装 univoice BaseASR 实例，附加连接状态追踪
 */
interface ASRClientInstance {
  /** univoice ASR 实例 */
  client: BaseASR;
  /** 是否已连接 */
  connected: boolean;
}

/**
 * ASR 服务
 * 处理语音识别功能，通过回调通知识别结果
 */
export class ASRService implements IASRService {
  /** 事件回调 */
  private events: ASRServiceEvents;

  /** 日志器 */
  private readonly logger: ILogger;

  /** 配置提供者 */
  private readonly configProvider?: IESP32ConfigProvider;

  /** 每个设备的 ASR 状态 */
  private readonly deviceStates = new Map<string, DeviceASRState>();

  /** 每个设备的 ASR 客户端（用于语音识别） */
  private readonly asrClients = new Map<string, ASRClientInstance>();

  /** 每个设备的 Opus 数据包队列（用于 decodeOpusStream 流式解码） */
  private readonly opusQueues = new Map<string, Buffer[]>();

  /** 每个设备的是否已结束音频输入 */
  private readonly audioEnded = new Map<string, boolean>();

  /** 每个设备的 V2 listen 任务 */
  private readonly listenTasks = new Map<string, Promise<void>>();

  /** 调试：每个设备的 opus 包计数器 */
  private readonly debugAudioCounters = new Map<string, number>();

  /** 调试：音频包存储目录 */
  private static readonly DEBUG_AUDIO_DIR = join(process.cwd(), "tmp", "audio");

  /**
   * 构造函数
   * @param options - 配置选项
   */
  constructor(options: ASRServiceOptions = {}) {
    this.events = options.events || {};
    this.logger = options.logger ?? noopLogger;
    this.configProvider = options.configProvider;
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
      this.logger.debug(
        `[ASRService] ASR 已准备好，跳过: deviceId=${deviceId}`
      );
      return;
    }

    // 初始化 Opus 数据包队列
    this.opusQueues.set(deviceId, []);
    this.audioEnded.set(deviceId, false);
    state.prepared = true;

    this.logger.info(`[ASRService] ASR 服务已准备: deviceId=${deviceId}`);
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
    if (existingClient?.connected) {
      this.logger.debug(
        `[ASRService] ASR 客户端已连接，跳过: deviceId=${deviceId}`
      );
      return;
    }

    // 如果正在连接，等待连接完成
    if (state.connecting && state.connectPromise) {
      this.logger.debug(
        `[ASRService] ASR 正在连接，等待: deviceId=${deviceId}`
      );
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
      this.logger.warn(
        `[ASRService] ASR 客户端存在但未连接，关闭旧的: deviceId=${deviceId}`
      );
      // univoice BaseASR 不支持 close()，标记为未连接即可
      // 底层 WebSocket 会在 listen 结束后自动关闭
      existingClient.connected = false;
      this.asrClients.delete(deviceId);
    }

    // 确保已准备
    await this.prepare(deviceId);

    // 创建 ASR 客户端
    await this.createASRClient(deviceId);

    this.logger.info(`[ASRService] ASR 连接已建立: deviceId=${deviceId}`);
  }

  /**
   * 创建 ASR 客户端
   * 使用 univoice SDK 创建 Doubao ASR 实例
   * @param deviceId - 设备 ID
   */
  private async createASRClient(deviceId: string): Promise<void> {
    const asrConfig = this.configProvider?.getASRConfig();

    if (!asrConfig?.appid || !asrConfig?.accessToken) {
      this.logger.error("[ASRService] ASR 配置不完整，请检查配置文件");
      return;
    }

    // 使用 univoice 创建 Doubao ASR 客户端
    const asrClient = createASR({
      provider: "doubao",
      appKey: asrConfig.appid,
      accessKey: asrConfig.accessToken,
      language: "zh-CN",
      format: "pcm",
      codec: "raw",
      audioFormat: { sampleRate: 16000, bits: 16, channel: 1 },
      mode: "streaming",
      ...(asrConfig.wsUrl && { baseUrl: asrConfig.wsUrl }),
      // 启用服务端 VAD 端点检测：当 vadEndWindowSize > 0 时传入 endWindowSize
      // 服务端将在检测到 vadEndWindowSize(ms) 静音后判定语音结束，
      // 通过 segment.confidence === 1 标记 definite utterance
      ...(asrConfig.vadEndWindowSize && asrConfig.vadEndWindowSize > 0
        ? { endWindowSize: asrConfig.vadEndWindowSize }
        : {}),
    });

    // 包装为带连接状态的实例
    const clientWrapper: ASRClientInstance = {
      client: asrClient,
      connected: true,
    };

    // 保存 ASR 客户端
    this.asrClients.set(deviceId, clientWrapper);

    // 启动 listen 任务处理音频流
    const listenTask = this.startListenTask(deviceId, asrClient);
    this.listenTasks.set(deviceId, listenTask);

    this.logger.info(
      `[ASRService] ASR 客户端已创建（univoice doubao）: deviceId=${deviceId}`
    );
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
    this.logger.debug(
      `[ASRService] 收到音频数据: deviceId=${deviceId}, size=${audioBuffer.length}`
    );

    // 调试：异步存储原始 opus 数据包（不阻塞 ASR 流程）
    this.saveDebugOpusPacket(deviceId, audioBuffer);

    const state = this.getOrCreateDeviceState(deviceId);

    // 检查是否已准备好
    if (!state.prepared) {
      this.logger.warn(
        `[ASRService] ASR 未准备好，自动准备: deviceId=${deviceId}`
      );
      await this.prepare(deviceId);
    }

    // 检查是否已经结束
    if (this.audioEnded.get(deviceId)) {
      this.logger.debug(
        `[ASRService] 音频已结束，忽略新数据: deviceId=${deviceId}`
      );
      return;
    }

    // 将原始 Opus 数据包推入队列，由 decodeOpusStream 统一流式解码
    try {
      // 获取或创建队列
      let queue = this.opusQueues.get(deviceId);
      if (!queue) {
        queue = [];
        this.opusQueues.set(deviceId, queue);
      }

      // 推入原始 Opus 包（解码由 decodeOpusStream 在 startListenTask 中统一处理）
      queue.push(audioBuffer);
      this.logger.debug(
        `[ASRService] 已将 Opus 包推入队列: deviceId=${deviceId}, opusSize=${audioBuffer.length}, queueLength=${queue.length}`
      );
    } catch (error) {
      this.logger.error(
        `[ASRService] Opus 包入队失败: deviceId=${deviceId}`,
        error
      );
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
   * 调试用：异步存储原始 opus 数据包到文件系统
   * 按设备隔离，按顺序编号命名（00.opus, 01.opus, ...）
   * 不阻塞 ASR 识别流程，写入失败静默忽略
   * @param deviceId - 设备 ID
   * @param opusData - 原始 opus 数据
   */
  private saveDebugOpusPacket(deviceId: string, opusData: Buffer): void {
    // 确保目录存在（仅检查一次）
    if (!existsSync(ASRService.DEBUG_AUDIO_DIR)) {
      try {
        mkdirSync(ASRService.DEBUG_AUDIO_DIR, { recursive: true });
      } catch {
        return; // 目录创建失败则跳过
      }
    }

    // 获取当前设备的包编号
    const count = this.debugAudioCounters.get(deviceId) || 0;
    this.debugAudioCounters.set(deviceId, count + 1);

    // 异步写入，不 await，不阻塞主流程
    const filename = `${count.toString().padStart(2, "0")}.opus`;
    const filePath = join(ASRService.DEBUG_AUDIO_DIR, filename);

    import("node:fs/promises")
      .then((fs) => fs.writeFile(filePath, opusData))
      .catch(() => {}); // 写入失败静默忽略
  }

  /** 静音超时时间（毫秒），超过此时间无新音频数据则认为语音结束 */
  private static readonly SILENCE_TIMEOUT_MS = 1500;

  /**
   * 创建异步生成器，从队列中读取 Opus 数据包
   * 支持静音超时：当超过 SILENCE_TIMEOUT_MS 无新数据时自动结束音频流
   * 这对 univoice 的 ASR 至关重要，因为它需要在音频流结束后发送结束标记
   * 服务端收到结束标记后才会发出 isLastPackage=true（isFinal=true）
   *
   * 产出的 Opus 包流将由 decodeOpusStream 统一解码为 PCM 流
   * @param deviceId - 设备 ID
   * @returns 异步生成器，产出原始 Opus Buffer
   */
  private async *createOpusPacketStream(
    deviceId: string
  ): AsyncGenerator<Buffer, void, unknown> {
    const queue = this.opusQueues.get(deviceId) || [];

    while (true) {
      // 等待队列中有数据（带超时检测）
      let lastDataTime = Date.now();

      while (queue.length === 0) {
        // 检查是否已通过 end() 手动标记结束
        if (this.audioEnded.get(deviceId)) {
          this.logger.debug(`[ASRService] 音频流结束: deviceId=${deviceId}`);
          return;
        }

        // 静音超时检测：超过阈值无新数据则自动结束音频流
        const elapsed = Date.now() - lastDataTime;
        if (elapsed >= ASRService.SILENCE_TIMEOUT_MS) {
          this.logger.info(
            `[ASRService] 静音超时（${elapsed}ms），自动结束音频流: deviceId=${deviceId}`
          );
          return;
        }

        // 短暂等待后重试
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(50, ASRService.SILENCE_TIMEOUT_MS - elapsed)
          )
        );
      }

      // 从队列取出数据，更新最后数据时间
      lastDataTime = Date.now();
      const opusData = queue.shift()!;
      yield opusData;
    }
  }

  /**
   * 启动 listen 任务
   * 使用 univoice 的 listen API 进行流式识别
   * @param deviceId - 设备 ID
   * @param asrClient - univoice ASR 客户端实例
   */
  private async startListenTask(
    deviceId: string,
    asrClient: BaseASR
  ): Promise<void> {
    try {
      // 创建 Opus 包流生成器（产出原始 Opus Buffer）
      const opusStream = this.createOpusPacketStream(deviceId);

      // 使用 univoice 的 decodeOpusStream 流式解码 Opus → PCM
      // 单一 Decoder 实例，支持背压控制，比逐包解码更高效
      const pcmStream = decodeOpusStream(opusStream, {
        sampleRate: 16000,
      });

      // 使用 univoice listen API 进行流式识别
      // ASRStreamChunk: { text: string; isFinal: boolean; confidence?: number; segment?: ASRSegment }
      for await (const chunk of asrClient.listen(pcmStream, {
        stream: true,
      })) {
        // 检测 VAD 端点：segment.confidence === 1 表示服务端判定用户已说完话（definite utterance）
        // 这是服务端 VAD 的端点信号，比客户端静音超时更准确、更低延迟
        const isVadEndpoint = chunk.segment?.confidence === 1;

        this.logger.info(
          `[ASRService] ASR 识别结果: deviceId=${deviceId}, ` +
            `isFinal=${chunk.isFinal}, isVadEndpoint=${isVadEndpoint}, text=${chunk.text}`
        );

        // 当检测到 VAD 端点或 isFinal 时，标记音频结束并按 isFinal 处理
        // VAD 端点和 isFinal 在语义上等价：都表示"当前语音片段已结束"
        const shouldTreatAsFinal = chunk.isFinal || isVadEndpoint;

        if (shouldTreatAsFinal) {
          this.audioEnded.set(deviceId, true);
          this.logger.info(
            `[ASRService] ASR 识别完成（${isVadEndpoint ? "VAD端点" : "isFinal"}），停止 listen: deviceId=${deviceId}`
          );
        }

        // 触发结果回调，使用异常隔离避免回调抛错导致整条链路终止
        // VAD 端点时以 isFinal=true 通知调用方，保证下游 LLM/TTS 流程正常触发
        try {
          this.events.onResult?.(
            deviceId,
            chunk.text || "",
            shouldTreatAsFinal
          );
        } catch (callbackError) {
          this.logger.error(
            `[ASRService] onResult 回调执行失败: deviceId=${deviceId}`,
            callbackError
          );
        }

        // isFinal 或 VAD 端点时 break 停止 listen 循环
        if (shouldTreatAsFinal) {
          break;
        }
      }

      this.logger.info(`[ASRService] listen 任务完成: deviceId=${deviceId}`);

      // 标记连接已关闭并触发 onClose 回调
      const wrapper = this.asrClients.get(deviceId);
      if (wrapper) {
        wrapper.connected = false;
      }
      this.events.onClose?.(deviceId);
      this.asrClients.delete(deviceId);

      // 重置音频缓冲区状态，准备下一次识别
      this.opusQueues.set(deviceId, []);
      this.audioEnded.set(deviceId, false);
      this.logger.info(
        `[ASRService] 音频缓冲区已重置，准备下一次识别: deviceId=${deviceId}`
      );
    } catch (error) {
      this.logger.error(
        `[ASRService] listen 任务出错: deviceId=${deviceId}`,
        error
      );

      // 触发错误回调（替代原来的事件监听模式）
      if (error instanceof Error) {
        this.events.onError?.(deviceId, error);
      }

      // 标记连接已关闭
      const wrapper = this.asrClients.get(deviceId);
      if (wrapper) {
        wrapper.connected = false;
      }
      this.asrClients.delete(deviceId);
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
        this.logger.info(
          `[ASRService] ASR listen 任务已结束: deviceId=${deviceId}`
        );
      } catch (error) {
        this.logger.error(
          `[ASRService] 等待 listen 任务失败: deviceId=${deviceId}`,
          error
        );
      }
    }

    // 关闭 ASR 客户端
    const clientWrapper = this.asrClients.get(deviceId);
    if (clientWrapper) {
      try {
        // 标记连接已关闭，listen 任务会在下一个迭代检测到 audioEnded 后退出
        clientWrapper.connected = false;
      } catch (error) {
        this.logger.error(
          `[ASRService] ASR 关闭失败: deviceId=${deviceId}`,
          error
        );
      }
    }

    // 清理资源
    this.asrClients.delete(deviceId);
    this.opusQueues.delete(deviceId);
    this.audioEnded.delete(deviceId);
    this.listenTasks.delete(deviceId);

    this.logger.info(`[ASRService] ASR 资源已清理: deviceId=${deviceId}`);
  }

  /**
   * 重置 ASR 服务状态
   * 清理资源但保留配置，准备下一次语音交互
   * @param deviceId - 设备 ID
   */
  async reset(deviceId: string): Promise<void> {
    this.logger.info(`[ASRService] 重置 ASR 服务状态: deviceId=${deviceId}`);

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

    this.logger.info(`[ASRService] ASR 服务已重置: deviceId=${deviceId}`);
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    // 清理 ASR 客户端
    for (const wrapper of this.asrClients.values()) {
      wrapper.connected = false;
      // listen 任务会因为 opusQueues/audioEnded 清理而自然退出
    }
    this.asrClients.clear();
    // 清理 V2 API 相关状态
    this.opusQueues.clear();
    this.audioEnded.clear();
    this.listenTasks.clear();
    this.deviceStates.clear();
    this.logger.debug("[ASRService] 服务已销毁");
  }
}
