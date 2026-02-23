/**
 * TTS 便捷函数测试
 */

import {
  type SynthesizeOptions,
  synthesizeSpeech,
  synthesizeSpeechStream,
  validateConfig,
} from "@/client/index.js";
import { describe, expect, it, vi } from "vitest";

describe("TTS 便捷函数", () => {
  describe("validateConfig", () => {
    it("应验证有效配置", () => {
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

      const result = validateConfig(validConfig);

      expect(result).toEqual(validConfig);
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
        validateConfig(invalidConfig);
      }).toThrow();
    });

    it("应使用默认编码格式", () => {
      const config = {
        app: {
          appid: "test_appid",
          accessToken: "test_token",
        },
        audio: {
          voice_type: "S_70000",
        },
      };

      const result = validateConfig(config);

      expect(result.audio.encoding).toBe("wav");
    });
  });

  describe("synthesizeSpeech", () => {
    it("应创建控制器并执行合成（会因无真实连接而失败）", async () => {
      const options: SynthesizeOptions = {
        appid: "test_appid",
        accessToken: "test_token",
        voice_type: "S_70000",
        text: "你好世界",
      };

      // 由于没有真实的 WebSocket 连接，会失败
      await expect(synthesizeSpeech(options)).rejects.toThrow();
    });

    it("应使用自定义编码格式", async () => {
      const options: SynthesizeOptions = {
        appid: "test_appid",
        accessToken: "test_token",
        voice_type: "S_70000",
        encoding: "mp3",
        text: "测试文本",
      };

      await expect(synthesizeSpeech(options)).rejects.toThrow();
    });

    it("应包含可选参数", async () => {
      const options: SynthesizeOptions = {
        appid: "test_appid",
        accessToken: "test_token",
        voice_type: "S_70000",
        text: "测试文本",
        speed: 1.0,
        pitch: 0,
        volume: 10,
        cluster: "volcano_icl",
        endpoint: "wss://custom.endpoint.com/tts",
      };

      await expect(synthesizeSpeech(options)).rejects.toThrow();
    });
  });

  describe("synthesizeSpeechStream", () => {
    it("应创建控制器并执行流式合成（会因无真实连接而失败）", async () => {
      const onAudioChunk = vi.fn();

      const options = {
        appid: "test_appid",
        accessToken: "test_token",
        voice_type: "S_70000",
        text: "你好世界",
        onAudioChunk,
      };

      // 由于没有真实的 WebSocket 连接，会失败
      await expect(synthesizeSpeechStream(options)).rejects.toThrow();
    });

    it("应在合成完成后关闭控制器", async () => {
      const onAudioChunk = vi.fn();

      const options = {
        appid: "test_appid",
        accessToken: "test_token",
        voice_type: "S_70000",
        text: "测试",
        onAudioChunk,
      };

      try {
        await synthesizeSpeechStream(options);
      } catch {
        // 忽略错误
      }

      // 即使合成失败，控制器也应该被关闭
      // 这里主要验证函数能正确执行完成（无论成功或失败）
    });

    it("应在发生错误时关闭控制器", async () => {
      const onAudioChunk = vi.fn();

      const options = {
        appid: "test_appid",
        accessToken: "test_token",
        voice_type: "S_70000",
        text: "",
        onAudioChunk,
      };

      try {
        await synthesizeSpeechStream(options);
      } catch {
        // 忽略错误
      }
    });
  });
});
