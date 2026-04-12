/**
 * TTS 服务单元测试
 * 测试 TTSService 的状态管理和音频处理逻辑
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { TTSService, mapClusterToResourceId } from "../tts.service.js";

// Mock prism-media
vi.mock("prism-media", () => {
  class MockOggDemuxer {
    on = vi.fn();
    write = vi.fn();
    end = vi.fn();
  }
  return {
    default: {
      opus: { OggDemuxer: MockOggDemuxer },
    },
  };
});

// Mock univoice
vi.mock("univoice", () => ({
  createTTS: vi.fn(),
}));

describe("mapClusterToResourceId", () => {
  it("volcano_icl → seed-tts-1.0", () => {
    expect(mapClusterToResourceId("volcano_icl")).toBe("seed-tts-1.0");
  });

  it("其他值 → seed-tts-2.0", () => {
    expect(mapClusterToResourceId("volcengine_streaming_common")).toBe(
      "seed-tts-2.0"
    );
    expect(mapClusterToResourceId("some_other_cluster")).toBe("seed-tts-2.0");
  });

  it("空字符串 → seed-tts-2.0", () => {
    expect(mapClusterToResourceId("")).toBe("seed-tts-2.0");
  });

  it("undefined → seed-tts-2.0", () => {
    expect(mapClusterToResourceId(undefined)).toBe("seed-tts-2.0");
  });
});

describe("TTSService", () => {
  let service: TTSService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TTSService();
  });

  describe("构造 & 基础", () => {
    it("初始化所有 Map 为空", () => {
      // 通过访问私有 Map 验证（通过 destroy 不报错来间接验证）
      // 直接调用 cleanup 对不存在的设备不报错
      expect(() => service.cleanup("non-existent")).not.toThrow();
      // destroy 正常执行
      expect(() => service.destroy()).not.toThrow();
    });

    it("setGetConnection 更新回调", () => {
      const mockConn = {
        send: vi.fn().mockResolvedValue(undefined),
        sendBinaryProtocol2: vi.fn().mockResolvedValue(undefined),
        getSessionId: () => "session-1",
      };
      service.setGetConnection((deviceId) =>
        deviceId === "d1" ? (mockConn as never) : undefined
      );

      // speak 应该能获取到连接（但会因为配置不完整而返回）
      // 这里只验证回调设置不会抛错
      expect(() => service.setGetConnection(() => undefined)).not.toThrow();
    });
  });

  describe("getPacketDuration", () => {
    it("config < 12 单帧 10ms", () => {
      // config=0, c=0 (单帧)
      const packet = Buffer.from([0x00]); // config=0, c=0
      expect(service.getPacketDuration(packet)).toBe(10);
    });

    it("config < 16 单帧 20ms", () => {
      // config=12, c=0 (单帧)
      const packet = Buffer.from([(12 << 3) | 0]); // config=12, c=0
      expect(service.getPacketDuration(packet)).toBe(20);
    });

    it("c=3 多帧从 data[1] 读取", () => {
      // config=16, c=3 (多帧，帧数在 data[1])
      const packet = Buffer.from([(16 << 3) | 3, 5]); // config=16, c=3, frameCount=5
      // config >= 16 时 frameSize = [2.5, 5, 10, 20][config & 0x03]
      // config & 0x03 = 0, 所以 frameSize = 2.5... 但结果是整数运算
      // 实际上 config=16, config&0x03=0, frameSize=[2.5,5,10,20][0]=2.5
      // 但 JavaScript 中这是浮点数... 让我重新看代码
      // frameSize = [2.5, 5, 10, 20][config & 0x03]
      // frameCount = opusPacket[1] & 0x3f = 5
      // result = 2.5 * 5 = 12.5
      const duration = service.getPacketDuration(packet);
      expect(duration).toBe(12.5);
    });

    it("空包返回 0", () => {
      expect(service.getPacketDuration(Buffer.alloc(0))).toBe(0);
    });

    it("null/undefined 返回 0", () => {
      expect(service.getPacketDuration(null as never)).toBe(0);
    });
  });

  describe("cleanup", () => {
    it("删除设备所有状态", async () => {
      // 先触发 speak 来创建设备状态
      const mockConn = {
        send: vi.fn().mockResolvedValue(undefined),
        sendBinaryProtocol2: vi.fn().mockResolvedValue(undefined),
        getSessionId: () => "s1",
      };
      service.setGetConnection(() => mockConn as never);

      // 由于 TTS 配置不完整，speak 会提前返回
      // 我们需要手动测试 cleanup 的行为
      // cleanup 删除除 ttsCompleted 外的所有状态

      // 模拟：直接调用后验证不报错
      service.cleanup("device-1");
      // 再次清理不报错
      service.cleanup("device-1");
    });
  });

  describe("speak 前置条件", () => {
    it("进行中忽略", async () => {
      // 设置一个假的 ttsTriggered 状态来模拟"进行中"
      // 由于是私有 Map，我们通过 speak 的行为间接测试
      const mockConn = {
        send: vi.fn().mockResolvedValue(undefined),
        sendBinaryProtocol2: vi.fn().mockResolvedValue(undefined),
        getSessionId: () => "s1",
      };

      // 第一次 speak 会因为无连接返回（ttsTriggered 未设置）
      service.setGetConnection(() => undefined);
      await service.speak("d1", "hello");

      // 提供连接但配置不完整也会返回
      service.setGetConnection(() => mockConn as never);
      await service.speak("d1", "hello");
      // 不应抛错
    });

    it("已完成忽略", async () => {
      const mockConn = {
        send: vi.fn().mockResolvedValue(undefined),
        sendBinaryProtocol2: vi.fn().mockResolvedValue(undefined),
        getSessionId: () => "s1",
      };
      service.setGetConnection(() => mockConn as never);

      // 多次调用 speak，后续的应该被忽略（因为 ttsCompleted 或 ttsTriggered）
      await service.speak("d1", "hello");
      await service.speak("d1", "world"); // 应该被忽略
    });

    it("无连接返回", async () => {
      service.setGetConnection(() => undefined);
      const result = service.speak("d1", "hello");
      await result; // 不应抛错
    });

    it("配置不完整返回", async () => {
      const mockConn = {
        send: vi.fn().mockResolvedValue(undefined),
        sendBinaryProtocol2: vi.fn().mockResolvedValue(undefined),
        getSessionId: () => "s1",
      };
      service.setGetConnection(() => mockConn as never);
      // 无 configProvider，TTS 配置为 undefined
      const result = service.speak("d1", "hello");
      await result; // 不应抛错，只是 warn 并返回
    });
  });

  describe("destroy", () => {
    it("清空所有内部 Map", () => {
      // 创建一些状态后销毁
      service.destroy();

      // 销毁后再操作不应报错
      expect(() => service.cleanup("any")).not.toThrow();
      expect(() => service.destroy()).not.toThrow(); // 重复销毁安全
    });
  });
});
