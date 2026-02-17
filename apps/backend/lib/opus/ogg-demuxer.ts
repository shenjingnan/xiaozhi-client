/**
 * Ogg Opus 解封装模块
 * 使用 prism-media 的 OggDemuxer 提取纯 Opus 音频数据
 */

import { Readable } from "node:stream";
import * as prism from "prism-media";

/**
 * 解封装 Ogg Opus 数据，提取纯 Opus 音频
 * @param oggData - Ogg Opus 格式的二进制数据
 * @returns 纯 Opus 数据的 Uint8Array
 */
export async function demuxOggOpus(oggData: Uint8Array): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];

  // 创建可读流
  const stream = Readable.from(Buffer.from(oggData));

  // 使用 prism-media 的 OggDemuxer 解封装
  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(new prism.opus.OggDemuxer())
      .on("data", (chunk: Buffer) => {
        chunks.push(new Uint8Array(chunk));
      })
      .on("end", () => resolve())
      .on("error", reject);
  });

  // 合并所有 Opus 数据块
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * 流式解封装 Ogg Opus 数据块（适用于流式 TTS）
 * @param oggChunk - 单个 Ogg Opus 数据块（来自 TTS stream）
 * @returns 解封装后的 Opus 数据块
 *
 * 注意：字节跳动的 TTS 每个 msg.payload 可能是完整的 Ogg 页，
 * 需要累积多个页才能正确解封装。实际实现可能需要调整。
 */
export async function demuxOggOpusChunk(
  oggChunk: Uint8Array
): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = [];

  await new Promise<void>((resolve, reject) => {
    const stream = Readable.from(Buffer.from(oggChunk));

    stream
      .pipe(new prism.opus.OggDemuxer())
      .on("data", (chunk: Buffer) => {
        chunks.push(new Uint8Array(chunk));
      })
      .on("end", () => resolve())
      .on("error", reject);
  });

  return chunks;
}
