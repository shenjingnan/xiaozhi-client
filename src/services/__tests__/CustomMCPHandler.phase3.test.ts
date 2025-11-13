import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomMCPTool, MCPHandlerConfig } from "../../configManager";
import { CustomMCPHandler } from "../CustomMCPHandler.js";
import { getEventBus } from "../EventBus.js";
import type { MCPServiceManager } from "../MCPServiceManager.js";

// Mock logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  },
}));

// Mock configManager
vi.mock("../../configManager.js", () => ({
  configManager: {
    getCustomMCPTools: vi.fn(),
    getCustomMCPConfig: vi.fn(),
    updateCustomMCPTools: vi.fn(),
    addCustomMCPTools: vi.fn(),
    getConfig: vi.fn(),
  },
}));

// Mock MCPCacheManager
vi.mock("../MCPCacheManager.js", () => {
  class MockMCPCacheManager {
    async loadExistingCache() {
      return {
        version: "1.0.0",
        mcpServers: {},
        metadata: {
          lastGlobalUpdate: new Date().toISOString(),
          totalWrites: 0,
          createdAt: new Date().toISOString(),
        },
        customMCPResults: {},
      };
    }

    async saveCache() {}
    async getCustomMCPStatistics() {
      return { total: 0, active: 0, expired: 0 };
    }
    async cleanupCustomMCPResults() {
      return { cleaned: 0, total: 0 };
    }
    cleanup() {}
  }

  return { MCPCacheManager: MockMCPCacheManager };
});

// Mock managers
vi.mock("../../managers/CacheLifecycleManager.js", () => {
  class MockCacheLifecycleManager {
    constructor() {}
    startAutoCleanup() {}
    stopAutoCleanup() {}
    cleanup() {}
    validateCacheIntegrity() {
      return { isValid: true, issues: [] };
    }
  }
  return { CacheLifecycleManager: MockCacheLifecycleManager };
});

vi.mock("../../managers/TaskStateManager.js", () => {
  class MockTaskStateManager {
    constructor() {}
    generateTaskId() {
      return "test-task-id";
    }
    markTaskAsPending() {}
    markTaskAsCompleted() {}
    markTaskAsFailed() {}
    getTaskStatistics() {
      return { total: 0, active: 0, completed: 0, failed: 0 };
    }
    validateTaskIntegrity() {
      return { isValid: true, issues: [] };
    }
    restartStalledTasks() {
      return 0;
    }
    cleanup() {}
  }
  return { TaskStateManager: MockTaskStateManager };
});

describe("CustomMCPHandler 第三阶段优化测试", () => {
  let customMCPHandler: CustomMCPHandler;
  let mockMCPServiceManager: MCPServiceManager;
  let eventBus: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // 获取事件总线
    eventBus = getEventBus();

    // 创建 Mock MCPServiceManager
    mockMCPServiceManager = {
      callTool: vi.fn(),
    } as unknown as MCPServiceManager;

    // 创建 CustomMCPHandler 实例，传入 MCPServiceManager
    customMCPHandler = new CustomMCPHandler(undefined, mockMCPServiceManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("MCPServiceManager 依赖注入", () => {
    it("应该正确接收 MCPServiceManager 依赖", () => {
      // 验证实例创建成功
      expect(customMCPHandler).toBeDefined();
    });

    it("应该在没有 MCPServiceManager 时正常工作", () => {
      // 创建不带 MCPServiceManager 的实例
      const handlerWithoutMCP = new CustomMCPHandler();
      expect(handlerWithoutMCP).toBeDefined();
    });
  });

  describe("MCP 工具类型路由", () => {
    it("应该正确路由 MCP 类型工具到转发方法", async () => {
      // 创建一个 MCP 类型的工具
      const mcpTool: CustomMCPTool = {
        name: "test-mcp-tool",
        description: "测试 MCP 工具",
        inputSchema: {
          type: "object",
          properties: {
            param1: { type: "string" },
          },
        },
        handler: {
          type: "mcp",
          config: {
            serviceName: "test-service",
            toolName: "original-tool-name",
          },
        },
      };

      // Mock MCPServiceManager 的 callTool 方法
      const mockResult = {
        content: [{ type: "text", text: "MCP 工具调用成功" }],
      };
      vi.mocked(mockMCPServiceManager.callTool).mockResolvedValue(mockResult);

      // 直接调用私有方法测试路由逻辑
      const callToolByType = (customMCPHandler as any).callToolByType.bind(
        customMCPHandler
      );
      const result = await callToolByType(mcpTool, { param1: "test" });

      // 验证结果
      expect(result).toEqual(mockResult);

      // 验证 MCPServiceManager 的 callTool 方法被正确调用
      expect(mockMCPServiceManager.callTool).toHaveBeenCalledWith(
        "original-tool-name",
        { param1: "test" }
      );
    });

    it("应该在 MCPServiceManager 未初始化时返回错误", async () => {
      // 创建不带 MCPServiceManager 的实例
      const handlerWithoutMCP = new CustomMCPHandler();

      // 创建一个 MCP 类型的工具
      const mcpTool: CustomMCPTool = {
        name: "test-mcp-tool",
        description: "测试 MCP 工具",
        inputSchema: { type: "object" },
        handler: {
          type: "mcp",
          config: {
            serviceName: "test-service",
            toolName: "original-tool-name",
          },
        },
      };

      // 直接调用私有方法测试路由逻辑
      const callToolByType = (handlerWithoutMCP as any).callToolByType.bind(
        handlerWithoutMCP
      );
      const result = await callToolByType(mcpTool, {});

      // 验证返回错误结果
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("MCPServiceManager 未初始化");
    });
  });

  describe("MCP 工具转发机制", () => {
    it("应该正确转发工具调用到 MCPServiceManager", async () => {
      const mcpTool: CustomMCPTool = {
        name: "calculator__calculator",
        description: "计算器工具",
        inputSchema: {
          type: "object",
          properties: {
            expression: { type: "string" },
          },
        },
        handler: {
          type: "mcp",
          config: {
            serviceName: "calculator",
            toolName: "calculator",
          },
        },
      };

      const mockResult = {
        content: [{ type: "text", text: "计算结果: 42" }],
      };
      vi.mocked(mockMCPServiceManager.callTool).mockResolvedValue(mockResult);

      // 先初始化工具（这会清空现有工具）
      customMCPHandler.initialize([mcpTool]);

      // 使用 callTool 方法测试完整的调用流程
      const result = await customMCPHandler.callTool("calculator__calculator", {
        expression: "6 * 7",
      });

      // 验证结果
      expect(result).toEqual(mockResult);

      // 验证 MCPServiceManager 被正确调用
      expect(mockMCPServiceManager.callTool).toHaveBeenCalledWith(
        "calculator",
        { expression: "6 * 7" }
      );
    });

    it("应该处理 MCPServiceManager 调用失败的情况", async () => {
      const mcpTool: CustomMCPTool = {
        name: "failing-tool",
        description: "会失败的 MCP 工具",
        inputSchema: { type: "object" },
        handler: {
          type: "mcp",
          config: {
            serviceName: "test-service",
            toolName: "failing-original-tool",
          },
        },
      };

      const mockError = new Error("MCP 服务调用失败");
      vi.mocked(mockMCPServiceManager.callTool).mockRejectedValue(mockError);

      // 添加工具到 handler
      (customMCPHandler as any).tools.set("failing-tool", mcpTool);

      // 调用工具
      const result = await customMCPHandler.callTool("failing-tool", {});

      // 验证错误处理
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("MCP工具调用失败");
      expect(result.content[0].text).toContain("MCP 服务调用失败");
    });

    it("应该记录详细的转发日志", async () => {
      const mcpTool: CustomMCPTool = {
        name: "logging-test-tool",
        description: "日志测试工具",
        inputSchema: { type: "object" },
        handler: {
          type: "mcp",
          config: {
            serviceName: "logging-service",
            toolName: "original-logging-tool",
          },
        },
      };

      const mockResult = {
        content: [{ type: "text", text: "日志测试成功" }],
      };
      vi.mocked(mockMCPServiceManager.callTool).mockResolvedValue(mockResult);

      // 添加工具到 handler
      (customMCPHandler as any).tools.set("logging-test-tool", mcpTool);

      // 调用工具
      await customMCPHandler.callTool("logging-test-tool", {});

      // 验证日志记录
      const { logger } = await import("../../Logger.js");
      expect(logger.info).toHaveBeenCalledWith(
        "[CustomMCP] 转发MCP工具调用: logging-test-tool",
        {
          serviceName: "logging-service",
          toolName: "original-logging-tool",
        }
      );
      expect(logger.info).toHaveBeenCalledWith(
        "[CustomMCP] MCP工具转发成功: logging-test-tool"
      );
    });
  });

  describe("配置变更响应", () => {
    it("应该在 customMCP 配置更新时重新初始化", async () => {
      const reinitializeSpy = vi.spyOn(customMCPHandler, "reinitialize");

      // 发射配置更新事件
      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      // 等待异步处理
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 验证重新初始化被调用
      expect(reinitializeSpy).toHaveBeenCalled();
    });

    it("应该在 serverTools 配置更新时重新初始化", async () => {
      const reinitializeSpy = vi.spyOn(customMCPHandler, "reinitialize");

      // 发射配置更新事件
      eventBus.emitEvent("config:updated", {
        type: "serverTools",
        serviceName: "test-service",
        timestamp: new Date(),
      });

      // 等待异步处理
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 验证重新初始化被调用
      expect(reinitializeSpy).toHaveBeenCalled();
    });
  });

  describe("错误处理和边界情况", () => {
    it("应该处理不存在的工具调用", async () => {
      await expect(
        customMCPHandler.callTool("non-existent-tool", {})
      ).rejects.toThrow("未找到工具: non-existent-tool");
    });

    it("应该处理配置更新处理中的异常", async () => {
      const { logger } = await import("../../Logger.js");

      // Mock reinitialize 方法抛出异常
      vi.spyOn(customMCPHandler, "reinitialize").mockRejectedValue(
        new Error("重新初始化失败")
      );

      // 发射配置更新事件
      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      // 等待异步处理
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 验证错误被记录
      expect(logger.error).toHaveBeenCalledWith(
        "[CustomMCP] 配置更新处理失败:",
        expect.any(Error)
      );
    });
  });

  describe("向后兼容性", () => {
    it("应该保持对非 MCP 工具类型的支持", async () => {
      // 创建一个代理类型的工具
      const proxyTool: CustomMCPTool = {
        name: "proxy-tool",
        description: "代理工具",
        inputSchema: { type: "object" },
        handler: {
          type: "proxy",
          platform: "coze",
          config: {
            workflow_id: "test-workflow",
          },
        },
      };

      // Mock callProxyTool 方法
      const mockResult = {
        content: [{ type: "text", text: "代理工具调用成功" }],
      };
      const callProxyToolSpy = vi
        .spyOn(customMCPHandler as any, "callProxyTool")
        .mockResolvedValue(mockResult);

      // 添加工具到 handler
      (customMCPHandler as any).tools.set("proxy-tool", proxyTool);

      // 调用工具
      const result = await customMCPHandler.callTool("proxy-tool", {});

      // 验证结果
      expect(result).toEqual(mockResult);
      expect(callProxyToolSpy).toHaveBeenCalledWith(proxyTool, {});
    });
  });
});
