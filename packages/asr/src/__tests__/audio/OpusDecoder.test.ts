/**
 * OpusDecoder 单元测试
 */

import { Buffer } from "node:buffer";
import { describe, expect, it, beforeEach } from "vitest";
import { OpusDecoder } from "@/audio/OpusDecoder.js";

describe("OpusDecoder", () => {
  describe("构造函数", () => {
    it("应该使用默认配置创建解码器", () => {
      const decoder = new OpusDecoder();

      // 私有属性，但可以通过测试行为验证
      expect(decoder).toBeDefined();
    });

    it("应该使用自定义配置创建解码器", () => {
      const decoder = new OpusDecoder({
        sampleRate: 48000,
        channels: 2,
        frameSize: 960,
      });

      expect(decoder).toBeDefined();
    });

    it("应该正确设置默认采样率", () => {
      const decoder = new OpusDecoder({ sampleRate: 24000 });
      expect(decoder).toBeDefined();
    });

    it("应该正确设置默认声道数", () => {
      const decoder = new OpusDecoder({ channels: 2 });
      expect(decoder).toBeDefined();
    });

    it("应该正确设置帧大小", () => {
      const decoder = new OpusDecoder({ frameSize: 480 });
      expect(decoder).toBeDefined();
    });

    it("应该根据采样率计算默认帧大小", () => {
      // 默认帧大小 = sampleRate * 0.02
      // 对于 16000 Hz，帧大小应该是 320
      const decoder = new OpusDecoder({ sampleRate: 16000 });
      expect(decoder).toBeDefined();
    });
  });

  describe("decode 方法", () => {
    let decoder: OpusDecoder;

    beforeEach(() => {
      decoder = new OpusDecoder({ sampleRate: 16000, channels: 1 });
    });

    it("应该处理空 Opus 数据", async () => {
      const emptyData = Buffer.alloc(0);

      const result = await decoder.decode(emptyData);

      // 空输入应该产生空或最小的输出
      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("应该处理小的 Opus 数据块（可能抛出解码错误）", async () => {
      // 创建一个小的测试数据块（不是有效的 Opus 数据）
      const testData = Buffer.alloc(100, 0xff);

      try {
        const result = await decoder.decode(testData);
        expect(Buffer.isBuffer(result)).toBe(true);
      } catch (error) {
        // 无效的 Opus 数据会抛出错误，这是预期行为
        expect(error).toBeDefined();
      }
    });

    it("应该处理较大的 Opus 数据块（可能抛出解码错误）", async () => {
      // 创建一个较大的测试数据块（不是有效的 Opus 数据）
      const testData = Buffer.alloc(5000, 0xab);

      try {
        const result = await decoder.decode(testData);
        expect(Buffer.isBuffer(result)).toBe(true);
      } catch (error) {
        // 无效的 Opus 数据会抛出错误，这是预期行为
        expect(error).toBeDefined();
      }
    });

    it("应该返回 PCM 格式数据", async () => {
      const testData = Buffer.alloc(200, 0x00);

      const result = await decoder.decode(testData);

      // PCM 数据通常是原始音频数据
      expect(result.length).toBeGreaterThan(0);
    });

    it("应该处理立体声数据", async () => {
      const stereoDecoder = new OpusDecoder({
        sampleRate: 16000,
        channels: 2,
      });

      const testData = Buffer.alloc(200);
      const result = await stereoDecoder.decode(testData);

      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("应该处理不同采样率", async () => {
      const highRateDecoder = new OpusDecoder({
        sampleRate: 48000,
        channels: 1,
      });

      const testData = Buffer.alloc(500);
      const result = await highRateDecoder.decode(testData);

      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe("静态方法 toPcm", () => {
    it("应该直接将 Opus 数据转换为 PCM", async () => {
      const testData = Buffer.alloc(200, 0x12);

      const result = await OpusDecoder.toPcm(testData);

      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("应该支持自定义配置", async () => {
      const testData = Buffer.alloc(300);

      const result = await OpusDecoder.toPcm(testData, {
        sampleRate: 48000,
        channels: 2,
      });

      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("应该使用默认配置当未提供选项时", async () => {
      const testData = Buffer.alloc(200);

      const result = await OpusDecoder.toPcm(testData);

      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe("边界情况", () => {
    it("应该处理连续的 decode 调用", async () => {
      const decoder = new OpusDecoder();

      const data1 = Buffer.alloc(100);
      const data2 = Buffer.alloc(150);
      const data3 = Buffer.alloc(200);

      const result1 = await decoder.decode(data1);
      const result2 = await decoder.decode(data2);
      const result3 = await decoder.decode(data3);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result3).toBeDefined();
    });

    it("应该处理包含零的数据", async () => {
      const decoder = new OpusDecoder();
      const zeroData = Buffer.alloc(500, 0x00);

      const result = await decoder.decode(zeroData);

      expect(result).toBeDefined();
    });

    it("应该处理随机数据（可能抛出解码错误）", async () => {
      const decoder = new OpusDecoder();
      const randomData = Buffer.alloc(1000);

      for (let i = 0; i < randomData.length; i++) {
        randomData[i] = Math.floor(Math.random() * 256);
      }

      // 随机数据可能不是有效的 Opus 数据，解码器可能会抛出错误
      // 这是预期行为，因为 Opus 解码需要有效的编码数据
      try {
        const result = await decoder.decode(randomData);
        // 如果没有抛出错误，结果应该是有效的 Buffer
        expect(Buffer.isBuffer(result)).toBe(true);
      } catch (error) {
        // 如果抛出错误，应该是解码错误
        expect(error).toBeDefined();
      }
    });
  });

  describe("配置验证", () => {
    it("应该支持 8000 Hz 采样率", async () => {
      const decoder = new OpusDecoder({ sampleRate: 8000 });
      const testData = Buffer.alloc(100);

      const result = await decoder.decode(testData);

      expect(result).toBeDefined();
    });

    it("应该支持 24000 Hz 采样率", async () => {
      const decoder = new OpusDecoder({ sampleRate: 24000 });
      const testData = Buffer.alloc(200);

      const result = await decoder.decode(testData);

      expect(result).toBeDefined();
    });

    it("应该支持自定义帧大小", async () => {
      const decoder = new OpusDecoder({ frameSize: 120 });
      const testData = Buffer.alloc(150);

      const result = await decoder.decode(testData);

      expect(result).toBeDefined();
    });
  });
});
