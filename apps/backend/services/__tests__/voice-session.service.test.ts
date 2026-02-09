/**
 * VoiceSessionService 单元测试
 */

import type { ESP32STTMessage, ESP32TTSMessage } from "@/types/esp32.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IAIService, ITTSService } from "../ai/index.js";
import type { EventBus } from "../event-bus.service.js";
import { VoiceSessionService } from "../voice-session.service.js";

describe("VoiceSessionService", () => {
  let service: VoiceSessionService;
  let mockAIService: IAIService;
  let mockTTSService: ITTSService;
  let mockEventBus: EventBus;
  let sentMessages: Array<{
    deviceId: string;
    message: ESP32STTMessage | ESP32TTSMessage;
  }>;
  let sentBinaryData: Array<{ deviceId: string; data: Uint8Array }>;

  beforeEach(() => {
    sentMessages = [];
    sentBinaryData = [];

    // Mock AI服务
    mockAIService = {
      recognize: vi.fn().mockResolvedValue("测试语音输入"),
      generateResponse: vi.fn().mockResolvedValue("测试回复"),
    };

    // Mock TTS服务
    const mockAudioData = new Uint8Array([1, 2, 3, 4, 5]);
    mockTTSService = {
      synthesize: vi.fn().mockResolvedValue(mockAudioData),
    };

    // Mock EventBus
    mockEventBus = {
      emitEvent: vi.fn(),
    } as unknown as EventBus;

    // 创建服务
    service = new VoiceSessionService(
      mockAIService,
      mockTTSService,
      mockEventBus,
      // 发送消息回调
      async (deviceId: string, message: ESP32STTMessage | ESP32TTSMessage) => {
        sentMessages.push({ deviceId, message });
      },
      // 发送二进制数据回调
      async (deviceId: string, data: Uint8Array) => {
        sentBinaryData.push({ deviceId, data });
      },
      // 会话配置（缩短超时时间用于测试）
      {
        audioTimeoutMs: 100,
        maxAudioSize: 100,
      }
    );
  });

  afterEach(() => {
    service.destroy();
  });

  describe("startSession", () => {
    it("应该成功创建新会话", async () => {
      const sessionId = await service.startSession("device-001", "auto");

      expect(sessionId).toBeTruthy();
      expect(sessionId).toContain("device-001");

      const session = service.getSession("device-001");
      expect(session).toBeTruthy();
      expect(session?.state).toBe("LISTENING");
      expect(session?.mode).toBe("auto");
    });

    it("应该发射session:started事件", async () => {
      await service.startSession("device-001", "manual");

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "voice:session:started",
        expect.objectContaining({
          deviceId: "device-001",
          mode: "manual",
        })
      );
    });

    it("应该先结束现有会话再创建新会话", async () => {
      const sessionId1 = await service.startSession("device-001", "auto");
      const sessionId2 = await service.startSession("device-001", "manual");

      expect(sessionId1).not.toBe(sessionId2);

      const session = service.getSession("device-001");
      expect(session?.sessionId).toBe(sessionId2);
    });
  });

  describe("handleWakeWord", () => {
    it("应该发射wake-word:detected事件", async () => {
      await service.handleWakeWord("device-001", "你好小智", "auto");

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "voice:wake-word:detected",
        {
          deviceId: "device-001",
          wakeWord: "你好小智",
          mode: "auto",
          timestamp: expect.any(Date),
        }
      );
    });

    it("应该自动创建新会话", async () => {
      await service.handleWakeWord("device-001", "你好小智", "auto");

      const session = service.getSession("device-001");
      expect(session).toBeTruthy();
      expect(session?.state).toBe("LISTENING");
    });
  });

  describe("handleAudioData", () => {
    beforeEach(async () => {
      await service.startSession("device-001", "auto");
    });

    it("应该累积音频数据", async () => {
      const audioData = new Uint8Array([1, 2, 3]);
      await service.handleAudioData("device-001", audioData);

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "voice:audio:received",
        expect.objectContaining({
          deviceId: "device-001",
          size: 3,
        })
      );
    });

    it("应该忽略无会话设备的音频数据", async () => {
      const audioData = new Uint8Array([1, 2, 3]);
      await service.handleAudioData("device-999", audioData);

      // 应该不抛出错误，只是静默忽略
      expect(mockEventBus.emitEvent).not.toHaveBeenCalledWith(
        "voice:audio:received",
        expect.any(Object)
      );
    });

    it("应该在达到最大音频数据量时触发处理", async () => {
      // 发送大量音频数据
      const largeAudio = new Uint8Array(150);
      await service.handleAudioData("device-001", largeAudio);

      // 等待异步处理完成
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 验证AI服务被调用
      expect(mockAIService.recognize).toHaveBeenCalled();
    }, 10000);
  });

  describe("abortSession", () => {
    it("应该中断活跃会话", async () => {
      await service.startSession("device-001", "auto");
      await service.abortSession("device-001", "测试中断");

      const session = service.getSession("device-001");
      expect(session).toBeNull();
    });

    it("应该发射session:ended事件", async () => {
      await service.startSession("device-001", "auto");
      await service.abortSession("device-001", "用户取消");

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "voice:session:ended",
        expect.objectContaining({
          deviceId: "device-001",
          reason: "aborted",
        })
      );
    });

    it("应该忽略不存在的中断请求", async () => {
      // 不应该抛出错误
      await service.abortSession("device-999", "测试");
    });
  });

  describe("getAllSessions", () => {
    it("应该返回所有活跃会话", async () => {
      await service.startSession("device-001", "auto");
      await service.startSession("device-002", "manual");

      const sessions = service.getAllSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.deviceId)).toContain("device-001");
      expect(sessions.map((s) => s.deviceId)).toContain("device-002");
    });

    it("应该返回空数组当没有会话时", () => {
      const sessions = service.getAllSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe("destroy", () => {
    it("应该结束所有活跃会话", async () => {
      await service.startSession("device-001", "auto");
      await service.startSession("device-002", "manual");

      service.destroy();

      expect(service.getAllSessions()).toHaveLength(0);
    });
  });
});
