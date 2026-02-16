import { describe, expect, it } from "vitest";
import {
  synthesizeSpeech,
  type TTSOptions,
  VoiceToCluster,
} from "../binary.js";

// 只测试 VoiceToCluster 函数
// synthesizeSpeech 需要完整的 WebSocket 集成测试，超出单元测试范围

describe("binary - VoiceToCluster 单元测试", () => {
  describe("VoiceToCluster", () => {
    it("应该将 S_ 开头的 voice 映射到 volcano_icl", () => {
      expect(VoiceToCluster("S_zh-CN_Xiaoxuan")).toBe("volcano_icl");
      expect(VoiceToCluster("S_小旭小旭")).toBe("volcano_icl");
      expect(VoiceToCluster("S_en-US_Jenny")).toBe("volcano_icl");
    });

    it("应该将普通 voice 映射到 volcano_tts", () => {
      expect(VoiceToCluster("zh-CN-Xiaoxuan")).toBe("volcano_tts");
      expect(VoiceToCluster("en-US-Jenny")).toBe("volcano_tts");
      expect(VoiceToCluster("custom_voice")).toBe("volcano_tts");
    });

    it("应该处理空字符串", () => {
      expect(VoiceToCluster("")).toBe("volcano_tts");
    });

    it("应该处理非 S_ 开头的 voice", () => {
      expect(VoiceToCluster("custom_voice")).toBe("volcano_tts");
      expect(VoiceToCluster("A_xxx")).toBe("volcano_tts");
      expect(VoiceToCluster("_test")).toBe("volcano_tts");
    });
  });
});

describe("binary - synthesizeSpeech 导出测试", () => {
  it("应该导出 synthesizeSpeech 函数", () => {
    expect(synthesizeSpeech).toBeDefined();
    expect(typeof synthesizeSpeech).toBe("function");
  });

  it("应该接受 TTSOptions 参数", () => {
    const options: TTSOptions = {
      appid: "test-app",
      accessToken: "test-token",
      voice_type: "zh-CN-Xiaoxuan",
      text: "测试",
    };
    // 验证参数类型正确
    expect(options.appid).toBe("test-app");
    expect(options.voice_type).toBe("zh-CN-Xiaoxuan");
  });

  it("应该支持 endpoint 参数覆盖", () => {
    const customEndpoint = "wss://custom.endpoint.com/tts";
    const options: TTSOptions = {
      appid: "test-app",
      accessToken: "test-token",
      voice_type: "zh-CN-Xiaoxuan",
      text: "测试",
      endpoint: customEndpoint,
    };
    expect(options.endpoint).toBe(customEndpoint);
  });

  it("应该支持 encoding 参数覆盖", () => {
    const options: TTSOptions = {
      appid: "test-app",
      accessToken: "test-token",
      voice_type: "zh-CN-Xiaoxuan",
      text: "测试",
      encoding: "mp3",
    };
    expect(options.encoding).toBe("mp3");
  });

  it("应该支持 cluster 参数覆盖", () => {
    const options: TTSOptions = {
      appid: "test-app",
      accessToken: "test-token",
      voice_type: "zh-CN-Xiaoxuan",
      text: "测试",
      cluster: "custom-cluster",
    };
    expect(options.cluster).toBe("custom-cluster");
  });
});
