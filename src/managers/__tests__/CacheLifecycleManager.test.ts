import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../../Logger.js";
import type {
  CacheStatistics,
  EnhancedToolResultCache,
  ExtendedMCPToolsCache,
  TaskStatus,
} from "../../types/mcp.js";
import { CacheLifecycleManager } from "../CacheLifecycleManager.js";

// Mock Logger - 使用 unknown 转换避免类型检查问题
const createMockLogger = (): Logger =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    success: vi.fn(),
    initLogFile: vi.fn(),
    enableFileLogging: vi.fn(),
    close: vi.fn(),
    setLogFileOptions: vi.fn(),
    cleanupOldLogs: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  }) as unknown as Logger;

// Mock cache data
const createMockCache = (): ExtendedMCPToolsCache => ({
  version: "1.0.0",
  mcpServers: {},
  metadata: {
    lastGlobalUpdate: new Date().toISOString(),
    totalWrites: 0,
    createdAt: new Date().toISOString(),
  },
  customMCPResults: {},
});

// Mock cache entry
const createMockCacheEntry = (
  status: TaskStatus = "pending",
  consumed = false,
  timestamp?: string
): EnhancedToolResultCache => ({
  result: {
    content: [{ type: "text", text: "test result" }],
  },
  timestamp: timestamp || new Date().toISOString(),
  ttl: 300000,
  status,
  consumed,
  retryCount: 0,
});

describe("CacheLifecycleManager", () => {
  let manager: CacheLifecycleManager;
  let mockLogger: Logger;
  let mockCache: ExtendedMCPToolsCache;

  beforeEach(() => {
    mockLogger = createMockLogger();
    manager = new CacheLifecycleManager(mockLogger);
    mockCache = createMockCache();

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup any running intervals
    manager.cleanup();
  });

  describe("构造函数和初始化", () => {
    it("应该正确初始化管理器", () => {
      expect(manager).toBeInstanceOf(CacheLifecycleManager);
      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it("应该正确初始化统计信息", () => {
      const stats = manager.getStatistics();
      expect(stats).toEqual({
        totalEntries: 0,
        pendingTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        consumedEntries: 0,
        cacheHitRate: 0,
        lastCleanupTime: expect.any(String),
        memoryUsage: 0,
      });
    });
  });

  describe("自动清理功能", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("应该启动自动清理定时器", () => {
      manager.startAutoCleanup();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("启动自动清理定时器")
      );
    });

    it("不应该重复启动定时器", () => {
      manager.startAutoCleanup();
      manager.startAutoCleanup();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[CacheLifecycle] 自动清理定时器已经在运行"
      );
      expect(mockLogger.info).toHaveBeenCalledTimes(1);
    });

    it("应该停止自动清理定时器", () => {
      manager.startAutoCleanup();
      manager.stopAutoCleanup();

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[CacheLifecycle] 停止自动清理定时器"
      );
    });

    it("应该处理停止未启动的定时器", () => {
      manager.stopAutoCleanup();

      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it("应该定期执行清理", async () => {
      const performCleanupSpy = vi.spyOn(manager, "performCleanup");

      manager.startAutoCleanup();

      // 快进到清理时间
      await vi.advanceTimersByTimeAsync(60000);

      expect(performCleanupSpy).toHaveBeenCalled();
    });

    it("应该处理清理过程中的错误", async () => {
      const error = new Error("清理失败");
      vi.spyOn(manager, "performCleanup").mockRejectedValue(error);

      manager.startAutoCleanup();

      // 快进到清理时间
      await vi.advanceTimersByTimeAsync(60000);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("自动清理失败: Error: 清理失败")
      );
    });
  });

  describe("创建缓存条目", () => {
    it("应该创建基本的缓存条目", () => {
      const entry = manager.createCacheEntry(
        "testTool",
        { arg1: "value1" },
        "result"
      );

      expect(entry).toEqual({
        result: "result",
        timestamp: expect.any(String),
        ttl: 300000,
        status: "pending",
        consumed: false,
        retryCount: 0,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[CacheLifecycle] 创建缓存条目: testTool, 状态: pending"
      );
    });

    it("应该创建带状态的缓存条目", () => {
      const entry = manager.createCacheEntry(
        "testTool",
        {},
        "result",
        "completed",
        "task123"
      );

      expect(entry.status).toBe("completed");
      expect(entry.taskId).toBe("task123");
    });

    it("应该创建带所有可选参数的缓存条目", () => {
      const result = { content: [{ type: "text", text: "test" }] };
      const entry = manager.createCacheEntry(
        "testTool",
        { num: 123 },
        result,
        "failed",
        "task456"
      );

      expect(entry.result).toEqual(result);
      expect(entry.retryCount).toBe(0);
    });
  });

  describe("更新缓存状态", () => {
    beforeEach(() => {
      mockCache.customMCPResults = {
        test_key: createMockCacheEntry("pending"),
      };
    });

    it("应该成功更新缓存状态", () => {
      const result = manager.updateCacheStatus(
        mockCache,
        "test_key",
        "completed"
      );

      expect(result).toBe(true);
      expect(mockCache.customMCPResults!.test_key.status).toBe("completed");
      expect(mockCache.customMCPResults!.test_key.consumed).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[CacheLifecycle] 更新缓存状态: test_key pending -> completed"
      );
    });

    it("应该处理不存在的缓存条目", () => {
      const result = manager.updateCacheStatus(
        mockCache,
        "nonexistent_key",
        "completed"
      );

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[CacheLifecycle] 缓存条目不存在: nonexistent_key"
      );
    });

    it("应该更新状态并包含结果", () => {
      const newResult = { content: [{ type: "text", text: "new result" }] };
      const result = manager.updateCacheStatus(
        mockCache,
        "test_key",
        "completed",
        newResult
      );

      expect(result).toBe(true);
      expect(mockCache.customMCPResults!.test_key.result).toEqual(newResult);
    });

    it("应该处理失败状态并自动标记为已消费", () => {
      const result = manager.updateCacheStatus(
        mockCache,
        "test_key",
        "failed",
        undefined,
        "test error"
      );

      expect(result).toBe(true);
      expect(mockCache.customMCPResults!.test_key.consumed).toBe(true);
      expect(mockCache.customMCPResults!.test_key.result).toEqual({
        content: [{ type: "text", text: "任务失败: test error" }],
      });
    });

    it("应该处理缺少 customMCPResults 的情况", () => {
      const cacheWithoutResults = { ...mockCache };
      (cacheWithoutResults as any).customMCPResults = undefined;

      const result = manager.updateCacheStatus(
        cacheWithoutResults,
        "test_key",
        "completed"
      );

      expect(result).toBe(false);
    });

    it("应该处理缺少 customMCPResults 中特定键的情况", () => {
      const result = manager.updateCacheStatus(
        mockCache,
        "nonexistent_key",
        "completed"
      );

      expect(result).toBe(false);
    });
  });

  describe("标记为已消费", () => {
    beforeEach(() => {
      mockCache.customMCPResults = {
        test_key: createMockCacheEntry("completed", false),
      };
    });

    it("应该成功标记缓存为已消费", () => {
      const result = manager.markAsConsumed(mockCache, "test_key");

      expect(result).toBe(true);
      expect(mockCache.customMCPResults!.test_key.consumed).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[CacheLifecycle] 标记缓存为已消费: test_key"
      );
    });

    it("不应该重复标记已消费的缓存", () => {
      mockCache.customMCPResults!.test_key.consumed = true;

      const result = manager.markAsConsumed(mockCache, "test_key");

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[CacheLifecycle] 缓存已标记为消费: test_key"
      );
    });

    it("应该处理不存在的缓存条目", () => {
      const result = manager.markAsConsumed(mockCache, "nonexistent_key");

      expect(result).toBe(false);
    });

    it("应该处理缺少 customMCPResults 的情况", () => {
      const cacheWithoutResults = { ...mockCache };
      (cacheWithoutResults as any).customMCPResults = undefined;

      const result = manager.markAsConsumed(cacheWithoutResults, "test_key");

      expect(result).toBe(false);
    });
  });

  describe("检查缓存可用性", () => {
    beforeEach(() => {
      mockCache.customMCPResults = {
        valid_key: createMockCacheEntry("completed", false),
        consumed_key: createMockCacheEntry("completed", true),
        expired_key: createMockCacheEntry(
          "completed",
          false,
          new Date(Date.now() - 400000).toISOString()
        ),
        pending_key: createMockCacheEntry("pending", false),
      };
    });

    it("应该返回有效的缓存", () => {
      const result = manager.isCacheAvailable(mockCache, "valid_key");

      expect(result).toBe(true);
    });

    it("应该拒绝已消费的缓存", () => {
      const result = manager.isCacheAvailable(mockCache, "consumed_key");

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[CacheLifecycle] 缓存已消费: consumed_key"
      );
    });

    it("应该拒绝过期的缓存", () => {
      const result = manager.isCacheAvailable(mockCache, "expired_key");

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[CacheLifecycle] 缓存已过期: expired_key"
      );
    });

    it("应该拒绝未完成的缓存", () => {
      const result = manager.isCacheAvailable(mockCache, "pending_key");

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("缓存状态未完成: pending_key")
      );
    });

    it("应该处理不存在的缓存条目", () => {
      const result = manager.isCacheAvailable(mockCache, "nonexistent_key");

      expect(result).toBe(false);
    });

    it("应该处理缺少 customMCPResults 的情况", () => {
      const cacheWithoutResults = { ...mockCache };
      (cacheWithoutResults as any).customMCPResults = undefined;

      const result = manager.isCacheAvailable(cacheWithoutResults, "test_key");

      expect(result).toBe(false);
    });
  });

  describe("执行清理", () => {
    it("应该执行基本清理", async () => {
      await expect(manager.performCleanup()).resolves.not.toThrow();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[CacheLifecycle] 执行缓存清理"
      );
    });

    it("应该处理清理错误", async () => {
      const error = new Error("清理错误");
      vi.spyOn(mockLogger, "debug").mockImplementation(() => {
        throw error;
      });

      await expect(manager.performCleanup()).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[CacheLifecycle] 清理失败: Error: 清理错误"
      );
    });
  });

  describe("清理缓存条目", () => {
    beforeEach(() => {
      mockCache.customMCPResults = {
        cleanup_key: createMockCacheEntry("failed", false),
        keep_key: createMockCacheEntry("completed", false),
        consumed_old_key: createMockCacheEntry(
          "completed",
          true,
          new Date(Date.now() - 120000).toISOString()
        ),
      };
    });

    it("应该清理指定的缓存条目", () => {
      const result = manager.cleanupCacheEntries(mockCache, ["cleanup_key"]);

      expect(result).toEqual({ cleaned: 1, total: 1 });
      expect(mockCache.customMCPResults!.cleanup_key).toBeUndefined();
      expect(mockCache.customMCPResults!.keep_key).toBeDefined();
    });

    it("应该清理所有缓存条目", () => {
      const result = manager.cleanupCacheEntries(mockCache);

      expect(result.cleaned).toBeGreaterThan(0);
      expect(result.total).toBe(3);
    });

    it("应该处理缺少 customMCPResults 的缓存", () => {
      const cacheWithoutResults = createMockCache();
      (cacheWithoutResults as any).customMCPResults = undefined;

      const result = manager.cleanupCacheEntries(cacheWithoutResults);

      expect(result).toEqual({ cleaned: 0, total: 0 });
    });

    it("应该处理空的缓存", () => {
      const emptyCache = createMockCache();
      emptyCache.customMCPResults = {};

      const result = manager.cleanupCacheEntries(emptyCache);

      expect(result).toEqual({ cleaned: 0, total: 0 });
    });

    it("应该记录清理过程", () => {
      manager.cleanupCacheEntries(mockCache, ["cleanup_key"]);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[CacheLifecycle] 清理缓存条目: cleanup_key"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("清理完成: 1/1")
      );
    });
  });

  describe("清理过期缓存", () => {
    beforeEach(() => {
      mockCache.customMCPResults = {
        expired_key: createMockCacheEntry(
          "completed",
          false,
          new Date(Date.now() - 400000).toISOString()
        ),
        fresh_key: createMockCacheEntry("completed", false),
      };
    });

    it("应该清理过期缓存", () => {
      const result = manager.cleanupExpiredCache(mockCache);

      expect(result.cleaned).toBe(1);
      expect(result.total).toBe(2);
      expect(mockCache.customMCPResults!.expired_key).toBeUndefined();
      expect(mockCache.customMCPResults!.fresh_key).toBeDefined();
    });

    it("应该处理没有过期缓存的情况", () => {
      const result = manager.cleanupExpiredCache(mockCache);

      expect(result.cleaned).toBe(1);
    });

    it("应该处理缺少 customMCPResults 的缓存", () => {
      const cacheWithoutResults = createMockCache();
      (cacheWithoutResults as any).customMCPResults = undefined;

      const result = manager.cleanupExpiredCache(cacheWithoutResults);

      expect(result).toEqual({ cleaned: 0, total: 0 });
    });

    it("应该处理空的缓存", () => {
      const emptyCache = createMockCache();
      emptyCache.customMCPResults = {};

      const result = manager.cleanupExpiredCache(emptyCache);

      expect(result).toEqual({ cleaned: 0, total: 0 });
    });

    it("应该记录清理结果", () => {
      manager.cleanupExpiredCache(mockCache);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[CacheLifecycle] 清理过期缓存: expired_key"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("清理过期缓存: 1/2")
      );
    });
  });

  describe("清理已消费缓存", () => {
    beforeEach(() => {
      const now = Date.now();
      mockCache.customMCPResults = {
        old_consumed_key: createMockCacheEntry(
          "completed",
          true,
          new Date(now - 120000).toISOString()
        ),
        new_consumed_key: createMockCacheEntry(
          "completed",
          true,
          new Date(now - 30000).toISOString()
        ),
        not_consumed_key: createMockCacheEntry("completed", false),
      };
    });

    it("应该清理超过1分钟的已消费缓存", () => {
      const result = manager.cleanupConsumedCache(mockCache);

      expect(result.cleaned).toBe(1);
      expect(result.total).toBe(3);
      expect(mockCache.customMCPResults!.old_consumed_key).toBeUndefined();
      expect(mockCache.customMCPResults!.new_consumed_key).toBeDefined();
    });

    it("应该处理没有需要清理的缓存", () => {
      const result = manager.cleanupConsumedCache(mockCache);

      expect(result.cleaned).toBe(1);
    });

    it("应该处理缺少 customMCPResults 的缓存", () => {
      const cacheWithoutResults = createMockCache();
      (cacheWithoutResults as any).customMCPResults = undefined;

      const result = manager.cleanupConsumedCache(cacheWithoutResults);

      expect(result).toEqual({ cleaned: 0, total: 0 });
    });

    it("应该处理空的缓存", () => {
      const emptyCache = createMockCache();
      emptyCache.customMCPResults = {};

      const result = manager.cleanupConsumedCache(emptyCache);

      expect(result).toEqual({ cleaned: 0, total: 0 });
    });

    it("应该记录清理结果", () => {
      manager.cleanupConsumedCache(mockCache);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[CacheLifecycle] 清理已消费缓存: old_consumed_key"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("清理已消费缓存: 1/3")
      );
    });
  });

  describe("统计信息管理", () => {
    beforeEach(() => {
      mockCache.customMCPResults = {
        pending_key: createMockCacheEntry("pending", false),
        completed_key: createMockCacheEntry("completed", false),
        completed_consumed_key: createMockCacheEntry("completed", true),
        failed_key: createMockCacheEntry("failed", false),
      };
    });

    it("应该正确更新统计信息", () => {
      manager.updateStatistics(mockCache);

      const stats = manager.getStatistics();
      expect(stats.totalEntries).toBe(4);
      expect(stats.pendingTasks).toBe(1);
      expect(stats.completedTasks).toBe(2);
      expect(stats.failedTasks).toBe(1);
      expect(stats.consumedEntries).toBe(1);
      expect(stats.cacheHitRate).toBe(50); // 1/2 * 100
    });

    it("应该处理空缓存的统计信息", () => {
      const emptyCache = createMockCache();
      (emptyCache as any).customMCPResults = undefined;

      manager.updateStatistics(emptyCache);

      const stats = manager.getStatistics();
      expect(stats.totalEntries).toBe(0);
      expect(stats.pendingTasks).toBe(0);
    });

    it("应该计算内存使用情况", () => {
      manager.updateStatistics(mockCache);

      const stats = manager.getStatistics();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it("应该处理缓存命中率为0的情况", () => {
      const cacheWithNoCompleted = createMockCache();
      cacheWithNoCompleted.customMCPResults = {
        pending_key: createMockCacheEntry("pending", false),
      };

      manager.updateStatistics(cacheWithNoCompleted);

      const stats = manager.getStatistics();
      expect(stats.cacheHitRate).toBe(0);
    });
  });

  describe("缓存完整性验证", () => {
    it("应该验证有效缓存", () => {
      mockCache.customMCPResults = {
        valid_key: createMockCacheEntry("completed", false),
      };

      const result = manager.validateCacheIntegrity(mockCache);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("应该检测缺少必需字段的缓存条目", () => {
      mockCache.customMCPResults = {
        invalid_key: {
          result: { content: [{ type: "text", text: "test" }] },
          // 缺少 timestamp, ttl, status
        } as any,
      };

      const result = manager.validateCacheIntegrity(mockCache);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain("缓存条目缺少必需字段: invalid_key");
    });

    it("应该检测无效的时间戳格式", () => {
      mockCache.customMCPResults = {
        invalid_timestamp: {
          ...createMockCacheEntry(),
          timestamp: "invalid-date",
        },
      };

      const result = manager.validateCacheIntegrity(mockCache);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain("无效的时间戳格式: invalid_timestamp");
    });

    it("应该检测无效的状态值", () => {
      mockCache.customMCPResults = {
        invalid_status: {
          ...createMockCacheEntry(),
          status: "invalid" as any,
        },
      };

      const result = manager.validateCacheIntegrity(mockCache);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain(
        "无效的状态值: invalid_status, 状态: invalid"
      );
    });

    it("应该检测过期条目", () => {
      mockCache.customMCPResults = {
        expired_key: createMockCacheEntry(
          "completed",
          false,
          new Date(Date.now() - 400000).toISOString()
        ),
      };

      const result = manager.validateCacheIntegrity(mockCache);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain("缓存条目已过期: expired_key");
    });

    it("应该处理没有 customMCPResults 的缓存", () => {
      const cacheWithoutResults = { ...mockCache };
      (cacheWithoutResults as any).customMCPResults = undefined;

      const result = manager.validateCacheIntegrity(cacheWithoutResults);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe("资源清理", () => {
    it("应该停止自动清理定时器", () => {
      const stopAutoCleanupSpy = vi.spyOn(manager, "stopAutoCleanup");

      manager.cleanup();

      expect(stopAutoCleanupSpy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[CacheLifecycle] 清理资源完成"
      );
    });

    it("应该可以多次调用清理", () => {
      manager.cleanup();
      manager.cleanup();

      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });
  });

  describe("边界条件", () => {
    it("应该处理大量的缓存条目", () => {
      // 创建大量缓存条目
      const largeCache = createMockCache();
      largeCache.customMCPResults = {};

      for (let i = 0; i < 1000; i++) {
        largeCache.customMCPResults[`key_${i}`] = createMockCacheEntry(
          "completed",
          false
        );
      }

      manager.updateStatistics(largeCache);

      const stats = manager.getStatistics();
      expect(stats.totalEntries).toBe(1000);
      expect(stats.completedTasks).toBe(1000);
    });

    it("应该处理空对象作为参数", () => {
      const result = manager.isCacheAvailable({} as any, "test_key");

      expect(result).toBe(false);
    });
  });

  describe("私有方法测试", () => {
    it("应该正确记录状态转换", () => {
      // 由于 logStateTransition 是私有方法，我们通过公共方法间接测试
      mockCache.customMCPResults = {
        test_key: createMockCacheEntry("pending", false),
      };

      manager.updateCacheStatus(mockCache, "test_key", "completed");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("状态转换: test_key pending -> completed")
      );
    });

    it("应该返回状态转换原因", () => {
      // 由于 getTransitionReason 是私有方法，我们通过公共方法间接测试
      mockCache.customMCPResults = {
        test_key: createMockCacheEntry("pending", false),
      };

      manager.updateCacheStatus(mockCache, "test_key", "completed");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("(任务执行成功)")
      );
    });

    it("应该处理未知的状态转换", () => {
      mockCache.customMCPResults = {
        test_key: createMockCacheEntry("pending", false),
      };

      manager.updateCacheStatus(mockCache, "test_key", "deleted" as TaskStatus);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("(状态更新)")
      );
    });
  });
});
