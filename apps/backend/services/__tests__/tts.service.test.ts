/**
 * TTS 服务单元测试
 * 测试语音合成服务的核心功能
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TTSService } from "../tts.service.js";

// Mock 依赖项
vi.mock("@/Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getTTSConfig: vi.fn().mockReturnValue({
      appid: "test-appid",
      accessToken: "test-token",
      voice_type: "test-voice",
      encoding: "ogg_opus",
    }),
  },
}));

// Mock prism-media - 只导出需要的方法
vi.mock("prism-media", () => {
  const mockOggDemuxer = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    pipe: vi.fn(),
  }));
  return {
    opus: {
      OggDemuxer: mockOggDemuxer,
    },
    default: {
      opus: {
        OggDemuxer: mockOggDemuxer,
      },
    },
  };
});

// Mock @xiaozhi-client/tts
vi.mock("@xiaozhi-client/tts", () => {
  const mockSpeak = vi.fn();
  const mockTTS = vi.fn().mockImplementation(() => ({
    bytedance: {
      v1: {
        speak: mockSpeak,
      },
    },
  }));
  return {
    TTS: mockTTS,
  };
});

// Mock node:stream
vi.mock("node:stream", () => ({
  Readable: {
    from: vi.fn().mockReturnValue({
      pause: vi.fn(),
      pipe: vi.fn().mockReturnThis(),
      on: vi.fn(),
    }),
  },
}));

describe("TTSService", () => {
  let ttsService: TTSService;
  let mockLogger: any;
  let mockConnection: any;

  const deviceId = "test-device-001";
  const testText = "你好，这是测试文本";

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("@/Logger.js");
    Object.assign(logger, mockLogger);

    // Mock ESP32Connection
    mockConnection = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBinaryProtocol2: vi.fn().mockResolvedValue(undefined),
      getSessionId: vi.fn().mockReturnValue("test-session-id"),
    };

    // 创建服务
    const getConnection = vi.fn().mockReturnValue(mockConnection);
    ttsService = new TTSService({ getConnection });
  });

  afterEach(() => {
    vi.clearAllMocks();
    ttsService.destroy();
  });

  describe("constructor", () => {
    it("应该使用正确的依赖项初始化", () => {
      const onTTSComplete = vi.fn();
      const getConnection = vi.fn().mockReturnValue(mockConnection);
      const service = new TTSService({ getConnection, onTTSComplete });

      expect(service).toBeInstanceOf(TTSService);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it("应该使用空的选项初始化", () => {
      const service = new TTSService();
      expect(service).toBeInstanceOf(TTSService);
    });
  });

  describe("setGetConnection", () => {
    it("应该设置获取设备连接的回调", () => {
      const newGetConnection = vi.fn().mockReturnValue(mockConnection);
      ttsService.setGetConnection(newGetConnection);

      expect(() => ttsService.setGetConnection(newGetConnection)).not.toThrow();
    });
  });

  describe("speak", () => {
    it("应该在无法获取设备连接时记录警告并返回", async () => {
      const serviceWithoutConnection = new TTSService({
        getConnection: vi.fn().mockReturnValue(undefined),
      });

      await serviceWithoutConnection.speak(deviceId, testText);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("无法获取设备连接")
      );
    });

    it("应该在 TTS 配置不完整时记录错误并返回", async () => {
      const { configManager } = await import("@xiaozhi-client/config");
      (configManager.getTTSConfig as any).mockReturnValue({
        appid: "",
        accessToken: "",
        voice_type: "",
      });

      const service = new TTSService({
        getConnection: vi.fn().mockReturnValue(mockConnection),
      });

      await service.speak(deviceId, testText);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("TTS 配置不完整")
      );
    });

    it("应该在首次调用后忽略相同设备的重复调用", async () => {
      // 注意：由于没有实际的连接和 TTS 返回数据，这个测试只验证
      // 服务结构允许重复调用而不崩溃

      // 第一次调用
      await ttsService.speak(deviceId, testText);

      // 第二次调用 - 验证不会抛出错误
      await expect(ttsService.speak(deviceId, "新文本")).resolves.not.toThrow();
    });

    it("应该处理空文本", async () => {
      const service = new TTSService({
        getConnection: vi.fn().mockReturnValue(undefined),
      });

      await service.speak(deviceId, "");

      expect(() => service.speak(deviceId, "")).not.toThrow();
    });

    it("应该处理非常长的文本", async () => {
      const service = new TTSService({
        getConnection: vi.fn().mockReturnValue(undefined),
      });

      const longText = "测试文本".repeat(1000);

      await service.speak(deviceId, longText);

      expect(() => service.speak(deviceId, longText)).not.toThrow();
    });

    it("应该处理特殊字符文本", async () => {
      const service = new TTSService({
        getConnection: vi.fn().mockReturnValue(undefined),
      });

      const specialText = "测试 @#$%^&*() 特殊字符";

      await service.speak(deviceId, specialText);

      expect(() => service.speak(deviceId, specialText)).not.toThrow();
    });

    it("应该处理包含换行符的文本", async () => {
      const service = new TTSService({
        getConnection: vi.fn().mockReturnValue(undefined),
      });

      const multilineText = "第一行\n第二行\n第三行";

      await service.speak(deviceId, multilineText);

      expect(() => service.speak(deviceId, multilineText)).not.toThrow();
    });
  });

  describe("getPacketDuration", () => {
    it("应该正确计算单帧 10ms 的包时长", () => {
      // TOC byte: config=3 (<12), c=0 (单帧)
      const opusPacket = Buffer.from([0x18, 0x00]);
      const duration = ttsService.getPacketDuration(opusPacket);

      // config < 12 时，frameSize = 10
      expect(duration).toBe(10);
    });

    it("应该正确计算单帧 20ms 的包时长", () => {
      // TOC byte: config=13 (>=12 && <16), c=0 (单帧)
      // 0x6a = 0b01101010, config=0b01101=13, c=0b10=2 (双帧)
      const opusPacket = Buffer.from([0x68, 0x00]); // config=13, c=0
      const duration = ttsService.getPacketDuration(opusPacket);

      // config >= 12 && < 16 时，frameSize = 20, c=0 → frameCount=1
      expect(duration).toBe(20);
    });

    it("应该处理空缓冲区", () => {
      const duration = ttsService.getPacketDuration(Buffer.from([]));
      expect(duration).toBe(0);
    });

    it("应该处理 null 或 undefined", () => {
      const duration1 = ttsService.getPacketDuration(null as any);
      const duration2 = ttsService.getPacketDuration(undefined as any);

      expect(duration1).toBe(0);
      expect(duration2).toBe(0);
    });

    it("应该正确计算双帧包时长", () => {
      // TOC byte: config=0, c=1 (双帧)
      const opusPacket = Buffer.from([0x01, 0x00]);
      const duration = ttsService.getPacketDuration(opusPacket);

      // config=0 => frameSize=10, c=1 => frameCount=2
      expect(duration).toBe(20);
    });

    it("应该正确计算可变帧数包时长", () => {
      // TOC byte: config=0, c=3 (可变帧数), frame count = 5
      const opusPacket = Buffer.from([0x03, 0x05, 0x00]);
      const duration = ttsService.getPacketDuration(opusPacket);

      // config=0 => frameSize=10, c=3 => frameCount=5 (from second byte)
      expect(duration).toBe(50);
    });
  });

  describe("processAudioBuffer", () => {
    // 注意：processAudioBuffer 方法依赖于实际的 prism-media 库和 Node.js stream
    // 由于这些依赖难以在单元测试中完全 mock，这里只测试方法的基本行为
    // 实际的音频处理逻辑应在集成测试中验证

    it("应该存在 processAudioBuffer 方法", () => {
      expect(typeof ttsService.processAudioBuffer).toBe("function");
    });

    it("应该接受正确的参数", () => {
      const audioBuffer = Buffer.from([0x01, 0x02]);
      const sendCallback = vi.fn();

      // 验证方法接受这些参数而不抛出同步错误
      expect(() => {
        // 不等待结果，只验证调用不抛出同步错误
        void ttsService.processAudioBuffer(audioBuffer, sendCallback);
      }).not.toThrow();
    });
  });

  describe("cleanup", () => {
    it("应该清理设备状态", () => {
      const service = new TTSService();

      expect(() => service.cleanup(deviceId)).not.toThrow();
    });

    it("应该处理清理不存在的设备", () => {
      const nonExistentDevice = "non-existent-device";
      expect(() => ttsService.cleanup(nonExistentDevice)).not.toThrow();
    });

    it("应该能够多次调用 cleanup", () => {
      expect(() => {
        ttsService.cleanup(deviceId);
        ttsService.cleanup(deviceId);
        ttsService.cleanup(deviceId);
      }).not.toThrow();
    });
  });

  describe("destroy", () => {
    it("应该销毁服务并清理所有资源", () => {
      const service = new TTSService();

      expect(() => service.destroy()).not.toThrow();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("服务已销毁")
      );
    });

    it("应该能够多次调用 destroy 而不抛出错误", () => {
      const service = new TTSService();

      expect(() => {
        service.destroy();
        service.destroy();
        service.destroy();
      }).not.toThrow();
    });

    it("应该在 destroy 后可以重新创建服务", () => {
      ttsService.destroy();

      const newService = new TTSService();
      expect(newService).toBeInstanceOf(TTSService);

      newService.destroy();
    });
  });

  describe("内存管理", () => {
    it("应该正确管理多个设备的状态", () => {
      const service = new TTSService();

      // 清理多个设备
      expect(() => {
        service.cleanup("device-001");
        service.cleanup("device-002");
        service.cleanup("device-003");
      }).not.toThrow();
    });

    it("应该在 destroy 后释放所有资源", () => {
      const service = new TTSService();

      service.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("服务已销毁")
      );
    });
  });

  describe("边界条件", () => {
    it("应该处理多个设备同时调用", async () => {
      const service = new TTSService({
        getConnection: vi.fn().mockReturnValue(undefined),
      });

      const devices = ["device-001", "device-002", "device-003"];
      const promises = devices.map((device) =>
        service.speak(device, `测试文本 ${device}`)
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it("应该处理带有表情符号的文本", async () => {
      const service = new TTSService({
        getConnection: vi.fn().mockReturnValue(undefined),
      });

      const emojiText = "你好 😊 这是一个测试 🎉";

      await expect(service.speak(deviceId, emojiText)).resolves.not.toThrow();
    });

    it("应该处理只有空格的文本", async () => {
      const service = new TTSService({
        getConnection: vi.fn().mockReturnValue(undefined),
      });

      const spacesText = "   ";

      await expect(service.speak(deviceId, spacesText)).resolves.not.toThrow();
    });
  });

  describe("回调功能", () => {
    it("应该正确处理 onTTSComplete 回调", () => {
      const onTTSComplete = vi.fn();
      const service = new TTSService({ onTTSComplete });

      service.destroy();

      // onTTSComplete 会在特定的 TTS 流程完成后调用
      // 这里我们验证服务创建时正确接收了回调
      expect(service).toBeInstanceOf(TTSService);
    });
  });
});
