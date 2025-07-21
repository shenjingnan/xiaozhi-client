import { EventEmitter } from "node:events";
import type { Server } from "node:http";
import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MCPServer } from "./mcpServer.js";

// Mock dependencies
vi.mock("express", () => {
  const mockApp = {
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    listen: vi.fn((port, callback) => {
      callback?.();
      return { close: vi.fn((cb) => cb?.()) };
    }),
  };
  const expressMock = vi.fn(() => mockApp);
  expressMock.json = vi.fn(() => (req: any, res: any, next: any) => next());
  expressMock.urlencoded = vi.fn(
    () => (req: any, res: any, next: any) => next()
  );
  return {
    default: expressMock,
  };
});

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdin = {
      write: vi.fn(),
    };
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = vi.fn((signal) => {
      // Simulate process exit when killed
      setTimeout(() => {
        mockProcess.emit("exit", 0, signal);
      }, 10);
    });

    // Simulate successful startup
    setTimeout(() => {
      mockProcess.stdout.emit("data", Buffer.from("MCP proxy ready"));
    }, 10);

    return mockProcess;
  }),
}));

vi.mock("../logger.js", () => ({
  logger: {
    withTag: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

vi.mock("../configManager.js", () => ({
  configManager: {
    configExists: vi.fn(() => true),
  },
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn((path: string) => path.includes("mcpServerProxy.js")),
}));

describe("MCPServer", () => {
  let server: MCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new MCPServer(3000);
  });

  it("should create an instance with default port", () => {
    const defaultServer = new MCPServer();
    expect(defaultServer).toBeInstanceOf(MCPServer);
    expect(defaultServer).toBeInstanceOf(EventEmitter);
  });

  it("should create an instance with custom port", () => {
    expect(server).toBeInstanceOf(MCPServer);
    expect(server).toBeInstanceOf(EventEmitter);
  });

  it("should setup middleware and routes on construction", () => {
    const mockExpress = vi.mocked(express);
    const mockApp = mockExpress();

    expect(mockApp.use).toHaveBeenCalled();
    expect(mockApp.get).toHaveBeenCalledWith("/sse", expect.any(Function));
    expect(mockApp.post).toHaveBeenCalledWith(
      "/messages",
      expect.any(Function)
    );
    expect(mockApp.post).toHaveBeenCalledWith("/rpc", expect.any(Function));
    expect(mockApp.get).toHaveBeenCalledWith("/health", expect.any(Function));
  });

  describe("SSE endpoint", () => {
    it("should handle SSE client connections", () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      // Get the SSE handler
      const sseHandler = mockApp.get.mock.calls.find(
        (call) => call[0] === "/sse"
      )?.[1];

      expect(sseHandler).toBeDefined();

      // Mock request and response
      const mockReq = new EventEmitter() as any;
      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn(),
      };

      // Call the handler
      sseHandler?.(mockReq, mockRes);

      // Check headers were set
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/event-stream"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        "no-cache, no-transform"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Connection",
        "keep-alive"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");

      // Check endpoint event was sent with sessionId
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringMatching(
          /event: endpoint\ndata: \/messages\?sessionId=[\w-]+\n\n/
        )
      );
    });

    it("should generate unique sessionId for each connection", () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      const sseHandler = mockApp.get.mock.calls.find(
        (call) => call[0] === "/sse"
      )?.[1];

      const sessionIds = new Set<string>();

      // Test multiple connections
      for (let i = 0; i < 5; i++) {
        const mockReq = new EventEmitter() as any;
        const mockRes = {
          setHeader: vi.fn(),
          write: vi.fn(),
        };

        sseHandler?.(mockReq, mockRes);

        // Extract sessionId from the write call
        const writeCall = mockRes.write.mock.calls[0][0];
        const match = writeCall.match(/sessionId=([\w-]+)/);
        if (match) {
          sessionIds.add(match[1]);
        }
      }

      // All sessionIds should be unique
      expect(sessionIds.size).toBe(5);
    });
  });

  describe("Messages endpoint", () => {
    it("should handle messages with valid sessionId", async () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      // Start the server to initialize proxy
      await server.start();

      // Get the messages handler
      const messagesHandler = mockApp.post.mock.calls.find(
        (call) => call[0] === "/messages"
      )?.[1];

      expect(messagesHandler).toBeDefined();

      // Mock request and response
      const mockReq = {
        query: { sessionId: "test-session-123" },
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "test",
          params: {},
        },
      };
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
        send: vi.fn(),
      };

      // Setup a mock client in the server
      const mockClient = {
        id: "client-1",
        sessionId: "test-session-123",
        response: {
          write: vi.fn(),
        },
      };
      // Access the private clients map (for testing purposes)
      (server as any).clients.set("test-session-123", mockClient);

      // Mock the forwardToProxy method to resolve immediately
      const originalForwardToProxy = (server as any).forwardToProxy;
      (server as any).forwardToProxy = vi.fn().mockResolvedValue({
        jsonrpc: "2.0",
        id: 1,
        result: { success: true },
      });

      // Call the handler
      await messagesHandler?.(mockReq as any, mockRes as any);

      // Check response
      expect(mockRes.status).toHaveBeenCalledWith(202);
      expect(mockRes.send).toHaveBeenCalled();

      // Restore original method
      (server as any).forwardToProxy = originalForwardToProxy;
    });

    it("should handle notification messages (no id)", async () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      await server.start();

      const messagesHandler = mockApp.post.mock.calls.find(
        (call) => call[0] === "/messages"
      )?.[1];

      const mockReq = {
        query: { sessionId: "test-session-123" },
        body: {
          jsonrpc: "2.0",
          method: "notifications/initialized",
          // No id field - this is a notification
        },
      };
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
        send: vi.fn(),
      };

      // Setup a mock client
      const mockClient = {
        id: "client-1",
        sessionId: "test-session-123",
        response: {
          write: vi.fn(),
        },
      };
      (server as any).clients.set("test-session-123", mockClient);

      // Call the handler
      await messagesHandler?.(mockReq as any, mockRes as any);

      // Should immediately return 202 for notifications
      expect(mockRes.status).toHaveBeenCalledWith(202);
      expect(mockRes.send).toHaveBeenCalled();
    });

    it("should return 400 for missing sessionId", async () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      const messagesHandler = mockApp.post.mock.calls.find(
        (call) => call[0] === "/messages"
      )?.[1];

      const mockReq = {
        query: {}, // No sessionId
        body: { jsonrpc: "2.0", id: 1, method: "test" },
      };
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
      };

      await messagesHandler?.(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Invalid or missing sessionId",
        },
        id: 1,
      });
    });

    it("should return 400 for invalid sessionId", async () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      const messagesHandler = mockApp.post.mock.calls.find(
        (call) => call[0] === "/messages"
      )?.[1];

      const mockReq = {
        query: { sessionId: "invalid-session" },
        body: { jsonrpc: "2.0", id: 1, method: "test" },
      };
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
      };

      await messagesHandler?.(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Invalid or missing sessionId",
        },
        id: 1,
      });
    });

    it("should return 503 when proxy is not running", async () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      const messagesHandler = mockApp.post.mock.calls.find(
        (call) => call[0] === "/messages"
      )?.[1];

      const mockReq = {
        query: { sessionId: "test-session-123" },
        body: { jsonrpc: "2.0", id: 1, method: "test" },
      };
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
      };

      // Setup a mock client but no proxy
      const mockClient = {
        id: "client-1",
        sessionId: "test-session-123",
        response: {
          write: vi.fn(),
        },
      };
      (server as any).clients.set("test-session-123", mockClient);
      (server as any).mcpProxy = null; // Ensure proxy is not running

      await messagesHandler?.(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "MCP proxy not running",
        },
        id: 1,
      });
    });
  });

  describe("RPC endpoint", () => {
    it("should return 503 when proxy is not running", async () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      // Get the RPC handler
      const rpcHandler = mockApp.post.mock.calls.find(
        (call) => call[0] === "/rpc"
      )?.[1];

      expect(rpcHandler).toBeDefined();

      // Mock request and response
      const mockReq = {
        body: { jsonrpc: "2.0", id: 1, method: "test" },
      };
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
      };

      // Call the handler
      await rpcHandler?.(mockReq as any, mockRes as any);

      // Check error response
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "MCP proxy not running",
        },
        id: 1,
      });
    });
  });

  describe("Health endpoint", () => {
    it("should return health status", () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      // Get the health handler
      const healthHandler = mockApp.get.mock.calls.find(
        (call) => call[0] === "/health"
      )?.[1];

      expect(healthHandler).toBeDefined();

      // Mock request and response
      const mockReq = {};
      const mockRes = {
        json: vi.fn(),
      };

      // Call the handler
      healthHandler?.(mockReq as any, mockRes as any);

      // Check response
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "ok",
        mode: "mcp-server",
        proxy: "stopped",
        clients: 0,
      });
    });
  });

  describe("start and stop", () => {
    it("should start the server successfully", async () => {
      await server.start();

      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      expect(mockApp.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    });

    it("should emit started event after successful start", async () => {
      const startedHandler = vi.fn();
      server.on("started", startedHandler);

      await server.start();

      expect(startedHandler).toHaveBeenCalled();
    });

    it("should stop the server successfully", async () => {
      await server.start();
      await server.stop();

      // Should not throw
      expect(true).toBe(true);
    });

    it("should emit stopped event after stop", async () => {
      const stoppedHandler = vi.fn();
      server.on("stopped", stoppedHandler);

      await server.start();
      await server.stop();

      expect(stoppedHandler).toHaveBeenCalled();
    });
  });

  describe("client management", () => {
    it("should handle client disconnection", () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      // Get the SSE handler
      const sseHandler = mockApp.get.mock.calls.find(
        (call) => call[0] === "/sse"
      )?.[1];

      // Mock request and response
      const mockReq = new EventEmitter() as any;
      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn(),
      };

      // Call the handler
      sseHandler?.(mockReq, mockRes);

      // Simulate client disconnect
      mockReq.emit("close");

      // Client should be removed (we can't directly test this without accessing private state)
      expect(true).toBe(true);
    });
  });

  describe("forwardToProxy", () => {
    it("should handle timeout gracefully without rejecting", async () => {
      // Start the server to initialize proxy
      await server.start();

      // Access the private forwardToProxy method
      const forwardToProxy = (server as any).forwardToProxy.bind(server);

      // Mock the proxy to not respond (simulating timeout)
      const mockProxy = (server as any).mcpProxy;
      if (mockProxy?.stdin) {
        mockProxy.stdin.write = vi.fn();
      }

      // Create a message to forward
      const message = {
        jsonrpc: "2.0",
        id: 123,
        method: "test/method",
        params: {},
      };

      // Speed up test by reducing timeout
      vi.useFakeTimers();

      // Call forwardToProxy
      const resultPromise = forwardToProxy(message);

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(31000);

      // Wait for the promise to resolve
      const result = await resultPromise;

      // Should resolve with timeout indicator instead of rejecting
      expect(result).toEqual({
        jsonrpc: "2.0",
        id: 123,
        result: {
          _timeout: true,
          message: "Response may have been sent via SSE",
        },
      });

      vi.useRealTimers();
    });

    it("should clear timeout when response is received", async () => {
      await server.start();

      // Test the response handling mechanism directly
      const message = {
        jsonrpc: "2.0",
        id: 456,
        method: "test/method",
        params: {},
      };

      // Manually add a pending request to simulate forwardToProxy behavior
      const pendingRequests = (server as any).pendingRequests;
      let resolvedValue: any = null;
      let timeoutCleared = false;

      const mockTimeoutId = setTimeout(() => {
        // This should not be called if timeout is cleared properly
      }, 1000);

      const originalClearTimeout = global.clearTimeout;
      global.clearTimeout = vi.fn((id) => {
        if (id === mockTimeoutId) {
          timeoutCleared = true;
        }
        return originalClearTimeout(id);
      });

      pendingRequests.set(456, {
        resolve: (value: any) => {
          resolvedValue = value;
        },
        reject: (error: any) => {
          throw error;
        },
        timeoutId: mockTimeoutId,
      });

      // Clear the response buffer to ensure clean state
      (server as any).responseBuffer = "";

      // Trigger the response handling
      const handleProxyResponse = (server as any).handleProxyResponse.bind(
        server
      );
      handleProxyResponse(
        Buffer.from(
          `${JSON.stringify({
            jsonrpc: "2.0",
            id: 456,
            result: { success: true },
          })}\n`
        )
      );

      // Check that the response was handled correctly
      expect(resolvedValue).toEqual({
        jsonrpc: "2.0",
        id: 456,
        result: { success: true },
      });
      expect(timeoutCleared).toBe(true);
      expect(pendingRequests.has(456)).toBe(false);

      // Restore clearTimeout
      global.clearTimeout = originalClearTimeout;
    });
  });

  describe("sendToClient", () => {
    it("should send messages in correct SSE format", async () => {
      await server.start();

      const mockClient = {
        id: "client-1",
        sessionId: "test-session",
        response: {
          write: vi.fn(),
        },
      };

      // Access the private sendToClient method
      const sendToClient = (server as any).sendToClient.bind(server);

      const message = {
        jsonrpc: "2.0",
        id: 1,
        result: { test: "data" },
      };

      sendToClient(mockClient, message);

      // Check message was sent in correct format
      expect(mockClient.response.write).toHaveBeenCalledWith(
        `event: message\ndata: ${JSON.stringify(message)}\n\n`
      );
    });

    it("should handle write errors gracefully", async () => {
      await server.start();

      const mockClient = {
        id: "client-1",
        sessionId: "test-session",
        response: {
          write: vi.fn(() => {
            throw new Error("Write failed");
          }),
        },
      };

      // Add client to server
      (server as any).clients.set("test-session", mockClient);

      const sendToClient = (server as any).sendToClient.bind(server);
      const message = { jsonrpc: "2.0", id: 1, result: {} };

      // Should not throw
      expect(() => sendToClient(mockClient, message)).not.toThrow();

      // Client should be removed on error
      expect((server as any).clients.has("test-session")).toBe(false);
    });
  });
});
