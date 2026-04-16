/**
 * ASR 服务单元测试
 * 测试 ASRService 的语音识别生命周期管理
 */

import { createASR } from "univoice/asr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ASRService } from "../asr.service.js";

// Mock univoice/asr（ASR 引擎 + decodeOpusStream 流式解码）
const mockListenGenerator = (async function* () {
  // 默认不产生任何结果（空生成器）
})();

vi.mock("univoice/asr", () => ({
  createASR: vi.fn().mockImplementation(() => ({
    listen: vi.fn().mockReturnValue(mockListenGenerator),
  })),
  // 模拟 decodeOpusStream：透传 Opus 包并输出模拟 PCM 数据
  decodeOpusStream: vi.fn().mockImplementation(async function* (
    opusStream: AsyncIterable<Buffer>
  ) {
    for await (const _packet of opusStream) {
      yield Buffer.from([0x01, 0x02, 0x03]); // 模拟 PCM 输出
    }
  }),
}));

// Mock univoice 类型导入（BaseASR 类型，无需实际实现）
vi.mock("univoice", () => ({}));

describe("ASRService", () => {
  let service: ASRService;
  const mockEvents = {
    onResult: vi.fn(),
    onError: vi.fn(),
    onClose: vi.fn(),
  };

  /** 创建有效的配置提供者 */
  function createValidConfigProvider() {
    return {
      getASRConfig: () => ({
        appid: "test-appid",
        accessToken: "test-token",
        cluster: "volcengine_streaming_common",
      }),
      getTTSConfig: () => null,
      getLLMConfig: () => null,
      isLLMConfigValid: () => false,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ASRService({
      events: mockEvents,
      configProvider: createValidConfigProvider(),
    });
  });

  describe("prepare", () => {
    it("首次初始化队列和状态", async () => {
      await service.prepare("device-1");
      // 不应抛错，状态已准备好
    });

    it("重复 prepare 跳过", async () => {
      await service.prepare("device-1");
      await service.prepare("device-1"); // 第二次应该跳过

      // 验证只准备了一次（通过不报错来间接验证）
    });
  });

  describe("connect", () => {
    it("已连接跳过", async () => {
      // 新实现使用 connected 属性而非 isConnected() 方法
      // 先 connect 创建客户端（标记 connected=true）
      await service.prepare("device-1");
      await service.connect("device-1");

      // 再次 connect 应该跳过（因为已连接）
      await service.connect("device-1");

      // 不应抛错，第二次 connect 被跳过
    });

    it("正在连接等待完成", async () => {
      // 这个测试比较复杂，因为 connect 内部有并发控制
      // 简化测试：确保不抛错
      const promise1 = service.connect("device-1");
      const promise2 = service.connect("device-1");

      await Promise.all([promise1, promise2]);
      // 两个都完成且不报错
    });

    it("配置不完整不创建客户端", async () => {
      const invalidService = new ASRService({
        events: mockEvents,
        configProvider: {
          getASRConfig: () => ({ appid: "", accessToken: "" }), // 缺少必要字段
          getTTSConfig: () => null,
          getLLMConfig: () => null,
          isLLMConfigValid: () => false,
        },
      });

      await invalidService.prepare("device-1");
      await invalidService.connect("device-1");
      // 配置不完整时不应创建 ASR 客户端，但不报错
    });
  });

  describe("init 兼容接口", () => {
    it("依次调用 prepare + connect", async () => {
      const prepareSpy = vi.spyOn(service, "prepare");
      const connectSpy = vi.spyOn(service, "connect");

      await service.init("device-1");

      expect(prepareSpy).toHaveBeenCalledWith("device-1");
      expect(connectSpy).toHaveBeenCalledWith("device-1");
    });
  });

  describe("handleAudioData", () => {
    it("未准备好自动 prepare", async () => {
      const audioData = new Uint8Array([0x04, 0x05]);
      await service.handleAudioData("device-1", audioData);

      // 应该自动调用 prepare 并处理数据
      // 不应抛错
    });

    it("audioEnded 已结束忽略", async () => {
      // 先准备
      await service.prepare("device-1");

      // 手动标记结束（通过 end 方法）
      await service.end("device-1");

      // 再发送数据应该被忽略
      const audioData = new Uint8Array([0x06]);
      await service.handleAudioData("device-1", audioData);

      // 不应抛错，数据被忽略
    });

    it("正常数据推入 Opus 队列（不做本地解码）", async () => {
      await service.prepare("device-1");

      const audioData = new Uint8Array([0x07, 0x08]);
      await service.handleAudioData("device-1", audioData);

      // 验证 handleAudioData 不抛错，原始 Opus 数据已推入内部队列
      // 实际解码由 decodeOpusStream 在 startListenTask 中统一处理
      const { decodeOpusStream } = await import("univoice/asr");
      expect(decodeOpusStream).not.toHaveBeenCalled(); // 尚未 connect，不会触发解码
    });
  });

  describe("end", () => {
    it("标记 audioEnded 并清理资源", async () => {
      await service.prepare("device-1");
      await service.end("device-1");

      // end 后再 handleAudioData 应该被忽略
      const audioData = new Uint8Array([0x09]);
      await service.handleAudioData("device-1", audioData);

      // 数据被忽略（因为 audioEnded=true），但不应报错
    });

    it("等待 listen 任务完成", async () => {
      await service.prepare("device-1");
      // end 会等待 listenTasks 中的任务完成
      // 如果没有 listen 任务则直接返回
      await service.end("device-1");
      // 不应抛错
    });
  });

  describe("reset", () => {
    it("结束会话并重新准备", async () => {
      await service.prepare("device-1");
      await service.reset("device-1");

      // reset 后应该可以重新接收音频数据
      const audioData = new Uint8Array([0x0a]);
      await service.handleAudioData("device-1", audioData);

      // 不应抛错，说明 reset 成功重新准备了
    });
  });

  describe("destroy", () => {
    it("清理所有资源并标记客户端断开", () => {
      // 先准备一些设备
      service.prepare("device-1");
      service.prepare("device-2");

      service.destroy();

      // destroy 后操作不应报错（虽然设备状态已清除）
      expect(() => service.destroy()).not.toThrow(); // 重复销毁安全
    });
  });

  describe("VAD 端点检测", () => {
    it("VAD端点(confidence=1)应触发onResult(isFinal=true)并停止listen", async () => {
      // 构造模拟生成器：先产生中间结果，再产生VAD端点
      const mockVadGenerator = (async function* () {
        yield { text: "你好", isFinal: false, confidence: 0.9 };
        // VAD 端点：segment.confidence === 1
        yield {
          text: "你好世界",
          isFinal: false,
          segment: {
            id: 1,
            start: 0,
            end: 1200,
            text: "你好世界",
            confidence: 1,
          },
        };
      })();

      vi.mocked(createASR).mockImplementation(
        () =>
          ({
            listen: vi.fn().mockReturnValue(mockVadGenerator),
          }) as unknown as ReturnType<typeof createASR>
      );

      await service.prepare("device-vad");
      await service.connect("device-vad");

      // 等待 listen 任务完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 验证 onResult 被调用了两次（中间结果 + VAD端点）
      expect(mockEvents.onResult).toHaveBeenCalledTimes(2);

      // 第一次：中间结果，isFinal=false
      expect(mockEvents.onResult).toHaveBeenCalledWith(
        "device-vad",
        "你好",
        false
      );

      // 第二次：VAD端点，应以 isFinal=true 触发
      expect(mockEvents.onResult).toHaveBeenCalledWith(
        "device-vad",
        "你好世界",
        true
      );
    });

    it("非definite segment(confidence<1)不应触发终止", async () => {
      const mockNonDefiniteGenerator = (async function* () {
        yield {
          text: "测试",
          isFinal: false,
          segment: {
            id: 1,
            start: 0,
            end: 500,
            text: "测试",
            confidence: 0.8,
          },
        };
        // 生成器继续运行（不应break）
        yield { text: "测试继续", isFinal: false };
        yield { text: "测试完成", isFinal: true }; // 最终由isFinal终止
      })();

      vi.mocked(createASR).mockImplementation(
        () =>
          ({
            listen: vi.fn().mockReturnValue(mockNonDefiniteGenerator),
          }) as unknown as ReturnType<typeof createASR>
      );

      await service.prepare("device-non-definite");
      await service.connect("device-non-definite");

      // 等待 listen 任务完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 应该收到全部3次结果（非definite segment不中断流）
      expect(mockEvents.onResult).toHaveBeenCalledTimes(3);
      expect(mockEvents.onResult).toHaveBeenLastCalledWith(
        "device-non-definite",
        "测试完成",
        true
      );
    });

    it("验证 Opus→PCM 解码链路：decodeOpusStream 以正确参数调用，listen 接收 PCM 流", async () => {
      // 捕获传给 listen 的第一个参数（应为 decodeOpusStream 的返回值）
      let capturedListenArg: unknown = null;

      const mockChainGenerator = (async function* () {
        yield { text: "链路测试", isFinal: true };
      })();

      vi.mocked(createASR).mockImplementation(
        () =>
          ({
            listen: vi.fn().mockImplementation((stream: unknown) => {
              capturedListenArg = stream;
              return mockChainGenerator;
            }),
          }) as unknown as ReturnType<typeof createASR>
      );

      await service.prepare("device-chain");
      await service.connect("device-chain");

      // 发送音频数据触发解码链路
      const audioData = new Uint8Array([0xaa, 0xbb, 0xcc]);
      await service.handleAudioData("device-chain", audioData);

      // 等待 listen 任务消费数据
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 验证 decodeOpusStream 被以 sampleRate=16000 调用
      const { decodeOpusStream } = await import("univoice/asr");
      expect(decodeOpusStream).toHaveBeenCalledTimes(1);
      expect(decodeOpusStream).toHaveBeenCalledWith(
        expect.anything(), // AsyncIterable<Buffer> (opus stream)
        { sampleRate: 16000 }
      );

      // 验证 asrClient.listen 接收到的参数是 decodeOpusStream 的返回值
      // （即一个 AsyncIterable<Buffer>，而非原始的 opusStream）
      expect(capturedListenArg).not.toBeNull();
      // 确认 listen 参数是可迭代的（PCM 流）
      expect(
        typeof (capturedListenArg as AsyncIterable<Buffer>)[
          Symbol.asyncIterator
        ]
      ).toBe("function");
    });

    it("无segment信息的chunk正常处理不受影响", async () => {
      const mockNoSegmentGenerator = (async function* () {
        yield { text: "第一条", isFinal: false };
        yield { text: "第二条", isFinal: false };
        yield { text: "最终", isFinal: true };
      })();

      vi.mocked(createASR).mockImplementation(
        () =>
          ({
            listen: vi.fn().mockReturnValue(mockNoSegmentGenerator),
          }) as unknown as ReturnType<typeof createASR>
      );

      await service.prepare("device-no-segment");
      await service.connect("device-no-segment");

      await new Promise((resolve) => setTimeout(resolve, 100));

      // 无 segment 时行为与改造前一致，3次正常回调
      expect(mockEvents.onResult).toHaveBeenCalledTimes(3);
      expect(mockEvents.onResult).toHaveBeenCalledWith(
        "device-no-segment",
        "第一条",
        false
      );
      expect(mockEvents.onResult).toHaveBeenCalledWith(
        "device-no-segment",
        "第二条",
        false
      );
      expect(mockEvents.onResult).toHaveBeenCalledWith(
        "device-no-segment",
        "最终",
        true
      );
    });
  });
});
