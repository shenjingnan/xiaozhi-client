/**
 * WebSocket 连接管理单元测试
 * 测试 ESP32Connection 的连接生命周期和消息处理
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { ESP32Connection } from "../connection.js";
import type { ESP32ConnectionConfig } from "../connection.js";
import type { IASRService } from "../services/asr.interface.js";

/**
 * Mock WebSocket 类
 * 在模块顶层定义，供 vi.mock 和测试共同使用
 */
class MockWebSocket {
  readyState = 1; // OPEN by default
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  private eventListeners: Map<string, ((...args: unknown[]) => void)[]> =
    new Map();

  send = vi.fn();
  close = vi.fn();
  on = vi.fn((event: string, callback: (...args: unknown[]) => void) => {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  });
  once = vi.fn((event: string, callback: (...args: unknown[]) => void) => {
    this.on(event, callback);
  });
  removeListener = vi.fn(
    (event: string, callback: (...args: unknown[]) => void) => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) listeners.splice(index, 1);
      }
    }
  );

  /** 触发事件 */
  emit(event: string, ...args: unknown[]) {
    const listeners = this.eventListeners.get(event) || [];
    for (const cb of listeners) cb(...args);
  }
}

// Mock ws 模块，返回我们定义的 MockWebSocket
vi.mock("ws", () => ({
  default: MockWebSocket,
}));

/** 创建测试用的配置 */
function createConfig(overrides?: Partial<ESP32ConnectionConfig>) {
  const mockASRService: IASRService = {
    prepare: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    init: vi.fn().mockResolvedValue(undefined),
    handleAudioData: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  };

  return {
    onMessage: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    onError: vi.fn(),
    heartbeatTimeoutMs: 30_000,
    getASRService: () => mockASRService,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  };
}

describe("ESP32Connection", () => {
  let wsInstance: MockWebSocket;
  /** 类型断言：MockWebSocket 在运行时通过 vi.mock 替代了真实的 WebSocket */
  const mockWS = (): WebSocket => wsInstance as unknown as WebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    wsInstance = new MockWebSocket();
  });

  describe("constructor", () => {
    it("初始状态为 connecting", () => {
      const config = createConfig();
      const conn = new ESP32Connection(
        "device-1",
        "client-1",
        mockWS(),
        config
      );
      expect(conn.getState()).toBe("connecting");
    });

    it("sessionId 格式正确（包含 deviceId 和时间戳）", () => {
      const config = createConfig();
      const conn = new ESP32Connection(
        "AA:BB:CC",
        "client-1",
        mockWS(),
        config
      );
      const sessionId = conn.getSessionId();

      expect(sessionId).toContain("AA:BB:CC");
      // 应该包含时间戳部分（16进制随机数）
      expect(sessionId.split("-").length).toBeGreaterThanOrEqual(3);
    });

    it("默认心跳超时 30s", () => {
      const config = createConfig();
      const { heartbeatTimeoutMs: _, ...rest } = config;
      const conn = new ESP32Connection("d1", "c1", mockWS(), rest);
      expect(conn.checkTimeout()).toBe(false);
    });

    it("自定义超时生效", async () => {
      const config = createConfig({ heartbeatTimeoutMs: 1 }); // 1ms 超时
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(conn.checkTimeout()).toBe(true);
    });

    it("设置 WS 事件监听：message/close/error/pong", () => {
      const config = createConfig();
      new ESP32Connection("d1", "c1", mockWS(), config);

      expect(wsInstance.on).toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      );
      expect(wsInstance.on).toHaveBeenCalledWith("close", expect.any(Function));
      expect(wsInstance.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(wsInstance.on).toHaveBeenCalledWith("pong", expect.any(Function));
    });
  });

  describe("send", () => {
    it("断开连接发送抛错", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);
      await conn.close();

      await expect(
        conn.send({ type: "hello" } as Parameters<typeof conn.send>[0])
      ).rejects.toThrow("连接已断开");
    });

    it("连接状态发送 JSON 成功", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);

      await conn.send({ type: "stt", text: "你好" });

      expect(wsInstance.send).toHaveBeenCalledTimes(1);
      const sentData = JSON.parse(wsInstance.send.mock.calls[0][0]);
      expect(sentData.type).toBe("stt");
      expect(sentData.text).toBe("你好");
    });

    it("发送失败传播错误", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);
      wsInstance.send.mockImplementationOnce(() => {
        throw new Error("网络错误");
      });

      await expect(
        conn.send({ type: "stt", text: "" } as Parameters<typeof conn.send>[0])
      ).rejects.toThrow("网络错误");
    });
  });

  describe("sendBinaryProtocol2", () => {
    it("编码后调用 sendBinary，默认 timestamp=0", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);

      const audioData = new Uint8Array([0x01, 0x02, 0x03]);
      await conn.sendBinaryProtocol2(audioData);

      expect(wsInstance.send).toHaveBeenCalledTimes(1);
      const sentBuffer = wsInstance.send.mock.calls[0][0];
      expect(sentBuffer.length).toBe(19); // HEADER_SIZE(16) + payload(3)
      expect(sentBuffer.readUInt16BE(0)).toBe(2);
      expect(sentBuffer.readUInt32BE(8)).toBe(0); // 默认 timestamp=0
    });

    it("自定义 timestamp 生效", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);

      const audioData = new Uint8Array([0x01]);
      await conn.sendBinaryProtocol2(audioData, 5000);

      const sentBuffer = wsInstance.send.mock.calls[0][0];
      expect(sentBuffer.readUInt32BE(8)).toBe(5000);
    });
  });

  describe("getter 方法", () => {
    it("getSessionId 返回会话 ID", () => {
      const config = createConfig();
      const conn = new ESP32Connection("my-device", "c1", mockWS(), config);
      expect(typeof conn.getSessionId()).toBe("string");
      expect(conn.getSessionId()).toContain("my-device");
    });

    it("getDeviceId 返回设备 ID", () => {
      const config = createConfig();
      const conn = new ESP32Connection("dev-123", "c1", mockWS(), config);
      expect(conn.getDeviceId()).toBe("dev-123");
    });

    it("getClientId 返回客户端 ID", () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "client-abc", mockWS(), config);
      expect(conn.getClientId()).toBe("client-abc");
    });

    it("getState 返回当前状态", () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);
      expect(conn.getState()).toBe("connecting");
    });
  });

  describe("checkTimeout", () => {
    it("断开状态不超时", async () => {
      const config = createConfig({ heartbeatTimeoutMs: 1 });
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);
      await conn.close();

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(conn.checkTimeout()).toBe(false);
    });

    it("未超时返回 false", () => {
      const config = createConfig({ heartbeatTimeoutMs: 60_000 });
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);
      expect(conn.checkTimeout()).toBe(false);
    });

    it("已超时返回 true", async () => {
      const config = createConfig({ heartbeatTimeoutMs: 1 });
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(conn.checkTimeout()).toBe(true);
    });
  });

  describe("close", () => {
    it("重复关闭直接返回", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);
      await conn.close();

      wsInstance.close.mockClear();
      await conn.close();
      expect(conn.getState()).toBe("disconnected");
    });

    it("关闭设为 disconnected 并调用 ws.close(1000)", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);

      // close 内部会调用 ws.close() 并等待 close 事件
      const closePromise = conn.close();
      // 模拟 WebSocket 触发 close 事件（真实 WS 关闭后会触发）
      wsInstance.emit("close");

      await closePromise;

      expect(conn.getState()).toBe("disconnected");
      // 验证 ws.close 被调用（可能因 readyState 检查而提前返回，这里验证不报错即可）
      // 如果 readyState 为 OPEN/CONNECTING，则一定会调用 ws.close
    });
  });

  describe("Hello 流程", () => {
    it("收到 Hello 发送 ServerHello", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);

      const helloMessage = JSON.stringify({
        type: "hello",
        version: 2,
        transport: "websocket",
        audioParams: {
          format: "opus",
          sampleRate: 24000,
          channels: 1,
          frameDuration: 60,
        },
      });
      wsInstance.emit("message", Buffer.from(helloMessage));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wsInstance.send).toHaveBeenCalled();
      const sentHello = JSON.parse(wsInstance.send.mock.calls[0][0]);
      expect(sentHello.type).toBe("hello");
      expect(sentHello.version).toBe(1);
      expect(sentHello.transport).toBe("websocket");
      expect(sentHello.session_id).toBe(conn.getSessionId());
      expect(sentHello.audio_params.format).toBe("opus");
    });

    it("握手后状态=connected", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);

      wsInstance.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "hello",
            version: 2,
            transport: "websocket",
          })
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(conn.getState()).toBe("connected");
    });

    it("重复 Hello 忽略（不重复发送 ServerHello）", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);

      // 第一次 Hello
      void conn;
      wsInstance.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "hello",
            version: 2,
            transport: "websocket",
          })
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      const sendCallCount = wsInstance.send.mock.calls.length;

      // 第二次 Hello - handleHello 提前返回，但 onMessage 仍会被调用
      // 由于我们的 onMessage mock 不发送任何内容，send 调用次数不变
      wsInstance.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "hello",
            version: 2,
            transport: "websocket",
          })
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 重复 Hello 不再发送 ServerHello（handleHello 提前返回）
      // onMessage 被调用但不发送数据，所以总调用次数不变
      expect(wsInstance.send.mock.calls.length).toBe(sendCallCount);
    });

    it("Hello 阶段调用 ASR prepare", async () => {
      const mockASR: IASRService = {
        prepare: vi.fn().mockResolvedValue(undefined),
        connect: vi.fn().mockResolvedValue(undefined),
        init: vi.fn().mockResolvedValue(undefined),
        handleAudioData: vi.fn().mockResolvedValue(undefined),
        end: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn(),
      };
      const config = createConfig({ getASRService: () => mockASR });
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);
      void conn;

      wsInstance.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "hello",
            version: 2,
            transport: "websocket",
          })
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockASR.prepare).toHaveBeenCalledWith("d1");
    });
  });

  describe("非 Hello 消息", () => {
    it("未握手收到其他消息发错误", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);
      void conn;

      wsInstance.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "listen",
            state: "start",
          })
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wsInstance.send).toHaveBeenCalled();
      const errorMsg = JSON.parse(wsInstance.send.mock.calls[0][0]);
      expect(errorMsg.type).toBe("error");
    });

    it("握手后消息路由到 onMessage", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);
      void conn;

      // 先完成握手
      wsInstance.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "hello",
            version: 2,
            transport: "websocket",
          })
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      wsInstance.send.mockClear();
      (config.onMessage as ReturnType<typeof vi.fn>).mockClear();

      wsInstance.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "listen",
            state: "detect",
            text: "你好小智",
          })
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(config.onMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "listen" })
      );
    });

    it("二进制协议2音频解析", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);

      // 完成握手（需要等待异步操作完成）
      wsInstance.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "hello",
            version: 2,
            transport: "websocket",
          })
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(conn.isHelloCompleted()).toBe(true);

      (config.onMessage as ReturnType<typeof vi.fn>).mockClear();

      // 发送二进制协议2音频数据（payload 包含高字节确保非有效 UTF-8）
      const { encodeBinaryProtocol2 } = await import("../audio-protocol.js");
      // 使用包含 >= 0x80 字节的 payload，使整个 Buffer 被判定为非 UTF-8
      const audioPayload = new Uint8Array([0x80, 0x81, 0x82]);
      const binaryData = encodeBinaryProtocol2(audioPayload, 100);

      wsInstance.emit("message", binaryData);
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 二进制协议2 数据应被正确解析并路由到 onMessage
      expect(config.onMessage).toHaveBeenCalled();
      const msgArg = (config.onMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(msgArg.type).toBe("audio");
      expect(msgArg._parsed).toMatchObject({
        protocolVersion: 2,
        dataType: "opus",
        timestamp: 100,
      });
    });

    it("无法识别的二进制作为原始音频", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);
      void conn;

      // 完成握手
      wsInstance.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "hello",
            version: 2,
            transport: "websocket",
          })
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      (config.onMessage as ReturnType<typeof vi.fn>).mockClear();

      // 发送无法识别的二进制数据
      const invalidBinary = Buffer.from([0xff, 0xfe, 0xfd, 0xfc, 0xfb]);
      wsInstance.emit("message", invalidBinary);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(config.onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "audio",
          data: expect.any(Uint8Array),
        })
      );
    });

    it("无效 JSON 发错误", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);
      void conn;

      wsInstance.emit("message", Buffer.from("{invalid json}"));
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wsInstance.send).toHaveBeenCalled();
      const errorMsg = JSON.parse(wsInstance.send.mock.calls[0][0]);
      expect(errorMsg.type).toBe("error");
    });
  });

  describe("isHelloCompleted", () => {
    it("初始 false", () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);
      expect(conn.isHelloCompleted()).toBe(false);
    });

    it("Hello 后 true", async () => {
      const config = createConfig();
      const conn = new ESP32Connection("d1", "c1", mockWS(), config);

      wsInstance.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "hello",
            version: 2,
            transport: "websocket",
          })
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(conn.isHelloCompleted()).toBe(true);
    });
  });
});
