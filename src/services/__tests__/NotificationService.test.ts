import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../configManager";
import { NotificationService } from "../NotificationService.js";
import type {
  NotificationMessage,
  WebSocketClient,
} from "../NotificationService.js";
import type { ClientInfo } from "../StatusService.js";

// Mock dependencies
vi.mock("../../Logger.js", () => ({
  logger: {
    withTag: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

vi.mock("../EventBus.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    onEvent: vi.fn(),
    emitEvent: vi.fn(),
  }),
}));

describe("NotificationService", () => {
  let notificationService: NotificationService;
  let mockEventBus: any;
  let mockLogger: any;
  let mockWebSocket: any;
  let mockClient: WebSocketClient;

  const mockConfig: AppConfig = {
    mcpEndpoint: "ws://localhost:3000",
    mcpServers: {
      calculator: {
        command: "node",
        args: ["calculator.js"],
      },
    },
    connection: {
      heartbeatInterval: 30000,
      heartbeatTimeout: 35000,
      reconnectInterval: 5000,
    },
    webUI: {
      port: 3001,
    },
  };

  const mockClientInfo: ClientInfo = {
    status: "connected",
    mcpEndpoint: "ws://localhost:3000",
    activeMCPServers: ["calculator", "datetime"],
    lastHeartbeat: Date.now(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock EventBus
    mockEventBus = {
      onEvent: vi.fn(),
      emitEvent: vi.fn(),
    };
    const { getEventBus } = await import("../EventBus.js");
    vi.mocked(getEventBus).mockReturnValue(mockEventBus);

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    vi.mocked(logger.withTag).mockReturnValue(mockLogger);

    // Mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    };

    mockClient = {
      id: "test-client-123",
      ws: mockWebSocket,
      readyState: 1,
      send: vi.fn(),
    };

    notificationService = new NotificationService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with correct dependencies", () => {
      expect(notificationService).toBeInstanceOf(NotificationService);
      expect(mockEventBus.onEvent).toHaveBeenCalledTimes(10); // 10 event listeners
    });

    it("should set up event listeners correctly", () => {
      expect(mockEventBus.onEvent).toHaveBeenCalledWith(
        "config:updated",
        expect.any(Function)
      );
      expect(mockEventBus.onEvent).toHaveBeenCalledWith(
        "status:updated",
        expect.any(Function)
      );
      expect(mockEventBus.onEvent).toHaveBeenCalledWith(
        "service:restart:started",
        expect.any(Function)
      );
      expect(mockEventBus.onEvent).toHaveBeenCalledWith(
        "service:restart:completed",
        expect.any(Function)
      );
      expect(mockEventBus.onEvent).toHaveBeenCalledWith(
        "service:restart:failed",
        expect.any(Function)
      );
      expect(mockEventBus.onEvent).toHaveBeenCalledWith(
        "notification:broadcast",
        expect.any(Function)
      );
    });
  });

  describe("registerClient", () => {
    it("should register client successfully", () => {
      notificationService.registerClient("test-client-123", mockWebSocket);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "WebSocket 客户端已注册: test-client-123"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith("当前客户端数量: 1");
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "websocket:client:connected",
        {
          clientId: "test-client-123",
          timestamp: expect.any(Number),
        }
      );
    });

    it("should send queued messages to newly registered client", () => {
      // First, send a message to offline client to queue it
      notificationService.sendToClient("test-client-123", "testMessage", {
        data: "test",
      });

      // Then register the client
      notificationService.registerClient("test-client-123", mockWebSocket);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"testMessage"')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "发送 1 条排队消息给客户端 test-client-123"
      );
    });

    it("should handle registration error", () => {
      const errorWebSocket = {
        get readyState() {
          throw new Error("WebSocket error");
        },
      };

      notificationService.registerClient("error-client", errorWebSocket);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "注册客户端失败: error-client",
        expect.any(Error)
      );
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "notification:error",
        {
          error: expect.any(Error),
          type: "client:register",
        }
      );
    });

    it("should handle non-Error exceptions during registration", () => {
      const errorWebSocket = {
        get readyState() {
          throw "String error";
        },
      };

      notificationService.registerClient("error-client", errorWebSocket);

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "notification:error",
        {
          error: expect.any(Error),
          type: "client:register",
        }
      );
    });
  });

  describe("unregisterClient", () => {
    it("should unregister client successfully", () => {
      // First register a client
      notificationService.registerClient("test-client-123", mockWebSocket);

      // Then unregister it
      notificationService.unregisterClient("test-client-123");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "WebSocket 客户端已注销: test-client-123"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith("剩余客户端数量: 0");
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "websocket:client:disconnected",
        {
          clientId: "test-client-123",
          timestamp: expect.any(Number),
        }
      );
    });

    it("should handle unregistering non-existent client", () => {
      notificationService.unregisterClient("non-existent-client");

      // Should not throw error or log anything for non-existent client
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining("WebSocket 客户端已注销")
      );
    });

    it("should clear message queue when unregistering client", () => {
      // Queue a message for offline client
      notificationService.sendToClient("test-client-123", "testMessage", {
        data: "test",
      });

      // Register client to create the queue
      notificationService.registerClient("test-client-123", mockWebSocket);

      // Clear previous mock calls
      vi.clearAllMocks();

      // Unregister client
      notificationService.unregisterClient("test-client-123");

      // Register again - should not have queued messages
      const newMockWebSocket = { send: vi.fn(), readyState: 1 };
      notificationService.registerClient("test-client-123", newMockWebSocket);

      // Should not send any queued messages
      expect(newMockWebSocket.send).not.toHaveBeenCalled();
    });

    it("should handle un-registration error", () => {
      // First register a client
      notificationService.registerClient("test-client", mockWebSocket);

      // Create a service with a mock that throws an error
      const mockClients = new Map();
      mockClients.has = vi.fn().mockReturnValue(true);
      mockClients.delete = vi.fn().mockImplementation(() => {
        throw new Error("Delete error");
      });

      // Replace the clients map with our mock
      (notificationService as any).clients = mockClients;

      notificationService.unregisterClient("test-client");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "注销客户端失败: test-client",
        expect.any(Error)
      );
    });
  });

  describe("broadcast", () => {
    it("should broadcast message to all clients", () => {
      const mockWebSocket2 = { send: vi.fn(), readyState: 1 };

      notificationService.registerClient("client1", mockWebSocket);
      notificationService.registerClient("client2", mockWebSocket2);

      notificationService.broadcast("testBroadcast", { message: "hello" });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"testBroadcast"')
      );
      expect(mockWebSocket2.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"testBroadcast"')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith("广播消息: testBroadcast", {
        clientCount: 2,
      });
    });

    it("should broadcast to empty client list without error", () => {
      notificationService.broadcast("testBroadcast", { message: "hello" });

      expect(mockLogger.debug).toHaveBeenCalledWith("广播消息: testBroadcast", {
        clientCount: 0,
      });
    });

    it("should include timestamp in broadcast message", () => {
      notificationService.registerClient("client1", mockWebSocket);

      const beforeTime = Date.now();
      notificationService.broadcast("testBroadcast", { message: "hello" });
      const afterTime = Date.now();

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringMatching(/"timestamp":\d+/)
      );

      // Verify timestamp is reasonable
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(sentMessage.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it("should handle broadcast with undefined data", () => {
      notificationService.registerClient("client1", mockWebSocket);

      notificationService.broadcast("testBroadcast");

      // When data is undefined, it should not include data field or include it as undefined
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("testBroadcast");
      expect(sentMessage.data).toBeUndefined();
    });
  });

  describe("sendToClient", () => {
    it("should send message to specific client", () => {
      notificationService.registerClient("test-client-123", mockWebSocket);

      notificationService.sendToClient("test-client-123", "testMessage", {
        data: "test",
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"testMessage"')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "消息已发送给客户端 test-client-123: testMessage"
      );
    });

    it("should queue message for offline client", () => {
      notificationService.sendToClient("offline-client", "testMessage", {
        data: "test",
      });

      // Message should be queued, not sent immediately
      expect(mockWebSocket.send).not.toHaveBeenCalled();

      // When client comes online, message should be sent
      notificationService.registerClient("offline-client", mockWebSocket);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"testMessage"')
      );
    });

    it("should handle client with closed connection", () => {
      const closedWebSocket = { send: vi.fn(), readyState: 3 }; // WebSocket.CLOSED
      notificationService.registerClient("test-client-123", closedWebSocket);

      notificationService.sendToClient("test-client-123", "testMessage", {
        data: "test",
      });

      expect(closedWebSocket.send).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "客户端 test-client-123 连接不可用，消息已加入队列"
      );
    });

    it("should handle send error and queue message", () => {
      const errorWebSocket = {
        send: vi.fn().mockImplementation(() => {
          throw new Error("Send failed");
        }),
        readyState: 1,
      };
      notificationService.registerClient("test-client-123", errorWebSocket);

      notificationService.sendToClient("test-client-123", "testMessage", {
        data: "test",
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "发送消息给客户端 test-client-123 失败:",
        expect.any(Error)
      );
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "notification:error",
        {
          error: expect.any(Error),
          type: "message:send",
        }
      );
    });

    it("should handle non-Error exceptions during send", () => {
      const errorWebSocket = {
        send: vi.fn().mockImplementation(() => {
          throw "String error";
        }),
        readyState: 1,
      };
      notificationService.registerClient("test-client-123", errorWebSocket);

      notificationService.sendToClient("test-client-123", "testMessage", {
        data: "test",
      });

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "notification:error",
        {
          error: expect.any(Error),
          type: "message:send",
        }
      );
    });
  });

  describe("message queue management", () => {
    it("should respect max queue size", () => {
      const maxQueueSize = 100;

      // Send more messages than max queue size
      for (let i = 0; i < maxQueueSize + 5; i++) {
        notificationService.sendToClient("offline-client", "testMessage", {
          data: `test${i}`,
        });
      }

      // Register client and check that only the last maxQueueSize messages are sent
      notificationService.registerClient("offline-client", mockWebSocket);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(maxQueueSize);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "客户端 offline-client 消息队列已满，移除最旧消息"
      );
    });

    it("should clear queue after sending messages", () => {
      // Queue multiple messages
      notificationService.sendToClient("test-client", "message1", {
        data: "test1",
      });
      notificationService.sendToClient("test-client", "message2", {
        data: "test2",
      });

      // Register client
      notificationService.registerClient("test-client", mockWebSocket);

      // Send another message - should not include previously queued messages
      const newMockWebSocket = { send: vi.fn(), readyState: 1 };
      notificationService.unregisterClient("test-client");
      notificationService.registerClient("test-client", newMockWebSocket);

      expect(newMockWebSocket.send).not.toHaveBeenCalled();
    });

    it("should handle empty queue gracefully", () => {
      notificationService.registerClient("test-client", mockWebSocket);

      // Should not log about sending queued messages
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining("发送")
      );
    });
  });

  describe("event listeners", () => {
    it("should handle config:updated event", () => {
      notificationService.registerClient("test-client", mockWebSocket);

      // Get the config:updated listener
      const configUpdatedListener = mockEventBus.onEvent.mock.calls.find(
        (call: any) => call[0] === "config:updated"
      )[1];

      // Trigger the event
      configUpdatedListener({ config: mockConfig });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"configUpdate"')
      );
    });

    it("should handle status:updated event", () => {
      notificationService.registerClient("test-client", mockWebSocket);

      // Get the status:updated listener
      const statusUpdatedListener = mockEventBus.onEvent.mock.calls.find(
        (call: any) => call[0] === "status:updated"
      )[1];

      // Trigger the event
      statusUpdatedListener({ status: mockClientInfo });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"statusUpdate"')
      );
    });

    it("should handle service:restart:started event", () => {
      notificationService.registerClient("test-client", mockWebSocket);

      // Get the service:restart:started listener
      const restartStartedListener = mockEventBus.onEvent.mock.calls.find(
        (call: any) => call[0] === "service:restart:started"
      )[1];

      // Trigger the event
      const timestamp = Date.now();
      restartStartedListener({ timestamp });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"restartStatus"')
      );

      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.data.status).toBe("restarting");
      expect(sentMessage.data.timestamp).toBe(timestamp);
    });

    it("should handle service:restart:completed event", () => {
      notificationService.registerClient("test-client", mockWebSocket);

      // Get the service:restart:completed listener
      const restartCompletedListener = mockEventBus.onEvent.mock.calls.find(
        (call: any) => call[0] === "service:restart:completed"
      )[1];

      // Trigger the event
      const timestamp = Date.now();
      restartCompletedListener({ timestamp });

      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.data.status).toBe("completed");
      expect(sentMessage.data.timestamp).toBe(timestamp);
    });

    it("should handle service:restart:failed event", () => {
      notificationService.registerClient("test-client", mockWebSocket);

      // Get the service:restart:failed listener
      const restartFailedListener = mockEventBus.onEvent.mock.calls.find(
        (call: any) => call[0] === "service:restart:failed"
      )[1];

      // Trigger the event
      const timestamp = Date.now();
      restartFailedListener({
        error: { message: "Restart failed" },
        timestamp,
      });

      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.data.status).toBe("failed");
      expect(sentMessage.data.error).toBe("Restart failed");
      expect(sentMessage.data.timestamp).toBe(timestamp);
    });

    it("should handle notification:broadcast event with target", () => {
      notificationService.registerClient("target-client", mockWebSocket);
      notificationService.registerClient("other-client", {
        send: vi.fn(),
        readyState: 1,
      });

      // Get the notification:broadcast listener
      const broadcastListener = mockEventBus.onEvent.mock.calls.find(
        (call: any) => call[0] === "notification:broadcast"
      )[1];

      // Trigger the event with target
      broadcastListener({
        target: "target-client",
        type: "targetedMessage",
        data: { message: "hello" },
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"targetedMessage"')
      );
    });

    it("should handle notification:broadcast event without target", () => {
      const mockWebSocket2 = { send: vi.fn(), readyState: 1 };
      notificationService.registerClient("client1", mockWebSocket);
      notificationService.registerClient("client2", mockWebSocket2);

      // Get the notification:broadcast listener
      const broadcastListener = mockEventBus.onEvent.mock.calls.find(
        (call: any) => call[0] === "notification:broadcast"
      )[1];

      // Trigger the event without target (broadcast to all)
      broadcastListener({
        type: "broadcastMessage",
        data: { message: "hello all" },
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"broadcastMessage"')
      );
      expect(mockWebSocket2.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"broadcastMessage"')
      );
    });
  });

  describe("broadcast methods", () => {
    it("should broadcast config update", () => {
      notificationService.registerClient("test-client", mockWebSocket);

      notificationService.broadcastConfigUpdate(mockConfig);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"configUpdate"')
      );

      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.data).toEqual(mockConfig);
    });

    it("should broadcast status update", () => {
      notificationService.registerClient("test-client", mockWebSocket);

      notificationService.broadcastStatusUpdate(mockClientInfo);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"statusUpdate"')
      );

      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.data).toEqual(mockClientInfo);
    });

    it("should broadcast restart status with all parameters", () => {
      notificationService.registerClient("test-client", mockWebSocket);

      const timestamp = Date.now();
      notificationService.broadcastRestartStatus(
        "failed",
        "Connection error",
        timestamp
      );

      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("restartStatus");
      expect(sentMessage.data.status).toBe("failed");
      expect(sentMessage.data.error).toBe("Connection error");
      expect(sentMessage.data.timestamp).toBe(timestamp);
    });

    it("should broadcast restart status with default timestamp", () => {
      notificationService.registerClient("test-client", mockWebSocket);

      const beforeTime = Date.now();
      notificationService.broadcastRestartStatus("completed");
      const afterTime = Date.now();

      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.data.status).toBe("completed");
      expect(sentMessage.data.error).toBeUndefined();
      expect(sentMessage.data.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(sentMessage.data.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("getClientStats", () => {
    it("should return correct stats with no clients", () => {
      const stats = notificationService.getClientStats();

      expect(stats).toEqual({
        totalClients: 0,
        connectedClients: 0,
        queuedMessages: 0,
      });
    });

    it("should return correct stats with connected clients", () => {
      const mockWebSocket2 = { send: vi.fn(), readyState: 1 };
      notificationService.registerClient("client1", mockWebSocket);
      notificationService.registerClient("client2", mockWebSocket2);

      const stats = notificationService.getClientStats();

      expect(stats).toEqual({
        totalClients: 2,
        connectedClients: 2,
        queuedMessages: 0,
      });
    });

    it("should return correct stats with mixed connection states", () => {
      const connectedWebSocket = { send: vi.fn(), readyState: 1 }; // OPEN
      const disconnectedWebSocket = { send: vi.fn(), readyState: 3 }; // CLOSED

      notificationService.registerClient(
        "connected-client",
        connectedWebSocket
      );
      notificationService.registerClient(
        "disconnected-client",
        disconnectedWebSocket
      );

      const stats = notificationService.getClientStats();

      expect(stats).toEqual({
        totalClients: 2,
        connectedClients: 1,
        queuedMessages: 0,
      });
    });

    it("should return correct stats with queued messages", () => {
      // Queue messages for offline clients
      notificationService.sendToClient("offline1", "message1", {
        data: "test1",
      });
      notificationService.sendToClient("offline1", "message2", {
        data: "test2",
      });
      notificationService.sendToClient("offline2", "message3", {
        data: "test3",
      });

      const stats = notificationService.getClientStats();

      expect(stats).toEqual({
        totalClients: 0,
        connectedClients: 0,
        queuedMessages: 3,
      });
    });
  });

  describe("cleanupDisconnectedClients", () => {
    it("should remove disconnected clients", () => {
      const connectedWebSocket = { send: vi.fn(), readyState: 1 }; // OPEN
      const disconnectedWebSocket = { send: vi.fn(), readyState: 3 }; // CLOSED

      notificationService.registerClient(
        "connected-client",
        connectedWebSocket
      );
      notificationService.registerClient(
        "disconnected-client",
        disconnectedWebSocket
      );

      notificationService.cleanupDisconnectedClients();

      expect(mockLogger.info).toHaveBeenCalledWith("清理了 1 个断开的客户端");

      const stats = notificationService.getClientStats();
      expect(stats.totalClients).toBe(1);
    });

    it("should handle cleanup with no disconnected clients", () => {
      const connectedWebSocket = { send: vi.fn(), readyState: 1 };
      notificationService.registerClient(
        "connected-client",
        connectedWebSocket
      );

      notificationService.cleanupDisconnectedClients();

      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining("清理了")
      );

      const stats = notificationService.getClientStats();
      expect(stats.totalClients).toBe(1);
    });

    it("should handle cleanup with no clients", () => {
      notificationService.cleanupDisconnectedClients();

      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining("清理了")
      );
    });

    it("should cleanup multiple disconnected clients", () => {
      const connectedWebSocket = { send: vi.fn(), readyState: 1 };
      const disconnectedWebSocket1 = { send: vi.fn(), readyState: 2 }; // CLOSING
      const disconnectedWebSocket2 = { send: vi.fn(), readyState: 3 }; // CLOSED

      notificationService.registerClient(
        "connected-client",
        connectedWebSocket
      );
      notificationService.registerClient(
        "disconnected-client1",
        disconnectedWebSocket1
      );
      notificationService.registerClient(
        "disconnected-client2",
        disconnectedWebSocket2
      );

      notificationService.cleanupDisconnectedClients();

      expect(mockLogger.info).toHaveBeenCalledWith("清理了 2 个断开的客户端");

      const stats = notificationService.getClientStats();
      expect(stats.totalClients).toBe(1);
    });
  });

  describe("destroy", () => {
    it("should clear all clients and message queues", () => {
      // Add some clients and queued messages
      notificationService.registerClient("client1", mockWebSocket);
      notificationService.sendToClient("offline-client", "message", {
        data: "test",
      });

      notificationService.destroy();

      expect(mockLogger.info).toHaveBeenCalledWith("销毁通知服务");

      const stats = notificationService.getClientStats();
      expect(stats.totalClients).toBe(0);
      expect(stats.queuedMessages).toBe(0);
    });

    it("should handle destroy with no clients", () => {
      notificationService.destroy();

      expect(mockLogger.info).toHaveBeenCalledWith("销毁通知服务");

      const stats = notificationService.getClientStats();
      expect(stats.totalClients).toBe(0);
      expect(stats.queuedMessages).toBe(0);
    });
  });

  describe("integration scenarios", () => {
    it("should handle client reconnection with queued messages", () => {
      // Send messages to offline client
      notificationService.sendToClient("test-client", "message1", {
        data: "test1",
      });
      notificationService.sendToClient("test-client", "message2", {
        data: "test2",
      });

      // Client connects
      notificationService.registerClient("test-client", mockWebSocket);

      // Should send both queued messages
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "发送 2 条排队消息给客户端 test-client"
      );

      // Client disconnects
      notificationService.unregisterClient("test-client");

      // Send more messages
      notificationService.sendToClient("test-client", "message3", {
        data: "test3",
      });

      // Client reconnects
      const newMockWebSocket = { send: vi.fn(), readyState: 1 };
      notificationService.registerClient("test-client", newMockWebSocket);

      // Should only send the new message
      expect(newMockWebSocket.send).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "发送 1 条排队消息给客户端 test-client"
      );
    });

    it("should handle multiple clients with different connection states", () => {
      const client1WS = { send: vi.fn(), readyState: 1 }; // OPEN
      const client2WS = { send: vi.fn(), readyState: 0 }; // CONNECTING
      const client3WS = { send: vi.fn(), readyState: 3 }; // CLOSED

      notificationService.registerClient("client1", client1WS);
      notificationService.registerClient("client2", client2WS);
      notificationService.registerClient("client3", client3WS);

      notificationService.broadcast("testMessage", { data: "test" });

      // Only client1 should receive the message immediately
      expect(client1WS.send).toHaveBeenCalledTimes(1);
      expect(client2WS.send).not.toHaveBeenCalled();
      expect(client3WS.send).not.toHaveBeenCalled();

      // Messages for client2 and client3 should be queued
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "客户端 client2 连接不可用，消息已加入队列"
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "客户端 client3 连接不可用，消息已加入队列"
      );
    });

    it("should handle event-driven notifications end-to-end", () => {
      notificationService.registerClient("test-client", mockWebSocket);

      // Simulate config update event
      const configUpdatedListener = mockEventBus.onEvent.mock.calls.find(
        (call: any) => call[0] === "config:updated"
      )[1];
      configUpdatedListener({ config: mockConfig });

      // Simulate status update event
      const statusUpdatedListener = mockEventBus.onEvent.mock.calls.find(
        (call: any) => call[0] === "status:updated"
      )[1];
      statusUpdatedListener({ status: mockClientInfo });

      // Should have sent both notifications
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"configUpdate"')
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"statusUpdate"')
      );
    });
  });
});
