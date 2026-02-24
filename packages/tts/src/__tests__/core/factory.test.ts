/**
 * TTS 工厂函数测试
 */

import {
  createTTSController,
  getTTSPlatform,
  listTTSPlatforms,
} from "@/core/index.js";
// 导入平台以触发注册
import "@/platforms/index.js";
import { describe, expect, it } from "vitest";

describe("TTS 工厂函数", () => {
  describe("createTTSController", () => {
    it("应为已注册的平台创建控制器", () => {
      // bytedance 平台在包初始化时已注册
      const controller = createTTSController("bytedance", {
        platform: "bytedance",
        app: {
          appid: "test_appid",
          accessToken: "test_token",
        },
        audio: {
          voice_type: "S_70000",
          encoding: "wav",
        },
      });

      expect(controller).toBeDefined();
      expect(typeof controller.synthesize).toBe("function");
      expect(typeof controller.synthesizeStream).toBe("function");
      expect(typeof controller.close).toBe("function");
    });

    it("应在平台不支持时抛出错误", () => {
      expect(() => {
        createTTSController("non-existent-platform", {
          platform: "non-existent-platform",
          app: {
            appid: "test_appid",
            accessToken: "test_token",
          },
          audio: {
            voice_type: "S_70000",
            encoding: "wav",
          },
        });
      }).toThrow();
    });

    it("应将 platform 添加到配置中", () => {
      const controller = createTTSController("bytedance", {
        app: {
          appid: "test_appid",
          accessToken: "test_token",
        },
        audio: {
          voice_type: "S_70000",
          encoding: "wav",
        },
      });

      expect(controller).toBeDefined();
    });
  });

  describe("getTTSPlatform", () => {
    it("应返回已注册的平台实例", () => {
      const platform = getTTSPlatform("bytedance");

      expect(platform).toBeDefined();
      expect(platform?.platform).toBe("bytedance");
    });

    it("应在平台不存在时返回 undefined", () => {
      const platform = getTTSPlatform("non-existent-platform");

      expect(platform).toBeUndefined();
    });
  });

  describe("listTTSPlatforms", () => {
    it("应返回已注册的平台列表", () => {
      const platforms = listTTSPlatforms();

      expect(Array.isArray(platforms)).toBe(true);
      expect(platforms).toContain("bytedance");
    });

    it("应返回平台名称数组", () => {
      const platforms = listTTSPlatforms();

      for (const platform of platforms) {
        expect(typeof platform).toBe("string");
      }
    });
  });
});
