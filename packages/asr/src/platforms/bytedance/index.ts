/**
 * ByteDance 平台适配器
 * 实现 ASRPlatform 接口，提供统一的平台抽象
 */

import type { ASR as ASRClient } from "@/client";
import { ASR } from "@/client";
import type { ASRController, ASRPlatform, PlatformConfig } from "@/core";
import {
  ByteDanceV2Controller,
  ByteDanceV3Controller,
} from "@/platforms/bytedance/controllers/index.js";
import { BYTEDANCE_V2_DEFAULT_CLUSTER } from "@/platforms/bytedance/schemas";

/**
 * buildByteDanceConfig 方法的返回类型
 * 这是一个配置对象，将被 ASR 客户端的 parseByteDanceConfig 进一步校验
 */
type ByteDanceConfigOption =
  | { v2: ByteDanceV2PartialConfig }
  | { v3: ByteDanceV3PartialConfig };

/**
 * V2 部分配置（用于构建 ASR 客户端配置）
 */
interface ByteDanceV2PartialConfig {
  app: {
    appid: string;
    token: string;
    cluster: string;
  };
  user: {
    uid: string;
  };
  audio: {
    format: string;
  };
}

/**
 * V3 部分配置（用于构建 ASR 客户端配置）
 */
interface ByteDanceV3PartialConfig {
  appKey: string;
  accessKey: string;
  resourceId: string;
  user: {
    uid: string;
  };
  audio: {
    format: string;
  };
}

// 重新导出控制器，供外部使用
export {
  ByteDanceV2Controller,
  ByteDanceV3Controller,
} from "@/platforms/bytedance/controllers/index.js";

// 重新导出协议，供外部使用
export * from "@/platforms/bytedance/protocol/index.js";

// 重新导出 Schema，供外部使用
export * from "@/platforms/bytedance/schemas/index.js";

// 重新导出请求相关类型，供外部使用
export * from "./request.js";

// 重新导出请求构造器，供外部使用
export { ByteDanceV2RequestBuilder } from "./request-builder.js";

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
  private buildByteDanceConfig(config: PlatformConfig): ByteDanceConfigOption {
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

    // 提供默认值以匹配 zod schema 的要求
    const user: { uid: string } = cfg.user?.uid
      ? { uid: cfg.user.uid }
      : { uid: "default_user" };
    const audio: { format: string } = cfg.audio?.format
      ? { format: cfg.audio.format }
      : { format: "wav" };

    if (version === "v3") {
      return {
        v3: {
          appKey: cfg.appKey || cfg.app?.appid || "",
          accessKey: cfg.accessKey || cfg.app?.token || "",
          resourceId: cfg.resourceId || "",
          user,
          audio,
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
        user,
        audio,
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

// 导出平台类型（使用别名避免与 Schema 类型冲突）
export type {
  ByteDancePlatformConfig,
  ByteDanceV2Config as ByteDanceV2PlatformConfig,
  ByteDanceV3Config as ByteDanceV3PlatformConfig,
} from "@/platforms/bytedance/types.js";
