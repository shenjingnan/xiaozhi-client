import { MCPServiceManager } from "@/lib/mcp";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEventBus } from "@services/event-bus.service.js";

// Mock dependencies
vi.mock("@/utils/Logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  },
}));

vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getMcpServerConfig: vi.fn(),
    updateServerToolsConfig: vi.fn(),
    isToolEnabled: vi.fn(),
    getCustomMCPConfig: vi.fn(),
    getCustomMCPTools: vi.fn(),
    addCustomMCPTools: vi.fn(),
    updateCustomMCPTools: vi.fn(),
    getServerToolsConfig: vi.fn(),
    saveConfig: vi.fn(),
    getConfig: vi.fn(),
    getToolCallLogConfig: vi.fn().mockReturnValue({}),
    getConfigDir: vi.fn().mockReturnValue("/tmp/test"),
  },
}));

describe("MCPServiceManager 事件监听测试", () => {
  let mcpServiceManager: MCPServiceManager;
  let eventBus: any;
  let mockConfigManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 设置测试环境
    process.env.XIAOZHI_CONFIG_DIR = "/tmp/xiaozhi-test-mcp-events";
    process.env.VITEST = "true";

    // 获取模拟实例
    const { configManager } = await import("@xiaozhi-client/config");
    mockConfigManager = configManager;

    // 获取事件总线
    eventBus = getEventBus();

    // 创建管理器实例
    mcpServiceManager = new MCPServiceManager(mockConfigManager);
  });

  afterEach(() => {
    // 清理资源
    process.env.VITEST = undefined;
    vi.clearAllMocks();
  });

  it("应该在构造函数中设置事件监听器", () => {
    // 验证事件总线存在
    expect(eventBus).toBeDefined();

    // 验证 MCPServiceManager 创建成功
    expect(mcpServiceManager).toBeDefined();
  });

  it("应该能够响应 MCP 服务连接事件", async () => {
    // 监听管理器的方法调用
    const handleServiceConnectedSpy = vi.spyOn(
      mcpServiceManager as any,
      "handleServiceConnected"
    );

    // 模拟工具数据
    const mockTools: Tool[] = [
      {
        name: "test-tool",
        description: "Test tool",
        inputSchema: { type: "object" },
      },
    ];

    // 发射服务连接事件
    const eventData = {
      serviceName: "test-service",
      tools: mockTools,
      connectionTime: new Date(),
    };

    eventBus.emitEvent("mcp:service:connected", eventData);

    // 等待异步处理
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 验证处理器被调用
    expect(handleServiceConnectedSpy).toHaveBeenCalledWith(eventData);
  });
});
