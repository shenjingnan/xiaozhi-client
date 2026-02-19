/**
 * Audio processor - unified entry for audio processing
 */

import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import {
  convertAudioToWav,
  convertMp3ToWav,
  convertOggToWav,
} from "./OggConverter.js";
import { createWavFile, readWavInfo } from "./WavParser.js";
import type { AudioConfig, WavInfo } from "./types.js";
import { AudioFormat } from "./types.js";

/**
 * Process audio file and return WAV format data
 */
export class AudioProcessor {
  private audioPath: string;
  private format: AudioFormat;

  constructor(audioPath: string, format?: AudioFormat) {
    this.audioPath = audioPath;
    this.format = this.detectFormat(audioPath, format);
  }

  /**
   * Detect audio format from file extension
   */
  private detectFormat(
    path: string,
    providedFormat?: AudioFormat
  ): AudioFormat {
    if (providedFormat) {
      return providedFormat;
    }

    const ext = path.toLowerCase().split(".").pop();
    switch (ext) {
      case "wav":
        return AudioFormat.WAV;
      case "mp3":
        return AudioFormat.MP3;
      case "ogg":
        return AudioFormat.OGG;
      default:
        return AudioFormat.WAV;
    }
  }

  /**
   * Read raw audio file data
   */
  private readAudioFile(): Buffer {
    return readFileSync(this.audioPath);
  }

  /**
   * Get WAV info from file
   */
  getWavInfo(): WavInfo {
    if (this.format === AudioFormat.WAV) {
      const data = this.readAudioFile();
      return readWavInfo(data);
    }
    // Convert to WAV first, then read info
    const wavPath = this.convertToWav();
    const data = readFileSync(wavPath);
    return readWavInfo(data);
  }

  /**
   * Convert audio to WAV format and return the path
   */
  convertToWav(): string {
    switch (this.format) {
      case AudioFormat.WAV:
        return this.audioPath;
      case AudioFormat.OGG:
        return convertOggToWav(this.audioPath);
      case AudioFormat.MP3:
        return convertMp3ToWav(this.audioPath);
      default:
        return convertAudioToWav(this.audioPath);
    }
  }

  /**
   * Get audio data as WAV format (with header)
   */
  getWavData(): Buffer {
    if (this.format === AudioFormat.WAV) {
      return this.readAudioFile();
    }

    // Convert to PCM first
    const pcmData = this.getPcmData();

    // Create WAV file
    return createWavFile(pcmData, 16000, 1, 16);
  }

  /**
   * Get raw PCM data
   */
  getPcmData(): Buffer {
    if (this.format === AudioFormat.WAV) {
      const data = this.readAudioFile();
      return this.extractPcmFromWav(data);
    }

    // Convert using ffmpeg
    const wavPath = this.convertToWav();
    const data = readFileSync(wavPath);
    return this.extractPcmFromWav(data);
  }

  /**
   * Extract PCM data from WAV file (skip header)
   */
  private extractPcmFromWav(wavData: Buffer): Buffer {
    // Find data chunk
    let offset = 12;
    while (offset < wavData.length - 8) {
      const chunkId = wavData.subarray(offset, offset + 4).toString("ascii");
      const chunkSize = wavData.readUInt32LE(offset + 4);

      if (chunkId === "data") {
        return wavData.subarray(offset + 8, offset + 8 + chunkSize);
      }

      offset += 8 + chunkSize;
      if (chunkSize % 2 !== 0) {
        offset += 1;
      }
    }

    return Buffer.alloc(0);
  }

  /**
   * Get audio config
   */
  getConfig(): AudioConfig {
    const info = this.getWavInfo();

    return {
      format:
        this.format === AudioFormat.WAV ? AudioFormat.WAV : AudioFormat.RAW,
      sampleRate: info.framerate,
      bits: info.sampwidth * 8,
      channel: info.nchannels,
    };
  }

  /**
   * Calculate segment size based on duration (ms)
   */
  calculateSegmentSize(durationMs = 15000): number {
    const info = this.getWavInfo();
    const bytesPerSecond = info.nchannels * info.sampwidth * info.framerate;
    const segmentSize = Math.floor(bytesPerSecond * (durationMs / 1000));
    return segmentSize;
  }

  /**
   * Get raw Opus data from OGG file
   * OGG container directly contains Opus encoded data
   */
  getOpusData(): Buffer {
    if (this.format === AudioFormat.OGG) {
      // Directly read OGG file as Opus data
      return this.readAudioFile();
    }
    throw new Error("Opus data only available for OGG format");
  }

  /**
   * Get the format of the audio
   */
  getFormat(): AudioFormat {
    return this.format;
  }

  /**
   * Slice audio data into chunks
   */
  *sliceData(
    chunkSize: number
  ): Generator<{ chunk: Buffer; last: boolean }, void, unknown> {
    const data = this.getPcmData();
    const dataLen = data.length;
    let offset = 0;

    while (offset + chunkSize < dataLen) {
      yield { chunk: data.subarray(offset, offset + chunkSize), last: false };
      offset += chunkSize;
    }

    // Last chunk
    yield { chunk: data.subarray(offset, dataLen), last: true };
  }
}

/**
 * Process audio file and return processed data
 */
export function processAudio(
  audioPath: string,
  format?: AudioFormat
): { wavData: Buffer; config: AudioConfig } {
  const processor = new AudioProcessor(audioPath, format);
  return {
    wavData: processor.getWavData(),
    config: processor.getConfig(),
  };
}
