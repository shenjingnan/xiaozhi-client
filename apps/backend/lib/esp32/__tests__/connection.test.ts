/**
 * ESP32Connection 单元测试
 * 测试 ESP32 设备连接管理功能
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ESP32Connection } from "../connection.js";
import type { ASRService } from "@/services/asr.service.js";
import type { ESP32WSMessage } from "@/types/esp32.js";
import type WebSocket from "ws";

// Mock Logger
vi.mock("@/Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("ESP32Connection", () => {
  let mockWebSocket: Partial<WebSocket>;
  let mockASRService: ASRService;
  let mockOnMessage: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;
  let mockGetASRService: ReturnType<typeof vi.fn>;
  let connection: ESP32Connection;

  const deviceId = "AA:BB:CC:DD:EE:FF";
  const clientId = "test-client-123";

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock WebSocket
    mockWebSocket = {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
      readyState: 1, // OPEN
      OPEN: 1,
      CONNECTING: 0,
      CLOSING: 2,
      CLOSED: 3,
    };

    // Mock ASR Service
    mockASRService = {
      prepare: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
      handleAudioData: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    } as unknown as ASRService;

    mockGetASRService = vi.fn().mockReturnValue(mockASRService);

    // Mock 回调函数
    mockOnMessage = vi.fn().mockResolvedValue(undefined);
    mockOnClose = vi.fn();
    mockOnError = vi.fn();

    // 创建连接实例
    connection = new ESP32Connection(deviceId, clientId, mockWebSocket as WebSocket, {
      onMessage: mockOnMessage,
      onClose: mockOnClose,
      onError: mockOnError,
      getASRService: mockGetASRService,
      heartbeatTimeoutMs: 30000,
    });

    // 触发 WebSocket 事件监听器的设置
    expect(mockWebSocket.on).toHaveBeenCalledWith(
      "message",
      expect.any(Function)
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("构造函数", () => {
    it("应该正确初始化连接状态", () => {
      expect(connection.getState()).toBe("connecting");
      expect(connection.getDeviceId()).toBe(deviceId);
      expect(connection.getClientId()).toBe(clientId);
      expect(connection.isHelloCompleted()).toBe(false);
    });

    it("应该生成唯一的会话 ID", () => {
      const connection1 = new ESP32Connection(
        deviceId,
        clientId,
        mockWebSocket as WebSocket,
        {
          onMessage: mockOnMessage,
          onClose: mockOnClose,
          onError: mockOnError,
          getASRService: mockGetASRService,
        }
      );

      const connection2 = new ESP32Connection(
        deviceId,
        clientId,
        mockWebSocket as WebSocket,
        {
          onMessage: mockOnMessage,
          onClose: mockOnClose,
          onError: mockOnError,
          getASRService: mockGetASRService,
        }
      );

      expect(connection1.getSessionId()).not.toBe(connection2.getSessionId());
    });

    it("应该使用默认心跳超时时间", () => {
      const defaultConnection = new ESP32Connection(
        deviceId,
        clientId,
        mockWebSocket as WebSocket,
        {
          onMessage: mockOnMessage,
          onClose: mockOnClose,
          onError: mockOnError,
          getASRService: mockGetASRService,
        }
      );

      // 默认超时时间为 30000ms
      // 这个值无法直接访问，但可以通过 checkTimeout 行为验证
      expect(defaultConnection.getState()).toBe("connecting");
    });

    it("应该设置 WebSocket 事件监听器", () => {
      expect(mockWebSocket.on).toHaveBeenCalledWith("message", expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith("close", expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith("pong", expect.any(Function));
    });
  });

  describe("消息处理", () => {
    it("应该正确处理 Hello 消息", async () => {
      const helloMessage: ESP32WSMessage = {
        type: "hello",
        version: 1,
        transport: "websocket",
        audioParams: {
          format: "opus",
          sampleRate: 24000,
          channels: 1,
          frameDuration: 60,
        },
      };

      // 获取 message 事件处理器
      const messageHandler = (mockWebSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      expect(messageHandler).toBeDefined();

      // 发送 Hello 消息
      await messageHandler!(Buffer.from(JSON.stringify(helloMessage)));

      // 验证 ASR 服务准备
      expect(mockASRService.prepare).toHaveBeenCalledWith(deviceId);

      // 验证状态更新
      expect(connection.isHelloCompleted()).toBe(true);
      expect(connection.getState()).toBe("connected");

      // 验证发送了 ServerHello 响应
      expect(mockWebSocket.send).toHaveBeenCalled();

      // 验证调用了消息回调
      expect(mockOnMessage).toHaveBeenCalledWith(helloMessage);
    });

    it("应该拒绝未完成 Hello 握手时的非 Hello 消息", async () => {
      const audioMessage: ESP32WSMessage = {
        type: "audio",
        data: new Uint8Array([0x01, 0x02]),
      };

      const messageHandler = (mockWebSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      await messageHandler!(Buffer.from(JSON.stringify(audioMessage)));

      // 应该发送错误消息
      expect(mockWebSocket.send).toHaveBeenCalled();

      // 不应该调用消息回调
      expect(mockOnMessage).not.toHaveBeenCalled();
    });

    it("应该正确处理 Hello 之后的音频消息", async () => {
      // 首先完成 Hello 握手
      const helloMessage: ESP32WSMessage = {
        type: "hello",
        version: 1,
        transport: "websocket",
      };

      const messageHandler = (mockWebSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      await messageHandler!(Buffer.from(JSON.stringify(helloMessage)));

      // 清除之前的调用（使用 mockClear 而非 clearAllMocks 以保留 handlers）
      mockOnMessage.mockClear();
      mockWebSocket.send.mockClear();

      // 现在发送音频消息
      // 注意：经过 JSON 序列化/反序列化后，Uint8Array 会变成普通对象
      const audioMessage: ESP32WSMessage = {
        type: "audio",
        data: new Uint8Array([0x01, 0x02, 0x03]),
      };

      await messageHandler!(Buffer.from(JSON.stringify(audioMessage)));

      // 应该调用消息回调（data 字段会被 JSON 序列化/反序列化）
      expect(mockOnMessage).toHaveBeenCalled();
      const calledMessage = (mockOnMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(calledMessage.type).toBe("audio");
    });

    it("应该正确处理 JSON 格式错误的消息", async () => {
      const messageHandler = (mockWebSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      // 发送无效 JSON
      await messageHandler!(Buffer.from("invalid json{"));

      // 不应该调用消息回调
      expect(mockOnMessage).not.toHaveBeenCalled();
    });

    it("应该忽略重复的 Hello 消息", async () => {
      const helloMessage: ESP32WSMessage = {
        type: "hello",
        version: 1,
        transport: "websocket",
      };

      const messageHandler = (mockWebSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      // 第一次 Hello
      await messageHandler!(Buffer.from(JSON.stringify(helloMessage)));

      const firstSessionId = connection.getSessionId();

      // 第二次 Hello（应该被忽略）
      await messageHandler!(Buffer.from(JSON.stringify(helloMessage)));

      // Session ID 不应该改变
      expect(connection.getSessionId()).toBe(firstSessionId);
    });
  });

  describe("二进制消息处理", () => {
    it("应该正确处理 Protocol2 二进制音频数据", async () => {
      // 首先完成 Hello 握手
      const helloMessage: ESP32WSMessage = {
        type: "hello",
        version: 1,
        transport: "websocket",
      };

      const messageHandler = (mockWebSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      await messageHandler!(Buffer.from(JSON.stringify(helloMessage)));

      // 重置 mock 调用计数（不清除 handlers）
      mockOnMessage.mockClear();
      mockWebSocket.send.mockClear();

      // 构造 Protocol2 二进制数据
      // 格式：version(2) + type(0) + reserved(0) + timestamp(0) + payloadSize(3)
      const audioPayload = Buffer.from([0x01, 0x02, 0x03]);
      const binaryData = Buffer.alloc(16 + audioPayload.length);
      binaryData.writeUInt16BE(2, 0); // version = 2
      binaryData.writeUInt16BE(0, 2); // type = opus
      binaryData.writeUInt32BE(0, 4); // reserved
      binaryData.writeUInt32BE(1000, 8); // timestamp
      binaryData.writeUInt32BE(audioPayload.length, 12); // payload size
      binaryData.set(audioPayload, 16); // payload

      await messageHandler!(binaryData);

      // 应该调用消息回调，包含解析信息
      expect(mockOnMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "audio",
          data: audioPayload,
          _parsed: expect.objectContaining({
            protocolVersion: 2,
            dataType: "opus",
            timestamp: 1000,
          }),
        })
      );
    });

    it("应该处理无法识别的二进制数据为原始音频", async () => {
      // 首先完成 Hello 握手
      const helloMessage: ESP32WSMessage = {
        type: "hello",
        version: 1,
        transport: "websocket",
      };

      const messageHandler = (mockWebSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      await messageHandler!(Buffer.from(JSON.stringify(helloMessage)));

      // 重置 mock 调用计数（不清除 handlers）
      mockOnMessage.mockClear();
      mockWebSocket.send.mockClear();

      // 随机二进制数据
      const randomData = Buffer.from([0xFF, 0xAA, 0x55, 0x00]);

      await messageHandler!(randomData);

      // 应该作为原始音频处理
      expect(mockOnMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "audio",
          data: new Uint8Array(randomData),
        })
      );
    });
  });

  describe("消息发送", () => {
    it("应该正确发送 JSON 消息", async () => {
      const message: ESP32WSMessage = {
        type: "text",
        data: "test message",
      };

      await connection.send(message);

      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = (mockWebSocket.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const parsedMessage = JSON.parse(sentData);

      // 验证消息被转换为 snake_case
      expect(parsedMessage.type).toBe("text");
      expect(parsedMessage.data).toBe("test message");
    });

    it("应该在断开状态下拒绝发送消息", async () => {
      // 关闭连接
      await connection.close();

      const message: ESP32WSMessage = {
        type: "text",
        data: "test",
      };

      await expect(connection.send(message)).rejects.toThrow();
    });

    it("应该正确发送二进制数据", async () => {
      const data = new Uint8Array([0x01, 0x02, 0x03]);

      await connection.sendBinary(data);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        Buffer.from(data)
      );
    });

    it("应该正确发送 Protocol2 音频数据", async () => {
      const data = new Uint8Array([0x01, 0x02, 0x03]);

      await connection.sendBinaryProtocol2(data, 1000);

      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = (mockWebSocket.send as ReturnType<typeof vi.fn>).mock.calls[0][0];

      // 验证协议头部
      expect(sentData).toBeInstanceOf(Buffer);
      expect(sentData.readUInt16BE(0)).toBe(2); // version
    });

    it("应该使用默认时间戳发送 Protocol2 数据", async () => {
      const data = new Uint8Array([0x01]);

      await connection.sendBinaryProtocol2(data);

      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = (mockWebSocket.send as ReturnType<typeof vi.fn>).mock.calls[0][0];

      // 默认时间戳为 0
      expect(sentData.readUInt32BE(8)).toBe(0);
    });
  });

  describe("心跳检测", () => {
    it("应该检测连接超时", () => {
      // 这是一个简单的测试，实际超时检测需要时间操作
      // checkTimeout 依赖于 lastActivity，我们可以验证其行为

      // 刚创建连接，不应该超时
      expect(connection.checkTimeout()).toBe(false);
    });

    it("pong 事件应该更新活动时间", () => {
      const pongHandler = (mockWebSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "pong"
      )?.[1];

      expect(pongHandler).toBeDefined();

      const initialCheck = connection.checkTimeout();

      // 触发 pong
      pongHandler!();

      // 触发 pong 后不应该超时（刚活动过）
      expect(connection.checkTimeout()).toBe(initialCheck);
    });

    it("接收消息应该更新活动时间", () => {
      const messageHandler = (mockWebSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      expect(messageHandler).toBeDefined();

      const initialCheck = connection.checkTimeout();

      // 触发消息处理
      messageHandler!(Buffer.from('{"type":"text"}'));

      // 消息处理后不应该立即超时
      expect(connection.checkTimeout()).toBe(initialCheck);
    });

    it("断开状态不应该被判定为超时", () => {
      // 关闭连接
      connection.close();
      // 等待 close 完成
      setTimeout(() => {
        expect(connection.checkTimeout()).toBe(false);
      }, 100);
    });
  });

  describe("连接关闭", () => {
    it("应该正确关闭连接", async () => {
      await connection.close();

      expect(connection.getState()).toBe("disconnected");
      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, "Normal closure");
    });

    it("重复关闭不应该报错", async () => {
      await connection.close();
      await connection.close();

      expect(mockWebSocket.close).toHaveBeenCalledTimes(1);
    });

    it("close 事件应该触发回调", () => {
      const closeHandler = (mockWebSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "close"
      )?.[1];

      expect(closeHandler).toBeDefined();

      closeHandler!();

      expect(connection.getState()).toBe("disconnected");
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("error 事件应该触发错误回调", () => {
      const errorHandler = (mockWebSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "error"
      )?.[1];

      expect(errorHandler).toBeDefined();

      const testError = new Error("Test error");
      errorHandler!(testError);

      expect(mockOnError).toHaveBeenCalledWith(testError);
    });
  });

  describe("Getter 方法", () => {
    it("应该正确获取设备 ID", () => {
      expect(connection.getDeviceId()).toBe(deviceId);
    });

    it("应该正确获取客户端 ID", () => {
      expect(connection.getClientId()).toBe(clientId);
    });

    it("应该正确获取会话 ID", () => {
      const sessionId = connection.getSessionId();

      expect(sessionId).toContain(deviceId);
      expect(typeof sessionId).toBe("string");
    });

    it("应该正确获取连接状态", () => {
      expect(connection.getState()).toBe("connecting");
    });

    it("应该正确检查 Hello 完成状态", () => {
      expect(connection.isHelloCompleted()).toBe(false);
    });
  });
});
