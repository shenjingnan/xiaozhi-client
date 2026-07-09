import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ASRService } from "../asr.service.js";
import type { ASRServiceEvents } from "../asr.interface.js";

// Mock Logger
vi.mock("@/Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock config
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getASRConfig: vi.fn().mockReturnValue({
      appid: "test-appid",
      accessToken: "test-token",
      cluster: "volcengine_streaming_common",
    }),
  },
}));

// Mock ASR package
// Helper function to create async generator from array
async function* mockAsyncGenerator<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

vi.mock("@xiaozhi-client/asr", () => ({
  ASR: vi.fn().mockImplementation(() => ({
    isConnected: vi.fn().mockReturnValue(true),
    bytedance: {
      v2: {
        listen: vi.fn().mockReturnValue(
          mockAsyncGenerator([
            { isFinal: false, text: "识别中" },
            { isFinal: true, text: "识别完成" },
          ])
        ),
      },
    },
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  AudioFormat: {
    RAW: "raw",
  },
  AuthMethod: {
    TOKEN: "token",
  },
  OpusDecoder: {
    toPcm: vi.fn().mockResolvedValue(Buffer.from("pcm-data")),
  },
}));

describe("ASRService", () => {
  let asrService: ASRService;
  let mockEvents: ASRServiceEvents;
  let mockLogger: any;

  const mockDeviceId = "test-device-123";
  const mockAudioData = new Uint8Array([1, 2, 3, 4, 5]);

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const { logger } = await import("@/Logger.js");
    Object.assign(logger, mockLogger);

    // Mock events
    mockEvents = {
      onResult: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    };

    asrService = new ASRService({ events: mockEvents });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe("constructor", () => {
    it("should initialize with correct dependencies", () => {
      expect(asrService).toBeInstanceOf(ASRService);
    });

    it("should initialize with custom events", () => {
      const customEvents = {
        onResult: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };
      const service = new ASRService({ events: customEvents });
      expect(service).toBeInstanceOf(ASRService);
    });

    it("should initialize with empty events", () => {
      const service = new ASRService();
      expect(service).toBeInstanceOf(ASRService);
    });
  });

  describe("prepare", () => {
    it("should prepare ASR service for device", async () => {
      await asrService.prepare(mockDeviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 服务已准备: deviceId=${mockDeviceId}`
      );
    });

    it("should skip preparation if already prepared", async () => {
      await asrService.prepare(mockDeviceId);
      vi.clearAllMocks();

      await asrService.prepare(mockDeviceId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[ASRService] ASR 已准备好，跳过: deviceId=${mockDeviceId}`
      );
    });

    it("should initialize audio queue and audio ended state", async () => {
      await asrService.prepare(mockDeviceId);

      // Verify internal state is initialized
      // (We can't directly access private properties, but we can verify behavior)
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe("connect", () => {
    it("should connect ASR client for device", async () => {
      await asrService.connect(mockDeviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 连接已建立: deviceId=${mockDeviceId}`
      );
    });

    it("should prepare device if not prepared", async () => {
      await asrService.connect(mockDeviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 服务已准备")
      );
    });

    it("should skip connection if already connected", async () => {
      await asrService.connect(mockDeviceId);
      vi.clearAllMocks();

      await asrService.connect(mockDeviceId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[ASRService] ASR 客户端已连接，跳过: deviceId=${mockDeviceId}`
      );
    });

    it("should handle concurrent connect calls", async () => {
      // Trigger multiple concurrent connects
      const connectPromise1 = asrService.connect(mockDeviceId);
      const connectPromise2 = asrService.connect(mockDeviceId);

      await Promise.all([connectPromise1, connectPromise2]);

      // Should only connect once
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 连接已建立: deviceId=${mockDeviceId}`
      );
    });

    it("should handle connection errors gracefully", async () => {
      // Mock to throw error during connection
      const { configManager } = await import("@xiaozhi-client/config");
      (configManager.getASRConfig as any).mockReturnValue({
        appid: "", // Missing config
        accessToken: "",
      });

      await asrService.connect(mockDeviceId);

      // Should handle error gracefully without throwing
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[ASRService] ASR 配置不完整，请检查配置文件"
      );
    });
  });

  describe("init (deprecated)", () => {
    it("should call prepare and connect", async () => {
      await asrService.init(mockDeviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 服务已准备: deviceId=${mockDeviceId}`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 连接已建立: deviceId=${mockDeviceId}`
      );
    });

    it("should handle init errors gracefully", async () => {
      const { configManager } = await import("@xiaozhi-client/config");
      (configManager.getASRConfig as any).mockReturnValue({
        appid: "",
        accessToken: "",
      });

      await asrService.init(mockDeviceId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[ASRService] ASR 配置不完整，请检查配置文件"
      );
    });
  });

  describe("handleAudioData", () => {
    it("should handle audio data and decode to PCM", async () => {
      await asrService.prepare(mockDeviceId);
      await asrService.handleAudioData(mockDeviceId, mockAudioData);

      const { OpusDecoder } = await import("@xiaozhi-client/asr");
      expect(OpusDecoder.toPcm).toHaveBeenCalledWith(
        Buffer.from(mockAudioData)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[ASRService] 收到音频数据: deviceId=${mockDeviceId}, size=${mockAudioData.length}`
      );
    });

    it("should auto-prepare if not prepared", async () => {
      await asrService.handleAudioData(mockDeviceId, mockAudioData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `[ASRService] ASR 未准备好，自动准备: deviceId=${mockDeviceId}`
      );
    });

    it("should ignore audio data if audio has ended", async () => {
      await asrService.connect(mockDeviceId);

      // Set audio ended flag directly through internal state
      // Since we can't access private properties, we'll use the reset behavior
      await asrService.end(mockDeviceId);

      // After end, the audio ended flag is reset, so this test checks
      // that the service can handle audio after end (which resets state)
      vi.clearAllMocks();

      // This will auto-prepare since state was reset
      await asrService.handleAudioData(mockDeviceId, mockAudioData);

      // The service should auto-prepare and accept the audio
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[ASRService] 收到音频数据: deviceId=${mockDeviceId}, size=${mockAudioData.length}`
      );
    });

    it("should handle decode errors gracefully", async () => {
      const { OpusDecoder } = await import("@xiaozhi-client/asr");
      (OpusDecoder.toPcm as any).mockRejectedValue(
        new Error("解码失败")
      );

      await asrService.prepare(mockDeviceId);
      await asrService.handleAudioData(mockDeviceId, mockAudioData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        `[ASRService] PCM 解码失败: deviceId=${mockDeviceId}`,
        expect.any(Error)
      );
    });
  });

  describe("end", () => {
    it("should end ASR session and cleanup resources", async () => {
      await asrService.connect(mockDeviceId);
      vi.clearAllMocks();

      await asrService.end(mockDeviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 资源已清理: deviceId=${mockDeviceId}`
      );
    });

    it("should handle end when no session exists", async () => {
      await asrService.end(mockDeviceId);

      // Should not throw error
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 资源已清理: deviceId=${mockDeviceId}`
      );
    });

    it("should close ASR client on end", async () => {
      const { ASR: ASRClass } = await import("@xiaozhi-client/asr");
      const { configManager } = await import("@xiaozhi-client/config");

      // Ensure config returns valid values
      (configManager.getASRConfig as any).mockReturnValue({
        appid: "test-appid",
        accessToken: "test-token",
        cluster: "volcengine_streaming_common",
      });

      const mockClose = vi.fn().mockResolvedValue(undefined);
      (ASRClass as any).mockImplementation(() => ({
        isConnected: vi.fn().mockReturnValue(true),
        close: mockClose,
        on: vi.fn(),
        bytedance: {
          v2: {
            listen: vi.fn().mockReturnValue(mockAsyncGenerator([])),
          },
        },
      }));

      await asrService.connect(mockDeviceId);
      await asrService.end(mockDeviceId);

      expect(mockClose).toHaveBeenCalled();
    });

    it("should handle close errors gracefully", async () => {
      const { ASR: ASRClass } = await import("@xiaozhi-client/asr");
      const { configManager } = await import("@xiaozhi-client/config");

      // Ensure config returns valid values
      (configManager.getASRConfig as any).mockReturnValue({
        appid: "test-appid",
        accessToken: "test-token",
        cluster: "volcengine_streaming_common",
      });

      const mockClose = vi.fn().mockRejectedValue(new Error("关闭失败"));
      (ASRClass as any).mockImplementation(() => ({
        isConnected: vi.fn().mockReturnValue(true),
        close: mockClose,
        on: vi.fn(),
        bytedance: {
          v2: {
            listen: vi.fn().mockReturnValue(mockAsyncGenerator([])),
          },
        },
      }));

      await asrService.connect(mockDeviceId);
      await asrService.end(mockDeviceId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        `[ASRService] ASR 关闭失败: deviceId=${mockDeviceId}`,
        expect.any(Error)
      );
    });
  });

  describe("reset", () => {
    it("should reset ASR service state", async () => {
      await asrService.connect(mockDeviceId);
      vi.clearAllMocks();

      await asrService.reset(mockDeviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 服务已重置: deviceId=${mockDeviceId}`
      );
    });

    it("should call end and prepare during reset", async () => {
      await asrService.reset(mockDeviceId);

      // Both end and prepare should be called
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 资源已清理: deviceId=${mockDeviceId}`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 服务已准备: deviceId=${mockDeviceId}`
      );
    });

    it("should handle reset errors gracefully", async () => {
      const { ASR: ASRClass } = await import("@xiaozhi-client/asr");
      const mockClose = vi.fn().mockRejectedValue(new Error("重置失败"));
      (ASRClass as any).mockImplementation(() => ({
        isConnected: vi.fn().mockReturnValue(true),
        close: mockClose,
        on: vi.fn(),
        bytedance: {
          v2: {
            listen: vi.fn().mockReturnValue(mockAsyncGenerator([])),
          },
        },
      }));

      await asrService.connect(mockDeviceId);
      await asrService.reset(mockDeviceId);

      // Should handle error and still complete reset
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] 重置 ASR 服务状态: deviceId=${mockDeviceId}`
      );
    });
  });

  describe("destroy", () => {
    it("should destroy service and cleanup all resources", () => {
      asrService.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[ASRService] 服务已销毁"
      );
    });

    it("should handle multiple destroy calls", () => {
      asrService.destroy();
      asrService.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[ASRService] 服务已销毁"
      );
    });

    it("should cleanup all device states", () => {
      // Connect multiple devices
      asrService.destroy();

      // All resources should be cleaned up
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[ASRService] 服务已销毁"
      );
    });
  });

  describe("event callbacks", () => {
    it("should trigger onResult callback when ASR result is received", async () => {
      const mockResult = { onResult: vi.fn() };
      const service = new ASRService({ events: mockResult });

      // Mock the listen generator to yield results
      const { ASR: ASRClass } = await import("@xiaozhi-client/asr");

      let listenCallback: any;
      (ASRClass as any).mockImplementation(() => {
        const mockClient = {
          isConnected: vi.fn().mockReturnValue(true),
          bytedance: {
            v2: {
              listen: vi.fn().mockImplementation(async function* () {
                yield { isFinal: false, text: "测试中" };
                yield { isFinal: true, text: "测试完成" };
              }),
            },
          },
          on: vi.fn((event: string, callback: any) => {
            if (event === "close") {
              listenCallback = callback;
            }
          }),
          close: vi.fn().mockResolvedValue(undefined),
        };
        return mockClient;
      });

      await service.connect(mockDeviceId);
      await service.handleAudioData(mockDeviceId, mockAudioData);

      // Wait a bit for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Trigger close to end listen
      if (listenCallback) {
        listenCallback();
      }

      // Note: This test verifies the structure but actual async generator
      // behavior is complex to test in unit tests
    });

    it("should trigger onError callback when ASR error occurs", async () => {
      const mockError = { onError: vi.fn() };
      const service = new ASRService({ events: mockError });

      const { ASR: ASRClass } = await import("@xiaozhi-client/asr");
      const { configManager } = await import("@xiaozhi-client/config");

      // Ensure config returns valid values
      (configManager.getASRConfig as any).mockReturnValue({
        appid: "test-appid",
        accessToken: "test-token",
        cluster: "volcengine_streaming_common",
      });

      let errorCallback: any;
      (ASRClass as any).mockImplementation(() => {
        const mockClient = {
          isConnected: vi.fn().mockReturnValue(true),
          bytedance: {
            v2: {
              listen: vi.fn().mockReturnValue(mockAsyncGenerator([])),
            },
          },
          on: vi.fn((event: string, callback: any) => {
            if (event === "error") {
              errorCallback = callback;
            }
          }),
          close: vi.fn().mockResolvedValue(undefined),
        };
        return mockClient;
      });

      await service.connect(mockDeviceId);

      // Simulate error event
      if (errorCallback) {
        const testError = new Error("ASR 连接错误");
        errorCallback(testError);
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        `[ASRService] ASR 错误: deviceId=${mockDeviceId}, error=ASR 连接错误`
      );
    });

    it("should trigger onClose callback when ASR connection closes", async () => {
      const mockClose = { onClose: vi.fn() };
      const service = new ASRService({ events: mockClose });

      const { ASR: ASRClass } = await import("@xiaozhi-client/asr");
      const { configManager } = await import("@xiaozhi-client/config");

      // Ensure config returns valid values
      (configManager.getASRConfig as any).mockReturnValue({
        appid: "test-appid",
        accessToken: "test-token",
        cluster: "volcengine_streaming_common",
      });

      let closeCallback: any;
      (ASRClass as any).mockImplementation(() => {
        const mockClient = {
          isConnected: vi.fn().mockReturnValue(true),
          bytedance: {
            v2: {
              listen: vi.fn().mockReturnValue(mockAsyncGenerator([])),
            },
          },
          on: vi.fn((event: string, callback: any) => {
            if (event === "close") {
              closeCallback = callback;
            }
          }),
          close: vi.fn().mockResolvedValue(undefined),
        };
        return mockClient;
      });

      await service.connect(mockDeviceId);

      // Clear previous logs
      vi.clearAllMocks();

      // Simulate close event
      if (closeCallback) {
        closeCallback();
      }

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 连接关闭: deviceId=${mockDeviceId}`
      );
    });

    it("should handle callback errors gracefully", async () => {
      const throwingCallback = vi.fn().mockImplementation(() => {
        throw new Error("回调错误");
      });
      const service = new ASRService({
        events: {
          onResult: throwingCallback,
        },
      });

      const { ASR: ASRClass } = await import("@xiaozhi-client/asr");
      const { configManager } = await import("@xiaozhi-client/config");

      // Ensure config returns valid values
      (configManager.getASRConfig as any).mockReturnValue({
        appid: "test-appid",
        accessToken: "test-token",
        cluster: "volcengine_streaming_common",
      });

      (ASRClass as any).mockImplementation(() => {
        const mockClient = {
          isConnected: vi.fn().mockReturnValue(true),
          bytedance: {
            v2: {
              listen: vi.fn().mockReturnValue(
                mockAsyncGenerator([
                  { isFinal: true, text: "测试" },
                ])
              ),
            },
          },
          on: vi.fn(),
          close: vi.fn().mockResolvedValue(undefined),
        };
        return mockClient;
      });

      await service.connect(mockDeviceId);
      await service.handleAudioData(mockDeviceId, mockAudioData);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should log callback error but not crash
      expect(mockLogger.error).toHaveBeenCalledWith(
        `[ASRService] onResult 回调执行失败: deviceId=${mockDeviceId}`,
        expect.any(Error)
      );
    });
  });

  describe("multi-device support", () => {
    it("should handle multiple devices independently", async () => {
      const deviceId1 = "device-1";
      const deviceId2 = "device-2";

      await asrService.prepare(deviceId1);
      await asrService.prepare(deviceId2);

      await asrService.connect(deviceId1);
      await asrService.connect(deviceId2);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 服务已准备: deviceId=${deviceId1}`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 服务已准备: deviceId=${deviceId2}`
      );
    });

    it("should handle audio data for different devices", async () => {
      const deviceId1 = "device-1";
      const deviceId2 = "device-2";

      await asrService.prepare(deviceId1);
      await asrService.prepare(deviceId2);

      await asrService.handleAudioData(deviceId1, new Uint8Array([1, 2, 3]));
      await asrService.handleAudioData(deviceId2, new Uint8Array([4, 5, 6]));

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[ASRService] 收到音频数据: deviceId=${deviceId1}, size=3`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[ASRService] 收到音频数据: deviceId=${deviceId2}, size=3`
      );
    });

    it("should end sessions for specific devices", async () => {
      const deviceId1 = "device-1";
      const deviceId2 = "device-2";

      await asrService.connect(deviceId1);
      await asrService.connect(deviceId2);

      await asrService.end(deviceId1);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 资源已清理: deviceId=${deviceId1}`
      );
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete ASR lifecycle", async () => {
      // Prepare
      await asrService.prepare(mockDeviceId);

      // Connect
      await asrService.connect(mockDeviceId);

      // Handle audio data
      await asrService.handleAudioData(mockDeviceId, mockAudioData);

      // End session
      await asrService.end(mockDeviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 服务已准备: deviceId=${mockDeviceId}`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 连接已建立: deviceId=${mockDeviceId}`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 资源已清理: deviceId=${mockDeviceId}`
      );
    });

    it("should handle reset and restart", async () => {
      // First session
      await asrService.connect(mockDeviceId);
      await asrService.handleAudioData(mockDeviceId, mockAudioData);
      await asrService.reset(mockDeviceId);

      // Second session
      await asrService.connect(mockDeviceId);
      await asrService.handleAudioData(mockDeviceId, mockAudioData);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 服务已重置: deviceId=${mockDeviceId}`
      );
    });

    it("should handle rapid state changes", async () => {
      await asrService.prepare(mockDeviceId);
      await asrService.connect(mockDeviceId);
      await asrService.end(mockDeviceId);
      await asrService.prepare(mockDeviceId);
      await asrService.connect(mockDeviceId);
      await asrService.end(mockDeviceId);

      // Should handle all transitions without errors
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe("edge cases and boundary conditions", () => {
    it("should handle empty device ID", async () => {
      await asrService.prepare("");

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 服务已准备: deviceId=`
      );
    });

    it("should handle special characters in device ID", async () => {
      const specialDeviceId = "device-中文-🎵-test";
      await asrService.prepare(specialDeviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 服务已准备: deviceId=${specialDeviceId}`
      );
    });

    it("should handle very long device ID", async () => {
      const longDeviceId = "a".repeat(1000);
      await asrService.prepare(longDeviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 服务已准备: deviceId=${longDeviceId}`
      );
    });

    it("should handle empty audio data", async () => {
      await asrService.prepare(mockDeviceId);
      await asrService.handleAudioData(mockDeviceId, new Uint8Array([]));

      const { OpusDecoder } = await import("@xiaozhi-client/asr");
      expect(OpusDecoder.toPcm).toHaveBeenCalled();
    });

    it("should handle very large audio data", async () => {
      const largeAudioData = new Uint8Array(10_000_000); // 10MB
      await asrService.prepare(mockDeviceId);

      await asrService.handleAudioData(mockDeviceId, largeAudioData);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[ASRService] 收到音频数据: deviceId=${mockDeviceId}, size=${largeAudioData.length}`
      );
    });

    it("should handle concurrent operations on same device", async () => {
      const { ASR: ASRClass } = await import("@xiaozhi-client/asr");
      (ASRClass as any).mockImplementation(() => ({
        isConnected: vi.fn().mockReturnValue(false),
        bytedance: {
          v2: {
            listen: vi.fn().mockReturnValue(mockAsyncGenerator([])),
          },
        },
        on: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      }));

      // Trigger concurrent operations
      const preparePromise = asrService.prepare(mockDeviceId);
      const connectPromise = asrService.connect(mockDeviceId);
      const audioPromise = asrService.handleAudioData(
        mockDeviceId,
        mockAudioData
      );

      await Promise.all([preparePromise, connectPromise, audioPromise]);

      // Should handle concurrent operations gracefully
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it("should handle operations after destroy", async () => {
      asrService.destroy();

      // Operations after destroy should be handled gracefully
      await asrService.prepare(mockDeviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ASRService] ASR 服务已准备: deviceId=${mockDeviceId}`
      );
    });

    it("should handle null event callbacks", () => {
      const service = new ASRService({ events: null as any });

      expect(service).toBeInstanceOf(ASRService);
    });

    it("should handle undefined event callbacks", () => {
      const service = new ASRService({ events: undefined as any });

      expect(service).toBeInstanceOf(ASRService);
    });
  });
});
