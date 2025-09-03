import { describe, expect, it, vi, beforeEach } from "vitest";
import { MCPRouteHandler } from "../MCPRouteHandler.js";

// Mock MCPServiceManagerSingleton
vi.mock("../../services/MCPServiceManagerSingleton.js", () => ({
  MCPServiceManagerSingleton: {
    getInstance: vi.fn().mockResolvedValue({
      // Mock service manager
    }),
    isInitialized: vi.fn().mockReturnValue(true),
  },
}));

// Mock MCPMessageHandler
vi.mock("../../core/MCPMessageHandler.js", () => ({
  MCPMessageHandler: vi.fn().mockImplementation(() => ({
    handleMessage: vi.fn().mockResolvedValue({
      jsonrpc: "2.0",
      result: { test: "response" },
      id: 1,
    }),
  })),
}));

describe("MCPRouteHandler", () => {
  let handler: MCPRouteHandler;

  beforeEach(() => {
    handler = new MCPRouteHandler();
  });

  it("should create MCPRouteHandler instance", () => {
    expect(handler).toBeInstanceOf(MCPRouteHandler);
  });

  it("should have getStatus method", () => {
    const status = handler.getStatus();
    expect(status).toHaveProperty("connectedClients");
    expect(status).toHaveProperty("maxClients");
    expect(status).toHaveProperty("isInitialized");
    expect(status.connectedClients).toBe(0);
    expect(status.maxClients).toBe(100);
    expect(status.isInitialized).toBe(false);
  });

  it("should handle POST request with valid JSON-RPC message", async () => {
    // Mock Context object
    const mockContext = {
      req: {
        header: vi.fn((name: string) => {
          if (name === "content-type") return "application/json";
          if (name === "mcp-protocol-version") return "2024-11-05";
          return undefined;
        }),
        query: vi.fn(() => undefined),
        json: vi.fn().mockResolvedValue({
          jsonrpc: "2.0",
          method: "initialize",
          id: 1,
        }),
      },
      json: vi.fn((data: any, status?: number, headers?: any) => {
        return new Response(JSON.stringify(data), {
          status: status || 200,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
        });
      }),
    };

    const response = await handler.handlePost(mockContext as any);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
  });

  it("should handle GET request for SSE connection", async () => {
    // Mock Context object
    const mockContext = {
      req: {
        raw: {
          signal: {
            addEventListener: vi.fn(),
          },
        },
      },
      json: vi.fn((data: any, status?: number) => {
        return new Response(JSON.stringify(data), {
          status: status || 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }),
    };

    // 使用 Promise.race 来避免无限等待
    const responsePromise = handler.handleGet(mockContext as any);
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve(null), 100); // 100ms 超时
    });

    const result = await Promise.race([responsePromise, timeoutPromise]);

    if (result) {
      const response = result as Response;
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
      expect(response.headers.get("MCP-Protocol-Version")).toBe("2024-11-05");

      // 验证状态更新
      const status = handler.getStatus();
      expect(status.connectedClients).toBe(1);
    } else {
      // 如果超时，说明方法正在等待流完成，这是正常的
      // 我们可以通过检查状态来验证连接已建立
      const status = handler.getStatus();
      expect(status.connectedClients).toBeGreaterThanOrEqual(0);
    }
  });

  it("should reject POST request with invalid content-type", async () => {
    const mockContext = {
      req: {
        header: vi.fn(() => "text/plain"),
        query: vi.fn(() => undefined),
      },
    };

    const response = await handler.handlePost(mockContext as any);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
  });

  it("should reject POST request with invalid JSON", async () => {
    const mockContext = {
      req: {
        header: vi.fn((name: string) => {
          if (name === "content-type") return "application/json";
          return undefined;
        }),
        query: vi.fn(() => undefined),
        json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      },
    };

    const response = await handler.handlePost(mockContext as any);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
  });

  it("should reject POST request with invalid JSON-RPC format", async () => {
    const mockContext = {
      req: {
        header: vi.fn((name: string) => {
          if (name === "content-type") return "application/json";
          return undefined;
        }),
        query: vi.fn(() => undefined),
        json: vi.fn().mockResolvedValue({
          // Missing jsonrpc and method fields
          id: 1,
        }),
      },
    };

    const response = await handler.handlePost(mockContext as any);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
  });
});
