/**
 * TTS 服务单元测试
 * 测试 TTSService 的状态管理和音频处理逻辑
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { TTSService, mapClusterToResourceId } from "../tts.service.js";

// Mock prism-media：支持事件发射和链式调用，用于测试 processAudioBuffer
// 捕获所有创建的 demuxer 实例，支持手动触发事件模拟多包场景
const demuxerInstances: Array<{
  emit: (event: string, ...args: unknown[]) => void;
}> = [];

vi.mock("prism-media", () => {
  class MockOggDemuxer {
    private listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

    on(event: string, fn: (...args: unknown[]) => void): MockOggDemuxer {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(fn);
      return this;
    }

    once(event: string, fn: (...args: unknown[]) => void): MockOggDemuxer {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(fn);
      return this;
    }

    emit(event: string, ...args: unknown[]): void {
      const handlers = this.listeners[event];
      if (handlers) {
        for (const fn of handlers) {
          fn(...args);
        }
      }
    }

    write(_chunk: Buffer): boolean {
      // 不自动发射 data 事件，由测试手动控制
      return true;
    }

    end(): void {
      // 不自动发射 end 事件，由测试手动控制
    }

    constructor() {
      demuxerInstances.push(this);
    }
  }
  return {
    default: { opus: { OggDemuxer: MockOggDemuxer } },
    opus: { OggDemuxer: MockOggDemuxer },
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
    demuxerInstances.length = 0;
    service = new TTSService();
  });

  describe("构造 & 基础", () => {
    it("初始化所有 Map 为空", () => {
      expect(() => service.cleanup("non-existent")).not.toThrow();
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

      expect(() => service.setGetConnection(() => undefined)).not.toThrow();
    });
  });

  describe("getPacketDuration", () => {
    it("config < 12 单帧 10ms", () => {
      const packet = Buffer.from([0x00]); // config=0, c=0
      expect(service.getPacketDuration(packet)).toBe(10);
    });

    it("config < 16 单帧 20ms", () => {
      const packet = Buffer.from([(12 << 3) | 0]); // config=12, c=0
      expect(service.getPacketDuration(packet)).toBe(20);
    });

    it("c=3 多帧从 data[1] 读取", () => {
      const packet = Buffer.from([(16 << 3) | 3, 5]); // config=16, c=3, frameCount=5
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
      const mockConn = {
        send: vi.fn().mockResolvedValue(undefined),
        sendBinaryProtocol2: vi.fn().mockResolvedValue(undefined),
        getSessionId: () => "s1",
      };
      service.setGetConnection(() => mockConn as never);

      service.cleanup("device-1");
      service.cleanup("device-1"); // 重复清理不报错
    });
  });

  describe("speak 前置条件", () => {
    it("进行中忽略", async () => {
      const mockConn = {
        send: vi.fn().mockResolvedValue(undefined),
        sendBinaryProtocol2: vi.fn().mockResolvedValue(undefined),
        getSessionId: () => "s1",
      };

      service.setGetConnection(() => undefined);
      await service.speak("d1", "hello");

      service.setGetConnection(() => mockConn as never);
      await service.speak("d1", "hello");
    });

    it("已完成忽略", async () => {
      const mockConn = {
        send: vi.fn().mockResolvedValue(undefined),
        sendBinaryProtocol2: vi.fn().mockResolvedValue(undefined),
        getSessionId: () => "s1",
      };
      service.setGetConnection(() => mockConn as never);

      await service.speak("d1", "hello");
      await service.speak("d1", "world");
    });

    it("无连接返回", async () => {
      service.setGetConnection(() => undefined);
      const result = service.speak("d1", "hello");
      await result;
    });

    it("配置不完整返回", async () => {
      const mockConn = {
        send: vi.fn().mockResolvedValue(undefined),
        sendBinaryProtocol2: vi.fn().mockResolvedValue(undefined),
        getSessionId: () => "s1",
      };
      service.setGetConnection(() => mockConn as never);
      const result = service.speak("d1", "hello");
      await result;
    });
  });

  describe("destroy", () => {
    it("清空所有内部 Map", () => {
      service.destroy();

      expect(() => service.cleanup("any")).not.toThrow();
      expect(() => service.destroy()).not.toThrow();
    });
  });

  describe("processAudioBuffer", () => {
    /** 构造一个模拟的 Opus 包（config=0, c=0, 单帧 10ms） */
    const makeOpusPacket = (size = 4): Buffer => Buffer.alloc(size, 0x00);

    /** 获取 processAudioBuffer 创建的最新 demuxer 实例 */
    const getLastDemuxer = () => demuxerInstances[demuxerInstances.length - 1];

    /** 辅助：调用 processAudioBuffer 并手动发射指定包序列 */
    const processWithPackets = async (
      packets: Buffer[],
      callback: Parameters<TTSService["processAudioBuffer"]>[1]
    ) => {
      const audioBuffer = Buffer.alloc(1); // 占位数据，实际不使用
      const promise = service.processAudioBuffer(audioBuffer, callback);

      // 手动发射每个包的 data 事件
      const demuxer = getLastDemuxer();
      for (const packet of packets) {
        demuxer.emit("data", packet);
      }
      demuxer.emit("end");

      return promise;
    };

    it("正常处理并返回正确的统计信息", async () => {
      const packets: Array<{ packet: Buffer; meta: unknown }> = [];
      const opusPacket = makeOpusPacket();

      const result = await processWithPackets([opusPacket], (packet, meta) => {
        packets.push({ packet, meta });
        return Promise.resolve();
      });

      expect(result.packetCount).toBe(1);
      expect(result.totalDuration).toBe(10); // config=0, c=0 → 10ms
      expect(packets).toHaveLength(1);
    });

    it("逐包调用 sendCallback 并携带正确的 metadata", async () => {
      const metas: Array<{
        index: number;
        size: number;
        duration: number;
        timestamp: number;
      }> = [];
      const packet1 = makeOpusPacket(4); // config=0 → 10ms
      const packet2 = Buffer.from([(12 << 3) | 0]); // config=12, c=0 → 20ms

      await processWithPackets([packet1, packet2], (_packet, meta) => {
        metas.push({ ...meta });
        return Promise.resolve();
      });

      expect(metas).toHaveLength(2);

      // 第一个包
      expect(metas[0].index).toBe(0);
      expect(metas[0].size).toBe(packet1.length);
      expect(metas[0].duration).toBe(10);
      expect(metas[0].timestamp).toBe(0);

      // 第二个包
      expect(metas[1].index).toBe(1);
      expect(metas[1].size).toBe(packet2.length);
      expect(metas[1].duration).toBe(20);
      expect(metas[1].timestamp).toBe(10); // 累计时间戳 = 10
    });

    it("累计时间戳连续递增", async () => {
      const timestamps: number[] = [];
      // 三个包：10ms + 20ms + 10ms
      const packets = [
        makeOpusPacket(4), // 10ms
        Buffer.from([(12 << 3) | 0]), // 20ms
        makeOpusPacket(4), // 10ms
      ];

      await processWithPackets(packets, (_packet, meta) => {
        timestamps.push(meta.timestamp);
        return Promise.resolve();
      });

      expect(timestamps).toEqual([0, 10, 30]);
    });

    it("多包按顺序处理，index 递增", async () => {
      const indices: number[] = [];
      const packets = [makeOpusPacket(), makeOpusPacket(), makeOpusPacket()];

      await processWithPackets(packets, (_packet, meta) => {
        indices.push(meta.index);
        return Promise.resolve();
      });

      expect(indices).toEqual([0, 1, 2]);
    });

    it("sendCallback 异常不中断后续包处理", async () => {
      const callCount = { value: 0 };
      const packets = [makeOpusPacket(), makeOpusPacket(), makeOpusPacket()];

      await processWithPackets(packets, (_packet, meta) => {
        callCount.value++;
        if (meta.index === 1) {
          throw new Error("模拟发送失败");
        }
        return Promise.resolve();
      });

      // 所有 3 个包都应该被尝试处理
      expect(callCount.value).toBe(3);
    });

    it("无包时返回零值统计", async () => {
      const audioBuffer = Buffer.alloc(1);
      const promise = service.processAudioBuffer(audioBuffer, () =>
        Promise.resolve()
      );

      // 直接发射 end，不发射任何 data
      const demuxer = getLastDemuxer();
      demuxer.emit("end");

      const result = await promise;

      expect(result.packetCount).toBe(0);
      expect(result.totalDuration).toBe(0);
    });
  });
});
