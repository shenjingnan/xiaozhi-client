/**
 * LLM服务单元测试
 * 测试 OpenAI 客户端初始化、配置热更新、聊天功能等
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LLMService } from "../llm.service.js";

// Mock OpenAI - 使用 default export
vi.mock("openai", () => {
  const mockCreate = vi.fn();
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
  return {
    default: MockOpenAI,
    OpenAI: MockOpenAI,
  };
});

// Mock dependencies
vi.mock("@/Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock configManager
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getLLMConfig: vi.fn().mockReturnValue(null),
    isLLMConfigValid: vi.fn().mockReturnValue(false),
  },
}));

// Mock resolvePrompt
vi.mock("@/utils/prompt-utils.js", () => ({
  resolvePrompt: vi.fn().mockReturnValue("你是一个智能助手"),
}));

describe("LLMService", () => {
  let llmService: LLMService;
  let mockLogger: any;
  let mockConfigManager: any;
  let mockOpenAI: any;
  let mockCreate: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mocks to default state
    mockConfigManager = {
      getLLMConfig: vi.fn().mockReturnValue(null),
      isLLMConfigValid: vi.fn().mockReturnValue(false),
    };

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // Mock configManager
    const { configManager } = await import("@xiaozhi-client/config");
    Object.assign(configManager, mockConfigManager);

    // Mock OpenAI
    mockCreate = vi.fn();
    mockOpenAI = vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    }));
    const OpenAI = await import("openai");
    vi.mocked(OpenAI.default).mockImplementation(mockOpenAI);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor 和 initClient", () => {
    it("配置无效时应该不初始化客户端并记录警告", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(null);
      mockConfigManager.isLLMConfigValid.mockReturnValue(false);

      llmService = new LLMService();

      expect(mockOpenAI).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[LLMService] LLM 配置未找到或无效，请检查配置文件中的 llm 配置项"
      );
      expect(llmService.isAvailable()).toBe(false);
    });

    it("配置有效时应该初始化客户端", async () => {
      const mockConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.test.com",
        model: "gpt-4",
      };
      mockConfigManager.getLLMConfig.mockReturnValue(mockConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      expect(mockOpenAI).toHaveBeenCalledWith({
        apiKey: "test-api-key",
        baseURL: "https://api.test.com",
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[LLMService] OpenAI 客户端已初始化，模型: gpt-4"
      );
      expect(llmService.isAvailable()).toBe(true);
    });

    it("配置缺失 apiKey 时应该不初始化客户端", async () => {
      const mockConfig = {
        baseURL: "https://api.test.com",
        model: "gpt-4",
      };
      mockConfigManager.getLLMConfig.mockReturnValue(mockConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(false);

      llmService = new LLMService();

      expect(mockOpenAI).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(llmService.isAvailable()).toBe(false);
    });
  });

  describe("isAvailable", () => {
    it("客户端已初始化时应该返回 true", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue({
        apiKey: "test-key",
        baseURL: "https://api.test.com",
        model: "gpt-4",
      });
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      expect(llmService.isAvailable()).toBe(true);
    });

    it("客户端未初始化时应该返回 false", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(null);
      mockConfigManager.isLLMConfigValid.mockReturnValue(false);

      llmService = new LLMService();

      expect(llmService.isAvailable()).toBe(false);
    });
  });

  describe("chat - think 标签移除", () => {
    beforeEach(async () => {
      // 配置有效的 LLM 设置
      mockConfigManager.getLLMConfig.mockReturnValue({
        apiKey: "test-key",
        baseURL: "https://api.test.com",
        model: "gpt-4",
      });
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();
    });

    it("应该移除响应中的 think 标签及其内容", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "你好<think>这是思考过程</think>世界",
            },
          },
        ],
      });

      const result = await llmService.chat("你好");

      expect(result).toBe("你好世界");
    });

    it("应该移除多行 think 标签内容", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "回复<think>\n思考行1\n思考行2\n</think>内容",
            },
          },
        ],
      });

      const result = await llmService.chat("你好");

      expect(result).toBe("回复内容");
    });

    it("应该处理没有 think 标签的内容", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "普通文本内容",
            },
          },
        ],
      });

      const result = await llmService.chat("你好");

      expect(result).toBe("普通文本内容");
    });

    it("应该处理只有 think 标签的内容返回默认消息", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "<think>全部是思考</think>",
            },
          },
        ],
      });

      const result = await llmService.chat("你好");

      // 由于 think 标签被移除后内容为空，应返回默认消息
      expect(result).toBe("抱歉，我暂时无法回答");
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[LLMService] LLM 返回空内容"
      );
    });

    it("应该处理多个 think 标签", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "开始<think>思考1</think>中间<think>思考2</think>结束",
            },
          },
        ],
      });

      const result = await llmService.chat("你好");

      expect(result).toBe("开始中间结束");
    });

    it("应该去除首尾空白字符", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "  内容  ",
            },
          },
        ],
      });

      const result = await llmService.chat("你好");

      expect(result).toBe("内容");
    });
  });

  describe("chat - 基本功能", () => {
    beforeEach(async () => {
      // 配置有效的 LLM 设置
      mockConfigManager.getLLMConfig.mockReturnValue({
        apiKey: "test-key",
        baseURL: "https://api.test.com",
        model: "gpt-4",
      });
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();
    });

    it("应该成功调用 LLM 并返回响应", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "你好，有什么可以帮助你的吗？",
            },
          },
        ],
      });

      const result = await llmService.chat("你好");

      expect(result).toBe("你好，有什么可以帮助你的吗？");
      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-4",
        messages: [
          { role: "system", content: "你是一个智能助手" },
          { role: "user", content: "你好" },
        ],
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[LLMService] LLM 调用成功，输入长度: 2，输出长度: 14"
      );
    });

    it("客户端未初始化时应该返回默认错误消息", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(null);
      mockConfigManager.isLLMConfigValid.mockReturnValue(false);

      llmService = new LLMService();

      const result = await llmService.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[LLMService] LLM 客户端未初始化"
      );
    });

    it("LLM 返回空内容时应该返回默认错误消息", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      });

      const result = await llmService.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[LLMService] LLM 返回空内容"
      );
    });

    it("LLM 返回 undefined choices 时应该返回默认错误消息", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [],
      });

      const result = await llmService.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
    });

    it("LLM 调用失败时应该返回默认错误消息", async () => {
      mockCreate.mockRejectedValueOnce(new Error("API Error"));

      const result = await llmService.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[LLMService] LLM 调用失败:",
        expect.any(Error)
      );
    });

    it("应该调用 resolvePrompt 解析系统提示词", async () => {
      const { resolvePrompt } = await import("../../utils/prompt-utils.js");
      vi.mocked(resolvePrompt).mockReturnValueOnce("自定义系统提示");

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "回复内容",
            },
          },
        ],
      });

      await llmService.chat("你好");

      expect(resolvePrompt).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-4",
        messages: [
          { role: "system", content: "自定义系统提示" },
          { role: "user", content: "你好" },
        ],
      });
    });
  });

  describe("reinitClient（配置热更新）", () => {
    it("客户端已存在时不应该重新初始化", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue({
        apiKey: "test-key",
        baseURL: "https://api.test.com",
        model: "gpt-4",
      });
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();
      expect(mockOpenAI).toHaveBeenCalledTimes(1);

      // 通过 chat 触发 reinitClient
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "回复" } }],
      });
      await llmService.chat("测试");

      // 客户端已存在，不应该再次初始化
      expect(mockOpenAI).toHaveBeenCalledTimes(1);
    });

    it("客户端不存在且配置有效时应该重新初始化", async () => {
      // 首次初始化失败
      mockConfigManager.getLLMConfig.mockReturnValue(null);
      mockConfigManager.isLLMConfigValid.mockReturnValue(false);

      llmService = new LLMService();
      expect(mockOpenAI).not.toHaveBeenCalled();
      expect(llmService.isAvailable()).toBe(false);

      // 配置更新后变为有效
      mockConfigManager.getLLMConfig.mockReturnValue({
        apiKey: "new-key",
        baseURL: "https://api.new.com",
        model: "gpt-4",
      });
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      // 通过 chat 触发 reinitClient
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "回复" } }],
      });
      const result = await llmService.chat("测试");

      expect(mockOpenAI).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[LLMService] 检测到配置更新，重新初始化客户端"
      );
      expect(result).toBe("回复");
    });

    it("客户端不存在且配置无效时不应该重新初始化", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(null);
      mockConfigManager.isLLMConfigValid.mockReturnValue(false);

      llmService = new LLMService();
      expect(mockOpenAI).not.toHaveBeenCalled();

      // 配置仍然无效
      const result = await llmService.chat("测试");

      expect(mockOpenAI).not.toHaveBeenCalled();
      expect(result).toBe("抱歉，我暂时无法回答");
    });
  });

  describe("集成场景", () => {
    it("完整的聊天流程：初始化 -> 聊天 -> 返回结果", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue({
        apiKey: "test-key",
        baseURL: "https://api.test.com",
        model: "gpt-4",
      });
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      // 验证初始化成功
      expect(llmService.isAvailable()).toBe(true);

      // 执行聊天
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "这是回复" } }],
      });
      const result = await llmService.chat("你好");

      expect(result).toBe("这是回复");
    });

    it("配置更新后的热重载流程", async () => {
      // 1. 首次启动时配置无效
      mockConfigManager.getLLMConfig.mockReturnValue(null);
      mockConfigManager.isLLMConfigValid.mockReturnValue(false);

      llmService = new LLMService();
      expect(llmService.isAvailable()).toBe(false);

      // 2. 尝试聊天，返回错误
      const firstResult = await llmService.chat("第一次");
      expect(firstResult).toBe("抱歉，我暂时无法回答");

      // 3. 配置更新为有效
      mockConfigManager.getLLMConfig.mockReturnValue({
        apiKey: "updated-key",
        baseURL: "https://api.updated.com",
        model: "gpt-4-turbo",
      });
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      // 4. 再次聊天，应该自动初始化
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "已重新初始化" } }],
      });
      const secondResult = await llmService.chat("第二次");

      expect(secondResult).toBe("已重新初始化");
      expect(llmService.isAvailable()).toBe(true);
    });

    it("多次聊天应该使用同一个客户端实例", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue({
        apiKey: "test-key",
        baseURL: "https://api.test.com",
        model: "gpt-4",
      });
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();
      expect(mockOpenAI).toHaveBeenCalledTimes(1);

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "回复" } }],
      });

      await llmService.chat("问题1");
      await llmService.chat("问题2");
      await llmService.chat("问题3");

      // 客户端只初始化一次
      expect(mockOpenAI).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });

  describe("边界情况", () => {
    it("应该处理特殊字符消息", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue({
        apiKey: "test-key",
        baseURL: "https://api.test.com",
        model: "gpt-4",
      });
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "回复" } }],
      });

      const specialMessage = "你好\n特殊字符\t!@#$%^&*()";
      const result = await llmService.chat(specialMessage);

      expect(result).toBe("回复");
      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-4",
        messages: [
          { role: "system", content: "你是一个智能助手" },
          { role: "user", content: specialMessage },
        ],
      });
    });

    it("应该处理非常长的用户消息", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue({
        apiKey: "test-key",
        baseURL: "https://api.test.com",
        model: "gpt-4",
      });
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "回复" } }],
      });

      const longMessage = "a".repeat(10000);
      const result = await llmService.chat(longMessage);

      expect(result).toBe("回复");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[LLMService] LLM 调用成功，输入长度: 10000，输出长度: 2"
      );
    });

    it("应该处理空用户消息", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue({
        apiKey: "test-key",
        baseURL: "https://api.test.com",
        model: "gpt-4",
      });
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "请提供更多信息" } }],
      });

      const result = await llmService.chat("");

      expect(result).toBe("请提供更多信息");
    });

    it("应该处理 API 返回非标准格式", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue({
        apiKey: "test-key",
        baseURL: "https://api.test.com",
        model: "gpt-4",
      });
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      // 返回完全不同的格式
      mockCreate.mockResolvedValueOnce({});

      const result = await llmService.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
    });
  });
});
