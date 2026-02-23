/**
 * ByteDance 平台适配器
 * 实现 ASRPlatform 接口，提供统一的平台抽象
 */

import type { ASR as ASRClient } from "../../client";
import { ASR } from "../../client";
import type { ASRController, ASRPlatform, PlatformConfig } from "../../core";
import { BYTEDANCE_V2_DEFAULT_CLUSTER } from "../../schema";
import {
  ByteDanceV2Controller,
  ByteDanceV3Controller,
} from "./controllers/index.js";
// 重新导出控制器，供外部使用
export {
  ByteDanceV2Controller,
  ByteDanceV3Controller,
} from "./controllers/index.js";

/**
 * ByteDance 平台实现
 */
export class ByteDancePlatform implements ASRPlatform {
  readonly platform = "bytedance";

  private asrClient: ASRClient | null = null;

  constructor(_config: PlatformConfig) {
    // 配置将在 createController 时使用
  }

  /**
   * 创建流式识别控制器
   */
  createController(config: PlatformConfig): ASRController {
    // 创建 ASR 客户端实例
    const asrClient = new ASR({
      bytedance: this.buildByteDanceConfig(config),
    });

    this.asrClient = asrClient;

    // 根据版本返回对应的控制器
    const version = this.getVersion(config);
    if (version === "v3") {
      return new ByteDanceV3Controller(asrClient);
    }
    return new ByteDanceV2Controller(asrClient);
  }

  /**
   * 校验配置
   */
  validateConfig(config: unknown): PlatformConfig {
    // 这里可以进行配置校验
    // 目前依赖 ASR 内部的校验逻辑
    return config as PlatformConfig;
  }

  /**
   * 获取认证头
   */
  getAuthHeaders(_config: PlatformConfig): Record<string, string> {
    // 由 ASR 客户端内部处理
    return {};
  }

  /**
   * 获取服务地址
   */
  getEndpoint(config: PlatformConfig): string {
    const version = this.getVersion(config);
    if (version === "v3") {
      return "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel";
    }
    return "wss://openspeech.bytedance.com/api/v2/asr";
  }

  /**
   * 获取版本
   */
  private getVersion(config: PlatformConfig): "v2" | "v3" {
    const cfg = config as { version?: string };
    return (cfg.version as "v2" | "v3") || "v2";
  }

  /**
   * 构建 ByteDance 配置
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildByteDanceConfig(config: PlatformConfig): any {
    const version = this.getVersion(config);
    const cfg = config as {
      app?: { appid?: string; token?: string; cluster?: string };
      appKey?: string;
      accessKey?: string;
      resourceId?: string;
      user?: { uid?: string };
      audio?: {
        format?: "wav" | "mp3" | "ogg" | "raw" | string;
        sampleRate?: number;
        rate?: number;
        bits?: number;
        channel?: number;
        codec?: string;
      };
      request?: {
        segDuration?: number;
        nbest?: number;
        workflow?: string;
        showLanguage?: boolean;
        showUtterances?: boolean;
        resultType?: string;
      };
      auth?: { method?: string; secret?: string };
    };

    if (version === "v3") {
      return {
        v3: {
          appKey: cfg.appKey || cfg.app?.appid || "",
          accessKey: cfg.accessKey || cfg.app?.token || "",
          resourceId: cfg.resourceId || "",
          user: cfg.user,
          audio: cfg.audio,
          request: cfg.request,
        },
      };
    }

    return {
      v2: {
        app: {
          appid: cfg.app?.appid || "",
          token: cfg.app?.token || "",
          cluster: cfg.app?.cluster || BYTEDANCE_V2_DEFAULT_CLUSTER,
        },
        user: cfg.user,
        audio: cfg.audio,
        request: cfg.request,
      },
    };
  }

  /**
   * 获取底层 ASR 客户端实例
   */
  getASRClient(): ASRClient | null {
    return this.asrClient;
  }
}

/**
 * 创建 ByteDance 平台实例
 */
export function createByteDancePlatform(config?: PlatformConfig): ASRPlatform {
  return new ByteDancePlatform(
    config || { platform: "bytedance", version: "v2" }
  );
}

// 导出类型
export type {
  ByteDancePlatformConfig,
  ByteDanceV2Config,
  ByteDanceV3Config,
} from "./types.js";
