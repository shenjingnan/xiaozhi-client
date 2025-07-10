import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { MultiEndpointMCPPipe } from "./multiEndpointMCPPipe.js";

// Mock dependencies
vi.mock("ws");
vi.mock("./configManager.js", () => ({
  configManager: {
    getConnectionConfig: vi.fn(() => ({
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      reconnectInterval: 5000,
    })),
    getWebUIPort: vi.fn(() => 9999),
  },
}));

vi.mock("./logger.js", () => ({
  logger: {
    withTag: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdin = {
      write: vi.fn(),
      destroyed: false,
    };
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = vi.fn();
    mockProcess.killed = false;
    return mockProcess;
  }),
}));

describe("MultiEndpointMCPPipe", () => {
  let mcpPipe: MultiEndpointMCPPipe;
  const mockEndpoints = [
    "ws://endpoint1.example.com",
    "ws://endpoint2.example.com",
    "ws://endpoint3.example.com",
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset WebSocket mock
    (WebSocket as any).mockImplementation(() => {
      const ws = new EventEmitter() as any;
      ws.readyState = WebSocket.OPEN;
      ws.send = vi.fn();
      ws.ping = vi.fn();
      ws.close = vi.fn();
      return ws;
    });
  });

  describe("constructor", () => {
    it("should initialize with multiple endpoints", () => {
      mcpPipe = new MultiEndpointMCPPipe("test.js", mockEndpoints);
      expect(mcpPipe).toBeDefined();
      // @ts-ignore - accessing private property for testing
      expect(mcpPipe.endpoints.size).toBe(3);
    });

    it("should handle single endpoint", () => {
      mcpPipe = new MultiEndpointMCPPipe("test.js", [
        "ws://single.example.com",
      ]);
      expect(mcpPipe).toBeDefined();
      // @ts-ignore - accessing private property for testing
      expect(mcpPipe.endpoints.size).toBe(1);
    });
  });

  describe("connectToAllEndpoints", () => {
    it("should connect to all endpoints", async () => {
      mcpPipe = new MultiEndpointMCPPipe("test.js", mockEndpoints);
      const connectSpy = vi.spyOn(mcpPipe as any, "connectToEndpoint");

      await mcpPipe.connectToAllEndpoints();

      expect(connectSpy).toHaveBeenCalledTimes(3);
      expect(connectSpy).toHaveBeenCalledWith(mockEndpoints[0]);
      expect(connectSpy).toHaveBeenCalledWith(mockEndpoints[1]);
      expect(connectSpy).toHaveBeenCalledWith(mockEndpoints[2]);
    });
  });

  describe("message routing", () => {
    it("should route response to correct endpoint", () => {
      mcpPipe = new MultiEndpointMCPPipe("test.js", mockEndpoints);

      // Setup mock endpoints
      const mockWs1 = new EventEmitter() as any;
      mockWs1.readyState = WebSocket.OPEN;
      mockWs1.send = vi.fn();

      const mockWs2 = new EventEmitter() as any;
      mockWs2.readyState = WebSocket.OPEN;
      mockWs2.send = vi.fn();

      // @ts-ignore - accessing private property for testing
      mcpPipe.endpoints.set(mockEndpoints[0], {
        url: mockEndpoints[0],
        websocket: mockWs1,
        isConnected: true,
        reconnectAttempt: 0,
      });

      // @ts-ignore - accessing private property for testing
      mcpPipe.endpoints.set(mockEndpoints[1], {
        url: mockEndpoints[1],
        websocket: mockWs2,
        isConnected: true,
        reconnectAttempt: 0,
      });

      // Send a request from endpoint1
      const request = JSON.stringify({
        jsonrpc: "2.0",
        id: 123,
        method: "test",
        params: {},
      });

      // @ts-ignore - accessing private method for testing
      mcpPipe.sendToEndpoint(mockEndpoints[0], request);

      // Now send a response
      const response = JSON.stringify({
        jsonrpc: "2.0",
        id: 123,
        result: { success: true },
      });

      // @ts-ignore - accessing private method for testing
      mcpPipe.handleMCPMessage(response);

      // Response should be sent back to endpoint1
      expect(mockWs1.send).toHaveBeenCalledWith(`${response}\n`);
      expect(mockWs2.send).not.toHaveBeenCalled();
    });

    it("should handle notifications without ID", () => {
      mcpPipe = new MultiEndpointMCPPipe("test.js", mockEndpoints);

      const mockWs = new EventEmitter() as any;
      mockWs.readyState = WebSocket.OPEN;
      mockWs.send = vi.fn();

      // @ts-ignore - accessing private property for testing
      mcpPipe.endpoints.set(mockEndpoints[0], {
        url: mockEndpoints[0],
        websocket: mockWs,
        isConnected: true,
        reconnectAttempt: 0,
      });

      const notification = JSON.stringify({
        jsonrpc: "2.0",
        method: "notification/test",
        params: {},
      });

      // @ts-ignore - accessing private method for testing
      mcpPipe.handleMCPMessage(notification);

      // Notification should be sent using load balancing
      expect(mockWs.send).toHaveBeenCalledWith(`${notification}\n`);
    });
  });

  describe("load balancing", () => {
    it("should use round-robin for new requests", () => {
      mcpPipe = new MultiEndpointMCPPipe("test.js", mockEndpoints);

      // Setup all endpoints as connected
      const mockWebSockets: any[] = [];
      mockEndpoints.forEach((url, index) => {
        const ws = new EventEmitter() as any;
        ws.readyState = WebSocket.OPEN;
        ws.send = vi.fn();
        mockWebSockets.push(ws);

        // @ts-ignore - accessing private property for testing
        mcpPipe.endpoints.set(url, {
          url,
          websocket: ws,
          isConnected: true,
          reconnectAttempt: 0,
        });
      });

      // Send multiple requests
      for (let i = 0; i < 6; i++) {
        const request = JSON.stringify({
          jsonrpc: "2.0",
          id: 1000 + i,
          method: "test",
          params: {},
        });

        // @ts-ignore - accessing private method for testing
        mcpPipe.handleMCPMessage(request);
      }

      // Each endpoint should receive 2 requests
      for (const ws of mockWebSockets) {
        expect(ws.send).toHaveBeenCalledTimes(2);
      }
    });

    it("should skip unavailable endpoints", () => {
      mcpPipe = new MultiEndpointMCPPipe("test.js", mockEndpoints);

      // Setup endpoints with one disconnected
      const mockWs1 = new EventEmitter() as any;
      mockWs1.readyState = WebSocket.OPEN;
      mockWs1.send = vi.fn();

      const mockWs2 = new EventEmitter() as any;
      mockWs2.readyState = WebSocket.CLOSED;
      mockWs2.send = vi.fn();

      const mockWs3 = new EventEmitter() as any;
      mockWs3.readyState = WebSocket.OPEN;
      mockWs3.send = vi.fn();

      // @ts-ignore - accessing private property for testing
      mcpPipe.endpoints.set(mockEndpoints[0], {
        url: mockEndpoints[0],
        websocket: mockWs1,
        isConnected: true,
        reconnectAttempt: 0,
      });

      // @ts-ignore - accessing private property for testing
      mcpPipe.endpoints.set(mockEndpoints[1], {
        url: mockEndpoints[1],
        websocket: mockWs2,
        isConnected: false,
        reconnectAttempt: 0,
      });

      // @ts-ignore - accessing private property for testing
      mcpPipe.endpoints.set(mockEndpoints[2], {
        url: mockEndpoints[2],
        websocket: mockWs3,
        isConnected: true,
        reconnectAttempt: 0,
      });

      // Send requests
      for (let i = 0; i < 4; i++) {
        const request = JSON.stringify({
          jsonrpc: "2.0",
          id: 2000 + i,
          method: "test",
          params: {},
        });

        // @ts-ignore - accessing private method for testing
        mcpPipe.handleMCPMessage(request);
      }

      // Only connected endpoints should receive requests
      expect(mockWs1.send).toHaveBeenCalledTimes(2);
      expect(mockWs2.send).not.toHaveBeenCalled();
      expect(mockWs3.send).toHaveBeenCalledTimes(2);
    });
  });

  describe("heartbeat", () => {
    it("should start heartbeat on connection", async () => {
      mcpPipe = new MultiEndpointMCPPipe("test.js", [mockEndpoints[0]]);
      const startHeartbeatSpy = vi.spyOn(mcpPipe as any, "startHeartbeat");

      const mockWs = new EventEmitter() as any;
      mockWs.readyState = WebSocket.OPEN;
      mockWs.send = vi.fn();
      mockWs.ping = vi.fn();
      mockWs.close = vi.fn();

      (WebSocket as any).mockImplementation(() => mockWs);

      await mcpPipe.connectToEndpoint(mockEndpoints[0]);

      // Simulate connection open
      mockWs.emit("open");

      expect(startHeartbeatSpy).toHaveBeenCalledWith(mockEndpoints[0]);
    });

    it("should stop heartbeat on disconnection", async () => {
      mcpPipe = new MultiEndpointMCPPipe("test.js", [mockEndpoints[0]]);
      const stopHeartbeatSpy = vi.spyOn(mcpPipe as any, "stopHeartbeat");

      const mockWs = new EventEmitter() as any;
      mockWs.readyState = WebSocket.OPEN;
      mockWs.send = vi.fn();
      mockWs.ping = vi.fn();
      mockWs.close = vi.fn();

      (WebSocket as any).mockImplementation(() => mockWs);

      await mcpPipe.connectToEndpoint(mockEndpoints[0]);

      // Simulate connection open then close
      mockWs.emit("open");
      mockWs.emit("close", 1000, "Normal closure");

      expect(stopHeartbeatSpy).toHaveBeenCalledWith(mockEndpoints[0]);
    });
  });

  describe("reconnection", () => {
    it("should schedule reconnection on connection failure", async () => {
      vi.useFakeTimers();
      mcpPipe = new MultiEndpointMCPPipe("test.js", [mockEndpoints[0]]);
      const scheduleReconnectSpy = vi.spyOn(
        mcpPipe as any,
        "scheduleReconnect"
      );

      const mockWs = new EventEmitter() as any;
      mockWs.readyState = WebSocket.CLOSED;
      mockWs.send = vi.fn();
      mockWs.close = vi.fn();

      (WebSocket as any).mockImplementation(() => mockWs);

      await mcpPipe.connectToEndpoint(mockEndpoints[0]);

      // Simulate connection error
      mockWs.emit("close", 1006, "Abnormal closure");

      expect(scheduleReconnectSpy).toHaveBeenCalledWith(mockEndpoints[0]);

      vi.useRealTimers();
    });

    it("should not reconnect on permanent error (4004)", async () => {
      mcpPipe = new MultiEndpointMCPPipe("test.js", [mockEndpoints[0]]);
      const scheduleReconnectSpy = vi.spyOn(
        mcpPipe as any,
        "scheduleReconnect"
      );

      const mockWs = new EventEmitter() as any;
      mockWs.readyState = WebSocket.CLOSED;
      mockWs.send = vi.fn();
      mockWs.close = vi.fn();

      (WebSocket as any).mockImplementation(() => mockWs);

      await mcpPipe.connectToEndpoint(mockEndpoints[0]);

      // Simulate permanent error
      mockWs.emit("close", 4004, "Permanent error");

      expect(scheduleReconnectSpy).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should cleanup all resources on shutdown", () => {
      mcpPipe = new MultiEndpointMCPPipe("test.js", mockEndpoints);

      // Setup mock endpoints
      const mockWebSockets: any[] = [];
      for (const url of mockEndpoints) {
        const ws = new EventEmitter() as any;
        ws.close = vi.fn();
        mockWebSockets.push(ws);

        // @ts-ignore - accessing private property for testing
        mcpPipe.endpoints.set(url, {
          url,
          websocket: ws,
          isConnected: true,
          reconnectAttempt: 0,
        });
      }

      // @ts-ignore - accessing private method for testing
      mcpPipe.cleanup();

      // All WebSockets should be closed
      for (const ws of mockWebSockets) {
        expect(ws.close).toHaveBeenCalled();
      }

      // @ts-ignore - accessing private property for testing
      expect(mcpPipe.messageRoutes.size).toBe(0);
    });
  });

  describe("status reporting", () => {
    it("should report status with all endpoints", () => {
      mcpPipe = new MultiEndpointMCPPipe("test.js", mockEndpoints);

      // @ts-ignore - accessing private property for testing
      mcpPipe.endpoints.set(mockEndpoints[0], {
        url: mockEndpoints[0],
        websocket: null,
        isConnected: true,
        reconnectAttempt: 0,
      });

      // @ts-ignore - accessing private property for testing
      mcpPipe.endpoints.set(mockEndpoints[1], {
        url: mockEndpoints[1],
        websocket: null,
        isConnected: false,
        reconnectAttempt: 0,
      });

      // @ts-ignore - accessing private property for testing
      mcpPipe.endpoints.set(mockEndpoints[2], {
        url: mockEndpoints[2],
        websocket: null,
        isConnected: true,
        reconnectAttempt: 0,
      });

      expect(mcpPipe.hasAnyConnection()).toBe(true);
    });

    it("should report disconnected when no endpoints are connected", () => {
      mcpPipe = new MultiEndpointMCPPipe("test.js", mockEndpoints);

      for (const url of mockEndpoints) {
        // @ts-ignore - accessing private property for testing
        mcpPipe.endpoints.set(url, {
          url,
          websocket: null,
          isConnected: false,
          reconnectAttempt: 0,
        });
      }

      expect(mcpPipe.hasAnyConnection()).toBe(false);
    });
  });
});
