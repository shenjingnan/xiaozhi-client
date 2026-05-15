import { TTS_VOICES, getVoiceScenes } from "@/constants/voices.js";
import type { VoiceInfo } from "@xiaozhi-client/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TTSApiHandler } from "../tts.handler.js";

// 模拟 fs 模块
vi.mock("node:fs", () => ({
  default: {
    writeFileSync: vi.fn(),
  },
}));

// 模拟 TTS 类
vi.mock("@xiaozhi-client/tts", () => ({
  TTS: vi.fn().mockImplementation(() => ({
    synthesize: vi.fn(),
  })),
}));

// 模拟 configManager
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getTTSConfig: vi.fn(),
  },
}));

describe("TTSApiHandler", () => {
  let handler: TTSApiHandler;
  let mockContext: any;
  let mockTTS: any;
  let mockWriteFileSync: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 模拟 TTS 类
    const { TTS } = await import("@xiaozhi-client/tts");
    mockTTS = {
      synthesize: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
    };
    vi.mocked(TTS).mockImplementation(() => mockTTS);

    // 模拟 fs.writeFileSync
    const fs = await import("node:fs");
    mockWriteFileSync = vi.fn();
    vi.mocked(fs.default.writeFileSync).mockImplementation(mockWriteFileSync);

    // 模拟 configManager.getTTSConfig
    const { configManager } = await import("@xiaozhi-client/config");
    vi.mocked(configManager.getTTSConfig).mockReturnValue({
      appid: "test-appid",
      accessToken: "test-token",
      voice_type: "zh_female_vv_uranus_bigtts",
      encoding: "wav",
      cluster: "default",
      endpoint: "wss://test.example.com",
    });

    handler = new TTSApiHandler();

    // 创建模拟上下文
    mockContext = {
      get: vi.fn((key: string) => {
        if (key === "logger") {
          return {
            debug: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
          };
        }
        return undefined;
      }),
      json: vi.fn().mockImplementation((data, status) => {
        return new Response(JSON.stringify(data), {
          status: status || 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
      success: vi.fn().mockImplementation((data, message, status = 200) => {
        const response: {
          success: true;
          data?: unknown;
          message?: string;
        } = { success: true };
        if (data !== undefined) {
          response.data = data;
        }
        if (message) {
          response.message = message;
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
            const response = {
              success: false,
              error: { code, message },
            };
            if (details !== undefined) {
              (
                response.error as {
                  code: string;
                  message: string;
                  details: unknown;
                }
              ).details = details;
            }
            return new Response(JSON.stringify(response), {
              status,
              headers: { "Content-Type": "application/json" },
            });
          }
        ),
      req: {
        json: vi.fn(),
      },
    };
  });

  describe("constructor", () => {
    it("应该成功初始化 TTSApiHandler", () => {
      expect(handler).toBeInstanceOf(TTSApiHandler);
    });
  });

  describe("synthesize", () => {
    it("应该成功合成语音", async () => {
      const requestBody = {
        text: "测试文本",
      };
      mockContext.req.json.mockResolvedValue(requestBody);
      const audioData = new Uint8Array([1, 2, 3, 4, 5]);
      mockTTS.synthesize.mockResolvedValue(audioData);

      const response = await handler.synthesize(mockContext);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("audio/wav");
      expect(response.headers.get("Content-Disposition")).toMatch(
        /tts_\d+\.wav/
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        "audio.wav",
        Buffer.from(audioData)
      );
    });

    it("应该支持自定义编码格式", async () => {
      const requestBody = {
        text: "测试文本",
        encoding: "mp3",
      };
      mockContext.req.json.mockResolvedValue(requestBody);
      const audioData = new Uint8Array([1, 2, 3]);
      mockTTS.synthesize.mockResolvedValue(audioData);

      const response = await handler.synthesize(mockContext);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("audio/mp3");
    });

    it("应该支持请求参数覆盖配置", async () => {
      const requestBody = {
        text: "测试文本",
        appid: "custom-appid",
        accessToken: "custom-token",
        voice_type: "zh_male_taocheng_uranus_bigtts",
      };
      mockContext.req.json.mockResolvedValue(requestBody);
      mockTTS.synthesize.mockResolvedValue(new Uint8Array([1, 2, 3]));

      await handler.synthesize(mockContext);

      const { TTS } = await import("@xiaozhi-client/tts");
      expect(TTS).toHaveBeenCalledWith(
        expect.objectContaining({
          bytedance: expect.objectContaining({
            v1: expect.objectContaining({
              app: expect.objectContaining({
                appid: "custom-appid",
                accessToken: "custom-token",
              }),
              audio: expect.objectContaining({
                voice_type: "zh_male_taocheng_uranus_bigtts",
              }),
            }),
          }),
        })
      );
    });

    it("应该在缺少 text 参数时返回 400 错误", async () => {
      const requestBody = {};
      mockContext.req.json.mockResolvedValue(requestBody);

      const response = await handler.synthesize(mockContext);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe("MISSING_PARAMETER");
      expect(responseData.error.message).toContain("缺少必需参数: text");
    });

    it("应该在缺少 appid 时返回 400 错误", async () => {
      const requestBody = { text: "测试文本" };
      mockContext.req.json.mockResolvedValue(requestBody);

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getTTSConfig).mockReturnValue({
        accessToken: "test-token",
        voice_type: "zh_female_vv_uranus_bigtts",
      });

      const response = await handler.synthesize(mockContext);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe("MISSING_PARAMETER");
      expect(responseData.error.message).toContain("缺少 appid 参数");
    });

    it("应该在缺少 accessToken 时返回 400 错误", async () => {
      const requestBody = { text: "测试文本" };
      mockContext.req.json.mockResolvedValue(requestBody);

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getTTSConfig).mockReturnValue({
        appid: "test-appid",
        voice_type: "zh_female_vv_uranus_bigtts",
      });

      const response = await handler.synthesize(mockContext);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe("MISSING_PARAMETER");
      expect(responseData.error.message).toContain("缺少 accessToken 参数");
    });

    it("应该在缺少 voice_type 时返回 400 错误", async () => {
      const requestBody = { text: "测试文本" };
      mockContext.req.json.mockResolvedValue(requestBody);

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getTTSConfig).mockReturnValue({
        appid: "test-appid",
        accessToken: "test-token",
      });

      const response = await handler.synthesize(mockContext);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe("MISSING_PARAMETER");
      expect(responseData.error.message).toContain("缺少 voice_type 参数");
    });

    it("应该处理 JSON 解析失败", async () => {
      mockContext.req.json.mockRejectedValue(new Error("JSON 解析失败"));

      const response = await handler.synthesize(mockContext);

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
    });

    it("应该处理 TTS 合成失败", async () => {
      const requestBody = { text: "测试文本" };
      mockContext.req.json.mockResolvedValue(requestBody);
      mockTTS.synthesize.mockRejectedValue(new Error("TTS 合成失败"));

      const response = await handler.synthesize(mockContext);

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toBe("TTS 合成失败");
    });

    it("应该处理非 Error 类型的异常", async () => {
      const requestBody = { text: "测试文本" };
      mockContext.req.json.mockResolvedValue(requestBody);
      mockTTS.synthesize.mockRejectedValue("字符串错误");

      const response = await handler.synthesize(mockContext);

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toBe("字符串错误");
    });
  });

  describe("getVoices", () => {
    it("应该成功获取语音列表", async () => {
      const response = await handler.getVoices(mockContext);

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data.voices).toBeInstanceOf(Array);
      expect(responseData.data.total).toBe(TTS_VOICES.length);
      expect(responseData.data.scenes).toBeInstanceOf(Array);
    });

    it("应该返回正确的语音信息结构", async () => {
      const response = await handler.getVoices(mockContext);
      const responseData = await response.json();

      expect(responseData.data.voices.length).toBeGreaterThan(0);
      const firstVoice: VoiceInfo = responseData.data.voices[0];
      expect(firstVoice).toHaveProperty("name");
      expect(firstVoice).toHaveProperty("voiceType");
      expect(firstVoice).toHaveProperty("scene");
      expect(firstVoice).toHaveProperty("language");
      expect(firstVoice).toHaveProperty("capabilities");
      expect(firstVoice).toHaveProperty("modelVersion");
    });

    it("应该返回所有场景列表", async () => {
      const response = await handler.getVoices(mockContext);
      const responseData = await response.json();

      const expectedScenes = getVoiceScenes();
      expect(responseData.data.scenes).toEqual(expectedScenes);
      expect(responseData.data.scenes).toContain("通用场景");
      expect(responseData.data.scenes).toContain("角色扮演");
    });

    it("应该按预期返回语音总数", async () => {
      const response = await handler.getVoices(mockContext);
      const responseData = await response.json();

      expect(responseData.data.total).toBe(TTS_VOICES.length);
      expect(responseData.data.voices.length).toBe(TTS_VOICES.length);
    });

    it("应该包含预期的语音类型", async () => {
      const response = await handler.getVoices(mockContext);
      const responseData = await response.json();
      const voices: VoiceInfo[] = responseData.data.voices;

      const voiceTypes = voices.map((v) => v.voiceType);
      expect(voiceTypes).toContain("zh_female_vv_uranus_bigtts");
      expect(voiceTypes).toContain("zh_male_taocheng_uranus_bigtts");
    });

    it("应该处理错误情况", async () => {
      // 模拟 getVoiceScenes 抛出错误
      const voicesModule = await import("@/constants/voices.js");
      const mockGetVoiceScenes = vi
        .spyOn(voicesModule, "getVoiceScenes")
        .mockImplementation(() => {
          throw new Error("获取场景失败");
        });

      const response = await handler.getVoices(mockContext);

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);

      // 恢复原始实现
      mockGetVoiceScenes.mockRestore();
    });
  });

  describe("边界场景和集成测试", () => {
    it("应该处理空文本参数", async () => {
      const requestBody = { text: "" };
      mockContext.req.json.mockResolvedValue(requestBody);

      const response = await handler.synthesize(mockContext);

      // 空字符串是 falsy 值，应该返回 400 错误
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe("MISSING_PARAMETER");
    });

    it("应该处理非常长的文本", async () => {
      const longText = "A".repeat(10000);
      const requestBody = { text: longText };
      mockContext.req.json.mockResolvedValue(requestBody);
      mockTTS.synthesize.mockResolvedValue(new Uint8Array([1, 2, 3]));

      const response = await handler.synthesize(mockContext);

      expect(response.status).toBe(200);
      expect(mockTTS.synthesize).toHaveBeenCalledWith(longText);
    });

    it("应该处理特殊字符", async () => {
      const specialText = "测试！@#$%^&*()_+{}|:\"<>?~`-=[]\\;',./";
      const requestBody = { text: specialText };
      mockContext.req.json.mockResolvedValue(requestBody);
      mockTTS.synthesize.mockResolvedValue(new Uint8Array([1, 2, 3]));

      const response = await handler.synthesize(mockContext);

      expect(response.status).toBe(200);
    });

    it("应该处理多语言文本", async () => {
      const multiLangText = "Hello 世界 こんにちは 안녕하세요";
      const requestBody = { text: multiLangText };
      mockContext.req.json.mockResolvedValue(requestBody);
      mockTTS.synthesize.mockResolvedValue(new Uint8Array([1, 2, 3]));

      const response = await handler.synthesize(mockContext);

      expect(response.status).toBe(200);
    });

    it("应该正确处理音频数据为空的情况", async () => {
      const requestBody = { text: "测试文本" };
      mockContext.req.json.mockResolvedValue(requestBody);
      mockTTS.synthesize.mockResolvedValue(new Uint8Array([]));

      const response = await handler.synthesize(mockContext);

      expect(response.status).toBe(200);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        "audio.wav",
        Buffer.from(new Uint8Array([]))
      );
    });
  });

  describe("配置回退测试", () => {
    it("应该在所有参数从请求体提供时工作正常", async () => {
      const requestBody = {
        text: "测试文本",
        appid: "request-appid",
        accessToken: "request-token",
        voice_type: "zh_female_vv_uranus_bigtts",
        encoding: "mp3",
      };
      mockContext.req.json.mockResolvedValue(requestBody);
      mockTTS.synthesize.mockResolvedValue(new Uint8Array([1, 2, 3]));

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getTTSConfig).mockReturnValue({}); // 空配置

      const response = await handler.synthesize(mockContext);

      expect(response.status).toBe(200);
    });

    it("应该正确合并配置和请求参数", async () => {
      const requestBody = {
        text: "测试文本",
        voice_type: "custom-voice-type",
      };
      mockContext.req.json.mockResolvedValue(requestBody);

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getTTSConfig).mockReturnValue({
        appid: "config-appid",
        accessToken: "config-token",
        voice_type: "config-voice-type",
        encoding: "wav",
        cluster: "default",
      });

      await handler.synthesize(mockContext);

      const { TTS } = await import("@xiaozhi-client/tts");
      expect(TTS).toHaveBeenCalledWith(
        expect.objectContaining({
          bytedance: expect.objectContaining({
            v1: expect.objectContaining({
              app: expect.objectContaining({
                appid: "config-appid",
                accessToken: "config-token",
              }),
              audio: expect.objectContaining({
                voice_type: "custom-voice-type", // 使用请求中的值
                encoding: "wav", // 使用配置中的值
              }),
            }),
          }),
        })
      );
    });
  });

  describe("语音列表数据验证", () => {
    it("应该验证所有语音都有必需字段", async () => {
      const response = await handler.getVoices(mockContext);
      const responseData = await response.json();
      const voices: VoiceInfo[] = responseData.data.voices;

      for (const voice of voices) {
        expect(voice.name).toBeTruthy();
        expect(voice.voiceType).toBeTruthy();
        expect(voice.scene).toBeTruthy();
        expect(voice.language).toBeTruthy();
        expect(Array.isArray(voice.capabilities)).toBe(true);
        expect(voice.modelVersion).toBeTruthy();
      }
    });

    it("应该验证语音场景分组的正确性", async () => {
      const response = await handler.getVoices(mockContext);
      const responseData = await response.json();
      const voices: VoiceInfo[] = responseData.data.voices;

      // 检查通用场景的语音
      const generalVoices = voices.filter((v) => v.scene === "通用场景");
      expect(generalVoices.length).toBeGreaterThan(0);

      // 检查角色扮演的语音
      const rolePlayVoices = voices.filter((v) => v.scene === "角色扮演");
      expect(rolePlayVoices.length).toBeGreaterThan(0);
    });

    it("应该验证模型版本都是 2.0", async () => {
      const response = await handler.getVoices(mockContext);
      const responseData = await response.json();
      const voices: VoiceInfo[] = responseData.data.voices;

      for (const voice of voices) {
        expect(voice.modelVersion).toBe("2.0");
      }
    });

    it("应该验证所有语音都有能力标签", async () => {
      const response = await handler.getVoices(mockContext);
      const responseData = await response.json();
      const voices: VoiceInfo[] = responseData.data.voices;

      for (const voice of voices) {
        expect(voice.capabilities.length).toBeGreaterThan(0);
        // 检查是否有有效的能力标签
        const validCapabilities = ["情感变化", "指令遵循", "ASMR"];
        const hasValidCapability = voice.capabilities.some((cap) =>
          validCapabilities.includes(cap)
        );
        expect(hasValidCapability).toBe(true);
      }
    });
  });
});
