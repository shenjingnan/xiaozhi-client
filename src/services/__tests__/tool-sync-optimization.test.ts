import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomMCPHandler } from "../CustomMCPHandler.js";
import { type EventBus, destroyEventBus, getEventBus } from "../EventBus.js";
import { MCPServiceManager } from "../MCPServiceManager.js";
import type { ToolSyncManager } from "../ToolSyncManager.js";

// Mock dependencies
vi.mock("../../Logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../configManager.js", () => ({
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
  },
}));

describe("第二阶段：工具同步优化集成测试", () => {
  let mcpServiceManager: MCPServiceManager;
  let toolSyncManager: ToolSyncManager;
  let customMCPHandler: CustomMCPHandler;
  let eventBus: EventBus;
  let mockLogger: any;
  let mockConfigManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 设置测试环境变量
    process.env.XIAOZHI_CONFIG_DIR = "/tmp/xiaozhi-test-phase2";
    process.env.VITEST = "true";

    // 获取模拟实例
    const { logger } = await import("../../Logger.js");
    mockLogger = logger;

    const { configManager } = await import("../../configManager.js");
    mockConfigManager = configManager;

    // 获取全局 EventBus 实例
    eventBus = getEventBus();

    // 创建 MCPServiceManager 实例（它会自动创建依赖项）
    mcpServiceManager = new MCPServiceManager(mockConfigManager);

    // 获取内部实例用于测试
    toolSyncManager = (mcpServiceManager as any)
      .toolSyncManager as ToolSyncManager;
    customMCPHandler = (mcpServiceManager as any)
      .customMCPHandler as CustomMCPHandler;

    // 重新初始化 CustomMCPHandler 使用我们的 mock 配置
    customMCPHandler.initialize([]);
  });

  afterEach(() => {
    // 清理资源
    eventBus.destroy();
    destroyEventBus();
    customMCPHandler.cleanup();
    vi.clearAllMocks();

    // 重置环境变量
    process.env.VITEST = undefined;
  });

  describe("事件驱动的工具同步", () => {
    it("应该在MCP服务连接成功后触发工具同步", async () => {
      // Mock 配置
      mockConfigManager.getServerToolsConfig.mockReturnValue({
        "test-tool": { enable: true, description: "Test tool" },
      });
      mockConfigManager.getCustomMCPTools.mockReturnValue([]);
      mockConfigManager.addCustomMCPTools.mockResolvedValue(undefined);

      // 监听工具同步事件
      const syncSpy = vi.spyOn(toolSyncManager, "syncToolsAfterConnection");
      const reinitSpy = vi.spyOn(customMCPHandler as any, "reinitialize");

      // 模拟 MCP 服务连接成功事件
      const mockTools: Tool[] = [
        {
          name: "test-tool",
          description: "Test tool",
          inputSchema: { type: "object" },
        },
      ];

      // 发射服务连接成功事件
      eventBus.emitEvent("mcp:service:connected", {
        serviceName: "test-service",
        tools: mockTools,
        connectionTime: new Date(),
      });

      // 等待异步操作完成
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 验证工具同步被调用
      expect(syncSpy).toHaveBeenCalledWith("test-service", mockTools);

      // 验证 CustomMCPHandler 重新初始化被调用
      expect(reinitSpy).toHaveBeenCalled();
    });

    it("应该在配置更新后触发相应的同步操作", async () => {
      // 监听配置更新处理
      const customMCPReinitSpy = vi.spyOn(
        customMCPHandler as any,
        "reinitialize"
      );
      const toolSyncSpy = vi.spyOn(
        toolSyncManager as any,
        "handleServerToolsConfigUpdated"
      );

      // 模拟 customMCP 配置更新事件
      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      // 模拟 serverTools 配置更新事件
      eventBus.emitEvent("config:updated", {
        type: "serverTools",
        serviceName: "test-service",
        timestamp: new Date(),
      });

      // 等待异步操作完成
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 验证 CustomMCPHandler 重新初始化被调用
      expect(customMCPReinitSpy).toHaveBeenCalled();

      // 验证工具同步管理器处理了配置更新
      expect(toolSyncSpy).toHaveBeenCalledWith("test-service");
    });

    it("应该正确处理同步锁机制防止重复同步", async () => {
      // Mock 配置
      mockConfigManager.getServerToolsConfig.mockReturnValue({
        "test-tool": { enable: true, description: "Test tool" },
      });
      mockConfigManager.getCustomMCPTools.mockReturnValue([]);

      // 监听同步方法
      const syncSpy = vi.spyOn(toolSyncManager, "syncToolsAfterConnection");

      // 模拟工具同步耗时操作
      syncSpy.mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const mockTools: Tool[] = [
        {
          name: "test-tool",
          description: "Test tool",
          inputSchema: { type: "object" },
        },
      ];

      // 快速连续发射两个相同服务的连接事件
      eventBus.emitEvent("mcp:service:connected", {
        serviceName: "test-service",
        tools: mockTools,
        connectionTime: new Date(),
      });

      eventBus.emitEvent("mcp:service:connected", {
        serviceName: "test-service",
        tools: mockTools,
        connectionTime: new Date(),
      });

      // 等待第一次同步完成
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 验证同步只被调用一次
      expect(syncSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("配置事件发射测试", () => {
    it("应该在添加 customMCP 工具时发射配置更新事件", async () => {
      // 监听事件总线
      const eventSpy = vi.spyOn(eventBus, "emitEvent");

      // Mock 配置管理器方法
      const mockTools = [
        {
          name: "test-tool",
          description: "Test tool",
          inputSchema: { type: "object" },
          handler: { type: "proxy" as const, config: {} },
        },
      ];

      // 调用配置管理器的 addCustomMCPTools 方法
      await mockConfigManager.addCustomMCPTools(mockTools);

      // 验证事件被发射
      expect(eventSpy).toHaveBeenCalledWith("config:updated", {
        type: "customMCP",
        timestamp: expect.any(Date),
      });
    });

    it("应该在更新 serverTools 配置时发射配置更新事件", async () => {
      // 监听事件总线
      const eventSpy = vi.spyOn(eventBus, "emitEvent");

      // Mock 配置管理器方法
      await mockConfigManager.updateServerToolsConfig("test-service", {});

      // 验证事件被发射
      expect(eventSpy).toHaveBeenCalledWith("config:updated", {
        type: "serverTools",
        serviceName: "test-service",
        timestamp: expect.any(Date),
      });
    });
  });

  describe("错误处理和边界情况", () => {
    it("应该正确处理工具同步失败的情况", async () => {
      // Mock 配置
      mockConfigManager.getServerToolsConfig.mockReturnValue({
        "test-tool": { enable: true, description: "Test tool" },
      });

      // Mock 添加工具失败
      mockConfigManager.addCustomMCPTools.mockRejectedValue(
        new Error("同步失败")
      );

      // 监听错误日志
      const errorSpy = vi.spyOn(mockLogger, "error");

      const mockTools: Tool[] = [
        {
          name: "test-tool",
          description: "Test tool",
          inputSchema: { type: "object" },
        },
      ];

      // 发射服务连接事件
      eventBus.emitEvent("mcp:service:connected", {
        serviceName: "test-service",
        tools: mockTools,
        connectionTime: new Date(),
      });

      // 等待异步操作完成
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 验证错误被记录
      expect(errorSpy).toHaveBeenCalledWith(
        "同步服务 test-service 工具失败:",
        expect.any(Error)
      );
    });

    it("应该正确处理 CustomMCPHandler 重新初始化失败", async () => {
      // Mock 重新初始化失败
      const reinitSpy = vi.spyOn(customMCPHandler as any, "reinitialize");
      reinitSpy.mockRejectedValue(new Error("重新初始化失败"));

      // 监听错误日志
      const errorSpy = vi.spyOn(mockLogger, "error");

      // 发射配置更新事件
      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      // 等待异步操作完成
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 验证错误被记录
      expect(errorSpy).toHaveBeenCalledWith(
        "[CustomMCP] 配置更新处理失败:",
        expect.any(Error)
      );
    });
  });

  describe("性能优化测试", () => {
    it("应该确保 getAllTools 方法无阻塞", async () => {
      // Mock 配置
      mockConfigManager.getCustomMCPTools.mockReturnValue([
        {
          name: "test-tool",
          description: "Test tool",
          inputSchema: { type: "object" },
          handler: { type: "proxy" as const, config: {} },
        },
      ]);

      // 测量执行时间
      const startTime = Date.now();
      const tools = customMCPHandler.getTools();
      const endTime = Date.now();

      // 验证执行时间小于 10ms
      expect(endTime - startTime).toBeLessThan(10);

      // 验证返回的工具列表
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("test-tool");
    });

    it("应该确保配置更新事件处理不阻塞主流程", async () => {
      // Mock 耗时的重新初始化操作
      const reinitSpy = vi.spyOn(customMCPHandler as any, "reinitialize");
      reinitSpy.mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // 发射配置更新事件
      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      // 验证事件发射不会阻塞
      expect(reinitSpy).toHaveBeenCalled();

      // 验证其他操作可以继续执行
      const tools = customMCPHandler.getTools();
      expect(Array.isArray(tools)).toBe(true);
    });
  });
});
