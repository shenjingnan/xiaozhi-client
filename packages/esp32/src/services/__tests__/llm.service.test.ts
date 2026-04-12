/**
 * LLM 服务单元测试
 * 测试 LLMService 的 OpenAI 客户端封装和配置管理
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { LLMService } from "../llm.service.js";

// Mock openai
const mockCreate = vi.fn();
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };
  }),
}));

describe("LLMService", () => {
  /** 创建有效的 mock 配置提供者 */
  function createValidConfigProvider(overrides?: {
    model?: string;
    apiKey?: string;
    baseURL?: string;
    prompt?: string;
  }) {
    return {
      getLLMConfig: () => ({
        model: overrides?.model ?? "gpt-4",
        apiKey: overrides?.apiKey ?? "test-key",
        baseURL: overrides?.baseURL ?? "https://api.example.com",
        prompt: overrides?.prompt ?? "你是一个助手",
      }),
      isLLMConfigValid: () => true,
      getASRConfig: () => null,
      getTTSConfig: () => null,
    };
  }

  /** 创建无效的 mock 配置提供者 */
  function createInvalidConfigProvider() {
    return {
      getLLMConfig: () => null,
      isLLMConfigValid: () => false,
      getASRConfig: () => null,
      getTTSConfig: () => null,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockReset();
  });

  describe("constructor", () => {
    it("无效配置 client=null", () => {
      const service = new LLMService({
        configProvider: createInvalidConfigProvider(),
      });
      expect(service.isAvailable()).toBe(false);
    });

    it("有效配置初始化 OpenAI", () => {
      const service = new LLMService({
        configProvider: createValidConfigProvider(),
      });
      expect(service.isAvailable()).toBe(true);
    });

    it("自定义 resolvePrompt", async () => {
      const customResolve = vi.fn((cfg?: string) => cfg ?? "默认提示词");
      const service = new LLMService({
        configProvider: createValidConfigProvider({ prompt: "自定义提示" }),
        resolvePrompt: customResolve,
      });

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "回复内容" } }],
      });
      await service.chat("你好");

      expect(customResolve).toHaveBeenCalledWith("自定义提示");
    });
  });

  describe("isAvailable", () => {
    it("无效配置返回 false", () => {
      const service = new LLMService({
        configProvider: createInvalidConfigProvider(),
      });
      expect(service.isAvailable()).toBe(false);
    });

    it("有效配置返回 true", () => {
      const service = new LLMService({
        configProvider: createValidConfigProvider(),
      });
      expect(service.isAvailable()).toBe(true);
    });
  });

  describe("chat", () => {
    it("未初始化返回默认文本", async () => {
      const service = new LLMService({
        configProvider: createInvalidConfigProvider(),
      });
      const result = await service.chat("你好");
      expect(result).toBe("抱歉，我暂时无法回答");
    });

    it("成功调用返回响应", async () => {
      const service = new LLMService({
        configProvider: createValidConfigProvider(),
      });

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "你好！有什么可以帮你的？" } }],
      });

      const result = await service.chat("你好");
      expect(result).toBe("你好！有什么可以帮你的？");

      // 验证调用参数
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4",
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "system" }),
            expect.objectContaining({ role: "user", content: "你好" }),
          ]),
        })
      );
    });

    it("移除 think 标签", async () => {
      const service = new LLMService({
        configProvider: createValidConfigProvider(),
      });

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "<think\n让我思考一下...\n</think\n>这是最终答案",
            },
          },
        ],
      });

      const result = await service.chat("问题");
      expect(result).toBe("这是最终答案");
    });

    it("空内容返回默认文本", async () => {
      const service = new LLMService({
        configProvider: createValidConfigProvider(),
      });

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "" } }],
      });

      const result = await service.chat("测试");
      expect(result).toBe("抱歉，我暂时无法回答");
    });

    it("调用失败返回默认文本", async () => {
      const service = new LLMService({
        configProvider: createValidConfigProvider(),
      });

      mockCreate.mockRejectedValue(new Error("网络超时"));

      const result = await service.chat("测试");
      expect(result).toBe("抱歉，我暂时无法回答");
    });

    it("配置热更新重新初始化", async () => {
      // 先创建一个无效配置的服务
      let isValid = false;
      const configProvider = {
        getLLMConfig: () =>
          isValid
            ? {
                model: "new-model",
                apiKey: "new-key",
                baseURL: "https://new.api.com",
              }
            : null,
        isLLMConfigValid: () => isValid,
        getASRConfig: () => null,
        getTTSConfig: () => null,
      };

      const service = new LLMService({ configProvider });
      expect(service.isAvailable()).toBe(false);

      // 模拟配置热更新
      isValid = true;
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "新配置生效" } }],
      });

      const result = await service.chat("测试");
      // reinitClient 应该检测到配置更新并重新初始化
      expect(result).toBe("新配置生效");
      expect(service.isAvailable()).toBe(true);
    });
  });
});
