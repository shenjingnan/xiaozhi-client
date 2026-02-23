/**
 * ByteDance 平台配置校验 Schema
 */

import { z } from "zod";

/**
 * ByteDance V2 应用配置 Schema
 */
export const ByteDanceV2AppSchema = z.object({
  /** 应用 ID */
  appid: z.string().min(1, "appid 不能为空"),
  /** 应用密钥 */
  token: z.string().min(1, "token 不能为空"),
  /** 集群 */
  cluster: z.string().optional(),
});

/**
 * ByteDance V2 用户配置 Schema
 */
export const ByteDanceV2UserSchema = z.object({
  /** 用户 ID */
  uid: z.string().optional(),
});

/**
 * ByteDance V2 音频配置 Schema
 */
export const ByteDanceV2AudioSchema = z.object({
  /** 音频格式 */
  format: z.enum(["wav", "mp3", "ogg", "raw"]).optional(),
  /** 采样率 */
  sampleRate: z.number().optional(),
  /** 位深 */
  bits: z.number().optional(),
  /** 声道数 */
  channel: z.number().optional(),
  /** 编解码器 */
  codec: z.string().optional(),
});

/**
 * ByteDance V2 请求配置 Schema
 */
export const ByteDanceV2RequestSchema = z.object({
  /** 分片时长 (ms) */
  segDuration: z.number().optional(),
  /** N-best 数量 */
  nbest: z.number().optional(),
  /** 工作流 */
  workflow: z.string().optional(),
  /** 显示语言 */
  showLanguage: z.boolean().optional(),
  /** 显示分句 */
  showUtterances: z.boolean().optional(),
  /** 结果类型 */
  resultType: z.string().optional(),
});

/**
 * ByteDance V2 配置 Schema
 */
export const ByteDanceV2ConfigSchema = z.object({
  /** API 版本 */
  version: z.literal("v2"),
  /** 应用配置 */
  app: ByteDanceV2AppSchema,
  /** 用户配置 */
  user: ByteDanceV2UserSchema.optional(),
  /** 音频配置 */
  audio: ByteDanceV2AudioSchema.optional(),
  /** 请求配置 */
  request: ByteDanceV2RequestSchema.optional(),
});

/**
 * ByteDance V2 配置类型
 */
export type ByteDanceV2Config = z.infer<typeof ByteDanceV2ConfigSchema>;

/**
 * ByteDance V2 应用类型
 */
export type ByteDanceV2App = z.infer<typeof ByteDanceV2AppSchema>;

/**
 * ByteDance V2 用户类型
 */
export type ByteDanceV2User = z.infer<typeof ByteDanceV2UserSchema>;

/**
 * ByteDance V2 音频类型
 */
export type ByteDanceV2Audio = z.infer<typeof ByteDanceV2AudioSchema>;

/**
 * ByteDance V2 请求类型
 */
export type ByteDanceV2Request = z.infer<typeof ByteDanceV2RequestSchema>;

/**
 * 默认集群
 */
export const BYTEDANCE_V2_DEFAULT_CLUSTER = "volcengine_streaming_common";
