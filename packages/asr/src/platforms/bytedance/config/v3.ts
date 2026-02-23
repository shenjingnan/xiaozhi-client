/**
 * ByteDance V3 配置校验 Schema
 */

import { z } from "zod";

/**
 * ByteDance V3 用户配置 Schema
 */
export const ByteDanceV3UserSchema = z.object({
  /** 用户 ID */
  uid: z.string().optional(),
  /** 请求 ID */
  request_id: z.string().optional(),
});

/**
 * ByteDance V3 音频配置 Schema
 */
export const ByteDanceV3AudioSchema = z.object({
  /** 音频格式 */
  format: z.string().optional(),
  /** 采样率 */
  rate: z.number().optional(),
  /** 位深 */
  bits: z.number().optional(),
  /** 声道数 */
  channel: z.number().optional(),
  /** 编解码器 */
  codec: z.string().optional(),
  /** 编解码器选项 */
  codec_options: z.record(z.unknown()).optional(),
});

/**
 * ByteDance V3 请求配置 Schema
 */
export const ByteDanceV3RequestSchema = z.object({
  /** 序列号 */
  sequence: z.number().optional(),
  /** 请求 ID */
  reqid: z.string().optional(),
  /** 工作流 */
  workflow: z.string().optional(),
  /** 语言 */
  language: z.string().optional(),
  /** 模型名称 */
  model_name: z.string().optional(),
  /** N-best 数量 */
  nbest: z.number().optional(),
  /** 结果类型 */
  result_type: z.string().optional(),
  /** 开启非流式识别 */
  enable_nonstream: z.boolean().optional(),
  /** 启用 ITN */
  enable_itn: z.boolean().optional(),
  /** 启用标点 */
  enable_punc: z.boolean().optional(),
  /** 启用顺滑 */
  enable_ddc: z.boolean().optional(),
  /** 显示分句 */
  show_utterances: z.boolean().optional(),
  /** 显示语速 */
  show_speech_rate: z.boolean().optional(),
  /** 显示音量 */
  show_volume: z.boolean().optional(),
  /** 启用语种检测 */
  enable_lid: z.boolean().optional(),
  /** 启用情绪检测 */
  enable_emotion_detection: z.boolean().optional(),
  /** 启用性别检测 */
  enable_gender_detection: z.boolean().optional(),
  /** 启用首字加速 */
  enable_accelerate_text: z.boolean().optional(),
  /** 首字加速分数 */
  accelerate_score: z.number().optional(),
  /** 额外参数 */
  extra: z.record(z.unknown()).optional(),
});

/**
 * ByteDance V3 应用配置 Schema
 */
export const ByteDanceV3AppSchema = z.object({
  /** 应用 Key */
  appKey: z.string().min(1, "appKey 不能为空"),
  /** 访问密钥 */
  accessKey: z.string().min(1, "accessKey 不能为空"),
  /** 资源 ID */
  resourceId: z.string().min(1, "resourceId 不能为空"),
});

/**
 * ByteDance V3 配置 Schema
 */
export const ByteDanceV3ConfigSchema = ByteDanceV3AppSchema.extend({
  /** 用户配置 */
  user: ByteDanceV3UserSchema.optional(),
  /** 音频配置 */
  audio: ByteDanceV3AudioSchema.optional(),
  /** 请求配置 */
  request: ByteDanceV3RequestSchema.optional(),
});

/**
 * ByteDance V3 配置类型
 */
export type ByteDanceV3Config = z.infer<typeof ByteDanceV3ConfigSchema>;

/**
 * ByteDance V3 应用类型
 */
export type ByteDanceV3App = z.infer<typeof ByteDanceV3AppSchema>;

/**
 * ByteDance V3 用户类型
 */
export type ByteDanceV3User = z.infer<typeof ByteDanceV3UserSchema>;

/**
 * ByteDance V3 音频类型
 */
export type ByteDanceV3Audio = z.infer<typeof ByteDanceV3AudioSchema>;

/**
 * ByteDance V3 请求类型
 */
export type ByteDanceV3Request = z.infer<typeof ByteDanceV3RequestSchema>;
