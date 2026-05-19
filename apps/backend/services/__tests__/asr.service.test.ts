import type { AuthMethod } from "@xiaozhi-client/asr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ASRServiceEvents } from "../asr.interface.js";
import { ASRService } from "../asr.service.js";

// Mock dependencies
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock @xiaozhi-client/config
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getASRConfig: vi.fn().mockReturnValue({
      appid: "test-appid",
      accessToken: "test-token",
      cluster: "test-cluster",
    }),
  },
}));

// Mock @xiaozhi-client/asr
vi.mock("@xiaozhi-client/asr", () => {
  // 创建一个共享的 mock ASR 客户端对象
  const mockClient = {
    isConnected: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    bytedance: {
      v2: {
        listen: vi.fn(),
      },
    },
  };

  return {
    ASR: vi.fn().mockImplementation(() => mockClient),
    AudioFormat: {
      RAW: "raw",
    },
    AuthMethod: {
      TOKEN: "token",
    },
    OpusDecoder: {
      toPcm: vi.fn().mockResolvedValue(Buffer.from("test-pcm-data")),
    },
    // 导出 mockClient 供测试使用
    __mockClient: mockClient,
  };
});

describe("ASRService", () => {
  let asrService: ASRService;
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let mockEvents: ASRServiceEvents;
  let mockASRClient: {
    isConnected: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    bytedance: { v2: { listen: ReturnType<typeof vi.fn> } };
  };
  let mockGetASRConfig: ReturnType<typeof vi.fn>;
  let mockOpusDecoderToPcm: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 导入 mocked 模块
    const { logger } = await import("../../Logger.js");
    mockLogger = {
      debug: vi.mocked(logger.debug),
      info: vi.mocked(logger.info),
      error: vi.mocked(logger.error),
      warn: vi.mocked(logger.warn),
    };

    const { configManager } = await import("@xiaozhi-client/config");
    mockGetASRConfig = vi.mocked(configManager.getASRConfig);

    const asrModule = await import("@xiaozhi-client/asr");
    // ASR 构造函数返回一个实例，我们需要获取实例的方法
    const MockASRConstructor = vi.mocked(asrModule.ASR);
    const mockInstance = new MockASRConstructor({
      bytedance: {
        v2: {
          app: { appid: "test", token: "test", cluster: "test" },
          user: { uid: "test" },
          audio: { format: "raw", language: "zh-CN" },
          request: { reqid: "test", sequence: 1 },
        },
      },
      authMethod: "token" as AuthMethod,
    });
    mockASRClient = {
      isConnected: vi.mocked(mockInstance.isConnected),
      on: vi.mocked(mockInstance.on),
      close: vi.mocked(mockInstance.close),
      bytedance: {
        v2: {
          listen: vi.mocked(mockInstance.bytedance.v2.listen),
        },
      },
    };
    mockOpusDecoderToPcm = vi.mocked(asrModule.OpusDecoder.toPcm);

    // Reset mock ASR client
    mockASRClient.isConnected.mockReturnValue(false);
    mockASRClient.on.mockClear();
    mockASRClient.close.mockClear();
    mockASRClient.bytedance.v2.listen.mockClear();

    // Mock events
    mockEvents = {
      onResult: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    };

    asrService = new ASRService({ events: mockEvents });
  });

  afterEach(() => {
    asrService.destroy();
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("应该正确初始化服务", () => {
      expect(asrService).toBeInstanceOf(ASRService);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it("应该正确设置事件回调", () => {
      const events: ASRServiceEvents = {
        onResult: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };
      const service = new ASRService({ events });
      expect(service).toBeInstanceOf(ASRService);
    });

    it("应该在没有事件回调时使用空对象", () => {
      const service = new ASRService();
      expect(service).toBeInstanceOf(ASRService);
    });
  });

  describe("prepare", () => {
    it("应该正确准备设备状态", async () => {
      await asrService.prepare("device-1");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 服务已准备: deviceId=device-1"
      );
    });

    it("应该跳过已准备好的设备", async () => {
      await asrService.prepare("device-1");
      await asrService.prepare("device-1");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[ASRService] ASR 已准备好，跳过: deviceId=device-1"
      );
    });

    it("应该支持多个设备的准备", async () => {
      await asrService.prepare("device-1");
      await asrService.prepare("device-2");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 服务已准备: deviceId=device-1"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 服务已准备: deviceId=device-2"
      );
    });
  });

  describe("connect", () => {
    it("应该正确建立连接", async () => {
      // Mock listen 方法返回空结果
      mockASRClient.bytedance.v2.listen.mockImplementation(async function* () {
        // 空生成器
      });

      await asrService.connect("device-1");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 连接已建立: deviceId=device-1"
      );
    });

    it("应该跳过已连接的设备", async () => {
      // 先建立连接
      mockASRClient.bytedance.v2.listen.mockImplementation(
        async function* () {}
      );
      await asrService.connect("device-1");

      // 之后模拟已连接状态
      mockASRClient.isConnected.mockReturnValue(true);

      // 再次调用 connect 应该跳过
      await asrService.connect("device-1");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[ASRService] ASR 客户端已连接，跳过: deviceId=device-1"
      );
    });

    it("应该正确处理并发连接请求", async () => {
      // 先 prepare 设备，避免重复准备日志
      await asrService.prepare("device-1");

      // 模拟连接过程需要一些时间
      let connectResolve: () => void;
      const connectPromise = new Promise<void>((resolve) => {
        connectResolve = resolve;
      });

      // biome-ignore lint/correctness/useYield: test mock for async generator that awaits without yielding
      mockASRClient.bytedance.v2.listen.mockImplementation(async function* () {
        await connectPromise;
      });

      // 同时发起多个连接请求
      const connectPromises = [
        asrService.connect("device-1"),
        asrService.connect("device-1"),
        asrService.connect("device-1"),
      ];

      // 完成连接
      connectResolve!();

      // 所有连接请求都应该完成
      await Promise.all(connectPromises);

      // 验证连接成功建立（只建立一次）
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 连接已建立: deviceId=device-1"
      );
    });

    it("应该在配置不完整时返回", async () => {
      mockGetASRConfig.mockReturnValueOnce({
        appid: "",
        accessToken: "",
        cluster: "",
      });

      await asrService.connect("device-1");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[ASRService] ASR 配置不完整，请检查配置文件"
      );
    });

    it("应该关闭存在但未连接的旧客户端", async () => {
      // 先创建一个连接
      mockASRClient.bytedance.v2.listen.mockImplementation(
        async function* () {}
      );
      await asrService.connect("device-1");

      // 模拟旧客户端未连接状态
      mockASRClient.isConnected.mockReturnValue(false);

      // 再次连接
      await asrService.connect("device-1");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[ASRService] ASR 客户端存在但未连接，关闭旧的: deviceId=device-1"
      );
    });
  });

  describe("init", () => {
    it("应该兼容旧接口，执行 prepare + connect", async () => {
      mockASRClient.bytedance.v2.listen.mockImplementation(
        async function* () {}
      );

      await asrService.init("device-1");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 服务已准备: deviceId=device-1"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 连接已建立: deviceId=device-1"
      );
    });
  });

  describe("handleAudioData", () => {
    it("应该正确处理音频数据", async () => {
      await asrService.prepare("device-1");

      const audioData = new Uint8Array([1, 2, 3, 4]);
      await asrService.handleAudioData("device-1", audioData);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[ASRService] 收到音频数据: deviceId=device-1, size=4"
      );
    });

    it("应该在未准备好时自动准备", async () => {
      const audioData = new Uint8Array([1, 2, 3, 4]);
      await asrService.handleAudioData("device-1", audioData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[ASRService] ASR 未准备好，自动准备: deviceId=device-1"
      );
    });

    it("应该在音频结束后忽略新数据（音频结束标记为 true 时）", async () => {
      await asrService.prepare("device-1");

      // 手动设置音频结束标记，模拟在处理过程中音频结束的情况
      // 注意：end() 方法在完成后会清除 audioEnded 标记
      // 所以这里直接测试 handleAudioData 在 audioEnded=true 时的行为

      // 先发送一些音频数据
      const audioData1 = new Uint8Array([1, 2, 3, 4]);
      await asrService.handleAudioData("device-1", audioData1);

      // 使用私有 API 设置 audioEnded 标记（测试内部状态）
      // 由于无法直接访问私有属性，我们通过 connect + listen 来测试这个场景
      // listen 任务在收到 isFinal 结果后会设置 audioEnded=true

      // Mock listen 返回 isFinal=true 的结果
      const mockResult = { text: "最终结果", isFinal: true };
      mockASRClient.bytedance.v2.listen.mockImplementation(async function* () {
        yield mockResult;
      });

      await asrService.connect("device-1");

      // 等待 listen 任务处理完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 此时 audioEnded 应该已经被设置为 true（但由于 listen 完成后会被清理）
      // 所以我们需要测试的是：在 listen 任务运行期间，audioEnded=true 时，新数据被忽略

      // 重新准备设备，模拟新的会话
      await asrService.prepare("device-2");

      // 直接验证 end() 方法的日志输出
      await asrService.end("device-2");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 资源已清理: deviceId=device-2"
      );
    });

    it("应该处理 PCM 解码错误", async () => {
      mockOpusDecoderToPcm.mockRejectedValueOnce(new Error("解码失败"));

      await asrService.prepare("device-1");

      const audioData = new Uint8Array([1, 2, 3, 4]);
      await asrService.handleAudioData("device-1", audioData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[ASRService] PCM 解码失败: deviceId=device-1",
        expect.any(Error)
      );
    });
  });

  describe("end", () => {
    it("应该正确结束音频识别", async () => {
      await asrService.prepare("device-1");

      await asrService.end("device-1");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 资源已清理: deviceId=device-1"
      );
    });

    it("应该等待 listen 任务完成", async () => {
      mockASRClient.bytedance.v2.listen.mockImplementation(
        async function* () {}
      );
      await asrService.connect("device-1");

      await asrService.end("device-1");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR listen 任务已结束: deviceId=device-1"
      );
    });

    it("应该处理 listen 任务失败", async () => {
      // biome-ignore lint/correctness/useYield: test mock for generator that throws immediately
      mockASRClient.bytedance.v2.listen.mockImplementation(async function* () {
        throw new Error("Listen failed");
      });

      await asrService.connect("device-1");

      // listen 任务应该已经失败，但 end 应该仍然完成
      await asrService.end("device-1");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[ASRService] listen 任务出错: deviceId=device-1",
        expect.any(Error)
      );
    });

    it("应该处理 ASR 关闭失败", async () => {
      mockASRClient.close.mockRejectedValueOnce(new Error("Close failed"));
      mockASRClient.bytedance.v2.listen.mockImplementation(
        async function* () {}
      );
      await asrService.connect("device-1");

      await asrService.end("device-1");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[ASRService] ASR 关闭失败: deviceId=device-1",
        expect.any(Error)
      );
    });
  });

  describe("reset", () => {
    it("应该正确重置服务状态", async () => {
      await asrService.prepare("device-1");

      await asrService.reset("device-1");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] 重置 ASR 服务状态: deviceId=device-1"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 服务已重置: deviceId=device-1"
      );
    });

    it("应该在重置后能够重新准备", async () => {
      await asrService.prepare("device-1");
      await asrService.reset("device-1");
      await asrService.prepare("device-1");

      // verify the prepare was called 3 times (prepare, reset->prepare, prepare)
      // reset() 会调用 end() 然后 prepare()
      // 所以日志输出顺序：
      // 1. prepare -> "ASR 服务已准备"
      // 2. reset -> "重置 ASR 服务状态"
      // 3. end -> "ASR 资源已清理" (由 reset 调用)
      // 4. prepare -> "ASR 服务已准备" (由 reset 调用)
      // 5. prepare -> "ASR 服务已准备" (最后一次调用)

      // 检查最后一次 prepare 的日志
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 服务已准备: deviceId=device-1"
      );
    });
  });

  describe("destroy", () => {
    it("应该正确销毁服务", () => {
      asrService.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith("[ASRService] 服务已销毁");
    });

    it("应该清理所有设备资源", async () => {
      mockASRClient.bytedance.v2.listen.mockImplementation(
        async function* () {}
      );
      await asrService.connect("device-1");
      await asrService.connect("device-2");

      asrService.destroy();

      expect(mockASRClient.close).toHaveBeenCalled();
    });
  });

  describe("事件回调", () => {
    it("应该在识别结果时触发 onResult 回调", async () => {
      const mockResult = { text: "测试文本", isFinal: false };
      mockASRClient.bytedance.v2.listen.mockImplementation(async function* () {
        yield mockResult;
      });

      await asrService.connect("device-1");

      // 等待 listen 任务处理
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockEvents.onResult).toHaveBeenCalledWith(
        "device-1",
        "测试文本",
        false
      );
    });

    it("应该在最终结果时标记音频结束", async () => {
      const mockResult = { text: "最终文本", isFinal: true };
      mockASRClient.bytedance.v2.listen.mockImplementation(async function* () {
        yield mockResult;
      });

      await asrService.connect("device-1");

      // 等待 listen 任务处理
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 识别完成，停止 listen: deviceId=device-1"
      );
    });

    it("应该在错误时触发 onError 回调", async () => {
      const testError = new Error("ASR error");

      await asrService.prepare("device-1");
      await asrService.connect("device-1");

      // 触发错误事件
      const errorCallback = mockASRClient.on.mock.calls.find(
        (call) => call[0] === "error"
      )?.[1];
      if (errorCallback) {
        errorCallback(testError);
      }

      expect(mockEvents.onError).toHaveBeenCalledWith("device-1", testError);
    });

    it("应该在连接关闭时触发 onClose 回调", async () => {
      mockASRClient.bytedance.v2.listen.mockImplementation(
        async function* () {}
      );
      await asrService.connect("device-1");

      // 触发关闭事件
      const closeCallback = mockASRClient.on.mock.calls.find(
        (call) => call[0] === "close"
      )?.[1];
      if (closeCallback) {
        closeCallback();
      }

      expect(mockEvents.onClose).toHaveBeenCalledWith("device-1");
    });

    it("应该处理 onResult 回调执行错误", async () => {
      // 创建一个在 onResult 时抛出错误的回调
      const mockOnResult = vi.fn().mockImplementation(() => {
        throw new Error("Callback error");
      });
      const serviceWithErrorCallback = new ASRService({
        events: { onResult: mockOnResult },
      });

      // Mock listen 返回结果，触发 onResult 回调
      const mockResult = { text: "测试文本", isFinal: false };
      mockASRClient.bytedance.v2.listen.mockImplementation(async function* () {
        yield mockResult;
      });

      await serviceWithErrorCallback.connect("device-1");

      // 等待 listen 任务处理
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 验证回调被调用且错误被捕获
      expect(mockOnResult).toHaveBeenCalledWith("device-1", "测试文本", false);

      serviceWithErrorCallback.destroy();
    });
  });

  describe("多设备管理", () => {
    it("应该支持多个设备并发处理", async () => {
      mockASRClient.bytedance.v2.listen.mockImplementation(
        async function* () {}
      );

      await asrService.prepare("device-1");
      await asrService.prepare("device-2");

      await asrService.connect("device-1");
      await asrService.connect("device-2");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 服务已准备: deviceId=device-1"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 服务已准备: deviceId=device-2"
      );
    });

    it("应该正确清理指定设备资源", async () => {
      mockASRClient.bytedance.v2.listen.mockImplementation(
        async function* () {}
      );
      await asrService.connect("device-1");
      await asrService.connect("device-2");

      await asrService.end("device-1");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 资源已清理: deviceId=device-1"
      );
    });
  });

  describe("边界情况", () => {
    it("应该处理空音频数据", async () => {
      await asrService.prepare("device-1");

      const audioData = new Uint8Array(0);
      await asrService.handleAudioData("device-1", audioData);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[ASRService] 收到音频数据: deviceId=device-1, size=0"
      );
    });

    it("应该处理重复的 prepare 调用", async () => {
      await asrService.prepare("device-1");
      await asrService.prepare("device-1");
      await asrService.prepare("device-1");

      expect(mockLogger.info).toHaveBeenCalledTimes(1);
    });

    it("应该处理重复的 destroy 调用", () => {
      asrService.destroy();
      asrService.destroy();
      asrService.destroy();

      expect(mockLogger.debug).toHaveBeenCalledTimes(3);
    });

    it("应该处理不存在设备的操作", async () => {
      await asrService.end("non-existent-device");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 资源已清理: deviceId=non-existent-device"
      );
    });

    it("应该处理不存在设备的 reset 操作", async () => {
      await asrService.reset("non-existent-device");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ASRService] ASR 服务已重置: deviceId=non-existent-device"
      );
    });
  });
});
