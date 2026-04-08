/**
 * WAV 文件解析器
 */

import { Buffer } from "node:buffer";
import type { WavInfo } from "@/audio/types.js";

/**
 * 读取 WAV 文件信息
 */
export function readWavInfo(data: Buffer): WavInfo {
  // 检查 RIFF 头部
  const riff = data.subarray(0, 4).toString("ascii");
  if (riff !== "RIFF") {
    throw new Error("Invalid WAV file: missing RIFF header");
  }

  // 检查 WAVE 格式
  const wave = data.subarray(8, 12).toString("ascii");
  if (wave !== "WAVE") {
    throw new Error("Invalid WAV file: missing WAVE format");
  }

  // 查找 fmt 块
  let offset = 12;
  let fmtChunk: Buffer | null = null;
  let dataChunk: Buffer | null = null;

  while (offset < data.length - 8) {
    const chunkId = data.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = data.readUInt32LE(offset + 4);

    if (chunkId === "fmt ") {
      fmtChunk = data.subarray(offset + 8, offset + 8 + chunkSize);
    } else if (chunkId === "data") {
      dataChunk = data.subarray(offset + 8, offset + 8 + chunkSize);
      break;
    }

    offset += 8 + chunkSize;
    // 字对齐
    if (chunkSize % 2 !== 0) {
      offset += 1;
    }
  }

  if (!fmtChunk) {
    throw new Error("Invalid WAV file: missing fmt chunk");
  }

  // 解析 fmt 块
  fmtChunk.readUInt16LE(0); // 音频格式 (1=PCM)
  const nchannels = fmtChunk.readUInt16LE(2);
  const framerate = fmtChunk.readUInt32LE(4);
  const sampwidth = fmtChunk.readUInt16LE(14);

  // 计算帧数
  const dataSize = dataChunk ? dataChunk.length : 0;
  const nframes = Math.floor(dataSize / (nchannels * sampwidth));

  return {
    nchannels,
    sampwidth,
    framerate,
    nframes,
    dataSize,
  };
}

/**
 * 读取 WAV 音频数据（跳过头部）
 */
export function readWavData(data: Buffer): Buffer {
  // 查找数据块
  let offset = 12;
  while (offset < data.length - 8) {
    const chunkId = data.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = data.readUInt32LE(offset + 4);

    if (chunkId === "data") {
      return data.subarray(offset + 8, offset + 8 + chunkSize);
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) {
      offset += 1;
    }
  }

  return Buffer.alloc(0);
}

/**
 * 从 PCM 数据创建 WAV 文件
 */
export function createWavFile(
  pcmData: Buffer,
  sampleRate = 16000,
  channels = 1,
  bitsPerSample = 16
): Buffer {
  const dataSize = pcmData.length;
  const blockAlign = channels * Math.ceil(bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);

  // RIFF 头部
  header.write("RIFF", 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write("WAVE", 8);

  // fmt 块
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // 块大小
  header.writeUInt16LE(1, 20); // 音频格式 (PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // 数据块
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}
