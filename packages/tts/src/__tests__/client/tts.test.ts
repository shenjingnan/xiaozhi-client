/**
 * TTS 客户端测试
 */

import { TTS } from "@/client/index.js";
import { describe, expect, it, vi } from "vitest";

describe("TTS 客户端", () => {
  describe("构造函数", () => {
    it("应使用默认选项创建客户端", () => {
      const tts = new TTS({
        config: {
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
          },
        },
      });

      expect(tts).toBeDefined();
    });

    it("应使用自定义平台", () => {
      const tts = new TTS({
        platform: "bytedance",
        config: {
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
          },
        },
      });

      expect(tts).toBeDefined();
    });

    it("应使用 bytedance v1 配置", () => {
      const tts = new TTS({
        bytedance: {
          v1: {
            app: {
              appid: "test_appid",
              accessToken: "test_token",
            },
            audio: {
              voice_type: "S_70000",
              encoding: "ogg_opus",
            },
          },
        },
      });

      expect(tts).toBeDefined();
      expect(tts.bytedance).toBeDefined();
      expect(tts.bytedance.v1).toBeDefined();
      expect(typeof tts.bytedance.v1.speak).toBe("function");
    });

    it("应继承 EventEmitter", () => {
      const tts = new TTS({
        config: {
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
          },
        },
      });

      expect(typeof tts.on).toBe("function");
      expect(typeof tts.emit).toBe("function");
      expect(typeof tts.off).toBe("function");
      expect(typeof tts.listenerCount).toBe("function");
    });
  });

  describe("事件处理", () => {
    it("应能绑定 audio_chunk 事件", () => {
      const tts = new TTS({
        config: {
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
          },
        },
      });

      const callback = vi.fn();
      tts.on("audio_chunk", callback);

      expect(tts.listenerCount("audio_chunk")).toBe(1);
    });

    it("应能绑定 result 事件", () => {
      const tts = new TTS({
        config: {
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
          },
        },
      });

      const callback = vi.fn();
      tts.on("result", callback);

      expect(tts.listenerCount("result")).toBe(1);
    });

    it("应能绑定 error 事件", () => {
      const tts = new TTS({
        config: {
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
          },
        },
      });

      const callback = vi.fn();
      tts.on("error", callback);

      expect(tts.listenerCount("error")).toBe(1);
    });

    it("应能绑定 close 事件", () => {
      const tts = new TTS({
        config: {
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
          },
        },
      });

      const callback = vi.fn();
      tts.on("close", callback);

      expect(tts.listenerCount("close")).toBe(1);
    });

    it("应能解绑事件", () => {
      const tts = new TTS({
        config: {
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
          },
        },
      });

      const callback = vi.fn();
      tts.on("audio_chunk", callback);
      tts.off("audio_chunk", callback);

      expect(tts.listenerCount("audio_chunk")).toBe(0);
    });
  });

  describe("close 方法", () => {
    it("应正确关闭客户端", () => {
      const tts = new TTS({
        config: {
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
          },
        },
      });

      const closeCallback = vi.fn();
      tts.on("close", closeCallback);

      tts.close();

      expect(closeCallback).toHaveBeenCalled();
    });

    it("应能多次关闭而不报错", () => {
      const tts = new TTS({
        config: {
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
          },
        },
      });

      expect(() => {
        tts.close();
        tts.close();
      }).not.toThrow();
    });
  });

  describe("updateConfig 方法", () => {
    it("应更新配置", () => {
      const tts = new TTS({
        config: {
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
          },
        },
      });

      tts.updateConfig({
        app: {
          appid: "new_appid",
          accessToken: "new_token",
        },
      });

      const newConfig = tts.getConfig();
      expect(newConfig.app.appid).toBe("new_appid");
      expect(newConfig.app.accessToken).toBe("new_token");
    });

    it("应合并部分配置", () => {
      const tts = new TTS({
        config: {
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
            speed: 1.0,
          },
        },
      });

      tts.updateConfig({
        audio: {
          voice_type: "S_80000",
          encoding: "wav",
        },
      });

      const newConfig = tts.getConfig();
      expect(newConfig.audio.voice_type).toBe("S_80000");
      expect(newConfig.audio.speed).toBe(1.0);
      expect(newConfig.audio.encoding).toBe("wav");
    });
  });

  describe("getConfig 方法", () => {
    it("应返回当前配置的副本", () => {
      const originalConfig = {
        app: {
          appid: "test_appid",
          accessToken: "test_token",
        },
        audio: {
          voice_type: "S_70000",
          encoding: "wav",
        },
      };

      const tts = new TTS({ config: originalConfig });

      const retrievedConfig = tts.getConfig();

      expect(retrievedConfig).toEqual(originalConfig);
      expect(retrievedConfig).not.toBe(originalConfig);
    });
  });

  describe("validateConfig 静态方法", () => {
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

      const result = TTS.validateConfig(validConfig);

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
        TTS.validateConfig(invalidConfig);
      }).toThrow();
    });
  });

  describe("synthesizeStream 方法", () => {
    it("应在文本为空时尝试合成（会因无真实连接而失败）", async () => {
      const tts = new TTS({
        config: {
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
          },
        },
      });

      // 由于没有真实的 WebSocket 连接，会失败
      await expect(tts.synthesizeStream("")).rejects.toThrow();
    });
  });

  describe("synthesize 方法", () => {
    it("应在文本为空时尝试合成（会因无真实连接而失败）", async () => {
      const tts = new TTS({
        config: {
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
          },
        },
      });

      // 由于没有真实的 WebSocket 连接，会失败
      await expect(tts.synthesize("")).rejects.toThrow();
    });
  });
});
