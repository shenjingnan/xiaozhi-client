/**
 * MockAIService 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MockAIService } from "../mock-ai.service.js";

describe("MockAIService", () => {
  let service: MockAIService;

  beforeEach(() => {
    service = new MockAIService();
  });

  describe("recognize", () => {
    it("应该返回固定的模拟STT结果", async () => {
      const audioData = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await service.recognize(audioData);

      expect(result).toBe("测试语音输入");
    });

    it("应该忽略输入的音频数据", async () => {
      const result1 = await service.recognize(new Uint8Array([1, 2, 3]));
      const result2 = await service.recognize(new Uint8Array([4, 5, 6]));

      expect(result1).toBe(result2);
    });

    it("应该模拟网络延迟", async () => {
      const start = Date.now();
      await service.recognize(new Uint8Array());
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });

  describe("generateResponse", () => {
    it("应该返回固定的模拟LLM回复", async () => {
      const result = await service.generateResponse("你好");

      expect(result).toBe("你好！我是小智助手，很高兴为你服务。");
    });

    it("应该忽略输入的文本", async () => {
      const result1 = await service.generateResponse("用户输入1");
      const result2 = await service.generateResponse("用户输入2");

      expect(result1).toBe(result2);
    });

    it("应该模拟网络延迟", async () => {
      const start = Date.now();
      await service.generateResponse("测试");
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(200);
    });
  });

  describe("完整流程", () => {
    it("应该能够连续处理STT和LLM请求", async () => {
      const sttResult = await service.recognize(new Uint8Array([1, 2, 3]));
      expect(sttResult).toBe("测试语音输入");

      const llmResult = await service.generateResponse(sttResult);
      expect(llmResult).toBe("你好！我是小智助手，很高兴为你服务。");
    });
  });
});
