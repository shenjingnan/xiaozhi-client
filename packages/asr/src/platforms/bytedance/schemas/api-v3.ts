/**
 * ByteDance V3 大模型流式识别配置 Schema
 */

import { z } from "zod";

/**
 * V3 用户配置
 */
export const ByteDanceV3UserSchema = z.object({
  uid: z.string().optional().describe("用户标识，建议采用 IMEI 或 MAC"),
  request_id: z
    .string()
    .optional()
    .describe("请求标识，每个请求唯一标识，建议使用 UUID"),
});

export type ByteDanceV3User = z.infer<typeof ByteDanceV3UserSchema>;

/**
 * V3 音频配置
 */
export const ByteDanceV3AudioSchema = z.object({
  format: z
    .string()
    .optional()
    .describe(
      "音频容器格式：pcm / wav / ogg / mp3。注意：pcm和wav内部音频流必须是pcm_s16le"
    ),
  rate: z
    .number()
    .optional()
    .describe("音频采样率，默认为 16000，目前只支持16000"),
  bits: z
    .number()
    .optional()
    .describe("音频采样点位数，默认为 16，暂只支持16bits"),
  channel: z
    .number()
    .optional()
    .describe("音频声道数：1(mono) / 2(stereo)，默认为1"),
  codec: z
    .string()
    .optional()
    .describe("音频编码格式：raw / opus，默认为 raw(表示pcm)"),
  codec_options: z.record(z.unknown()).optional().describe("编码选项"),
});

export type ByteDanceV3Audio = z.infer<typeof ByteDanceV3AudioSchema>;

/**
 * V3 请求配置
 */
export const ByteDanceV3RequestSchema = z.object({
  sequence: z
    .number()
    .optional()
    .describe(
      "请求序号。对于同一个请求的多个包序号，从 1 递增，最后一包取相反数"
    ),
  reqid: z
    .string()
    .optional()
    .describe("请求标识，每个请求唯一标识，建议使用 UUID"),
  workflow: z
    .string()
    .optional()
    .describe(
      "自定义工作流，默认值：audio_in,resample,partition,vad,fe,decode"
    ),
  language: z.string().optional().describe("指定可识别的语言"),
  model_name: z.string().optional().describe("模型名称，目前只有bigmodel"),
  nbest: z.number().optional().describe("识别结果候选数目，默认为 1"),
  result_type: z.string().optional().describe('结果返回方式，默认为"full"'),
  enable_nonstream: z.boolean().optional().describe("开启二遍识别"),
  enable_itn: z.boolean().optional().describe("启用ITN，默认为true"),
  enable_punc: z.boolean().optional().describe("启用标点，默认为true"),
  enable_ddc: z.boolean().optional().describe("启用顺滑，默认为false"),
  show_utterances: z
    .boolean()
    .optional()
    .describe("输出语音停顿、分句、分词信息"),
  show_speech_rate: z.boolean().optional().describe("分句信息携带语速"),
  show_volume: z.boolean().optional().describe("分句信息携带音量"),
  enable_lid: z.boolean().optional().describe("启用语种检测"),
  enable_emotion_detection: z.boolean().optional().describe("启用情绪检测"),
  enable_gender_detection: z.boolean().optional().describe("启用性别检测"),
  enable_accelerate_text: z
    .boolean()
    .optional()
    .describe("是否启动首字返回加速"),
  accelerate_score: z.number().optional().describe("首字返回加速率"),
  extra: z.record(z.unknown()).optional().describe("额外参数"),
});

export type ByteDanceV3Request = z.infer<typeof ByteDanceV3RequestSchema>;

/**
 * V3 应用配置（必需）
 */
export const ByteDanceV3AppSchema = z.object({
  appKey: z.string().min(1, "appKey 不能为空").describe("应用 Key"),
  accessKey: z.string().min(1, "accessKey 不能为空").describe("访问 Key"),
  resourceId: z.string().min(1, "resourceId 不能为空").describe("资源 ID"),
});

export type ByteDanceV3App = z.infer<typeof ByteDanceV3AppSchema>;

/**
 * V3 完整配置 Schema
 */
export const ByteDanceV3ConfigSchema = ByteDanceV3AppSchema.extend({
  user: ByteDanceV3UserSchema.optional(),
  audio: ByteDanceV3AudioSchema.optional(),
  request: ByteDanceV3RequestSchema.optional(),
});

export type ByteDanceV3Config = z.infer<typeof ByteDanceV3ConfigSchema>;
