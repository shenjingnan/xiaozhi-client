/**
 * Audio type definitions
 */

export enum AudioFormat {
  WAV = "wav",
  MP3 = "mp3",
  OGG = "ogg",
  RAW = "raw",
}

// WAV file information
export interface WavInfo {
  nchannels: number;    // Number of channels
  sampwidth: number;   // Sample width in bytes
  framerate: number;  // Sample rate
  nframes: number;    // Number of frames
  dataSize: number;    // Size of audio data
}

// Audio configuration
export interface AudioConfig {
  format: AudioFormat;
  sampleRate: number;
  language?: string;
  bits?: number;
  channel?: number;
  codec?: string;
}

// Audio data with metadata
export interface AudioData {
  data: Buffer;
  config: AudioConfig;
}
