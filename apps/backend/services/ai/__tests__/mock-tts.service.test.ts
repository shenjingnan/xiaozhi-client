/**
 * MockTTSService 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MockTTSService } from "../mock-tts.service.js";

describe("MockTTSService", () => {
  let service: MockTTSService;

  beforeEach(() => {
    service = new MockTTSService();
  });

  describe("initialize", () => {
    it("应该成功加载测试音频文件", async () => {
      await service.initialize();

      expect(service.getAudioDataSize()).toBeGreaterThan(0);
    });

    it("应该只初始化一次", async () => {
      await service.initialize();
      const size1 = service.getAudioDataSize();

      await service.initialize();
      const size2 = service.getAudioDataSize();

      expect(size1).toBe(size2);
    });

    it("应该记录音频数据大小", async () => {
      await service.initialize();

      const size = service.getAudioDataSize();
      expect(size).toBeGreaterThan(1000); // 测试音频至少有1KB
    });
  });

  describe("synthesize", () => {
    it("应该在未初始化时自动初始化", async () => {
      const result = await service.synthesize("测试文本");

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it("应该返回测试音频数据", async () => {
      await service.initialize();

      const result = await service.synthesize("任意文本");

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(service.getAudioDataSize());
    });

    it("应该忽略输入文本内容", async () => {
      await service.initialize();

      const result1 = await service.synthesize("文本1");
      const result2 = await service.synthesize("文本2");

      expect(result1).toEqual(result2);
    });

    it("应该模拟网络延迟", async () => {
      await service.initialize();

      const start = Date.now();
      await service.synthesize("测试");
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(150);
    });
  });

  describe("getAudioDataSize", () => {
    it("应该在未初始化时返回0", () => {
      expect(service.getAudioDataSize()).toBe(0);
    });

    it("应该在初始化后返回实际大小", async () => {
      await service.initialize();

      expect(service.getAudioDataSize()).toBeGreaterThan(0);
    });
  });

  describe("完整流程", () => {
    it("应该能够连续处理多个TTS请求", async () => {
      const result1 = await service.synthesize("第一句话");
      const result2 = await service.synthesize("第二句话");
      const result3 = await service.synthesize("第三句话");

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });
});
