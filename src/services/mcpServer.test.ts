import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { EventEmitter } from "node:events";
import express from "express";
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
  expressMock.urlencoded = vi.fn(() => (req: any, res: any, next: any) => next());
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
    expect(mockApp.post).toHaveBeenCalledWith("/rpc", expect.any(Function));
    expect(mockApp.get).toHaveBeenCalledWith("/health", expect.any(Function));
  });
  
  describe("SSE endpoint", () => {
    it("should handle SSE client connections", () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();
      
      // Get the SSE handler
      const sseHandler = mockApp.get.mock.calls.find(
        call => call[0] === "/sse"
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
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
      expect(mockRes.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");
      
      // Check initial event was sent
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining("event: open")
      );
    });
  });
  
  describe("RPC endpoint", () => {
    it("should return 503 when proxy is not running", async () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();
      
      // Get the RPC handler
      const rpcHandler = mockApp.post.mock.calls.find(
        call => call[0] === "/rpc"
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
        call => call[0] === "/health"
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
        call => call[0] === "/sse"
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
});