/**
 * ByteDance TTS 配置校验测试
 */

import {
  ByteDanceTTSAppSchema,
  ByteDanceTTSAudioSchema,
  ByteDanceTTSConfigSchema,
  DEFAULT_TTS_ENDPOINT,
  validateByteDanceTTSConfig,
} from "@/platforms/index.js";
import { describe, expect, it } from "vitest";

describe("ByteDance TTS 配置校验", () => {
  describe("ByteDanceTTSAppSchema", () => {
    it("应验证有效的应用配置", () => {
      const validApp = {
        appid: "test_appid",
        accessToken: "test_token",
      };

      const result = ByteDanceTTSAppSchema.parse(validApp);

      expect(result.appid).toBe("test_appid");
      expect(result.accessToken).toBe("test_token");
    });

    it("应在 appid 为空时抛出错误", () => {
      const invalidApp = {
        appid: "",
        accessToken: "test_token",
      };

      expect(() => {
        ByteDanceTTSAppSchema.parse(invalidApp);
      }).toThrow();
    });

    it("应在 accessToken 为空时抛出错误", () => {
      const invalidApp = {
        appid: "test_appid",
        accessToken: "",
      };

      expect(() => {
        ByteDanceTTSAppSchema.parse(invalidApp);
      }).toThrow();
    });
  });

  describe("ByteDanceTTSAudioSchema", () => {
    it("应验证有效的音频配置", () => {
      const validAudio = {
        voice_type: "S_70000",
        encoding: "wav",
      };

      const result = ByteDanceTTSAudioSchema.parse(validAudio);

      expect(result.voice_type).toBe("S_70000");
      expect(result.encoding).toBe("wav");
    });

    it("应在 voice_type 为空时抛出错误", () => {
      const invalidAudio = {
        voice_type: "",
        encoding: "wav",
      };

      expect(() => {
        ByteDanceTTSAudioSchema.parse(invalidAudio);
      }).toThrow();
    });

    it("应使用默认编码格式", () => {
      const audioWithoutEncoding = {
        voice_type: "S_70000",
      };

      const result = ByteDanceTTSAudioSchema.parse(audioWithoutEncoding);

      expect(result.encoding).toBe("wav");
    });

    it("应接受可选参数", () => {
      const audioWithOptional = {
        voice_type: "S_70000",
        encoding: "mp3",
        speed: 1.0,
        pitch: 0,
        volume: 10,
      };

      const result = ByteDanceTTSAudioSchema.parse(audioWithOptional);

      expect(result.speed).toBe(1.0);
      expect(result.pitch).toBe(0);
      expect(result.volume).toBe(10);
    });
  });

  describe("ByteDanceTTSConfigSchema", () => {
    it("应验证有效的完整配置", () => {
      const validConfig = {
        app: {
          appid: "test_appid",
          accessToken: "test_token",
        },
        audio: {
          voice_type: "S_70000",
          encoding: "wav",
        },
      };

      const result = ByteDanceTTSConfigSchema.parse(validConfig);

      expect(result.app.appid).toBe("test_appid");
      expect(result.audio.voice_type).toBe("S_70000");
    });

    it("应接受可选的 cluster 参数", () => {
      const configWithCluster = {
        app: {
          appid: "test_appid",
          accessToken: "test_token",
        },
        audio: {
          voice_type: "S_70000",
          encoding: "wav",
        },
        cluster: "volcano_icl",
      };

      const result = ByteDanceTTSConfigSchema.parse(configWithCluster);

      expect(result.cluster).toBe("volcano_icl");
    });

    it("应接受可选的 endpoint 参数", () => {
      const configWithEndpoint = {
        app: {
          appid: "test_appid",
          accessToken: "test_token",
        },
        audio: {
          voice_type: "S_70000",
          encoding: "wav",
        },
        endpoint: "wss://custom.endpoint.com/tts",
      };

      const result = ByteDanceTTSConfigSchema.parse(configWithEndpoint);

      expect(result.endpoint).toBe("wss://custom.endpoint.com/tts");
    });

    it("应在配置无效时抛出错误", () => {
      const invalidConfig = {
        app: {
          appid: "",
          accessToken: "",
        },
        audio: {
          voice_type: "",
          encoding: "wav",
        },
      };

      expect(() => {
        ByteDanceTTSConfigSchema.parse(invalidConfig);
      }).toThrow();
    });
  });

  describe("validateByteDanceTTSConfig", () => {
    it("应返回验证后的配置", () => {
      const config = {
        app: {
          appid: "test_appid",
          accessToken: "test_token",
        },
        audio: {
          voice_type: "S_70000",
          encoding: "wav",
        },
      };

      const result = validateByteDanceTTSConfig(config);

      expect(result).toEqual(config);
    });

    it("应在配置无效时抛出错误", () => {
      const invalidConfig = {
        app: {
          appid: "",
          accessToken: "",
        },
        audio: {
          voice_type: "",
          encoding: "wav",
        },
      };

      expect(() => {
        validateByteDanceTTSConfig(invalidConfig);
      }).toThrow();
    });
  });

  describe("DEFAULT_TTS_ENDPOINT", () => {
    it("应为有效的 WebSocket URL", () => {
      expect(DEFAULT_TTS_ENDPOINT).toBe(
        "wss://openspeech.bytedance.com/api/v1/tts/ws_binary"
      );
      expect(DEFAULT_TTS_ENDPOINT).toMatch(/^wss:\/\/.+/);
    });
  });
});
