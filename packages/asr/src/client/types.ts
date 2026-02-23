/**
 * Client type definitions
 */

import type { AudioFormat } from "@/audio";
import type { AuthMethod } from "@/auth";
import type { ByteDanceOption } from "@/platforms";
import type { ByteDanceV2ASRRequest } from "@/platforms/bytedance/request.js";

// Request configuration (向后兼容，重新导出 ByteDanceV2ASRRequest)
export type ASRRequestConfig = ByteDanceV2ASRRequest;

// Client options
export interface ASROption {
  // ByteDance 配置（V2 或 V3）
  bytedance?: ByteDanceOption;

  // Server（用于旧版兼容）
  wsUrl?: string;
  cluster?: string;

  // App（用于旧版兼容）
  appid?: string;
  token?: string;

  // User（用于旧版兼容）
  uid?: string;

  // Audio（用于旧版兼容）
  audioPath?: string;
  format?: AudioFormat;
  sampleRate?: number;
  language?: string;
  bits?: number;
  channel?: number;
  codec?: string;

  // Request（用于旧版兼容）
  segDuration?: number;
  nbest?: number;
  workflow?: string;
  showLanguage?: boolean;
  showUtterances?: boolean;
  resultType?: string;

  // Auth（用于旧版兼容）
  authMethod?: AuthMethod;
  secret?: string;

  // MP3 specific
  mp3SegSize?: number;

  // Success code
  successCode?: number;
}

// Result callback
export interface ASRResult {
  code: number;
  message?: string;
  seq?: number;
  sequence?: number; // 服务端返回的包序号，负数表示最后一包
  result?: Array<{
    text: string;
    segments?: Array<{
      text: string;
      start_time?: number;
      end_time?: number;
    }>;
    utterances?: Array<{
      // 分句信息
      text: string;
      definite?: boolean; // true 表示最终结果
      start_time?: number;
      end_time?: number;
    }>;
  }>;
}

// Event types
export type ASREventType =
  | "open"
  | "close"
  | "error"
  | "result"
  | "audio_end"
  | "full_response"
  | "vad_end"; // VAD 检测到用户说话结束

// Event data
export interface ASREventData {
  type: ASREventType;
  data?: unknown;
}
