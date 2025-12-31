/**
 * CustomMCPHandler 基础测试
 * 测试基本功能和资源管理
 */

import type { CustomMCPTool } from "@xiaozhi-client/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomMCPHandler } from "../custom.js";

// 类型定义：测试用到的私有方法签名
// 使用类型断言来访问私有方法（仅用于测试）
type TestableCustomMCPHandler = {
  generateCacheKey(
    toolName: string,
    arguments_: Record<string, unknown>
  ): string;
};

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
vi.mock("@xiaozhi-client/config", () => ({
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

describe("CustomMCPHandler 基础测试", () => {
  let customMCPHandler: CustomMCPHandler;
  let handlerWithPrivateMethods: TestableCustomMCPHandler;

  beforeEach(() => {
    vi.clearAllMocks();

    // 创建 CustomMCPHandler 实例
    customMCPHandler = new CustomMCPHandler();
    // 类型转换以访问私有方法（仅用于测试）
    handlerWithPrivateMethods =
      customMCPHandler as unknown as TestableCustomMCPHandler;
  });

  afterEach(() => {
    vi.clearAllMocks();
    customMCPHandler.cleanup();
  });

  describe("缓存管理测试", () => {
    it("应该正确生成缓存键", async () => {
      const cacheKey1 = handlerWithPrivateMethods.generateCacheKey(
        "test_tool",
        { param: "value1" }
      );
      const cacheKey2 = handlerWithPrivateMethods.generateCacheKey(
        "test_tool",
        { param: "value2" }
      );
      const cacheKey3 = handlerWithPrivateMethods.generateCacheKey(
        "test_tool",
        { param: "value1" }
      );

      expect(cacheKey1).not.toBe(cacheKey2);
      expect(cacheKey1).toBe(cacheKey3); // 相同参数应该生成相同的键
      expect(typeof cacheKey1).toBe("string");
    });
  });

  describe("性能和资源管理测试", () => {
    it("应该提供正确的工具统计信息", () => {
      const testTools: CustomMCPTool[] = [
        {
          name: "slow_tool",
          description: "慢速测试工具",
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
              workflow_id: "slow_workflow_id",
            },
          },
        },
        {
          name: "fast_tool",
          description: "快速测试工具",
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
              workflow_id: "fast_workflow_id",
            },
          },
        },
      ];

      customMCPHandler.initialize(testTools);

      expect(customMCPHandler.getToolCount()).toBe(2);
      expect(customMCPHandler.hasTool("slow_tool")).toBe(true);
      expect(customMCPHandler.hasTool("fast_tool")).toBe(true);

      const toolNames = customMCPHandler.getToolNames();
      expect(toolNames).toContain("slow_tool");
      expect(toolNames).toContain("fast_tool");
      expect(toolNames).toHaveLength(2);
    });

    it("应该能够正常清理资源", () => {
      expect(() => customMCPHandler.cleanup()).not.toThrow();

      // 清理后工具数量应该为0
      expect(customMCPHandler.getToolCount()).toBe(0);
    });

    it("应该能够多次清理资源而不出错", () => {
      expect(() => {
        customMCPHandler.cleanup();
        customMCPHandler.cleanup();
        customMCPHandler.cleanup();
      }).not.toThrow();
    });
  });

  describe("错误处理测试", () => {
    it("应该处理工具不存在错误", async () => {
      await expect(
        customMCPHandler.callTool("non_existent_tool", {})
      ).rejects.toThrow("未找到工具: non_existent_tool");
    });
  });
});
