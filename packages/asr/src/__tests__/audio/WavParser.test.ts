/**
 * WAV 文件解析器测试
 */

import { Buffer } from "node:buffer";
import { createWavFile, readWavData, readWavInfo } from "@/audio/index.js";
import { describe, expect, it } from "vitest";

describe("WavParser", () => {
  /**
   * 创建测试用 WAV 文件数据
   */
  function createTestWavData(
    sampleRate = 16000,
    channels = 1,
    bitsPerSample = 16,
    dataSize = 16000
  ): Buffer {
    return createWavFile(
      Buffer.alloc(dataSize),
      sampleRate,
      channels,
      bitsPerSample
    );
  }

  describe("readWavInfo", () => {
    it("应正确解析标准 WAV 文件", () => {
      const wavData = createTestWavData(16000, 1, 16, 16000);
      const info = readWavInfo(wavData);

      expect(info.nchannels).toBe(1);
      expect(info.sampwidth).toBe(16);
      expect(info.framerate).toBe(16000);
      expect(info.dataSize).toBe(16000);
      expect(info.nframes).toBe(1000); // 16000 / (1 * 16)
    });

    it("应正确解析立体声 WAV 文件", () => {
      const wavData = createTestWavData(16000, 2, 16, 32000);
      const info = readWavInfo(wavData);

      expect(info.nchannels).toBe(2);
      expect(info.sampwidth).toBe(16);
      expect(info.framerate).toBe(16000);
      expect(info.nframes).toBe(1000); // 32000 / (2 * 16)
    });

    it("应正确解析不同采样率", () => {
      const wavData = createTestWavData(48000, 1, 16, 48000);
      const info = readWavInfo(wavData);

      expect(info.framerate).toBe(48000);
    });

    it("应在缺少 data chunk 时返回零数据大小", () => {
      // 手动创建一个没有 data chunk 的 WAV 文件
      const header = Buffer.alloc(44);
      header.write("RIFF", 0);
      header.writeUInt32LE(36, 4); // 文件大小 - 8
      header.write("WAVE", 8);
      header.write("fmt ", 12);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20); // PCM
      header.writeUInt16LE(1, 22); // channels
      header.writeUInt32LE(16000, 24); // sample rate
      header.writeUInt32LE(32000, 28); // byte rate
      header.writeUInt16LE(2, 32); // block align
      header.writeUInt16LE(16, 34); // bits per sample
      // 没有 data chunk

      const info = readWavInfo(header);

      expect(info.nchannels).toBe(1);
      expect(info.dataSize).toBe(0);
    });

    it("应在缺少 RIFF 头时抛出错误", () => {
      const invalidData = Buffer.from("not a wav file");

      expect(() => readWavInfo(invalidData)).toThrow(
        "Invalid WAV file: missing RIFF header"
      );
    });

    it("应在缺少 WAVE 格式时抛出错误", () => {
      const invalidData = Buffer.alloc(12);
      invalidData.write("RIFF", 0);
      invalidData.writeUInt32LE(4, 4);
      invalidData.write("NOTW", 8); // 错误的格式

      expect(() => readWavInfo(invalidData)).toThrow(
        "Invalid WAV file: missing WAVE format"
      );
    });

    it("应在缺少 fmt chunk 时抛出错误", () => {
      const invalidData = Buffer.alloc(20);
      invalidData.write("RIFF", 0);
      invalidData.writeUInt32LE(12, 4);
      invalidData.write("WAVE", 8);
      // 缺少 fmt chunk

      expect(() => readWavInfo(invalidData)).toThrow(
        "Invalid WAV file: missing fmt chunk"
      );
    });

    it("应正确处理 8 位采样", () => {
      const wavData = createTestWavData(8000, 1, 8, 8000);
      const info = readWavInfo(wavData);

      expect(info.sampwidth).toBe(8);
      expect(info.nframes).toBe(1000); // 8000 / (1 * 8)
    });
  });

  describe("readWavData", () => {
    it("应正确读取音频数据", () => {
      const pcmData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      const wavData = createWavFile(pcmData, 16000, 1, 16);

      const audioData = readWavData(wavData);

      expect(audioData.length).toBe(pcmData.length);
      expect(audioData.compare(pcmData)).toBe(0);
    });

    it("应在没有 data chunk 时返回空 buffer", () => {
      const header = Buffer.alloc(44);
      header.write("RIFF", 0);
      header.writeUInt32LE(36, 4);
      header.write("WAVE", 8);
      header.write("fmt ", 12);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(1, 22);
      header.writeUInt32LE(16000, 24);
      header.writeUInt32LE(32000, 28);
      header.writeUInt16LE(2, 32);
      header.writeUInt16LE(16, 34);
      // 没有 data chunk

      const audioData = readWavData(header);

      expect(audioData.length).toBe(0);
    });

    it("应正确读取大的音频数据", () => {
      const pcmData = Buffer.alloc(1024 * 1024); // 1MB 数据
      for (let i = 0; i < pcmData.length; i++) {
        pcmData[i] = i % 256;
      }

      const wavData = createWavFile(pcmData, 16000, 1, 16);
      const audioData = readWavData(wavData);

      expect(audioData.length).toBe(pcmData.length);
    });
  });

  describe("createWavFile", () => {
    it("应创建有效的 WAV 文件", () => {
      const pcmData = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      const wavFile = createWavFile(pcmData, 16000, 1, 16);

      expect(wavFile.length).toBe(44 + pcmData.length);
      expect(wavFile.subarray(0, 4).toString()).toBe("RIFF");
      expect(wavFile.subarray(8, 12).toString()).toBe("WAVE");
      expect(wavFile.subarray(12, 16).toString()).toBe("fmt ");
      expect(wavFile.subarray(36, 40).toString()).toBe("data");
    });

    it("应使用指定的采样率创建文件", () => {
      const pcmData = Buffer.alloc(100);
      const wavFile = createWavFile(pcmData, 48000, 1, 16);

      expect(wavFile.readUInt32LE(24)).toBe(48000);
    });

    it("应使用指定的声道数创建文件", () => {
      const pcmData = Buffer.alloc(100);
      const wavFile = createWavFile(pcmData, 16000, 2, 16);

      expect(wavFile.readUInt16LE(22)).toBe(2);
    });

    it("应使用指定的位深度创建文件", () => {
      const pcmData = Buffer.alloc(100);
      const wavFile = createWavFile(pcmData, 16000, 1, 8);

      expect(wavFile.readUInt16LE(34)).toBe(8);
    });

    it("应正确计算文件大小", () => {
      const dataSize = 1000;
      const pcmData = Buffer.alloc(dataSize);
      const wavFile = createWavFile(pcmData, 16000, 1, 16);

      // 文件大小 = 36 + dataSize (chunkSize 字段不包含 RIFF 和 WAVE)
      const chunkSize = wavFile.readUInt32LE(4);
      expect(chunkSize).toBe(36 + dataSize);
    });

    it("应正确计算 byteRate 和 blockAlign", () => {
      const pcmData = Buffer.alloc(100);
      const wavFile = createWavFile(pcmData, 16000, 2, 16);

      // blockAlign = channels * (bitsPerSample / 8) = 2 * 2 = 4
      expect(wavFile.readUInt16LE(32)).toBe(4);

      // byteRate = sampleRate * blockAlign = 16000 * 4 = 64000
      expect(wavFile.readUInt32LE(28)).toBe(64000);
    });

    it("应支持空 PCM 数据", () => {
      const pcmData = Buffer.alloc(0);
      const wavFile = createWavFile(pcmData, 16000, 1, 16);

      expect(wavFile.length).toBe(44);
      expect(wavFile.readUInt32LE(40)).toBe(0); // data chunk size
    });
  });
});
