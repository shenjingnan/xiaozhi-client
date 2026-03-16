/**
 * 音频类型定义
 */

export enum AudioFormat {
  WAV = "wav",
  MP3 = "mp3",
  OGG = "ogg",
  RAW = "raw",
}

// WAV 文件信息
export interface WavInfo {
  nchannels: number; // 声道数
  sampwidth: number; // 采样宽度（字节）
  framerate: number; // 采样率
  nframes: number; // 帧数
  dataSize: number; // 音频数据大小
}

// 音频配置
export interface AudioConfig {
  format: AudioFormat;
  sampleRate: number;
  language?: string;
  bits?: number;
  channel?: number;
  codec?: string;
}

// 带元数据的音频数据
export interface AudioData {
  data: Buffer;
  config: AudioConfig;
}
