/**
 * WAV file parser
 */

import { Buffer } from "node:buffer";
import { WavInfo } from "./types.js";

/**
 * Read WAV file information
 */
export function readWavInfo(data: Buffer): WavInfo {
  // Check RIFF header
  const riff = data.subarray(0, 4).toString("ascii");
  if (riff !== "RIFF") {
    throw new Error("Invalid WAV file: missing RIFF header");
  }

  // Check WAVE format
  const wave = data.subarray(8, 12).toString("ascii");
  if (wave !== "WAVE") {
    throw new Error("Invalid WAV file: missing WAVE format");
  }

  // Find fmt chunk
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
    // Word alignment
    if (chunkSize % 2 !== 0) {
      offset += 1;
    }
  }

  if (!fmtChunk) {
    throw new Error("Invalid WAV file: missing fmt chunk");
  }

  // Parse fmt chunk
  fmtChunk.readUInt16LE(0); // audio format (1=PCM)
  const nchannels = fmtChunk.readUInt16LE(2);
  const framerate = fmtChunk.readUInt32LE(4);
  const sampwidth = fmtChunk.readUInt16LE(14);

  // Calculate frames
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
 * Read WAV audio data (skipping header)
 */
export function readWavData(data: Buffer): Buffer {
  // Find data chunk
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
 * Create WAV file from PCM data
 */
export function createWavFile(
  pcmData: Buffer,
  sampleRate: number = 16000,
  channels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const dataSize = pcmData.length;
  const blockAlign = channels * Math.ceil(bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);

  // RIFF header
  header.write("RIFF", 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write("WAVE", 8);

  // fmt chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // chunk size
  header.writeUInt16LE(1, 20);  // audio format (PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}
