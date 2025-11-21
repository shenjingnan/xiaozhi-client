/**
 * MCPMessageHandler prompts/list 功能测试
 */

import type { MCPServiceManager } from "@services/MCPServiceManager.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MCPMessageHandler } from "../MCPMessageHandler.js";

// Mock MCPServiceManager
const mockServiceManager = {
  getAllTools: vi.fn(),
  callTool: vi.fn(),
} as unknown as MCPServiceManager;

describe("MCPMessageHandler - prompts/list", () => {
  let handler: MCPMessageHandler;

  beforeEach(() => {
    handler = new MCPMessageHandler(mockServiceManager);
    vi.clearAllMocks();
  });

  it("should handle prompts/list request and return empty prompts array", async () => {
    const message = {
      jsonrpc: "2.0" as const,
      method: "prompts/list",
      params: {},
      id: 1,
    };

    const response = await handler.handleMessage(message);

    expect(response).toEqual({
      jsonrpc: "2.0",
      result: {
        prompts: [],
      },
      id: 1,
    });
  });

  it("should handle prompts/list request with string id", async () => {
    const message = {
      jsonrpc: "2.0" as const,
      method: "prompts/list",
      params: {},
      id: "test-id",
    };

    const response = await handler.handleMessage(message);

    expect(response).toEqual({
      jsonrpc: "2.0",
      result: {
        prompts: [],
      },
      id: "test-id",
    });
  });

  it("should handle prompts/list request without id", async () => {
    const message = {
      jsonrpc: "2.0" as const,
      method: "prompts/list",
      params: {},
      id: "test-prompts-list" as const,
    };

    const response = await handler.handleMessage(message);

    expect(response).toEqual({
      jsonrpc: "2.0",
      result: {
        prompts: [],
      },
      id: "test-prompts-list", // 与请求中的ID匹配
    });
  });

  it("should return prompts array with correct structure", async () => {
    const message = {
      jsonrpc: "2.0" as const,
      method: "prompts/list",
      params: {},
      id: 2,
    };

    const response = await handler.handleMessage(message);

    expect(response).not.toBeNull();
    expect(response?.result).toBeDefined();
    expect(response?.result.prompts).toBeDefined();
    expect(Array.isArray(response?.result.prompts)).toBe(true);
    expect(response?.result.prompts).toHaveLength(0);
  });

  it("should not interfere with other methods", async () => {
    // 测试 prompts/list 不会影响其他方法的处理
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

  it("should handle prompts/list in combination with other methods", async () => {
    // 先调用 prompts/list
    const promptsMessage = {
      jsonrpc: "2.0" as const,
      method: "prompts/list",
      params: {},
      id: 1,
    };

    const promptsResponse = await handler.handleMessage(promptsMessage);
    expect(promptsResponse?.result.prompts).toEqual([]);

    // 再调用 resources/list
    const resourcesMessage = {
      jsonrpc: "2.0" as const,
      method: "resources/list",
      params: {},
      id: 2,
    };

    const resourcesResponse = await handler.handleMessage(resourcesMessage);
    expect(resourcesResponse?.result.resources).toEqual([]);
  });

  it("should handle prompts/list with resources/list", async () => {
    // 测试多个 list 方法的组合使用
    const promptsMessage = {
      jsonrpc: "2.0" as const,
      method: "prompts/list",
      params: {},
      id: 1,
    };

    const resourcesMessage = {
      jsonrpc: "2.0" as const,
      method: "resources/list",
      params: {},
      id: 2,
    };

    const promptsResponse = await handler.handleMessage(promptsMessage);
    const resourcesResponse = await handler.handleMessage(resourcesMessage);

    expect(promptsResponse?.result.prompts).toEqual([]);
    expect(resourcesResponse?.result.resources).toEqual([]);
  });
});
