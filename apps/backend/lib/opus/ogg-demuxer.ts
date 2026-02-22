/**
 * Ogg Opus 解封装模块
 * 使用 prism-media 的 OggDemuxer 提取纯 Opus 音频数据
 *
 * 安全说明：
 * 为了缓解 CVE-2024-21521 (@discordjs/opus DoS 漏洞)，
 * 本模块对输入进行严格验证：
 * 1. 类型检查：确保输入为 Uint8Array
 * 2. Ogg 文件头验证：验证 "OggS" 魔数
 * 3. 大小限制：防止处理超大文件
 */

import { Readable } from "node:stream";
import * as prism from "prism-media";

/** Ogg 文件魔数 ("OggS") */
const OGG_MAGIC_NUMBER = [0x4f, 0x67, 0x67, 0x53];

/** Ogg 文件最大允许大小（100MB） */
const MAX_OGG_FILE_SIZE = 100 * 1024 * 1024;

/** Ogg 文件最小有效大小（Ogg 页头至少 27 字节） */
const MIN_OGG_FILE_SIZE = 27;

/**
 * 验证 Ogg Opus 数据的有效性
 * @param oggData - 待验证的二进制数据
 * @throws {TypeError} 如果数据类型不正确
 * @throws {Error} 如果数据不是有效的 Ogg 文件或大小不合理
 */
function validateOggData(oggData: Uint8Array): void {
  // 1. 类型检查
  if (!(oggData instanceof Uint8Array)) {
    throw new TypeError(
      `oggData 必须是 Uint8Array 类型，收到: ${oggData === null ? "null" : typeof oggData}`
    );
  }

  // 2. 大小检查
  if (oggData.length < MIN_OGG_FILE_SIZE) {
    throw new Error(
      `Ogg 数据过小，不是有效的 Ogg 文件（至少 ${MIN_OGG_FILE_SIZE} 字节，收到 ${oggData.length} 字节）`
    );
  }

  if (oggData.length > MAX_OGG_FILE_SIZE) {
    throw new Error(
      `Ogg 数据过大，超过安全限制（最大 ${MAX_OGG_FILE_SIZE} 字节，收到 ${oggData.length} 字节）`
    );
  }

  // 3. Ogg 文件头验证 ("OggS")
  if (
    oggData[0] !== OGG_MAGIC_NUMBER[0] ||
    oggData[1] !== OGG_MAGIC_NUMBER[1] ||
    oggData[2] !== OGG_MAGIC_NUMBER[2] ||
    oggData[3] !== OGG_MAGIC_NUMBER[3]
  ) {
    throw new Error(
      `无效的 Ogg 文件格式：缺少 "OggS" 文件头（收到: 0x${oggData[0].toString(16)} 0x${oggData[1].toString(16)} 0x${oggData[2].toString(16)} 0x${oggData[3].toString(16)}）`
    );
  }
}

/**
 * 解封装 Ogg Opus 数据，提取纯 Opus 音频
 * @param oggData - Ogg Opus 格式的二进制数据
 * @returns 纯 Opus 数据的 Uint8Array
 * @throws {TypeError} 如果数据类型不正确
 * @throws {Error} 如果数据不是有效的 Ogg 文件或大小不合理
 */
export async function demuxOggOpus(oggData: Uint8Array): Promise<Uint8Array> {
  // 输入验证（缓解 CVE-2024-21521）
  validateOggData(oggData);

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
 *
 * 安全说明：对输入进行与 demuxOggOpus 相同的严格验证
 */
export async function demuxOggOpusChunk(
  oggChunk: Uint8Array
): Promise<Uint8Array[]> {
  // 输入验证（缓解 CVE-2024-21521）
  validateOggData(oggChunk);

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
