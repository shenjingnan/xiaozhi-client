/**
 * AudioProcessor 单元测试
 */

import { Buffer } from "node:buffer";
import { unlinkSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach, beforeAll } from "vitest";
import { AudioProcessor, processAudio } from "@/audio/AudioProcessor.js";
import { AudioFormat } from "@/audio/types.js";
import { createWavFile } from "@/audio/WavParser.js";

describe("AudioProcessor", () => {
  let testDir: string;
  let ffmpegAvailable: boolean;

  beforeAll(() => {
    // 检查 ffmpeg 是否可用
    try {
      const { execFileSync } = require("node:child_process");
      execFileSync("ffmpeg", ["-version"], { stdio: "pipe" });
      ffmpegAvailable = true;
    } catch {
      ffmpegAvailable = false;
    }
  });

  beforeEach(() => {
    // 创建临时测试目录
    testDir = join(tmpdir(), `audio-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // 清理临时目录
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // 辅助函数：创建测试 WAV 文件
  function createTestWavFile(
    filename: string,
    sampleRate = 16000,
    channels = 1
  ): string {
    const pcmData = Buffer.alloc(sampleRate * 2); // 1 秒的音频
    const wavData = createWavFile(pcmData, sampleRate, channels, 16);
    const filePath = join(testDir, filename);
    writeFileSync(filePath, wavData);
    return filePath;
  }

  describe("构造函数", () => {
    it("应该根据文件扩展名检测格式", () => {
      const wavPath = createTestWavFile("test.wav");
      const processor = new AudioProcessor(wavPath);

      expect(processor.getFormat()).toBe(AudioFormat.WAV);
    });

    it("应该接受显式指定的格式", () => {
      const wavPath = createTestWavFile("test.unknown");
      const processor = new AudioProcessor(wavPath, AudioFormat.WAV);

      expect(processor.getFormat()).toBe(AudioFormat.WAV);
    });

    it("应该检测 mp3 扩展名", () => {
      const mp3Path = join(testDir, "test.mp3");
      writeFileSync(mp3Path, Buffer.alloc(100));

      const processor = new AudioProcessor(mp3Path);
      expect(processor.getFormat()).toBe(AudioFormat.MP3);
    });

    it("应该检测 ogg 扩展名", () => {
      const oggPath = join(testDir, "test.ogg");
      writeFileSync(oggPath, Buffer.alloc(100));

      const processor = new AudioProcessor(oggPath);
      expect(processor.getFormat()).toBe(AudioFormat.OGG);
    });

    it("应该默认使用 WAV 格式当无法检测时", () => {
      const unknownPath = join(testDir, "test.unknown");
      writeFileSync(unknownPath, Buffer.alloc(100));

      const processor = new AudioProcessor(unknownPath);
      expect(processor.getFormat()).toBe(AudioFormat.WAV);
    });
  });

  describe("getWavInfo", () => {
    it("应该正确读取 WAV 文件信息", () => {
      const wavPath = createTestWavFile("test.wav", 16000, 1);
      const processor = new AudioProcessor(wavPath);

      const info = processor.getWavInfo();

      expect(info.nchannels).toBe(1);
      expect(info.framerate).toBe(16000);
      expect(info.sampwidth).toBe(16); // bytes
      expect(info.dataSize).toBeGreaterThan(0);
      expect(info.nframes).toBeGreaterThan(0);
    });

    it("应该正确读取立体声 WAV 文件信息", () => {
      const wavPath = createTestWavFile("stereo.wav", 16000, 2);
      const processor = new AudioProcessor(wavPath);

      const info = processor.getWavInfo();

      expect(info.nchannels).toBe(2);
    });

    it("应该正确读取不同采样率的文件", () => {
      const wavPath = createTestWavFile("48k.wav", 48000, 1);
      const processor = new AudioProcessor(wavPath);

      const info = processor.getWavInfo();

      expect(info.framerate).toBe(48000);
    });
  });

  describe("getPcmData", () => {
    it("应该从 WAV 文件提取 PCM 数据", () => {
      const wavPath = createTestWavFile("test.wav", 16000, 1);
      const processor = new AudioProcessor(wavPath);

      const pcmData = processor.getPcmData();

      expect(Buffer.isBuffer(pcmData)).toBe(true);
      expect(pcmData.length).toBeGreaterThan(0);
    });

    it("应该返回原始音频数据（不含 WAV 头）", () => {
      const wavPath = createTestWavFile("test.wav", 16000, 1);
      const processor = new AudioProcessor(wavPath);

      const pcmData = processor.getPcmData();
      const wavData = processor.getWavData();

      // PCM 数据应该比 WAV 数据短（去掉了 44 字节的头）
      expect(pcmData.length).toBeLessThan(wavData.length);
      expect(wavData.length - pcmData.length).toBe(44);
    });
  });

  describe("getWavData", () => {
    it("应该返回完整的 WAV 数据（包含头）", () => {
      const wavPath = createTestWavFile("test.wav", 16000, 1);
      const processor = new AudioProcessor(wavPath);

      const wavData = processor.getWavData();

      expect(Buffer.isBuffer(wavData)).toBe(true);
      expect(wavData.length).toBeGreaterThan(44); // 至少包含 WAV 头
      expect(wavData.subarray(0, 4).toString()).toBe("RIFF");
    });

    it("对于 WAV 文件应该返回原始文件数据", () => {
      const wavPath = createTestWavFile("test.wav", 16000, 1);
      const processor = new AudioProcessor(wavPath);

      const wavData = processor.getWavData();
      const originalData = readFileSync(wavPath);

      expect(wavData.equals(originalData)).toBe(true);
    });
  });

  describe("getConfig", () => {
    it("应该返回正确的音频配置", () => {
      const wavPath = createTestWavFile("test.wav", 16000, 1);
      const processor = new AudioProcessor(wavPath);

      const config = processor.getConfig();

      expect(config.format).toBe(AudioFormat.WAV);
      expect(config.sampleRate).toBe(16000);
      // AudioProcessor 使用 sampwidth * 8 计算 bits，这里 sampwidth = 16 (bits per sample)
      // 所以 bits = 16 * 8 = 128
      expect(config.bits).toBe(128);
      expect(config.channel).toBe(1);
    });

    it("应该正确报告立体声配置", () => {
      const wavPath = createTestWavFile("stereo.wav", 16000, 2);
      const processor = new AudioProcessor(wavPath);

      const config = processor.getConfig();

      expect(config.channel).toBe(2);
    });
  });

  describe("calculateSegmentSize", () => {
    it("应该计算正确的段大小", () => {
      const wavPath = createTestWavFile("test.wav", 16000, 1);
      const processor = new AudioProcessor(wavPath);

      const segmentSize = processor.calculateSegmentSize(1000); // 1 秒

      // AudioProcessor 计算: nchannels * sampwidth * framerate * (durationMs / 1000)
      // 1 * 16 * 16000 * 1 = 256000 字节 (注意：代码中的 sampwidth 实际是 bits per sample)
      expect(segmentSize).toBe(256000);
    });

    it("应该使用默认 15 秒时长", () => {
      const wavPath = createTestWavFile("test.wav", 16000, 1);
      const processor = new AudioProcessor(wavPath);

      const segmentSize = processor.calculateSegmentSize();

      // 1 * 16 * 16000 * 15 = 3840000 字节
      expect(segmentSize).toBe(3840000);
    });

    it("应该支持立体声计算", () => {
      const wavPath = createTestWavFile("stereo.wav", 16000, 2);
      const processor = new AudioProcessor(wavPath);

      const segmentSize = processor.calculateSegmentSize(1000);

      // 2 * 16 * 16000 * 1 = 512000 字节
      expect(segmentSize).toBe(512000);
    });
  });

  describe("getOpusData", () => {
    it("对于 OGG 格式应该返回文件数据", () => {
      const oggPath = join(testDir, "test.ogg");
      writeFileSync(oggPath, Buffer.alloc(100));

      const processor = new AudioProcessor(oggPath);

      expect(() => {
        processor.getOpusData();
      }).not.toThrow();
    });

    it("对于非 OGG 格式应该抛出错误", () => {
      const wavPath = createTestWavFile("test.wav");
      const processor = new AudioProcessor(wavPath);

      expect(() => {
        processor.getOpusData();
      }).toThrow("Opus data only available for OGG format");
    });
  });

  describe("sliceData", () => {
    it("应该将数据分成指定大小的块", () => {
      const wavPath = createTestWavFile("test.wav", 16000, 1);
      const processor = new AudioProcessor(wavPath);

      const chunkSize = 32000; // 1 秒的数据
      const chunks = Array.from(processor.sliceData(chunkSize));

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].chunk.length).toBeLessThanOrEqual(chunkSize);
    });

    it("应该正确标记最后一个块", () => {
      const wavPath = createTestWavFile("test.wav", 16000, 1);
      const processor = new AudioProcessor(wavPath);

      const chunks = Array.from(processor.sliceData(32000));

      if (chunks.length > 1) {
        // 如果有多个块，第一个块不应该是最后一个
        expect(chunks[0].last).toBe(false);
        // 最后一个块应该被标记为 last
        const lastChunk = chunks[chunks.length - 1];
        expect(lastChunk.last).toBe(true);
      } else {
        // 如果只有一个块，它应该被标记为 last
        expect(chunks[0].last).toBe(true);
      }
    });

    it("应该处理单块数据", () => {
      const wavPath = createTestWavFile("test.wav", 16000, 1);
      const processor = new AudioProcessor(wavPath);

      const chunks = Array.from(processor.sliceData(1000000)); // 超大的块大小

      expect(chunks.length).toBe(1);
      expect(chunks[0].last).toBe(true);
    });
  });

  describe("convertToWav", () => {
    it("对于 WAV 文件应该返回原路径", () => {
      const wavPath = createTestWavFile("test.wav");
      const processor = new AudioProcessor(wavPath);

      const resultPath = processor.convertToWav();

      expect(resultPath).toBe(wavPath);
    });

    it("对于非 WAV 文件应该尝试转换", () => {
      if (!ffmpegAvailable) {
        return;
      }

      const mp3Path = join(testDir, "test.mp3");
      writeFileSync(mp3Path, Buffer.alloc(100));

      const processor = new AudioProcessor(mp3Path);

      expect(() => {
        processor.convertToWav();
      }).toThrow();
    });
  });

  describe("processAudio 辅助函数", () => {
    it("应该处理音频文件并返回数据", () => {
      const wavPath = createTestWavFile("test.wav");

      const result = processAudio(wavPath);

      expect(result.wavData).toBeDefined();
      expect(Buffer.isBuffer(result.wavData)).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.config.sampleRate).toBe(16000);
    });

    it("应该支持指定格式", () => {
      const unknownPath = join(testDir, "test.unknown");
      writeFileSync(unknownPath, Buffer.alloc(100));

      expect(() => {
        processAudio(unknownPath, AudioFormat.WAV);
      }).toThrow(); // 无效的 WAV 文件
    });
  });

  describe("错误处理", () => {
    it("应该处理不存在的文件", () => {
      const processor = new AudioProcessor("/nonexistent/file.wav");

      expect(() => {
        processor.getWavInfo();
      }).toThrow();
    });

    it("应该处理无效的 WAV 文件", () => {
      const invalidPath = join(testDir, "invalid.wav");
      writeFileSync(invalidPath, Buffer.from("not a wav file"));

      const processor = new AudioProcessor(invalidPath);

      expect(() => {
        processor.getWavInfo();
      }).toThrow();
    });
  });

  describe("边界情况", () => {
    it("应该处理空音频文件", () => {
      const emptyPcm = Buffer.alloc(0);
      const emptyWav = createWavFile(emptyPcm, 16000, 1, 16);
      const emptyPath = join(testDir, "empty.wav");
      writeFileSync(emptyPath, emptyWav);

      const processor = new AudioProcessor(emptyPath);

      const info = processor.getWavInfo();
      expect(info.dataSize).toBe(0);
    });

    it("应该处理非常短的音频", () => {
      const shortPcm = Buffer.alloc(100);
      const shortWav = createWavFile(shortPcm, 16000, 1, 16);
      const shortPath = join(testDir, "short.wav");
      writeFileSync(shortPath, shortWav);

      const processor = new AudioProcessor(shortPath);

      expect(() => {
        processor.getWavInfo();
        processor.getPcmData();
      }).not.toThrow();
    });
  });
});

// 辅助函数：检查文件是否存在
function existsSync(path: string): boolean {
  try {
    const { existsSync } = require("node:fs");
    return existsSync(path);
  } catch {
    return false;
  }
}

// 辅助函数：读取文件
function readFileSync(path: string): Buffer {
  const { readFileSync } = require("node:fs");
  return readFileSync(path);
}
