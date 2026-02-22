/**
 * Client type definitions
 */

import type { AudioFormat } from "../audio";
import type { AuthMethod } from "../auth";

// Request configuration
export interface ASRRequestConfig {
  app: {
    appid: string;
    cluster: string;
    token: string;
  };
  user: {
    uid: string;
  };
  request: {
    reqid: string;
    nbest: number;
    workflow: string;
    show_language: boolean;
    show_utterances: boolean;
    result_type: string;
    sequence: number;
    vad_signal: boolean;
    start_silence_time: string;
    vad_silence_time: string;
  };
  audio: {
    format: string;
    rate: number;
    language: string;
    bits: number;
    channel: number;
    codec: string;
  };
}

// Client options
export interface ASROption {
  // Server
  wsUrl?: string;
  cluster?: string;

  // App
  appid?: string;
  token?: string;

  // User
  uid?: string;

  // Audio
  audioPath?: string;
  format?: AudioFormat;
  sampleRate?: number;
  language?: string;
  bits?: number;
  channel?: number;
  codec?: string;

  // Request
  segDuration?: number;
  nbest?: number;
  workflow?: string;
  showLanguage?: boolean;
  showUtterances?: boolean;
  resultType?: string;

  // Auth
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
