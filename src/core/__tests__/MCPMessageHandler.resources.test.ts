/**
 * MCPMessageHandler resources/list 功能测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MCPServiceManager } from "../../services";
import { MCPMessageHandler } from "../MCPMessageHandler.js";

// Mock MCPServiceManager
const mockServiceManager = {
  getAllTools: vi.fn(),
  callTool: vi.fn(),
} as unknown as MCPServiceManager;

describe("MCPMessageHandler - resources/list", () => {
  let handler: MCPMessageHandler;

  beforeEach(() => {
    handler = new MCPMessageHandler(mockServiceManager);
    vi.clearAllMocks();
  });

  it("should handle resources/list request and return empty resources array", async () => {
    const message = {
      jsonrpc: "2.0" as const,
      method: "resources/list",
      params: {},
      id: 1,
    };

    const response = await handler.handleMessage(message);

    expect(response).toEqual({
      jsonrpc: "2.0",
      result: {
        resources: [],
      },
      id: 1,
    });
  });

  it("should handle resources/list request with string id", async () => {
    const message = {
      jsonrpc: "2.0" as const,
      method: "resources/list",
      params: {},
      id: "test-id",
    };

    const response = await handler.handleMessage(message);

    expect(response).toEqual({
      jsonrpc: "2.0",
      result: {
        resources: [],
      },
      id: "test-id",
    });
  });

  it("should handle resources/list request without id", async () => {
    const message = {
      jsonrpc: "2.0" as const,
      method: "resources/list",
      params: {},
    };

    const response = await handler.handleMessage(message);

    expect(response).toEqual({
      jsonrpc: "2.0",
      result: {
        resources: [],
      },
      id: 1, // 默认 id
    });
  });

  it("should return resources array with correct structure", async () => {
    const message = {
      jsonrpc: "2.0" as const,
      method: "resources/list",
      params: {},
      id: 2,
    };

    const response = await handler.handleMessage(message);

    expect(response).not.toBeNull();
    expect(response?.result).toBeDefined();
    expect(response?.result.resources).toBeDefined();
    expect(Array.isArray(response?.result.resources)).toBe(true);
    expect(response?.result.resources).toHaveLength(0);
  });

  it("should not interfere with other methods", async () => {
    // 测试 resources/list 不会影响其他方法的处理
    const pingMessage = {
      jsonrpc: "2.0" as const,
      method: "ping",
      id: 1,
    };

    const pingResponse = await handler.handleMessage(pingMessage);

    expect(pingResponse).toEqual({
      jsonrpc: "2.0",
      result: {
        status: "ok",
        timestamp: expect.any(String),
      },
      id: 1,
    });
  });

  it("should handle resources/list in combination with other methods", async () => {
    // 先调用 resources/list
    const resourcesMessage = {
      jsonrpc: "2.0" as const,
      method: "resources/list",
      params: {},
      id: 1,
    };

    const resourcesResponse = await handler.handleMessage(resourcesMessage);
    expect(resourcesResponse?.result.resources).toEqual([]);

    // 再调用 ping
    const pingMessage = {
      jsonrpc: "2.0" as const,
      method: "ping",
      id: 2,
    };

    const pingResponse = await handler.handleMessage(pingMessage);
    expect(pingResponse?.result.status).toBe("ok");
  });
});
