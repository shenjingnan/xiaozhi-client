/**
 * CustomMCPHandler 基础功能测试
 * 专门测试 Coze 工作流功能
 */

import type { CustomMCPTool } from "@xiaozhi/config";
import { getEventBus } from "@root/services/EventBus.js";
import type { EventBus } from "@services/EventBus.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomMCPHandler } from "../custom.js";

// Mock logger
vi.mock("@root/Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  },
}));

// Mock configManager
vi.mock("@xiaozhi/config", () => ({
  configManager: {
    getCustomMCPTools: vi.fn(),
    getCustomMCPConfig: vi.fn(),
    updateCustomMCPTools: vi.fn(),
    addCustomMCPTools: vi.fn(),
    getConfig: vi.fn().mockReturnValue({
      platforms: {
        coze: {
          token: "test-token",
        },
      },
    }),
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

// Mock global fetch
global.fetch = vi.fn();

describe("CustomMCPHandler 基础功能测试", () => {
  let customMCPHandler: CustomMCPHandler;
  let eventBus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();

    // 获取事件总线
    eventBus = getEventBus();

    // 创建 CustomMCPHandler 实例
    customMCPHandler = new CustomMCPHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("工具管理功能测试", () => {
    it("应该正确初始化和加载 Coze 工具", () => {
      // 创建 Coze 代理工具
      const testTools: CustomMCPTool[] = [
        {
          name: "test_tool_1",
          description: "测试 Coze 工具 1",
          inputSchema: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          handler: {
            type: "proxy",
            platform: "coze",
            config: {
              workflow_id: "test-workflow-1",
              base_url: "https://api.coze.cn",
            },
          },
        },
        {
          name: "test_tool_2",
          description: "测试 Coze 工具 2",
          inputSchema: {
            type: "object",
            properties: {
              data: { type: "string" },
            },
          },
          handler: {
            type: "proxy",
            platform: "coze",
            config: {
              workflow_id: "test-workflow-2",
              base_url: "https://api.coze.cn",
            },
          },
        },
        {
          name: "non_coze_tool",
          description: "非 Coze 工具（应被过滤）",
          inputSchema: { type: "object" },
          handler: {
            type: "function",
            module: "test.js",
            function: "test",
          },
        },
      ];

      customMCPHandler.initialize(testTools);

      // 应该只加载 Coze 工具
      expect(customMCPHandler.getToolCount()).toBe(2);
      expect(customMCPHandler.hasTool("test_tool_1")).toBe(true);
      expect(customMCPHandler.hasTool("test_tool_2")).toBe(true);
      expect(customMCPHandler.hasTool("non_coze_tool")).toBe(false);
    });

    it("应该正确获取所有工具名称", () => {
      const testTools: CustomMCPTool[] = [
        {
          name: "tool_a",
          description: "Coze 工具 A",
          inputSchema: { type: "object" },
          handler: {
            type: "proxy",
            platform: "coze",
            config: { workflow_id: "workflow-a" },
          },
        },
        {
          name: "tool_b",
          description: "Coze 工具 B",
          inputSchema: { type: "object" },
          handler: {
            type: "proxy",
            platform: "coze",
            config: { workflow_id: "workflow-b" },
          },
        },
      ];

      customMCPHandler.initialize(testTools);

      const toolNames = customMCPHandler.getToolNames();
      expect(toolNames).toContain("tool_a");
      expect(toolNames).toContain("tool_b");
      expect(toolNames).toHaveLength(2);
    });

    it("应该返回正确的工具列表（MCP格式）", () => {
      const testTool: CustomMCPTool = {
        name: "test_tool",
        description: "测试工具",
        inputSchema: {
          type: "object",
          properties: {
            param1: { type: "string" },
          },
        },
        handler: {
          type: "proxy",
          platform: "coze",
          config: { workflow_id: "test-workflow" },
        },
      };

      customMCPHandler.initialize([testTool]);

      const tools = customMCPHandler.getTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("test_tool");
      expect(tools[0].description).toBe("测试工具");
      expect(tools[0].inputSchema).toEqual({
        type: "object",
        properties: {
          param1: { type: "string" },
        },
      });
    });

    it("应该能够获取工具详细信息", () => {
      const testTool: CustomMCPTool = {
        name: "detailed_tool",
        description: "详细工具信息",
        inputSchema: { type: "object" },
        handler: {
          type: "proxy",
          platform: "coze",
          config: { workflow_id: "detailed-workflow" },
        },
      };

      customMCPHandler.initialize([testTool]);

      const toolInfo = customMCPHandler.getToolInfo("detailed_tool");
      expect(toolInfo).toBeDefined();
      expect(toolInfo?.name).toBe("detailed_tool");
      expect(toolInfo?.description).toBe("详细工具信息");
    });

    it("应该清空现有工具并重新加载", () => {
      // 第一次初始化
      customMCPHandler.initialize([
        {
          name: "tool1",
          description: "工具 1",
          inputSchema: { type: "object" },
          handler: {
            type: "proxy",
            platform: "coze",
            config: { workflow_id: "workflow-1" },
          },
        },
      ]);
      expect(customMCPHandler.getToolCount()).toBe(1);

      // 第二次初始化（应该清空现有工具）
      customMCPHandler.initialize([
        {
          name: "tool2",
          description: "工具 2",
          inputSchema: { type: "object" },
          handler: {
            type: "proxy",
            platform: "coze",
            config: { workflow_id: "workflow-2" },
          },
        },
      ]);
      expect(customMCPHandler.getToolCount()).toBe(1);
      expect(customMCPHandler.hasTool("tool1")).toBe(false);
      expect(customMCPHandler.hasTool("tool2")).toBe(true);
    });
  });

  describe("错误处理测试", () => {
    it("应该处理工具不存在错误", async () => {
      await expect(
        customMCPHandler.callTool("non-existent-tool", {})
      ).rejects.toThrow("未找到工具: non-existent-tool");
    });
  });

  describe("资源清理测试", () => {
    it("应该正确清理资源", () => {
      const testTool: CustomMCPTool = {
        name: "cleanup_tool",
        description: "清理测试工具",
        inputSchema: { type: "object" },
        handler: {
          type: "proxy",
          platform: "coze",
          config: { workflow_id: "cleanup-workflow" },
        },
      };

      customMCPHandler.initialize([testTool]);
      expect(customMCPHandler.getToolCount()).toBe(1);

      // 清理资源
      customMCPHandler.cleanup();

      // 验证资源被清理
      expect(customMCPHandler.getToolCount()).toBe(0);
    });

    it("应该能够多次调用清理而不出错", () => {
      expect(() => {
        customMCPHandler.cleanup();
        customMCPHandler.cleanup();
        customMCPHandler.cleanup();
      }).not.toThrow();
    });
  });

  describe("配置更新响应测试", () => {
    it("应该在配置更新处理失败时记录错误", async () => {
      const { logger } = await import("@root/Logger.js");

      // Mock initialize 方法抛出异常
      vi.spyOn(customMCPHandler, "initialize").mockImplementation(() => {
        throw new Error("重新初始化失败");
      });

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
});
