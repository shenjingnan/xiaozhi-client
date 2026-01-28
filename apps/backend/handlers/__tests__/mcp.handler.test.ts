import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MCPRouteHandler } from "../mcp.handler.js";

// Mock MCPServiceManager - 在 Context 中提供
const mockServiceManager = {
  // Mock service manager
};

// Mock MCPMessageHandler
vi.mock("@/lib/mcp", () => ({
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
    handler = new MCPRouteHandler({
      maxMessageSize: 1024 * 1024,
      enableMetrics: true,
    });
  });

  afterEach(() => {
    // 清理资源
    handler.destroy();
  });

  it("应该创建 MCPRouteHandler 实例", () => {
    expect(handler).toBeInstanceOf(MCPRouteHandler);
  });

  it("应该具有 getStatus 方法", () => {
    const status = handler.getStatus();
    expect(status).toHaveProperty("isInitialized");
    expect(status).toHaveProperty("metrics");
    expect(status).toHaveProperty("config");
    expect(status.isInitialized).toBe(false);
    expect(status.config.maxMessageSize).toBe(1024 * 1024);
  });

  it("应该处理有效的 JSON-RPC 消息的 POST 请求", async () => {
    // Mock Context object
    const mockContext = {
      req: {
        header: vi.fn((name: string) => {
          if (name === "content-type" || name === "Content-Type") return "application/json";
          if (name === "mcp-protocol-version" || name === "MCP-Protocol-Version") return "2024-11-05";
          return undefined;
        }),
        query: vi.fn(() => undefined),
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            jsonrpc: "2.0",
            method: "initialize",
            id: 1,
          })
        ),
      },
      json: vi.fn((data: unknown, status?: number, headers?: any) => {
        return new Response(JSON.stringify(data), {
          status: status || 200,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
        });
      }),
      get: vi.fn((key: string) => {
        if (key === "mcpServiceManager") {
          return mockServiceManager;
        }
        if (key === "logger") {
          return {
            debug: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
          };
        }
        return undefined;
      }),
    };

    const response = await handler.handlePost(mockContext as any);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
  });

  it("应该拒绝无效 content-type 的 POST 请求", async () => {
    const mockContext = {
      req: {
        header: vi.fn(() => "text/plain"),
        query: vi.fn(() => undefined),
      },
      get: vi.fn((key: string) => {
        if (key === "mcpServiceManager") {
          return mockServiceManager;
        }
        if (key === "logger") {
          return {
            debug: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
          };
        }
        return undefined;
      }),
    };

    const response = await handler.handlePost(mockContext as any);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
  });

  it("应该拒绝无效 JSON 的 POST 请求", async () => {
    const mockContext = {
      req: {
        header: vi.fn((name: string) => {
          if (name === "content-type") return "application/json";
          return undefined;
        }),
        query: vi.fn(() => undefined),
        text: vi.fn().mockResolvedValue("invalid json"),
      },
      get: vi.fn((key: string) => {
        if (key === "mcpServiceManager") {
          return mockServiceManager;
        }
        if (key === "logger") {
          return {
            debug: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
          };
        }
        return undefined;
      }),
    };

    const response = await handler.handlePost(mockContext as any);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
  });

  it("应该拒绝无效 JSON-RPC 格式的 POST 请求", async () => {
    const mockContext = {
      req: {
        header: vi.fn((name: string) => {
          if (name === "content-type") return "application/json";
          return undefined;
        }),
        query: vi.fn(() => undefined),
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            // Missing jsonrpc and method fields
            id: 1,
          })
        ),
      },
      get: vi.fn((key: string) => {
        if (key === "mcpServiceManager") {
          return mockServiceManager;
        }
        if (key === "logger") {
          return {
            debug: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
          };
        }
        return undefined;
      }),
    };

    const response = await handler.handlePost(mockContext as any);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
  });

  it("应该拒绝超过最大消息大小的 POST 请求", async () => {
    const largeMessage = "x".repeat(2 * 1024 * 1024); // 2MB message
    const mockContext = {
      req: {
        header: vi.fn((name: string) => {
          if (name === "content-type") return "application/json";
          if (name === "content-length") return (2 * 1024 * 1024).toString();
          return undefined;
        }),
        query: vi.fn(() => undefined),
        text: vi.fn().mockResolvedValue(largeMessage),
      },
      get: vi.fn((key: string) => {
        if (key === "mcpServiceManager") {
          return mockServiceManager;
        }
        if (key === "logger") {
          return {
            debug: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
          };
        }
        return undefined;
      }),
    };

    const response = await handler.handlePost(mockContext as any);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
  });

  it("应该正确处理 destroy 方法", () => {
    expect(() => handler.destroy()).not.toThrow();
  });
});
