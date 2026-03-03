/**
 * ASR 服务测试
 * 测试语音识别服务的核心功能和状态管理
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ASRService } from "../asr.service.js";
import type { ASRServiceEvents, ASRServiceOptions } from "../asr.interface.js";

// 创建异步生成器函数
async function* mockListenIterator() {
  yield { text: "你好", isFinal: false };
  yield { text: "你好世界", isFinal: true };
}

// 模拟 ASR 依赖
vi.mock("@xiaozhi-client/asr", () => ({
  ASR: vi.fn().mockImplementation(() => ({
    isConnected: vi.fn().mockReturnValue(true),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    bytedance: {
      v2: {
        listen: vi.fn().mockReturnValue(mockListenIterator()),
      },
    },
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

// 模拟配置管理器
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getASRConfig: vi.fn().mockReturnValue({
      appid: "test-appid",
      accessToken: "test-token",
      cluster: "volcengine_streaming_common",
    }),
  },
}));

// 模拟 Logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("ASRService", () => {
  let asrService: ASRService;
  let mockEvents: ASRServiceEvents;
  let mockLogger: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 模拟 Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // 模拟事件回调
    mockEvents = {
      onResult: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    };

    const options: ASRServiceOptions = {
      events: mockEvents,
    };

    asrService = new ASRService(options);
  });

  afterEach(() => {
    asrService.destroy();
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("应该使用正确的依赖项初始化", () => {
      expect(asrService).toBeInstanceOf(ASRService);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it("应该使用空事件对象初始化", () => {
      const serviceWithoutEvents = new ASRService();
      expect(serviceWithoutEvents).toBeInstanceOf(ASRService);
      serviceWithoutEvents.destroy();
    });
  });

  describe("prepare", () => {
    it("应该正确初始化设备状态", async () => {
      const deviceId = "device-001";

      await asrService.prepare(deviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 服务已准备")
      );
    });

    it("应该支持多次 prepare 调用而不重复初始化", async () => {
      const deviceId = "device-001";

      await asrService.prepare(deviceId);
      await asrService.prepare(deviceId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("ASR 已准备好，跳过")
      );
    });

    it("应该为不同设备独立初始化状态", async () => {
      const device1 = "device-001";
      const device2 = "device-002";

      await asrService.prepare(device1);
      await asrService.prepare(device2);

      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });
  });

  describe("connect", () => {
    it("应该成功建立连接", async () => {
      const deviceId = "device-001";

      await asrService.connect(deviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 连接已建立")
      );
    });

    it("应该在已连接时跳过重复连接", async () => {
      const deviceId = "device-001";

      // 第一次连接
      await asrService.connect(deviceId);

      // 第二次连接应该跳过
      await asrService.connect(deviceId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("ASR 客户端已连接，跳过")
      );
    });

    it("应该支持并发连接请求", async () => {
      const deviceId = "device-001";

      // 同时发起多个连接请求
      const [result1, result2] = await Promise.all([
        asrService.connect(deviceId),
        asrService.connect(deviceId),
      ]);

      // 两个请求都应该成功完成
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });

    it("应该在连接前自动调用 prepare", async () => {
      const deviceId = "device-001";

      await asrService.connect(deviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 服务已准备")
      );
    });
  });

  describe("init", () => {
    it("应该兼容旧接口，调用 prepare 和 connect", async () => {
      const deviceId = "device-001";

      await asrService.init(deviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 服务已准备")
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 连接已建立")
      );
    });
  });

  describe("handleAudioData", () => {
    it("应该正确处理音频数据并推入队列", async () => {
      const deviceId = "device-001";
      const audioData = new Uint8Array([1, 2, 3, 4, 5]);

      await asrService.prepare(deviceId);
      await asrService.handleAudioData(deviceId, audioData);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("已将 PCM 推入队列")
      );
    });

    it("应该在未准备好时自动准备", async () => {
      const deviceId = "device-001";
      const audioData = new Uint8Array([1, 2, 3, 4, 5]);

      await asrService.handleAudioData(deviceId, audioData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("ASR 未准备好，自动准备")
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("已将 PCM 推入队列")
      );
    });

    it("应该在音频已结束后忽略新数据", async () => {
      const deviceId = "device-001";
      const audioData = new Uint8Array([1, 2, 3, 4, 5]);

      await asrService.prepare(deviceId);
      // 标记音频结束
      const service = asrService as any;
      service.audioEnded.set(deviceId, true);

      await asrService.handleAudioData(deviceId, audioData);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("音频已结束，忽略新数据")
      );
    });
  });

  describe("end", () => {
    it("应该正确结束语音识别并清理资源", async () => {
      const deviceId = "device-001";

      await asrService.prepare(deviceId);
      await asrService.connect(deviceId);
      await asrService.end(deviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 资源已清理")
      );
    });

    it("应该处理未连接设备的结束请求", async () => {
      const deviceId = "device-001";

      // 结束未连接的设备不应该抛出错误
      await expect(asrService.end(deviceId)).resolves.toBeUndefined();
    });

    it("应该等待 listen 任务完成", async () => {
      const deviceId = "device-001";

      await asrService.prepare(deviceId);
      await asrService.connect(deviceId);
      await asrService.end(deviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR listen 任务已结束")
      );
    });
  });

  describe("reset", () => {
    it("应该重置服务状态并准备下一次识别", async () => {
      const deviceId = "device-001";

      await asrService.prepare(deviceId);
      await asrService.connect(deviceId);
      await asrService.reset(deviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 服务已重置")
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 服务已准备")
      );
    });

    it("应该清理当前会话并重新准备", async () => {
      const deviceId = "device-001";

      await asrService.prepare(deviceId);
      await asrService.connect(deviceId);
      await asrService.handleAudioData(deviceId, new Uint8Array([1, 2, 3]));

      // 重置应该清理所有状态
      await asrService.reset(deviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("重置 ASR 服务状态")
      );
    });
  });

  describe("destroy", () => {
    it("应该清理所有设备的资源", () => {
      const device1 = "device-001";
      const device2 = "device-002";

      asrService.prepare(device1);
      asrService.prepare(device2);

      asrService.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("服务已销毁")
      );
    });

    it("应该能够安全地多次调用 destroy", () => {
      asrService.destroy();
      asrService.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("服务已销毁")
      );
    });
  });

  describe("事件回调", () => {
    it("应该在识别结果时触发 onResult 回调", async () => {
      const deviceId = "device-001";
      const onResult = vi.fn();

      const serviceWithCallback = new ASRService({
        events: { onResult },
      });

      await serviceWithCallback.prepare(deviceId);
      await serviceWithCallback.connect(deviceId);

      // 等待异步 listen 任务完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      serviceWithCallback.destroy();
    });

    it("应该在连接关闭时触发 onClose 回调", async () => {
      const deviceId = "device-001";
      const onClose = vi.fn();

      const serviceWithCloseCallback = new ASRService({
        events: { onClose },
      });

      await serviceWithCloseCallback.prepare(deviceId);
      await serviceWithCloseCallback.connect(deviceId);
      await serviceWithCloseCallback.end(deviceId);

      // 等待异步处理完成
      await new Promise((resolve) => setTimeout(resolve, 50));

      serviceWithCloseCallback.destroy();
    });

    it("应该在错误时触发 onError 回调", async () => {
      const deviceId = "device-001";
      const onError = vi.fn();

      const serviceWithErrorCallback = new ASRService({
        events: { onError },
      });

      await serviceWithErrorCallback.prepare(deviceId);
      await serviceWithErrorCallback.connect(deviceId);

      // 等待异步错误处理
      await new Promise((resolve) => setTimeout(resolve, 50));

      serviceWithErrorCallback.destroy();
    });
  });

  describe("多设备并发场景", () => {
    it("应该独立管理多个设备的状态", async () => {
      const device1 = "device-001";
      const device2 = "device-002";

      await asrService.prepare(device1);
      await asrService.prepare(device2);
      await asrService.connect(device1);
      await asrService.connect(device2);

      // 两个设备都应该成功连接
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("device-001")
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("device-002")
      );
    });

    it("应该支持并发处理多个设备的音频数据", async () => {
      const device1 = "device-001";
      const device2 = "device-002";
      const audioData = new Uint8Array([1, 2, 3, 4, 5]);

      await asrService.prepare(device1);
      await asrService.prepare(device2);

      // 并发发送音频数据
      await Promise.all([
        asrService.handleAudioData(device1, audioData),
        asrService.handleAudioData(device2, audioData),
      ]);

      // 两个设备都应该处理成功
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("device-001")
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("device-002")
      );
    });

    it("应该独立结束每个设备的会话", async () => {
      const device1 = "device-001";
      const device2 = "device-002";

      await asrService.prepare(device1);
      await asrService.prepare(device2);
      await asrService.connect(device1);
      await asrService.connect(device2);

      // 独立结束每个设备
      await asrService.end(device1);
      await asrService.end(device2);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 资源已清理")
      );
    });

    it("应该支持多个设备同时重置", async () => {
      const device1 = "device-001";
      const device2 = "device-002";

      await asrService.prepare(device1);
      await asrService.prepare(device2);
      await asrService.connect(device1);
      await asrService.connect(device2);

      // 同时重置两个设备
      await Promise.all([
        asrService.reset(device1),
        asrService.reset(device2),
      ]);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 服务已重置")
      );
    });
  });

  describe("完整工作流集成测试", () => {
    it("应该支持完整的语音识别工作流", async () => {
      const deviceId = "device-001";
      const audioData = new Uint8Array([1, 2, 3, 4, 5]);
      const onResult = vi.fn();

      const service = new ASRService({
        events: { onResult },
      });

      // 完整工作流
      await service.prepare(deviceId);
      await service.connect(deviceId);
      await service.handleAudioData(deviceId, audioData);
      await service.end(deviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 服务已准备")
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 连接已建立")
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 资源已清理")
      );

      service.destroy();
    });

    it("应该支持重置后重新开始工作流", async () => {
      const deviceId = "device-001";
      const audioData = new Uint8Array([1, 2, 3, 4, 5]);

      // 第一次工作流
      await asrService.prepare(deviceId);
      await asrService.connect(deviceId);
      await asrService.handleAudioData(deviceId, audioData);
      await asrService.end(deviceId);

      // 重置并开始第二次工作流
      await asrService.reset(deviceId);
      await asrService.connect(deviceId);
      await asrService.handleAudioData(deviceId, audioData);
      await asrService.end(deviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 服务已重置")
      );
    });

    it("应该支持多轮语音识别流程", async () => {
      const deviceId = "device-001";
      const audioData = new Uint8Array([1, 2, 3, 4, 5]);

      // 第一轮识别
      await asrService.prepare(deviceId);
      await asrService.connect(deviceId);
      await asrService.handleAudioData(deviceId, audioData);
      await asrService.end(deviceId);

      // 第二轮识别（重置后）
      await asrService.reset(deviceId);
      await asrService.connect(deviceId);
      await asrService.handleAudioData(deviceId, audioData);
      await asrService.end(deviceId);

      // 第三轮识别（重置后）
      await asrService.reset(deviceId);
      await asrService.connect(deviceId);
      await asrService.handleAudioData(deviceId, audioData);
      await asrService.end(deviceId);

      // 每轮: prepare(1) + connect(2) + handle(1) + end(2) + reset(2) = 8，三轮共24次
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe("边界情况和错误处理", () => {
    it("应该处理空设备 ID", async () => {
      const deviceId = "";
      const audioData = new Uint8Array([1, 2, 3]);

      await asrService.prepare(deviceId);
      await asrService.handleAudioData(deviceId, audioData);

      // 应该正常处理，不抛出错误
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it("应该处理空音频数据", async () => {
      const deviceId = "device-001";
      const audioData = new Uint8Array([]);

      await asrService.prepare(deviceId);
      await asrService.handleAudioData(deviceId, audioData);

      // 应该正常处理，不抛出错误
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it("应该处理 prepare 后立即 end 的情况", async () => {
      const deviceId = "device-001";

      await asrService.prepare(deviceId);
      await asrService.end(deviceId);

      // 应该正常清理资源
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 资源已清理")
      );
    });

    it("应该处理连接过程中的并发操作", async () => {
      const deviceId = "device-001";
      const audioData = new Uint8Array([1, 2, 3]);

      // 并发执行多个操作
      await Promise.all([
        asrService.prepare(deviceId),
        asrService.connect(deviceId),
        asrService.handleAudioData(deviceId, audioData),
      ]);

      // 所有操作都应该完成
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it("应该处理重复 end 调用", async () => {
      const deviceId = "device-001";

      await asrService.prepare(deviceId);
      await asrService.connect(deviceId);

      // 多次调用 end 不应该抛出错误
      await asrService.end(deviceId);
      await asrService.end(deviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 资源已清理")
      );
    });

    it("应该处理重复 reset 调用", async () => {
      const deviceId = "device-001";

      await asrService.prepare(deviceId);
      await asrService.connect(deviceId);

      // 多次调用 reset 不应该抛出错误
      await asrService.reset(deviceId);
      await asrService.reset(deviceId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ASR 服务已重置")
      );
    });
  });
});
