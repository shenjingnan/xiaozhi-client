/**
 * TTS API Handler 测试
 * 测试语音合成 RESTful API 接口
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TTSApiHandler } from "../tts.handler.js";

// 模拟 TTS 类 - 必须在导入前声明
vi.mock("@xiaozhi-client/tts", () => ({
  TTS: vi.fn().mockImplementation(() => ({
    synthesize: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
  })),
}));

// 模拟 configManager - 必须在导入前声明
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getTTSConfig: vi.fn().mockReturnValue({
      appid: "default_appid",
      accessToken: "default_token",
      voice_type: "default_voice",
      cluster: "default_cluster",
      endpoint: "default_endpoint",
      encoding: "wav",
    }),
  },
}));

// 模拟 Logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// 模拟 fs
vi.mock("node:fs", () => ({
  default: {
    writeFileSync: vi.fn(),
  },
  writeFileSync: vi.fn(),
}));

describe("TTSApiHandler", () => {
  let ttsApiHandler: TTSApiHandler;
  // 使用 any 类型是务实的做法，用于测试 mock 对象
  let mockLogger: any;
  // 使用 any 类型是务实的做法，用于测试 mock 对象
  let mockContext: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 获取模拟的 Logger - 使用静态导入，mock 已经生效
    const { logger } = await import("../../Logger.js");
    mockLogger = logger;

    // 模拟 Hono 上下文
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

    ttsApiHandler = new TTSApiHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("应该正确初始化处理器实例", () => {
      expect(ttsApiHandler).toBeInstanceOf(TTSApiHandler);
    });
  });

  describe("synthesize", () => {
    describe("参数验证", () => {
      it("缺少 text 参数时应返回错误响应", async () => {
        mockContext.req.json.mockResolvedValue({});

        await ttsApiHandler.synthesize(mockContext);

        expect(mockLogger.warn).toHaveBeenCalledWith("缺少 text 参数");
        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少必需参数: text",
          undefined,
          400
        );
      });

      it("缺少 appid 参数时应返回错误响应（请求和配置都没有）", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
        });
        // 重置 mock 返回值
        const { configManager } = await import("@xiaozhi-client/config");
        vi.mocked(configManager.getTTSConfig).mockReturnValue({
          accessToken: "default_token",
          voice_type: "default_voice",
        });

        await ttsApiHandler.synthesize(mockContext);

        expect(mockLogger.warn).toHaveBeenCalledWith("缺少 appid 参数");
        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少 appid 参数，请提供或配置 tts.appid",
          undefined,
          400
        );
      });

      it("缺少 accessToken 参数时应返回错误响应", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test_appid",
        });
        const { configManager } = await import("@xiaozhi-client/config");
        vi.mocked(configManager.getTTSConfig).mockReturnValue({
          appid: "test_appid",
          voice_type: "default_voice",
        });

        await ttsApiHandler.synthesize(mockContext);

        expect(mockLogger.warn).toHaveBeenCalledWith("缺少 accessToken 参数");
        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少 accessToken 参数，请提供或配置 tts.accessToken",
          undefined,
          400
        );
      });

      it("缺少 voice_type 参数时应返回错误响应", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test_appid",
          accessToken: "test_token",
        });
        const { configManager } = await import("@xiaozhi-client/config");
        vi.mocked(configManager.getTTSConfig).mockReturnValue({
          appid: "test_appid",
          accessToken: "test_token",
        });

        await ttsApiHandler.synthesize(mockContext);

        expect(mockLogger.warn).toHaveBeenCalledWith("缺少 voice_type 参数");
        expect(mockContext.fail).toHaveBeenCalledWith(
          "MISSING_PARAMETER",
          "缺少 voice_type 参数，请提供或配置 tts.voice_type",
          undefined,
          400
        );
      });
    });

    describe("参数优先级", () => {
      it("请求参数应优先于配置默认值", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "request_appid",
          accessToken: "request_token",
          voice_type: "request_voice",
          encoding: "mp3",
        });
        const { configManager } = await import("@xiaozhi-client/config");
        vi.mocked(configManager.getTTSConfig).mockReturnValue({
          appid: "config_appid",
          accessToken: "config_token",
          voice_type: "config_voice",
          encoding: "wav",
        });

        await ttsApiHandler.synthesize(mockContext);

        // 验证 TTS 类使用请求参数初始化
        const { TTS } = await import("@xiaozhi-client/tts");
        expect(TTS).toHaveBeenCalledWith({
          bytedance: {
            v1: {
              app: {
                appid: "request_appid",
                accessToken: "request_token",
              },
              audio: {
                voice_type: "request_voice",
                encoding: "mp3",
              },
              cluster: undefined,
              endpoint: undefined,
            },
          },
        });
      });

      it("缺少请求参数时应使用配置默认值", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
        });
        const { configManager } = await import("@xiaozhi-client/config");
        vi.mocked(configManager.getTTSConfig).mockReturnValue({
          appid: "config_appid",
          accessToken: "config_token",
          voice_type: "config_voice",
          cluster: "config_cluster",
          endpoint: "config_endpoint",
          encoding: "ogg",
        });

        await ttsApiHandler.synthesize(mockContext);

        // 验证 TTS 类使用配置默认值初始化
        const { TTS } = await import("@xiaozhi-client/tts");
        expect(TTS).toHaveBeenCalledWith({
          bytedance: {
            v1: {
              app: {
                appid: "config_appid",
                accessToken: "config_token",
              },
              audio: {
                voice_type: "config_voice",
                encoding: "ogg",
              },
              cluster: "config_cluster",
              endpoint: "config_endpoint",
            },
          },
        });
      });

      it("encoding 参数默认值为 wav", async () => {
        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test_appid",
          accessToken: "test_token",
          voice_type: "test_voice",
        });
        const { configManager } = await import("@xiaozhi-client/config");
        vi.mocked(configManager.getTTSConfig).mockReturnValue({
          appid: "test_appid",
          accessToken: "test_token",
          voice_type: "test_voice",
        });

        await ttsApiHandler.synthesize(mockContext);

        const { TTS } = await import("@xiaozhi-client/tts");
        expect(TTS).toHaveBeenCalledWith({
          bytedance: {
            v1: {
              app: {
                appid: "test_appid",
                accessToken: "test_token",
              },
              audio: {
                voice_type: "test_voice",
                encoding: "wav",
              },
              cluster: undefined,
              endpoint: undefined,
            },
          },
        });
      });
    });

    describe("成功合成", () => {
      it("成功合成时应返回正确的音频响应", async () => {
        const mockAudioData = new Uint8Array([1, 2, 3, 4, 5]);
        const { TTS } = await import("@xiaozhi-client/tts");
        vi.mocked(TTS).mockImplementation(() => ({
          synthesize: vi.fn().mockResolvedValue(mockAudioData),
        }));

        mockContext.req.json.mockResolvedValue({
          text: "你好世界",
          appid: "test_appid",
          accessToken: "test_token",
          voice_type: "test_voice",
          encoding: "wav",
        });

        const response = await ttsApiHandler.synthesize(mockContext);

        expect(mockLogger.info).toHaveBeenCalledWith("处理语音合成请求");
        expect(mockLogger.info).toHaveBeenCalledWith(
          "开始语音合成: text=你好世界..., voice_type=test_voice"
        );
        expect(response.headers.get("Content-Type")).toBe("audio/wav");
        expect(response.headers.get("Content-Disposition")).toMatch(
          /attachment; filename="tts_\d+\.wav"/
        );
      });
    });

    describe("错误处理", () => {
      it("JSON 解析错误应正确处理", async () => {
        const jsonError = new Error("Invalid JSON");
        mockContext.req.json.mockRejectedValue(jsonError);

        await ttsApiHandler.synthesize(mockContext);

        expect(mockLogger.error).toHaveBeenCalled();
        expect(mockContext.fail).toHaveBeenCalledWith(
          "OPERATION_FAILED",
          "请求体格式错误: Invalid JSON",
          undefined,
          500
        );
      });

      it("TTS 客户端错误应正确处理", async () => {
        const ttsError = new Error("TTS connection failed");
        const { TTS } = await import("@xiaozhi-client/tts");
        vi.mocked(TTS).mockImplementation(() => ({
          synthesize: vi.fn().mockRejectedValue(ttsError),
        }));

        mockContext.req.json.mockResolvedValue({
          text: "测试文本",
          appid: "test_appid",
          accessToken: "test_token",
          voice_type: "test_voice",
        });

        await ttsApiHandler.synthesize(mockContext);

        expect(mockLogger.error).toHaveBeenCalledWith(
          "语音合成失败:",
          ttsError
        );
        expect(mockContext.fail).toHaveBeenCalledWith(
          "OPERATION_FAILED",
          "TTS connection failed",
          undefined,
          500
        );
      });
    });
  });

  describe("getVoices", () => {
    it("应成功返回音色列表", async () => {
      const response = await ttsApiHandler.getVoices(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith("获取音色列表");
      expect(mockContext.success).toHaveBeenCalled();

      // 验证返回的数据结构
      const successCall = mockContext.success.mock.calls[0];
      const responseData = successCall[0];

      expect(responseData).toHaveProperty("voices");
      expect(responseData).toHaveProperty("total");
      expect(responseData).toHaveProperty("scenes");
      expect(responseData.total).toBe(responseData.voices.length);
      expect(Array.isArray(responseData.scenes)).toBe(true);
    });

    it("返回的音色应包含必要字段", async () => {
      await ttsApiHandler.getVoices(mockContext);

      const successCall = mockContext.success.mock.calls[0];
      const responseData = successCall[0];

      // 验证第一个音色的结构
      const firstVoice = responseData.voices[0];
      expect(firstVoice).toHaveProperty("name");
      expect(firstVoice).toHaveProperty("voiceType");
      expect(firstVoice).toHaveProperty("scene");
      expect(firstVoice).toHaveProperty("language");
      expect(firstVoice).toHaveProperty("capabilities");
      expect(firstVoice).toHaveProperty("modelVersion");
    });

    it("scenes 应包含所有场景类型", async () => {
      await ttsApiHandler.getVoices(mockContext);

      const successCall = mockContext.success.mock.calls[0];
      const responseData = successCall[0];

      // 验证场景列表包含预期场景
      const expectedScenes = [
        "通用场景",
        "角色扮演",
        "视频配音",
        "教育场景",
        "客服场景",
        "有声阅读",
        "多语种",
      ];
      for (const scene of expectedScenes) {
        expect(responseData.scenes).toContain(scene);
      }
    });
  });
});