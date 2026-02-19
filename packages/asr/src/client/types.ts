/**
 * Client type definitions
 */

import { AudioFormat } from "../audio/types.js";
import { AuthMethod } from "../auth/types.js";

// Request configuration
export interface AsrRequestConfig {
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
export interface AsrClientOptions {
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
export interface AsrResult {
  code: number;
  message?: string;
  seq?: number;
  result?: {
    text: string;
    segments?: Array<{
      text: string;
      start_time?: number;
      end_time?: number;
    }>;
  };
}

// Event types
export type AsrEventType =
  | "open"
  | "close"
  | "error"
  | "result"
  | "audio_end"
  | "full_response";

// Event data
export interface AsrEventData {
  type: AsrEventType;
  data?: unknown;
}
