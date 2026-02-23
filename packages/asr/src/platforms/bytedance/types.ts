/**
 * ByteDance 平台类型定义
 */

import type { AudioFormat } from "../../audio";
import type { AuthMethod } from "../../auth";

/**
 * ByteDance 平台配置
 */
export interface ByteDancePlatformConfig {
  /** 平台标识 */
  platform: "bytedance";

  /** API 版本 */
  version: "v2" | "v3";

  /** 应用配置 */
  app: {
    /** 应用 ID */
    appid: string;
    /** 应用密钥 */
    token: string;
    /** 集群 */
    cluster?: string;
  };

  /** 用户配置 */
  user?: {
    /** 用户 ID */
    uid?: string;
    /** 设备 */
    device?: string;
    /** 平台 */
    platform?: string;
  };

  /** 音频配置 */
  audio?: {
    /** 音频格式 */
    format?: AudioFormat;
    /** 采样率 */
    sampleRate?: number;
    /** 位深 */
    bits?: number;
    /** 声道数 */
    channel?: number;
    /** 编解码器 */
    codec?: string;
  };

  /** 请求配置 */
  request?: {
    /** 分片时长 (ms) */
    segDuration?: number;
    /** N-best 数量 */
    nbest?: number;
    /** 工作流 */
    workflow?: string;
    /** 显示语言 */
    showLanguage?: boolean;
    /** 显示分句 */
    showUtterances?: boolean;
    /** 结果类型 */
    resultType?: string;
  };

  /** 认证配置 */
  auth?: {
    /** 认证方式 */
    method?: AuthMethod;
    /** 密钥 (用于签名认证) */
    secret?: string;
  };
}

/**
 * ByteDance V2 配置
 */
export interface ByteDanceV2Config {
  /** API 版本 */
  version: "v2";

  /** 应用配置 */
  app: {
    /** 应用 ID */
    appid: string;
    /** 应用密钥 */
    token: string;
    /** 集群 */
    cluster?: string;
  };

  /** 用户配置 */
  user?: {
    /** 用户 ID */
    uid?: string;
  };

  /** 音频配置 */
  audio?: {
    /** 音频格式 */
    format?: AudioFormat;
    /** 采样率 */
    sampleRate?: number;
    /** 位深 */
    bits?: number;
    /** 声道数 */
    channel?: number;
    /** 编解码器 */
    codec?: string;
  };

  /** 请求配置 */
  request?: {
    /** 分片时长 (ms) */
    segDuration?: number;
    /** N-best 数量 */
    nbest?: number;
    /** 工作流 */
    workflow?: string;
    /** 显示语言 */
    showLanguage?: boolean;
    /** 显示分句 */
    showUtterances?: boolean;
    /** 结果类型 */
    resultType?: string;
  };
}

/**
 * ByteDance V3 配置
 */
export interface ByteDanceV3Config {
  /** API 版本 */
  version: "v3";

  /** 应用 Key */
  appKey: string;

  /** 访问密钥 */
  accessKey: string;

  /** 用户配置 */
  user?: {
    /** 用户 ID */
    uid?: string;
  };

  /** 音频配置 */
  audio?: {
    /** 音频格式 */
    format?: AudioFormat;
    /** 采样率 */
    sampleRate?: number;
    /** 位深 */
    bits?: number;
    /** 声道数 */
    channel?: number;
    /** 编解码器 */
    codec?: string;
  };

  /** 请求配置 */
  request?: {
    /** 分片时长 (ms) */
    segDuration?: number;
    /** N-best 数量 */
    nbest?: number;
    /** 工作流 */
    workflow?: string;
    /** 显示语言 */
    showLanguage?: boolean;
    /** 显示分句 */
    showUtterances?: boolean;
    /** 结果类型 */
    resultType?: string;
  };
}

/**
 * ByteDance 兼容配置（支持 V2 或 V3）
 */
export interface ByteDanceCompatConfig {
  /** V2 配置 */
  v2?: ByteDanceV2Config;
  /** V3 配置 */
  v3?: ByteDanceV3Config;
}
