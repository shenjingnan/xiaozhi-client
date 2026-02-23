/**
 * Opus 解码器工具
 *
 * 提供将 Opus 音频数据解码为 PCM 格式的功能
 */

import { Readable } from "node:stream";
import prism from "prism-media";

export interface OpusDecoderOptions {
  /** 采样率，默认 16000 Hz */
  sampleRate?: number;
  /** 声道数，默认 1（单声道） */
  channels?: number;
  /** 帧大小，可选，默认根据 sampleRate * 0.02 计算 */
  frameSize?: number;
}

/**
 * Opus 解码器
 *
 * 使用 prism-media 库将 Opus 音频数据解码为 PCM 格式
 *
 * @example
 * ```typescript
 * const decoder = new OpusDecoder({ sampleRate: 16000, channels: 1 });
 * const pcmData = await decoder.decode(opusData);
 * ```
 *
 * @example
 * ```typescript
 * // 使用便捷静态方法
 * const pcmData = await OpusDecoder.toPcm(opusData);
 * ```
 */
export class OpusDecoder {
  private sampleRate: number;
  private channels: number;
  private frameSize: number;

  constructor(options: OpusDecoderOptions = {}) {
    this.sampleRate = options.sampleRate ?? 16000;
    this.channels = options.channels ?? 1;
    this.frameSize = options.frameSize ?? Math.floor(this.sampleRate * 0.02);
  }

  /**
   * 将 Opus 数据解码为 PCM
   *
   * @param opusData 裸 Opus 音频数据
   * @returns PCM 音频数据
   */
  async decode(opusData: Buffer): Promise<Buffer> {
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      const stream = Readable.from(opusData);

      const decoder = new prism.opus.Decoder({
        rate: this.sampleRate,
        channels: this.channels,
        frameSize: this.frameSize,
      });

      decoder.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      decoder.on("end", () => resolve());
      decoder.on("error", reject);

      stream.pipe(decoder);
    });

    return Buffer.concat(chunks);
  }

  /**
   * 便捷方法：直接将 Opus 数据解码为 PCM
   *
   * @param opusData 裸 Opus 音频数据
   * @param options 解码选项
   * @returns PCM 音频数据
   */
  static async toPcm(
    opusData: Buffer,
    options?: OpusDecoderOptions
  ): Promise<Buffer> {
    const decoder = new OpusDecoder(options);
    return decoder.decode(opusData);
  }
}
