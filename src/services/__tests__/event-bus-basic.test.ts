import { beforeEach, describe, expect, it, vi } from "vitest";
import { type EventBus, getEventBus } from "../EventBus.js";

// Mock Logger
vi.mock("../../Logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  },
}));

describe("EventBus 基本功能测试", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = getEventBus();
  });

  it("应该能够发送和接收 MCP 服务连接事件", async () => {
    const handlerSpy = vi.fn();

    // 监听事件
    eventBus.onEvent("mcp:service:connected", handlerSpy);

    // 发送事件
    const eventData = {
      serviceName: "test-service",
      tools: [{ name: "test-tool", description: "Test", inputSchema: { type: "object" as const } }],
      connectionTime: new Date(),
    };

    eventBus.emitEvent("mcp:service:connected", eventData);

    // 等待异步处理
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 验证处理器被调用
    expect(handlerSpy).toHaveBeenCalledWith(eventData);
  });

  it("应该能够发送和接收配置更新事件", async () => {
    const handlerSpy = vi.fn();

    // 监听事件
    eventBus.onEvent("config:updated", handlerSpy);

    // 发送事件
    const eventData = {
      type: "customMCP",
      timestamp: new Date(),
    };

    eventBus.emitEvent("config:updated", eventData);

    // 等待异步处理
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 验证处理器被调用
    expect(handlerSpy).toHaveBeenCalledWith(eventData);
  });
});
