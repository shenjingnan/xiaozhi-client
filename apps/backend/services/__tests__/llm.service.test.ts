/**
 * LLM服务单元测试
 * 测试配置热更新功能
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 存储 mock 函数的引用，以便在测试中修改返回值
const mockGetLLMConfig = vi.fn();
const mockIsLLMConfigValid = vi.fn();

// Mock dependencies
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getLLMConfig: mockGetLLMConfig,
    isLLMConfigValid: mockIsLLMConfigValid,
  },
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: "测试回复" } }],
        }),
      },
    },
  })),
}));

describe("LLMService", () => {
  let LLMService: typeof import("../llm.service.js").LLMService;
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };

  const validConfig = {
    apiKey: "test-api-key",
    baseURL: "https://api.test.com/v1",
    model: "gpt-4",
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // 重置 mock 返回值
    mockGetLLMConfig.mockReset();
    mockIsLLMConfigValid.mockReset();

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // 动态导入 LLMService 以使用最新的 mock
    const module = await import("../llm.service.js");
    LLMService = module.LLMService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("初始化", () => {
    it("配置无效时 isAvailable() 应返回 false", () => {
      mockGetLLMConfig.mockReturnValue(null);
      mockIsLLMConfigValid.mockReturnValue(false);

      const service = new LLMService();

      expect(service.isAvailable()).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("LLM 配置未找到或无效")
      );
    });

    it("配置有效时应该正确初始化客户端", () => {
      mockGetLLMConfig.mockReturnValue(validConfig);
      mockIsLLMConfigValid.mockReturnValue(true);

      const service = new LLMService();

      expect(service.isAvailable()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("OpenAI 客户端已初始化")
      );
    });
  });

  describe("配置热更新", () => {
    it("配置从无效变为有效时应该重新初始化", async () => {
      // 初始状态：配置无效
      mockGetLLMConfig.mockReturnValue(null);
      mockIsLLMConfigValid.mockReturnValue(false);

      const service = new LLMService();
      expect(service.isAvailable()).toBe(false);

      // 清除初始化时的日志
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();

      // 更新配置为有效
      mockGetLLMConfig.mockReturnValue(validConfig);
      mockIsLLMConfigValid.mockReturnValue(true);

      // 调用 chat 触发重新初始化
      await service.chat("测试消息");

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("检测到配置更新，初始化客户端")
      );
      expect(service.isAvailable()).toBe(true);
    });

    it("apiKey 变更时应该重新初始化客户端", async () => {
      mockGetLLMConfig.mockReturnValue(validConfig);
      mockIsLLMConfigValid.mockReturnValue(true);

      const service = new LLMService();
      expect(service.isAvailable()).toBe(true);

      // 清除初始化时的日志
      mockLogger.info.mockClear();

      // 更新 apiKey
      const newConfig = {
        ...validConfig,
        apiKey: "new-api-key",
      };
      mockGetLLMConfig.mockReturnValue(newConfig);

      // 调用 chat 触发重新初始化
      await service.chat("测试消息");

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("检测到配置变更，重新初始化客户端")
      );
    });

    it("baseURL 变更时应该重新初始化客户端", async () => {
      mockGetLLMConfig.mockReturnValue(validConfig);
      mockIsLLMConfigValid.mockReturnValue(true);

      const service = new LLMService();
      expect(service.isAvailable()).toBe(true);

      // 清除初始化时的日志
      mockLogger.info.mockClear();

      // 更新 baseURL
      const newConfig = {
        ...validConfig,
        baseURL: "https://new-api.test.com/v1",
      };
      mockGetLLMConfig.mockReturnValue(newConfig);

      // 调用 chat 触发重新初始化
      await service.chat("测试消息");

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("检测到配置变更，重新初始化客户端")
      );
    });

    it("model 变更时应该重新初始化客户端", async () => {
      mockGetLLMConfig.mockReturnValue(validConfig);
      mockIsLLMConfigValid.mockReturnValue(true);

      const service = new LLMService();
      expect(service.isAvailable()).toBe(true);

      // 清除初始化时的日志
      mockLogger.info.mockClear();

      // 更新 model
      const newConfig = {
        ...validConfig,
        model: "gpt-4o",
      };
      mockGetLLMConfig.mockReturnValue(newConfig);

      // 调用 chat 触发重新初始化
      await service.chat("测试消息");

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("检测到配置变更，重新初始化客户端")
      );
    });

    it("配置未变更时不应重复初始化", async () => {
      mockGetLLMConfig.mockReturnValue(validConfig);
      mockIsLLMConfigValid.mockReturnValue(true);

      const service = new LLMService();
      expect(service.isAvailable()).toBe(true);

      // 清除初始化时的日志
      mockLogger.info.mockClear();

      // 配置未变更
      mockGetLLMConfig.mockReturnValue(validConfig);

      // 调用 chat
      await service.chat("测试消息");

      // 不应该有重新初始化的日志
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining("检测到配置变更")
      );
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining("检测到配置更新，初始化客户端")
      );
    });

    it("多次调用 chat 时配置未变更应只初始化一次", async () => {
      mockGetLLMConfig.mockReturnValue(validConfig);
      mockIsLLMConfigValid.mockReturnValue(true);

      const service = new LLMService();

      // 清除初始化时的日志
      mockLogger.info.mockClear();

      // 多次调用 chat，配置不变
      await service.chat("消息1");
      await service.chat("消息2");
      await service.chat("消息3");

      // 不应该有重新初始化的日志
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining("检测到配置变更")
      );
    });
  });

  describe("chat 方法", () => {
    it("客户端未初始化时应返回错误提示", async () => {
      mockGetLLMConfig.mockReturnValue(null);
      mockIsLLMConfigValid.mockReturnValue(false);

      const service = new LLMService();
      const response = await service.chat("测试消息");

      expect(response).toBe("抱歉，我暂时无法回答");
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("LLM 客户端未初始化")
      );
    });
  });
});
