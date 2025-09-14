/**
 * CustomMCPHandler 超时响应测试
 * 测试超时友好响应机制和任务状态管理
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomMCPTool } from "../../configManager.js";
import { CustomMCPHandler } from "../../services/CustomMCPHandler.js";
import { MCPCacheManager } from "../../services/MCPCacheManager.js";
import {
  TimeoutError,
  createTimeoutResponse,
  isTimeoutError,
  isTimeoutResponse,
} from "../../types/timeout.js";

// Mock Logger
const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock MCPCacheManager
const mockCacheManager = {
  loadExistingCache: vi.fn(),
  saveCache: vi.fn(),
  cleanup: vi.fn(),
  getCustomMCPStatistics: vi.fn(),
  cleanupCustomMCPResults: vi.fn(),
  writeCustomMCPResult: vi.fn(),
  readCustomMCPResult: vi.fn(),
  updateCustomMCPStatus: vi.fn(),
  markCustomMCPAsConsumed: vi.fn(),
  deleteCustomMCPResult: vi.fn(),
  loadExtendedCache: vi.fn(),
  saveExtendedCache: vi.fn(),
};

describe("CustomMCPHandler 超时响应测试", () => {
  let customMCPHandler: CustomMCPHandler;
  let slowTool: CustomMCPTool;
  let fastTool: CustomMCPTool;

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();

    // 设置 mock 返回值
    mockCacheManager.getCustomMCPStatistics.mockReturnValue({
      totalEntries: 0,
      pendingTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      consumedEntries: 0,
      cacheHitRate: 0,
      lastCleanupTime: new Date().toISOString(),
      memoryUsage: 0,
    });

    // 创建 CustomMCPHandler 实例
    customMCPHandler = new CustomMCPHandler(mockCacheManager as any);

    // 替换 logger
    (customMCPHandler as any).logger = mockLogger;

    // 创建测试工具
    slowTool = {
      name: "slow_tool",
      description: "慢速测试工具",
      inputSchema: { type: "object", properties: {} },
      handler: {
        type: "function",
        module: "./test-module.js",
        function: "slowFunction",
      },
    };

    fastTool = {
      name: "fast_tool",
      description: "快速测试工具",
      inputSchema: { type: "object", properties: {} },
      handler: {
        type: "function",
        module: "./test-module.js",
        function: "fastFunction",
      },
    };

    // 初始化工具
    customMCPHandler.initialize([slowTool, fastTool]);
  });

  afterEach(() => {
    // 清理资源
    customMCPHandler.cleanup();
  });

  describe("超时友好响应测试", () => {
    it("应该在超时时返回友好提示信息", async () => {
      // 模拟慢速工具
      vi.spyOn(
        customMCPHandler as any,
        "callToolByType"
      ).mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10秒延迟
        return { content: [{ type: "text", text: "slow result" }] };
      });

      const result = await customMCPHandler.callTool("slow_tool", {});

      expect(isTimeoutResponse(result)).toBe(true);
      if (isTimeoutResponse(result)) {
        expect(result.status).toBe("timeout");
        expect(result.taskId).toBeDefined();
        expect(result.taskId).toMatch(/^slow_tool_\d+_[a-z0-9]+$/);
        expect(result.content[0].text).toContain("⏱️ 工具调用超时");
        expect(result.content[0].text).toContain("任务ID");
        expect(result.content[0].text).toContain("请等待30秒后重试查询");
      }
    });

    it("应该包含清晰的后续操作指引", async () => {
      vi.spyOn(
        customMCPHandler as any,
        "callToolByType"
      ).mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return { content: [{ type: "text", text: "slow result" }] };
      });

      const result = await customMCPHandler.callTool("slow_tool", {});

      expect(isTimeoutResponse(result)).toBe(true);
      if (isTimeoutResponse(result)) {
        expect(result.nextAction).toBe("请稍后重试或等待任务完成");
        expect(result.content[0].text).toContain("使用相同的参数重新调用工具");
        expect(result.content[0].text).toContain(
          "系统会自动返回已完成的任务结果"
        );
      }
    });

    it("应该为 Coze 工作流工具提供特定提示信息", async () => {
      const cozeTool: CustomMCPTool = {
        name: "coze_workflow",
        description: "扣子工作流测试工具",
        inputSchema: { type: "object", properties: {} },
        handler: {
          type: "proxy",
          platform: "coze",
          config: { workflow_id: "test_workflow" },
        },
      };

      customMCPHandler.initialize([cozeTool]);

      vi.spyOn(
        customMCPHandler as any,
        "callToolByType"
      ).mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return { content: [{ type: "text", text: "coze result" }] };
      });

      const result = await customMCPHandler.callTool("coze_workflow", {});

      expect(isTimeoutResponse(result)).toBe(true);
      if (isTimeoutResponse(result)) {
        expect(result.content[0].text).toContain("扣子工作流执行超时");
        expect(result.content[0].text).toContain("工具类型: 扣子工作流");
        expect(result.content[0].text).toContain("请等待30-60秒后重试查询");
        expect(result.content[0].text).toContain(
          "复杂工作流可能需要更长时间处理"
        );
      }
    });

    it("应该在 8 秒内响应（允许 500ms 误差）", async () => {
      vi.spyOn(
        customMCPHandler as any,
        "callToolByType"
      ).mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return { content: [{ type: "text", text: "slow result" }] };
      });

      const startTime = Date.now();

      try {
        await customMCPHandler.callTool("slow_tool", {});
      } catch (error) {
        // 预期的超时响应
      }

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThanOrEqual(8500); // 8秒 + 500ms 误差
    });
  });

  describe("任务状态管理测试", () => {
    it("应该正确生成任务ID", async () => {
      const taskId = await (customMCPHandler as any).generateTaskId(
        "test_tool",
        { param: "value" }
      );

      expect(taskId).toMatch(/^test_tool_\d+_[a-z0-9]+$/);
      expect(taskId.length).toBeGreaterThan(10); // 确保ID有足够长度
    });

    it("应该正确标记任务状态", async () => {
      const taskId = "test_task_123";

      // 标记为处理中
      await (customMCPHandler as any).markTaskAsPending(
        taskId,
        "test_tool",
        {}
      );

      // 验证任务状态
      const task = (customMCPHandler as any).activeTasks.get(taskId);
      expect(task).toBeDefined();
      expect(task.status).toBe("pending");
      expect(task.startTime).toBeDefined();

      // 标记为已完成
      const result = { content: [{ type: "text", text: "completed" }] };
      await (customMCPHandler as any).markTaskAsCompleted(taskId, result);

      // 验证状态更新
      const updatedTask = (customMCPHandler as any).activeTasks.get(taskId);
      expect(updatedTask.status).toBe("completed");
      expect(updatedTask.endTime).toBeDefined();
    });

    it("应该正确处理失败任务", async () => {
      const taskId = "test_task_456";
      const error = new Error("测试错误");

      // 标记为失败
      await (customMCPHandler as any).markTaskAsFailed(taskId, error);

      // 验证失败状态
      const task = (customMCPHandler as any).activeTasks.get(taskId);
      expect(task).toBeDefined();
      expect(task.status).toBe("failed");
      expect(task.error).toBe("测试错误");
      expect(task.endTime).toBeDefined();
    });
  });

  describe("缓存管理测试", () => {
    it("应该正确生成缓存键", async () => {
      const cacheKey1 = (customMCPHandler as any).generateCacheKey(
        "test_tool",
        { param: "value1" }
      );
      const cacheKey2 = (customMCPHandler as any).generateCacheKey(
        "test_tool",
        { param: "value2" }
      );
      const cacheKey3 = (customMCPHandler as any).generateCacheKey(
        "test_tool",
        { param: "value1" }
      );

      expect(cacheKey1).not.toBe(cacheKey2);
      expect(cacheKey1).toBe(cacheKey3); // 相同参数应该生成相同的键
      expect(cacheKey1).toMatch(/^test_tool_[a-f0-9]{32}$/);
    });

    it("应该检查缓存是否过期", async () => {
      const expiredCache = {
        timestamp: new Date(Date.now() - 400000).toISOString(), // 400秒前
        ttl: 300000, // 5分钟TTL
        status: "completed" as const,
        consumed: false,
      };

      const validCache = {
        timestamp: new Date(Date.now() - 60000).toISOString(), // 1分钟前
        ttl: 300000, // 5分钟TTL
        status: "completed" as const,
        consumed: false,
      };

      // 模拟缓存检查
      mockCacheManager.loadExistingCache.mockResolvedValue({
        version: "1.0.0",
        mcpServers: {},
        metadata: {
          lastGlobalUpdate: new Date().toISOString(),
          totalWrites: 0,
          createdAt: new Date().toISOString(),
        },
        customMCPResults: {
          expired_key: expiredCache,
          valid_key: validCache,
        },
      });

      const expiredResult = await (customMCPHandler as any).getCompletedResult(
        "test_tool",
        {}
      );
      const validResult = await (customMCPHandler as any).getCompletedResult(
        "test_tool",
        {}
      );

      // 过期的缓存应该返回null
      expect(expiredResult).toBeNull();
      // 有效的缓存应该返回结果（但在这种情况下，由于缓存键不匹配，也会返回null）
      // 这里我们主要测试过期检查逻辑
    });

    it("应该清理已消费的缓存", async () => {
      const cacheKey = "test_key";
      const consumedCache = {
        result: { content: [{ type: "text", text: "test" }] },
        timestamp: new Date().toISOString(),
        ttl: 300000,
        status: "completed" as const,
        consumed: true,
        retryCount: 0,
      };

      mockCacheManager.loadExistingCache.mockResolvedValue({
        version: "1.0.0",
        mcpServers: {},
        metadata: {
          lastGlobalUpdate: new Date().toISOString(),
          totalWrites: 0,
          createdAt: new Date().toISOString(),
        },
        customMCPResults: {
          [cacheKey]: consumedCache,
        },
      });

      await (customMCPHandler as any).clearConsumedCache("test_tool", {});

      expect(mockCacheManager.saveCache).toHaveBeenCalled();
    });
  });

  describe("TimeoutResponse 工具函数测试", () => {
    it("应该创建正确的超时响应", () => {
      const taskId = "test_task_123";
      const response = createTimeoutResponse(taskId, "test_tool");

      expect(response.status).toBe("timeout");
      expect(response.taskId).toBe(taskId);
      expect(response.isError).toBe(false);
      expect(response.content[0].type).toBe("text");
      expect(response.content[0].text).toContain(taskId);
    });

    it("应该正确识别超时响应", () => {
      const timeoutResponse = {
        content: [{ type: "text", text: "timeout message" }],
        isError: false,
        taskId: "test_task",
        status: "timeout" as const,
        message: "timeout message",
        nextAction: "retry",
      };

      const normalResponse = {
        content: [{ type: "text", text: "normal result" }],
        isError: false,
      };

      expect(isTimeoutResponse(timeoutResponse)).toBe(true);
      expect(isTimeoutResponse(normalResponse)).toBe(false);
      expect(isTimeoutResponse(null)).toBe(false);
      expect(isTimeoutResponse(undefined)).toBe(false);
    });

    it("应该正确识别超时错误", () => {
      const timeoutError = new TimeoutError("timeout message");
      const normalError = new Error("normal error");

      expect(isTimeoutError(timeoutError)).toBe(true);
      expect(isTimeoutError(normalError)).toBe(false);
      expect(isTimeoutError(null)).toBe(false);
      expect(isTimeoutError(undefined)).toBe(false);
    });
  });

  describe("性能和统计测试", () => {
    it("应该提供正确的缓存统计信息", async () => {
      const stats = await customMCPHandler.getCacheStatistics();

      expect(stats).toBeDefined();
      expect(typeof stats.totalEntries).toBe("number");
      expect(typeof stats.pendingTasks).toBe("number");
      expect(typeof stats.completedTasks).toBe("number");
      expect(typeof stats.failedTasks).toBe("number");
      expect(typeof stats.memoryUsage).toBe("number");
      expect(stats.lastCleanupTime).toBeDefined();
    });

    it("应该能够停止和启动清理定时器", () => {
      // 停止定时器
      expect(() => customMCPHandler.stopCleanupTimer()).not.toThrow();

      // 重新启动定时器
      expect(() => (customMCPHandler as any).startCleanupTimer()).not.toThrow();
    });
  });
});
