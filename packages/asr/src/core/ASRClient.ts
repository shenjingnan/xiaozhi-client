/**
 * 统一 ASR 客户端
 * 提供跨平台的统一接口
 */

import { EventEmitter } from "node:events";
import { platformRegistry } from "./ASRPlatform.js";
import type {
  ASRController,
  ASRPlatform,
  AudioInput,
  CommonASROptions,
  ListenResult,
  PlatformConfig,
} from "./types.js";

/**
 * 统一 ASR 客户端选项
 */
export interface ASRClientOptions extends CommonASROptions {
  /** ByteDance 兼容配置 */
  bytedance?: {
    v2?: Record<string, unknown>;
    v3?: Record<string, unknown>;
  };
}

/**
 * 统一 ASR 客户端
 * 通过平台抽象提供统一的 ASR 调用接口
 */
export class ASRClient extends EventEmitter {
  /** 当前使用的平台 */
  private _platform: ASRPlatform;

  /** 平台控制器 */
  private controller: ASRController | null = null;

  /** 平台配置 */
  private config: PlatformConfig;

  /** 内部客户端（用于兼容旧 API） */
  public readonly bytedance?: {
    v2: ASRController;
    v3: ASRController;
  };

  constructor(options: ASRClientOptions) {
    super();

    // 确定使用哪个平台
    if (options.platform) {
      // 新版配置：直接指定平台
      const platform = platformRegistry.get(options.platform);
      if (!platform) {
        throw new Error(`平台 "${options.platform}" 未注册`);
      }
      this._platform = platform;
      this.config = options.config || { platform: options.platform };
    } else if (options.bytedance) {
      // 兼容旧版配置：通过 bytedance 配置指定
      const bytedancePlatform = platformRegistry.get("bytedance");
      if (!bytedancePlatform) {
        throw new Error("ByteDance 平台未注册");
      }
      this._platform = bytedancePlatform;
      this.config = this._platform.validateConfig(options.bytedance);
    } else {
      throw new Error("必须指定 platform 或 bytedance 配置");
    }

    // 注册事件回调
    this.setupEventHandlers();
  }

  /**
   * 设置事件回调
   */
  private setupEventHandlers(): void {
    if (this._platform) {
      // 设置平台级别的事件处理
    }
  }

  /**
   * 获取当前平台
   */
  get platform(): ASRPlatform {
    return this._platform;
  }

  /**
   * 创建控制器
   */
  private getController(): ASRController {
    if (!this.controller) {
      this.controller = this._platform.createController(this.config);
    }
    return this.controller;
  }

  /**
   * 流式识别
   * @param audioInput - 音频输入
   * @returns 异步生成器，持续产出识别结果
   */
  listen(audioInput: AudioInput): AsyncGenerator<ListenResult, void, unknown> {
    const controller = this.getController();
    return controller.listen(audioInput);
  }

  /**
   * 非流式识别
   * @param audioData - 音频数据
   * @returns 识别结果
   */
  async execute(audioData: Buffer): Promise<ListenResult> {
    const controller = this.getController();
    return controller.execute(audioData);
  }

  /**
   * 关闭连接
   */
  close(): void {
    if (this.controller) {
      this.controller.close();
      this.controller = null;
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.controller !== null;
  }
}
