/**
 * WebSocketManager 测试
 * 测试 WebSocket 管理器的功能
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageHandler } from "../types/WebServerTypes.js";
import { WebSocketManager } from "./WebSocketManager.js";
import { WebSocketMessageType } from "./types.js";

// Mock WebSocketServer
const mockWebSocketServer = {
  on: vi.fn(),
  close: vi.fn(),
};

vi.mock("ws", () => ({
  WebSocketServer: vi.fn().mockImplementation(() => mockWebSocketServer),
}));

// Mock logger
vi.mock("../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("WebSocketManager", () => {
  let webSocketManager: WebSocketManager;
  let mockServer: any;
  let mockHandler: MessageHandler;
  let mockWebSocket: any;

  beforeEach(() => {
    webSocketManager = new WebSocketManager();
    mockServer = {};
    mockHandler = {
      canHandle: vi.fn() as any,
      handle: vi.fn() as any,
    };
    mockWebSocket = {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("构造函数", () => {
    it("应该创建一个空的 WebSocket 管理器", () => {
      expect(webSocketManager.getHandlerCount()).toBe(0);
      expect(webSocketManager.getConnectionCount()).toBe(0);
    });
  });

  describe("addMessageHandler", () => {
    it("应该成功添加消息处理器", () => {
      webSocketManager.addMessageHandler(mockHandler);
      expect(webSocketManager.getHandlerCount()).toBe(1);
    });

    it("应该在添加空处理器时抛出错误", () => {
      expect(() => {
        webSocketManager.addMessageHandler(null as any);
      }).toThrow("消息处理器不能为空");
    });

    it("应该能够添加多个消息处理器", () => {
      const handler1 = { canHandle: vi.fn(), handle: vi.fn() };
      const handler2 = { canHandle: vi.fn(), handle: vi.fn() };

      webSocketManager.addMessageHandler(handler1);
      webSocketManager.addMessageHandler(handler2);

      expect(webSocketManager.getHandlerCount()).toBe(2);
    });
  });

  describe("setup", () => {
    it("应该成功设置 WebSocket 服务器", () => {
      webSocketManager.setup(mockServer);

      expect(mockWebSocketServer.on).toHaveBeenCalledWith(
        "connection",
        expect.any(Function)
      );
    });

    it("应该在服务器为空时抛出错误", () => {
      expect(() => {
        webSocketManager.setup(null);
      }).toThrow("HTTP 服务器实例不能为空");
    });
  });

  describe("handleConnection", () => {
    it("应该正确处理新的 WebSocket 连接", () => {
      webSocketManager.handleConnection(mockWebSocket);

      expect(mockWebSocket.on).toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      );
      expect(mockWebSocket.on).toHaveBeenCalledWith(
        "close",
        expect.any(Function)
      );
      expect(mockWebSocket.on).toHaveBeenCalledWith(
        "error",
        expect.any(Function)
      );
      expect(webSocketManager.getConnectionCount()).toBe(1);
    });
  });

  describe("broadcast", () => {
    beforeEach(() => {
      webSocketManager.handleConnection(mockWebSocket);
    });

    it("应该成功广播消息给所有连接", () => {
      const message = { type: "test", data: "test data" };
      webSocketManager.broadcast(message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it("应该在消息为空时发出警告", () => {
      webSocketManager.broadcast(null);
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it("应该跳过未连接的客户端", () => {
      mockWebSocket.readyState = 0; // WebSocket.CONNECTING
      const message = { type: "test" };

      webSocketManager.broadcast(message);
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });
  });

  describe("消息处理", () => {
    let messageCallback: (message: Buffer) => Promise<void>;

    beforeEach(() => {
      webSocketManager.addMessageHandler(mockHandler);
      webSocketManager.handleConnection(mockWebSocket);

      // 获取消息回调函数
      const messageCall = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === "message"
      );
      messageCallback = messageCall[1];
    });

    it("应该正确处理有效消息", async () => {
      const message = { type: "test", data: "test data" };
      (mockHandler.canHandle as any).mockReturnValue(true);

      await messageCallback(Buffer.from(JSON.stringify(message)));

      expect(mockHandler.canHandle).toHaveBeenCalledWith("test");
      expect(mockHandler.handle).toHaveBeenCalledWith(mockWebSocket, message);
    });

    it("应该处理未知消息类型", async () => {
      const message = { type: "unknown" };
      (mockHandler.canHandle as any).mockReturnValue(false);

      await messageCallback(Buffer.from(JSON.stringify(message)));

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"未知消息类型: unknown"')
      );
    });

    it("应该处理无效的 JSON 消息", async () => {
      await messageCallback(Buffer.from("invalid json"));

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    it("应该处理缺少 type 字段的消息", async () => {
      const message = { data: "test" };
      await messageCallback(Buffer.from(JSON.stringify(message)));

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"无效的消息格式"')
      );
    });
  });

  describe("closeAllConnections", () => {
    it("应该关闭所有连接", () => {
      webSocketManager.handleConnection(mockWebSocket);
      expect(webSocketManager.getConnectionCount()).toBe(1);

      webSocketManager.closeAllConnections();

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(webSocketManager.getConnectionCount()).toBe(0);
    });
  });

  describe("stop", () => {
    it("应该停止 WebSocket 服务器", async () => {
      webSocketManager.setup(mockServer);
      mockWebSocketServer.close.mockImplementation((callback) => callback());

      await webSocketManager.stop();

      expect(mockWebSocketServer.close).toHaveBeenCalled();
    });

    it("应该在没有服务器时正常返回", async () => {
      await expect(webSocketManager.stop()).resolves.toBeUndefined();
    });
  });
});
