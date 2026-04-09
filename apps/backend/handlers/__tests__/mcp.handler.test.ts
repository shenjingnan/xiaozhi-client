import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MCPRouteHandler } from "../mcp.handler.js";
import type { MCPMessageHandler, MCPServiceManager } from "@/lib/mcp";

// 模拟 MCPServiceManager - 在 Context 中提供
const mockServiceManager = {} as MCPServiceManager;

// 创建模拟的 MCPMessageHandler
function createMockMCPMessageHandler(): MCPMessageHandler {
  return {
    handleMessage: vi.fn().mockResolvedValue({
      jsonrpc: "2.0",
      result: { test: "response" },
      id: 1,
    }),
  } as unknown as MCPMessageHandler;
}

describe("MCPRouteHandler", () => {
  let handler: MCPRouteHandler;
  let mockMessageHandler: MCPMessageHandler;
  let mockMessageHandlerFactory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // 重置 mock
    vi.clearAllMocks();

    // 每次测试创建新的 mock 消息处理器和工厂函数
    mockMessageHandler = createMockMCPMessageHandler();

    mockMessageHandlerFactory = vi.fn().mockReturnValue(mockMessageHandler);

    // 使用工厂函数创建 handler，便于测试依赖注入
    handler = new MCPRouteHandler({
      maxMessageSize: 1024 * 1024,
      enableMetrics: true,
      mcpMessageHandlerFactory: mockMessageHandlerFactory,
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

  it("应该接受自定义的 MCPMessageHandler 工厂函数", () => {
    // 创建另一个 mock 消息处理器
    const anotherMockHandler = createMockMCPMessageHandler();

    const customFactory = vi.fn().mockReturnValue(anotherMockHandler);
    const customHandler = new MCPRouteHandler({
      mcpMessageHandlerFactory: customFactory,
    });

    expect(customHandler).toBeInstanceOf(MCPRouteHandler);
    customHandler.destroy();
  });

  it("应该处理有效的 JSON-RPC 消息的 POST 请求", async () => {
    // 模拟 Context 对象
    const mockContext = {
      req: {
        header: vi.fn((name: string) => {
          if (name === "content-type" || name === "Content-Type")
            return "application/json";
          if (
            name === "mcp-protocol-version" ||
            name === "MCP-Protocol-Version"
          )
            return "2024-11-05";
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
      json: vi.fn((data: unknown, status?: number, headers?: Record<string, string>) => {
        return new Response(JSON.stringify(data), {
          status: status || 200,
          headers: {
            "Content-Type": "application/json",
            ...(headers || {}),
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

    const response = await handler.handlePost(mockContext as unknown as Parameters<typeof handler.handlePost>[0]);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);

    // 验证工厂函数被调用（消息处理器初始化）
    expect(mockMessageHandlerFactory).toHaveBeenCalledWith(mockServiceManager);
    // 验证 MCPMessageHandler.handleMessage 被调用
    expect(mockMessageHandler.handleMessage).toHaveBeenCalled();
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

    const response = await handler.handlePost(mockContext as unknown as Parameters<typeof handler.handlePost>[0]);
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

    const response = await handler.handlePost(mockContext as unknown as Parameters<typeof handler.handlePost>[0]);
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

    const response = await handler.handlePost(mockContext as unknown as Parameters<typeof handler.handlePost>[0]);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
  });

  it("应该拒绝超过最大消息大小的 POST 请求", async () => {
    const largeMessage = "x".repeat(2 * 1024 * 1024); // 2MB 消息
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

    const response = await handler.handlePost(mockContext as unknown as Parameters<typeof handler.handlePost>[0]);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
  });

  it("应该正确处理 destroy 方法", () => {
    expect(() => handler.destroy()).not.toThrow();
  });

  it("应该使用注入的工厂函数创建 MCPMessageHandler（依赖注入验证）", async () => {
    // 创建一个全新的 handler 来验证工厂函数被调用
    const newMockHandler = createMockMCPMessageHandler();

    const newFactory = vi.fn().mockReturnValue(newMockHandler);
    const newHandler = new MCPRouteHandler({
      mcpMessageHandlerFactory: newFactory,
    });

    const mockContext = {
      req: {
        header: vi.fn((name: string) => {
          // 注意：HTTP_HEADERS.CONTENT_TYPE 是 "Content-Type"，需要处理两种大小写
          if (name === "content-type" || name === "Content-Type")
            return "application/json";
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
      json: vi.fn((data: unknown) => new Response(JSON.stringify(data))),
      get: vi.fn((key: string) => {
        if (key === "mcpServiceManager") return mockServiceManager;
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

    await newHandler.handlePost(mockContext as unknown as Parameters<typeof handler.handlePost>[0]);

    // 验证工厂函数被正确调用
    expect(newFactory).toHaveBeenCalledTimes(1);
    expect(newFactory).toHaveBeenCalledWith(mockServiceManager);

    newHandler.destroy();
  });

  it("应该在多次请求中只初始化一次消息处理器（懒加载验证）", async () => {
    // 创建一个全新的 handler 来验证懒加载特性
    const newMockHandler = createMockMCPMessageHandler();

    const newFactory = vi.fn().mockReturnValue(newMockHandler);
    const newHandler = new MCPRouteHandler({
      mcpMessageHandlerFactory: newFactory,
    });

    const mockContext = {
      req: {
        header: vi.fn((name: string) => {
          // 注意：HTTP_HEADERS.CONTENT_TYPE 是 "Content-Type"，需要处理两种大小写
          if (name === "content-type" || name === "Content-Type")
            return "application/json";
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
      json: vi.fn((data: unknown) => new Response(JSON.stringify(data))),
      get: vi.fn((key: string) => {
        if (key === "mcpServiceManager") return mockServiceManager;
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

    // 第一次请求
    await newHandler.handlePost(mockContext as unknown as Parameters<typeof handler.handlePost>[0]);
    // 第二次请求
    await newHandler.handlePost(mockContext as unknown as Parameters<typeof handler.handlePost>[0]);

    // 工厂函数应该只被调用一次（懒加载特性）
    expect(newFactory).toHaveBeenCalledTimes(1);

    newHandler.destroy();
  });
});