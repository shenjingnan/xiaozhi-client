/**
 * TTS API 处理器集成测试
 * 测试语音合成 RESTful API 接口
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TTSApiHandler } from "../tts.handler.js";

// Mock 依赖项
vi.mock("@/Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock @xiaozhi-client/config
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getTTSConfig: vi.fn().mockReturnValue({
      appid: "test-appid",
      accessToken: "test-access-token",
      voice_type: "zh_female_shuangkuaisisi_moon_bigtts",
      encoding: "wav",
      cluster: "volcano_tts",
      endpoint: "wss://test.example.com",
    }),
  },
}));

// Mock node:fs
vi.mock("node:fs", () => ({
  default: {
    writeFileSync: vi.fn(),
  },
}));

// Mock @xiaozhi-client/tts
const mockTTS = {
  synthesize: vi
    .fn()
    .mockResolvedValue(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04])),
};

vi.mock("@xiaozhi-client/tts", () => ({
  TTS: vi.fn().mockImplementation(() => mockTTS),
}));

describe("TTSApiHandler", () => {
  let ttsApiHandler: TTSApiHandler;
  let mockLogger: any;
  let mockContext: any;
  let mockConfigManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("@/Logger.js");
    Object.assign(logger, mockLogger);

    // Mock ConfigManager
    mockConfigManager = {
      getTTSConfig: vi.fn().mockReturnValue({
        appid: "test-appid",
        accessToken: "test-access-token",
        voice_type: "test-voice-type",
        encoding: "wav",
        cluster: "volcano_tts",
        endpoint: "wss://test.example.com",
      }),
    };
    const { configManager } = await import("@xiaozhi-client/config");
    Object.assign(configManager, mockConfigManager);

    // 模拟 Hono 上下文
    mockContext = {
      get: vi.fn((key: string) => {
        if (key === "logger") return mockLogger;
        return undefined;
      }),
      success: vi.fn().mockImplementation((data: unknown, message?: string) => {
        return new Response(
          JSON.stringify({
            success: true,
            data,
            message,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }),
      fail: vi
        .fn()
        .mockImplementation(
          (code: string, message: string, details?: any, status = 400) => {
            return new Response(
              JSON.stringify({
                success: false,
                error: {
                  code,
                  message,
                  ...(details !== undefined && { details }),
                },
              }),
              {
                status,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        ),
      req: {
        json: vi.fn(),
      },
    };

    ttsApiHandler = new TTSApiHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("应该使用正确的依赖项初始化", () => {
      expect(ttsApiHandler).toBeInstanceOf(TTSApiHandler);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("synthesize", () => {
    describe("参数验证", () => {
      it("应该在缺少 text 参数时返回错误", async () => {
        const invalidBody = {
          appid: "test-appid",
        };
        mockContext.req.json.mockResolvedValue(invalidBody);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("缺少 text 参数")
        );
        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少必需参数: text",
          undefined,
          400
        );
      });

      it("应该在 text 为 null 时返回错误", async () => {
        const invalidBody = {
          text: null,
        };
        mockContext.req.json.mockResolvedValue(invalidBody);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少必需参数: text",
          undefined,
          400
        );
      });

      it("应该在 text 为 undefined 时返回错误", async () => {
        const invalidBody = {};
        mockContext.req.json.mockResolvedValue(invalidBody);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少必需参数: text",
          undefined,
          400
        );
      });

      it("应该在空字符串时返回错误", async () => {
        const emptyBody = {
          text: "",
        };
        mockContext.req.json.mockResolvedValue(emptyBody);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少必需参数: text",
          undefined,
          400
        );
      });

      it("应该在缺少 appid 时返回错误", async () => {
        mockConfigManager.getTTSConfig.mockReturnValue({
          appid: "",
          accessToken: "test-access-token",
          voice_type: "test-voice",
        });

        const body = {
          text: "测试文本",
        };
        mockContext.req.json.mockResolvedValue(body);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("缺少 appid 参数")
        );
        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少 appid 参数，请提供或配置 tts.appid",
          undefined,
          400
        );
      });

      it("应该在缺少 accessToken 时返回错误", async () => {
        mockConfigManager.getTTSConfig.mockReturnValue({
          appid: "test-appid",
          accessToken: "",
          voice_type: "test-voice",
        });

        const body = {
          text: "测试文本",
        };
        mockContext.req.json.mockResolvedValue(body);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("缺少 accessToken 参数")
        );
        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少 accessToken 参数，请提供或配置 tts.accessToken",
          undefined,
          400
        );
      });

      it("应该在缺少 voice_type 时返回错误", async () => {
        mockConfigManager.getTTSConfig.mockReturnValue({
          appid: "test-appid",
          accessToken: "test-access-token",
          voice_type: "",
        });

        const body = {
          text: "测试文本",
        };
        mockContext.req.json.mockResolvedValue(body);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("缺少 voice_type 参数")
        );
        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少 voice_type 参数，请提供或配置 tts.voice_type",
          undefined,
          400
        );
      });
    });

    describe("JSON 解析错误", () => {
      it("应该处理无效的 JSON 请求体", async () => {
        const jsonError = new Error("Unexpected token");
        mockContext.req.json.mockRejectedValue(jsonError);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(mockLogger.error).toHaveBeenCalledWith(
          "语音合成失败:",
          expect.any(Error)
        );
        expect(mockContext.fail).toHaveBeenCalledWith(
          "OPERATION_FAILED",
          "请求体格式错误: Unexpected token",
          undefined,
          500
        );
      });

      it("应该处理空请求体", async () => {
        mockContext.req.json.mockResolvedValue(null);

        const response = await ttsApiHandler.synthesize(mockContext);

        // null 会导致 TypeError: Cannot read properties of null (reading 'text')
        expect(mockContext.fail).toHaveBeenCalledWith(
          "OPERATION_FAILED",
          "Cannot read properties of null (reading 'text')",
          undefined,
          500
        );
      });
    });

    describe("成功场景", () => {
      it("应该成功处理基本语音合成请求", async () => {
        const validBody = {
          text: "你好，这是测试文本",
        };
        mockContext.req.json.mockResolvedValue(validBody);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(mockLogger.info).toHaveBeenCalledWith("处理语音合成请求");
        expect(response).toBeInstanceOf(Response);
      });

      it("应该正确处理带自定义参数的请求", async () => {
        const customBody = {
          text: "自定义文本",
          appid: "custom-appid",
          accessToken: "custom-token",
          voice_type: "custom-voice",
          encoding: "mp3",
        };
        mockContext.req.json.mockResolvedValue(customBody);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(response).toBeInstanceOf(Response);
      });

      it("应该处理包含特殊字符的文本", async () => {
        const specialBody = {
          text: "测试 @#$%^&*() 特殊字符",
        };
        mockContext.req.json.mockResolvedValue(specialBody);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(response).toBeInstanceOf(Response);
      });

      it("应该处理非常长的文本", async () => {
        const longBody = {
          text: "测试文本".repeat(1000),
        };
        mockContext.req.json.mockResolvedValue(longBody);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(response).toBeInstanceOf(Response);
      });

      it("应该处理包含换行符的文本", async () => {
        const multilineBody = {
          text: "第一行\n第二行\n第三行",
        };
        mockContext.req.json.mockResolvedValue(multilineBody);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(response).toBeInstanceOf(Response);
      });

      it("应该处理包含表情符号的文本", async () => {
        const emojiBody = {
          text: "你好 😊 这是一个测试 🎉",
        };
        mockContext.req.json.mockResolvedValue(emojiBody);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(response).toBeInstanceOf(Response);
      });

      it("应该处理只有空格的文本", async () => {
        const spacesBody = {
          text: "   ",
        };
        mockContext.req.json.mockResolvedValue(spacesBody);

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(response).toBeInstanceOf(Response);
      });
    });
  });

  describe("日志记录", () => {
    it("应该记录处理开始", async () => {
      mockContext.req.json.mockResolvedValue({ text: "测试" });

      await ttsApiHandler.synthesize(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith("处理语音合成请求");
    });
  });

  describe("集成场景", () => {
    it("应该处理完整的语音合成流程", async () => {
      const requestBody = {
        text: "完整的测试流程",
      };
      mockContext.req.json.mockResolvedValue(requestBody);

      const response = await ttsApiHandler.synthesize(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith("处理语音合成请求");
      expect(response).toBeInstanceOf(Response);
    });

    it("应该处理带所有可选参数的请求", async () => {
      const fullRequest = {
        text: "完整参数测试",
        appid: "custom-appid",
        accessToken: "custom-token",
        voice_type: "custom-voice",
        encoding: "mp3",
        cluster: "custom-cluster",
        endpoint: "wss://custom.endpoint.com",
      };
      mockContext.req.json.mockResolvedValue(fullRequest);

      const response = await ttsApiHandler.synthesize(mockContext);

      expect(response).toBeInstanceOf(Response);
    });
  });
});
