/**
 * TTS API HTTP 路由处理器测试
 * 测试语音合成 RESTful API 接口的参数验证、配置读取和 API 调用逻辑
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TTSApiHandler } from "../tts.handler.js";

// 模拟依赖
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// 模拟 univoice SDK - 在工厂函数内定义 mock
vi.mock("univoice", () => {
  const mockSynthesize = vi.fn();
  return {
    createTTS: vi.fn().mockReturnValue({
      synthesize: mockSynthesize,
    }),
    // 导出 mock 函数以便在测试中访问
    __mockSynthesize: mockSynthesize,
  };
});

// 模拟 configManager
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getTTSConfig: vi.fn(),
  },
}));

// 模拟 mapClusterToResourceId
vi.mock("@xiaozhi-client/esp32", () => ({
  mapClusterToResourceId: vi.fn((cluster?: string) =>
    cluster === "volcano_icl" ? "seed-tts-1.0" : "seed-tts-2.0"
  ),
}));

describe("TTSApiHandler", () => {
  let handler: TTSApiHandler;
  let mockContext: {
    get: ReturnType<typeof vi.fn>;
    success: ReturnType<typeof vi.fn>;
    fail: ReturnType<typeof vi.fn>;
    req: { json: ReturnType<typeof vi.fn> };
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let mockConfigManager: {
    getTTSConfig: ReturnType<typeof vi.fn>;
  };
  let mockSynthesize: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 模拟 Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // 模拟 ConfigManager
    mockConfigManager = {
      getTTSConfig: vi.fn().mockReturnValue({}),
    };
    const { configManager } = await import("@xiaozhi-client/config");
    Object.assign(configManager, mockConfigManager);

    // 获取 univoice mock
    const univoice = await import("univoice");
    mockSynthesize = (
      univoice as unknown as { __mockSynthesize: ReturnType<typeof vi.fn> }
    ).__mockSynthesize;

    // 模拟 Hono Context
    mockContext = {
      get: vi.fn((key: string) => {
        if (key === "logger") return mockLogger;
        return undefined;
      }),
      success: vi
        .fn()
        .mockImplementation((data: unknown, message?: string, status = 200) => {
          const response: {
            success: true;
            data?: unknown;
            message?: string;
          } = {
            success: true,
            message,
          };
          if (data !== undefined) {
            response.data = data;
          }
          return new Response(JSON.stringify(response), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }),
      fail: vi
        .fn()
        .mockImplementation(
          (code: string, message: string, details?: unknown, status = 400) => {
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

    handler = new TTSApiHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("应该正确初始化 TTSApiHandler", () => {
      expect(handler).toBeInstanceOf(TTSApiHandler);
    });
  });

  describe("synthesize", () => {
    describe("参数验证", () => {
      it("缺少 text 参数时应返回 400 错误", async () => {
        mockContext.req.json.mockResolvedValue({});
        mockConfigManager.getTTSConfig.mockReturnValue({});

        await handler.synthesize(mockContext);

        expect(mockLogger.warn).toHaveBeenCalledWith("缺少 text 参数");
        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少必需参数: text",
          undefined,
          400
        );
      });

      it("缺少 appid 参数时应返回 400 错误", async () => {
        mockContext.req.json.mockResolvedValue({ text: "测试文本" });
        mockConfigManager.getTTSConfig.mockReturnValue({});

        await handler.synthesize(mockContext);

        expect(mockLogger.warn).toHaveBeenCalledWith("缺少 appid 参数");
        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少 appid 参数，请提供或配置 tts.appid",
          undefined,
          400
        );
      });

      it("缺少 accessToken 参数时应返回 400 错误", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test-appid",
        });
        mockConfigManager.getTTSConfig.mockReturnValue({});

        await handler.synthesize(mockContext);

        expect(mockLogger.warn).toHaveBeenCalledWith("缺少 accessToken 参数");
        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少 accessToken 参数，请提供或配置 tts.accessToken",
          undefined,
          400
        );
      });

      it("缺少 voice_type 参数时应返回 400 错误", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test-appid",
          accessToken: "test-token",
        });
        mockConfigManager.getTTSConfig.mockReturnValue({});

        await handler.synthesize(mockContext);

        expect(mockLogger.warn).toHaveBeenCalledWith("缺少 voice_type 参数");
        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少 voice_type 参数，请提供或配置 tts.voice_type",
          undefined,
          400
        );
      });

      it("不支持的 encoding 参数时应返回错误", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test-appid",
          accessToken: "test-token",
          voice_type: "test-voice",
          encoding: "invalid_format",
        });
        mockConfigManager.getTTSConfig.mockReturnValue({});

        await handler.synthesize(mockContext);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          "不支持的 encoding 参数: invalid_format"
        );
        expect(mockContext.fail).toHaveBeenCalledWith(
          "INVALID_PARAMETER",
          expect.stringContaining("不支持的 encoding 参数: invalid_format"),
          undefined,
          400
        );
      });
    });

    describe("配置读取", () => {
      it("应该优先使用请求参数而非全局配置", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "request-appid",
          accessToken: "request-token",
          voice_type: "request-voice",
          encoding: "mp3",
        });
        mockConfigManager.getTTSConfig.mockReturnValue({
          appid: "config-appid",
          accessToken: "config-token",
          voice_type: "config-voice",
          encoding: "wav",
        });
        mockSynthesize.mockResolvedValue({
          audio: new Uint8Array([1, 2, 3]),
        });

        const { createTTS } = await import("univoice");
        await handler.synthesize(mockContext);

        expect(createTTS).toHaveBeenCalledWith(
          expect.objectContaining({
            appId: "request-appid",
            accessToken: "request-token",
            voice: "request-voice",
            format: "mp3",
          })
        );
      });

      it("请求参数缺失时应使用全局配置默认值", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
        });
        mockConfigManager.getTTSConfig.mockReturnValue({
          appid: "config-appid",
          accessToken: "config-token",
          voice_type: "config-voice",
          encoding: "ogg",
          cluster: "volcano_icl",
          endpoint: "https://custom.endpoint",
        });
        mockSynthesize.mockResolvedValue({
          audio: new Uint8Array([1, 2, 3]),
        });

        const { createTTS } = await import("univoice");
        await handler.synthesize(mockContext);

        expect(createTTS).toHaveBeenCalledWith(
          expect.objectContaining({
            appId: "config-appid",
            accessToken: "config-token",
            voice: "config-voice",
            format: "ogg",
            baseUrl: "https://custom.endpoint",
          })
        );
      });

      it("encoding 参数默认值应为 wav", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test-appid",
          accessToken: "test-token",
          voice_type: "test-voice",
        });
        mockConfigManager.getTTSConfig.mockReturnValue({});
        mockSynthesize.mockResolvedValue({
          audio: new Uint8Array([1, 2, 3]),
        });

        const { createTTS } = await import("univoice");
        await handler.synthesize(mockContext);

        expect(createTTS).toHaveBeenCalledWith(
          expect.objectContaining({
            format: "wav",
          })
        );
      });

      it("应该正确映射 cluster 参数到 resourceId", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test-appid",
          accessToken: "test-token",
          voice_type: "test-voice",
          cluster: "volcano_icl",
        });
        mockConfigManager.getTTSConfig.mockReturnValue({});
        mockSynthesize.mockResolvedValue({
          audio: new Uint8Array([1, 2, 3]),
        });

        const { createTTS } = await import("univoice");
        const { mapClusterToResourceId } = await import(
          "@xiaozhi-client/esp32"
        );
        await handler.synthesize(mockContext);

        expect(mapClusterToResourceId).toHaveBeenCalledWith("volcano_icl");
        expect(createTTS).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceId: "seed-tts-1.0",
          })
        );
      });
    });

    describe("TTS API 调用", () => {
      it("成功合成语音时应返回音频数据", async () => {
        const audioData = new Uint8Array([1, 2, 3, 4, 5]);
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test-appid",
          accessToken: "test-token",
          voice_type: "test-voice",
        });
        mockConfigManager.getTTSConfig.mockReturnValue({});
        mockSynthesize.mockResolvedValue({
          audio: audioData,
        });

        const response = await handler.synthesize(mockContext);

        expect(mockSynthesize).toHaveBeenCalledWith({
          text: "测试文本",
        });
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("开始语音合成")
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("语音合成成功")
        );
        expect(response).toBeInstanceOf(Response);
        expect(response.headers.get("Content-Type")).toBe("audio/wav");
      });

      it("应该返回正确的 MIME 类型（mp3）", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test-appid",
          accessToken: "test-token",
          voice_type: "test-voice",
          encoding: "mp3",
        });
        mockConfigManager.getTTSConfig.mockReturnValue({});
        mockSynthesize.mockResolvedValue({
          audio: new Uint8Array([1, 2, 3]),
        });

        const response = await handler.synthesize(mockContext);

        expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
      });

      it("应该返回正确的 MIME 类型（ogg_opus）", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test-appid",
          accessToken: "test-token",
          voice_type: "test-voice",
          encoding: "ogg_opus",
        });
        mockConfigManager.getTTSConfig.mockReturnValue({});
        mockSynthesize.mockResolvedValue({
          audio: new Uint8Array([1, 2, 3]),
        });

        const response = await handler.synthesize(mockContext);

        expect(response.headers.get("Content-Type")).toBe("audio/ogg");
      });

      it("应该返回正确的 Content-Disposition 头", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test-appid",
          accessToken: "test-token",
          voice_type: "test-voice",
          encoding: "flac",
        });
        mockConfigManager.getTTSConfig.mockReturnValue({});
        mockSynthesize.mockResolvedValue({
          audio: new Uint8Array([1, 2, 3]),
        });

        const response = await handler.synthesize(mockContext);

        expect(response.headers.get("Content-Disposition")).toContain(
          "attachment"
        );
        expect(response.headers.get("Content-Disposition")).toContain(".flac");
      });

      it("TTS API 调用失败时应正确处理错误", async () => {
        const error = new Error("TTS API error");
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test-appid",
          accessToken: "test-token",
          voice_type: "test-voice",
        });
        mockConfigManager.getTTSConfig.mockReturnValue({});
        mockSynthesize.mockRejectedValue(error);

        await handler.synthesize(mockContext);

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining("语音合成失败"),
          error
        );
        expect(mockContext.fail).toHaveBeenCalled();
      });

      it("应该处理非 Error 异常", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test-appid",
          accessToken: "test-token",
          voice_type: "test-voice",
        });
        mockConfigManager.getTTSConfig.mockReturnValue({});
        mockSynthesize.mockRejectedValue("String error");

        await handler.synthesize(mockContext);

        expect(mockContext.fail).toHaveBeenCalled();
      });
    });

    describe("支持的编码格式", () => {
      const encodings = [
        "mp3",
        "wav",
        "ogg",
        "flac",
        "pcm",
        "opus",
        "ogg_opus",
      ];

      it.each(encodings)("应该支持 %s 编码格式", async (encoding) => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test-appid",
          accessToken: "test-token",
          voice_type: "test-voice",
          encoding,
        });
        mockConfigManager.getTTSConfig.mockReturnValue({});
        mockSynthesize.mockResolvedValue({
          audio: new Uint8Array([1, 2, 3]),
        });

        const response = await handler.synthesize(mockContext);

        expect(mockContext.fail).not.toHaveBeenCalled();
        expect(response).toBeInstanceOf(Response);
      });
    });
  });

  describe("getVoices", () => {
    it("应该成功返回音色列表", async () => {
      await handler.getVoices(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith("获取音色列表");
      expect(mockContext.success).toHaveBeenCalledWith(
        expect.objectContaining({
          voices: expect.any(Array),
          total: expect.any(Number),
          scenes: expect.any(Array),
        })
      );
    });

    it("返回的音色列表应包含正确的结构", async () => {
      await handler.getVoices(mockContext);

      const callArgs = mockContext.success.mock.calls[0][0];
      expect(callArgs.voices.length).toBeGreaterThan(0);
      expect(callArgs.total).toBe(callArgs.voices.length);
      expect(callArgs.scenes.length).toBeGreaterThan(0);

      // 验证单个音色结构
      const firstVoice = callArgs.voices[0];
      expect(firstVoice).toHaveProperty("name");
      expect(firstVoice).toHaveProperty("voiceType");
      expect(firstVoice).toHaveProperty("scene");
      expect(firstVoice).toHaveProperty("language");
      expect(firstVoice).toHaveProperty("capabilities");
      expect(firstVoice).toHaveProperty("modelVersion");
    });
  });
});
