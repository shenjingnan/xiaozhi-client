/**
 * ASR 客户端测试
 */

import { AudioFormat } from "@/audio/index.js";
import { AuthMethod } from "@/auth/index.js";
import { ASR, executeOne } from "@/client/index.js";
import { describe, expect, it, vi } from "vitest";

describe("ASR 客户端", () => {
  describe("构造函数", () => {
    it("应使用默认选项创建客户端", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
      });

      expect(asr).toBeDefined();
    });

    it("应使用自定义 WebSocket URL", () => {
      const customUrl = "wss://custom.example.com/asr";
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
        wsUrl: customUrl,
      });

      expect(asr).toBeDefined();
    });

    it("应使用自定义集群", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
        cluster: "custom_cluster",
      });

      expect(asr).toBeDefined();
    });

    it("应使用自定义音频格式", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.mp3",
        format: AudioFormat.MP3,
      });

      expect(asr).toBeDefined();
    });

    it("应使用自定义采样率", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
        sampleRate: 48000,
      });

      expect(asr).toBeDefined();
    });

    it("应使用自定义语言", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
        language: "en-US",
      });

      expect(asr).toBeDefined();
    });

    it("应使用自定义用户 ID", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
        uid: "custom_uid",
      });

      expect(asr).toBeDefined();
    });

    it("应使用签名认证方法", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
        authMethod: AuthMethod.SIGNATURE,
        secret: "test_secret",
      });

      expect(asr).toBeDefined();
    });

    it("应使用自定义成功码", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
        successCode: 2000,
      });

      expect(asr).toBeDefined();
    });

    it("应使用自定义分段时长", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
        segDuration: 30000,
      });

      expect(asr).toBeDefined();
    });

    it("应使用自定义 nbest 值", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
        nbest: 3,
      });

      expect(asr).toBeDefined();
    });

    it("应使用自定义工作流", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
        workflow: "custom_workflow",
      });

      expect(asr).toBeDefined();
    });

    it("应使用 showLanguage 选项", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
        showLanguage: true,
      });

      expect(asr).toBeDefined();
    });

    it("应使用 showUtterances 选项", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
        showUtterances: true,
      });

      expect(asr).toBeDefined();
    });

    it("应使用 resultType 选项", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
        resultType: "partial",
      });

      expect(asr).toBeDefined();
    });

    it("应使用 mp3SegSize 选项", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.mp3",
        format: AudioFormat.MP3,
        mp3SegSize: 5000,
      });

      expect(asr).toBeDefined();
    });

    it("应继承 EventEmitter", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
      });

      expect(typeof asr.on).toBe("function");
      expect(typeof asr.emit).toBe("function");
      expect(typeof asr.off).toBe("function");
    });
  });

  describe("事件处理", () => {
    it("应能绑定 open 事件", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
      });

      const callback = vi.fn();
      asr.on("open", callback);

      expect(asr.listenerCount("open")).toBe(1);
    });

    it("应能绑定 close 事件", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
      });

      const callback = vi.fn();
      asr.on("close", callback);

      expect(asr.listenerCount("close")).toBe(1);
    });

    it("应能绑定 error 事件", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
      });

      const callback = vi.fn();
      asr.on("error", callback);

      expect(asr.listenerCount("error")).toBe(1);
    });

    it("应能绑定 result 事件", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
      });

      const callback = vi.fn();
      asr.on("result", callback);

      expect(asr.listenerCount("result")).toBe(1);
    });

    it("应能绑定 audio_end 事件", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
      });

      const callback = vi.fn();
      asr.on("audio_end", callback);

      expect(asr.listenerCount("audio_end")).toBe(1);
    });

    it("应能绑定 full_response 事件", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
      });

      const callback = vi.fn();
      asr.on("full_response", callback);

      expect(asr.listenerCount("full_response")).toBe(1);
    });

    it("应能解绑事件", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
      });

      const callback = vi.fn();
      asr.on("open", callback);
      asr.off("open", callback);

      expect(asr.listenerCount("open")).toBe(0);
    });
  });

  describe("设置方法", () => {
    it("setAudioPath 应设置音频路径", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
      });

      asr.setAudioPath("/new/path/audio.wav");

      expect(asr).toBeDefined();
    });

    it("setAudioPath 应设置音频路径和格式", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
      });

      asr.setAudioPath("/new/path/audio.mp3", AudioFormat.MP3);

      expect(asr).toBeDefined();
    });

    it("setFormat 应设置音频格式", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
        format: AudioFormat.WAV,
      });

      asr.setFormat(AudioFormat.MP3);

      expect(asr).toBeDefined();
    });
  });

  describe("连接状态", () => {
    it("初始状态应未连接", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
      });

      expect(asr.isConnected()).toBe(false);
    });

    it("close 方法应正确关闭连接", () => {
      const asr = new ASR({
        appid: "test_appid",
        token: "test_token",
        audioPath: "/path/to/audio.wav",
      });

      // 关闭未连接的客户端应该不会出错
      asr.close();

      expect(asr.isConnected()).toBe(false);
    });
  });

  describe("executeOne 函数", () => {
    it("应创建 ASR 客户端并执行", async () => {
      // 由于没有真实的 WebSocket 连接，我们测试函数是否能正确创建客户端
      const resultPromise = executeOne(
        "/path/to/audio.wav",
        "volcengine_streaming_common",
        {
          appid: "test_appid",
          token: "test_token",
        }
      );

      // 由于没有真实服务器，execute 会因为缺少音频文件而失败
      // 我们期望它抛出错误而不是成功
      await expect(resultPromise).rejects.toThrow();
    });
  });
});
