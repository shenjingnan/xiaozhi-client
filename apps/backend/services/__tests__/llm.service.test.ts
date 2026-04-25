import type { LLMConfig } from "@xiaozhi-client/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LLMService } from "../llm.service.js";

// Mock OpenAI - module level
const mockCreate = vi.fn();
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

// Mock Logger
vi.mock("@/Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock ConfigManager
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getLLMConfig: vi.fn(),
    isLLMConfigValid: vi.fn(),
  },
}));

// Mock resolvePrompt
vi.mock("@/utils/prompt-utils.js", () => ({
  resolvePrompt: vi.fn(),
}));

describe("LLMService", () => {
  let llmService: LLMService;
  let mockLogger: ReturnType<typeof import("../../Logger.js").logger>;
  let mockConfigManager: ReturnType<
    typeof import("@xiaozhi-client/config").configManager
  >;
  let mockResolvePrompt: ReturnType<
    typeof import("../../utils/prompt-utils.js").resolvePrompt
  >;
  let MockOpenAI: ReturnType<typeof import("openai").default>;

  const validConfig: LLMConfig = {
    model: "gpt-4",
    apiKey: "test-api-key",
    baseURL: "https://api.openai.com/v1",
    prompt: "自定义提示词",
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // 重置 mock 默认值
    mockCreate.mockReset();

    // 导入 mock 模块
    const { logger } = await import("../../Logger.js");
    mockLogger = logger;

    const { configManager } = await import("@xiaozhi-client/config");
    mockConfigManager = configManager;

    const { resolvePrompt } = await import("../../utils/prompt-utils.js");
    mockResolvePrompt = resolvePrompt;
    mockResolvePrompt.mockReturnValue("默认系统提示词");

    const OpenAI = await import("openai").then((m) => m.default);
    MockOpenAI = OpenAI;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("构造函数和初始化", () => {
    it("应该在没有有效配置时跳过客户端初始化", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(null);
      mockConfigManager.isLLMConfigValid.mockReturnValue(false);

      llmService = new LLMService();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[LLMService] LLM 配置未找到或无效，请检查配置文件中的 llm 配置项"
      );
      expect(MockOpenAI).not.toHaveBeenCalled();
      expect(llmService.isAvailable()).toBe(false);
    });

    it("应该在配置有效时正确初始化 OpenAI 客户端", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      expect(MockOpenAI).toHaveBeenCalledWith({
        apiKey: validConfig.apiKey,
        baseURL: validConfig.baseURL,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[LLMService] OpenAI 客户端已初始化，模型: ${validConfig.model}`
      );
      expect(llmService.isAvailable()).toBe(true);
    });

    it("应该在配置对象存在但无效时跳过初始化", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue({
        model: "",
        apiKey: "",
        baseURL: "",
      });
      mockConfigManager.isLLMConfigValid.mockReturnValue(false);

      llmService = new LLMService();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[LLMService] LLM 配置未找到或无效，请检查配置文件中的 llm 配置项"
      );
      expect(MockOpenAI).not.toHaveBeenCalled();
    });
  });

  describe("isAvailable", () => {
    it("应该返回 true 当客户端已初始化", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      expect(llmService.isAvailable()).toBe(true);
    });

    it("应该返回 false 当客户端未初始化", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(null);
      mockConfigManager.isLLMConfigValid.mockReturnValue(false);

      llmService = new LLMService();

      expect(llmService.isAvailable()).toBe(false);
    });
  });

  describe("chat", () => {
    it("应该在客户端未初始化时返回默认消息", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(null);
      mockConfigManager.isLLMConfigValid.mockReturnValue(false);

      llmService = new LLMService();

      const result = await llmService.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[LLMService] LLM 客户端未初始化"
      );
    });

    it("应该成功调用 LLM API 并返回内容", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);
      mockResolvePrompt.mockReturnValue("系统提示词");

      llmService = new LLMService();

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "这是回复内容",
            },
          },
        ],
      });

      const result = await llmService.chat("你好");

      expect(result).toBe("这是回复内容");
      expect(mockCreate).toHaveBeenCalledWith({
        model: validConfig.model,
        messages: [
          { role: "system", content: "系统提示词" },
          { role: "user", content: "你好" },
        ],
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("[LLMService] LLM 调用成功")
      );
    });

    it("应该处理 API 调用失败", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      mockCreate.mockRejectedValue(new Error("API 调用失败"));

      const result = await llmService.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[LLMService] LLM 调用失败:",
        expect.any(Error)
      );
    });

    it("应该处理空响应内容", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "",
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

    it("应该处理响应中没有 choices 的情况", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      mockCreate.mockResolvedValue({
        choices: [],
      });

      const result = await llmService.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[LLMService] LLM 返回空内容"
      );
    });

    it("应该处理响应中没有 message 的情况", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      mockCreate.mockResolvedValue({
        choices: [{}],
      });

      const result = await llmService.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
    });

    it("应该使用配置中的提示词", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);
      mockResolvePrompt.mockReturnValue("自定义系统提示词");

      llmService = new LLMService();

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "回复",
            },
          },
        ],
      });

      await llmService.chat("你好");

      expect(mockResolvePrompt).toHaveBeenCalledWith(validConfig.prompt);
      expect(mockCreate).toHaveBeenCalledWith({
        model: validConfig.model,
        messages: [
          { role: "system", content: "自定义系统提示词" },
          { role: "user", content: "你好" },
        ],
      });
    });
  });

  describe("reinitClient", () => {
    it("应该支持配置热更新", async () => {
      // 首次初始化失败
      mockConfigManager.getLLMConfig.mockReturnValue(null);
      mockConfigManager.isLLMConfigValid.mockReturnValue(false);

      llmService = new LLMService();

      expect(llmService.isAvailable()).toBe(false);

      // 配置更新后变得有效
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "回复",
            },
          },
        ],
      });

      // 通过 chat 触发重新初始化
      const result = await llmService.chat("你好");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[LLMService] 检测到配置更新，重新初始化客户端"
      );
      expect(MockOpenAI).toHaveBeenCalled();
      expect(llmService.isAvailable()).toBe(true);
      expect(result).toBe("回复");
    });

    it("应该在客户端已存在时不重新初始化", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      // 清除初始化时的调用记录
      vi.clearAllMocks();

      // 再次调用 chat
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "回复",
            },
          },
        ],
      });

      await llmService.chat("你好");

      // 不应该重新初始化
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        "[LLMService] 检测到配置更新，重新初始化客户端"
      );
    });

    it("应该在配置无效时不尝试重新初始化", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(null);
      mockConfigManager.isLLMConfigValid.mockReturnValue(false);

      llmService = new LLMService();

      // 清除初始化时的调用记录
      vi.clearAllMocks();

      // 调用 chat 时配置仍然无效
      const result = await llmService.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        "[LLMService] 检测到配置更新，重新初始化客户端"
      );
    });
  });

  describe("边界情况和异常处理", () => {
    it("应该处理非常长的用户输入", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      const longInput = "你好".repeat(10000);

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "回复",
            },
          },
        ],
      });

      const result = await llmService.chat(longInput);

      expect(result).toBe("回复");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[LLMService] LLM 调用成功，输入长度: ${longInput.length}，输出长度: 2`
      );
    });

    it("应该处理包含特殊字符的用户输入", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      const specialInput = "你好\n\t特殊字符: @#$%^&*()";

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "回复",
            },
          },
        ],
      });

      const result = await llmService.chat(specialInput);

      expect(result).toBe("回复");
      expect(mockCreate).toHaveBeenCalledWith({
        model: validConfig.model,
        messages: [
          { role: "system", content: expect.any(String) },
          { role: "user", content: specialInput },
        ],
      });
    });

    it("应该处理网络超时错误", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      mockCreate.mockRejectedValue(new Error("Network timeout"));

      const result = await llmService.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[LLMService] LLM 调用失败:",
        expect.any(Error)
      );
    });

    it("应该处理 API 返回非字符串内容", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      mockCreate.mockResolvedValue({
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
    });

    it("应该处理 API 返回 undefined choices", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      mockCreate.mockResolvedValue({});

      const result = await llmService.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
    });

    it("应该处理 resolvePrompt 返回空字符串", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);
      mockResolvePrompt.mockReturnValue("");

      llmService = new LLMService();

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "回复",
            },
          },
        ],
      });

      await llmService.chat("你好");

      expect(mockCreate).toHaveBeenCalledWith({
        model: validConfig.model,
        messages: [
          { role: "system", content: "" },
          { role: "user", content: "你好" },
        ],
      });
    });
  });

  describe("集成场景", () => {
    it("应该处理完整的对话流程", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "你好！有什么我可以帮助你的吗？",
            },
          },
        ],
      });

      const result = await llmService.chat("你好");

      expect(result).toBe("你好！有什么我可以帮助你的吗？");
      expect(llmService.isAvailable()).toBe(true);
    });

    it("应该处理从无效配置到有效配置的转换", async () => {
      // 初始状态：配置无效
      mockConfigManager.getLLMConfig.mockReturnValue(null);
      mockConfigManager.isLLMConfigValid.mockReturnValue(false);

      llmService = new LLMService();

      expect(llmService.isAvailable()).toBe(false);

      // 配置更新
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "回复",
            },
          },
        ],
      });

      // 通过 chat 自动重新初始化
      const result = await llmService.chat("你好");

      expect(result).toBe("回复");
      expect(llmService.isAvailable()).toBe(true);
    });

    it("应该处理多次连续的聊天请求", async () => {
      mockConfigManager.getLLMConfig.mockReturnValue(validConfig);
      mockConfigManager.isLLMConfigValid.mockReturnValue(true);

      llmService = new LLMService();

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "回复",
            },
          },
        ],
      });

      // 连续多次请求
      await llmService.chat("问题1");
      await llmService.chat("问题2");
      await llmService.chat("问题3");

      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });
});
