import type { StatusService } from "@/services/status.service.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceApiHandler } from "../service.handler.js";

// 模拟依赖
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

vi.mock("@/services/event-bus.service.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    emitEvent: vi.fn(),
  }),
}));

describe("ServiceApiHandler", () => {
  let handler: ServiceApiHandler;
  let mockStatusService: StatusService;
  let mockContext: any;
  let mockSpawn: any;
  let mockEventBus: any;
  let mockMcpServiceManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // 模拟 StatusService
    mockStatusService = {
      updateRestartStatus: vi.fn(),
    } as any;

    // 模拟 MCPServiceManager
    mockMcpServiceManager = {
      getStatus: vi.fn().mockReturnValue({
        isRunning: true,
        mode: "daemon",
        pid: 12345,
      }),
    };

    // 模拟 Hono Context
    mockContext = {
      json: vi.fn().mockReturnValue(new Response()),
      success: vi.fn().mockReturnValue(new Response()),
      fail: vi.fn().mockReturnValue(new Response()),
      req: {
        json: vi.fn(),
      },
      get: vi.fn((key: string) => {
        if (key === "mcpServiceManager") {
          return mockMcpServiceManager;
        }
        if (key === "logger") {
          return {
            debug: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
          };
        }
        return undefined;
      }),
    };

    // 模拟 spawn
    mockSpawn = vi.fn().mockReturnValue({
      unref: vi.fn(),
    });
    const { spawn } = await import("node:child_process");
    vi.mocked(spawn).mockImplementation(mockSpawn);

    // 模拟 EventBus
    mockEventBus = {
      emitEvent: vi.fn(),
    };
    const { getEventBus } = await import("@/services/event-bus.service.js");
    vi.mocked(getEventBus).mockReturnValue(mockEventBus);

    handler = new ServiceApiHandler(mockStatusService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("应该使用正确的依赖项初始化", () => {
      expect(handler).toBeInstanceOf(ServiceApiHandler);
      expect(mockEventBus).toBeDefined();
    });
  });

  describe("getServiceStatus", () => {
    it("应该成功返回服务状态", async () => {
      const mockStatus = {
        isRunning: true,
        pid: 12345,
        uptime: 3600000,
        memory: { rss: 50000000 },
        mode: "daemon",
      };
      mockMcpServiceManager.getStatus.mockReturnValue(mockStatus);

      await handler.getServiceStatus(mockContext);

      expect(mockMcpServiceManager.getStatus).toHaveBeenCalledOnce();
      expect(mockContext.success).toHaveBeenCalledWith(mockStatus);
    });

    it("应该处理服务状态错误", async () => {
      const error = new Error("Status check failed");
      mockMcpServiceManager.getStatus.mockImplementation(() => {
        throw error;
      });

      await handler.getServiceStatus(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "SERVICE_STATUS_READ_ERROR",
        "Status check failed",
        undefined,
        500
      );
    });

    it("应该处理非 Error 异常", async () => {
      mockMcpServiceManager.getStatus.mockImplementation(() => {
        throw "String error";
      });

      await handler.getServiceStatus(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "SERVICE_STATUS_READ_ERROR",
        "获取服务状态失败",
        undefined,
        500
      );
    });
  });

  describe("getServiceHealth", () => {
    it("应该成功返回服务健康状态", async () => {
      const originalUptime = process.uptime;
      const originalMemoryUsage = process.memoryUsage;
      const originalVersion = process.version;

      process.uptime = vi.fn().mockReturnValue(3600);
      process.memoryUsage = vi.fn().mockReturnValue({
        rss: 50000000,
        heapUsed: 30000000,
        heapTotal: 40000000,
        external: 5000000,
        arrayBuffers: 1000000,
      }) as any;
      Object.defineProperty(process, "version", {
        value: "v18.0.0",
        writable: true,
      });

      await handler.getServiceHealth(mockContext);

      expect(mockContext.success).toHaveBeenCalledWith({
        status: "healthy",
        timestamp: expect.any(Number),
        uptime: 3600,
        memory: {
          rss: 50000000,
          heapUsed: 30000000,
          heapTotal: 40000000,
          external: 5000000,
          arrayBuffers: 1000000,
        },
        version: "v18.0.0",
      });

      // 恢复原始函数
      process.uptime = originalUptime;
      process.memoryUsage = originalMemoryUsage;
      Object.defineProperty(process, "version", {
        value: originalVersion,
        writable: true,
      });
    });

    it("应该处理健康检查错误", async () => {
      const originalUptime = process.uptime;
      process.uptime = vi.fn().mockImplementation(() => {
        throw new Error("Uptime error");
      });

      await handler.getServiceHealth(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "SERVICE_HEALTH_READ_ERROR",
        "Uptime error",
        undefined,
        500
      );

      // 恢复原始函数
      process.uptime = originalUptime;
    });
  });

  describe("startService", () => {
    it("应该成功启动服务", async () => {
      await handler.startService(mockContext);

      expect(mockSpawn).toHaveBeenCalledWith("xiaozhi", ["start", "--daemon"], {
        detached: true,
        stdio: "ignore",
        env: expect.objectContaining({
          XIAOZHI_CONFIG_DIR: expect.any(String),
        }),
      });

      expect(mockContext.success).toHaveBeenCalledWith(null, "启动请求已接收");
    });

    it("应该处理启动服务错误", async () => {
      const error = new Error("Start failed");
      mockSpawn.mockImplementation(() => {
        throw error;
      });

      await handler.startService(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "START_REQUEST_ERROR",
        "Start failed",
        undefined,
        500
      );
    });

    it("应该处理启动时的非 Error 异常", async () => {
      mockSpawn.mockImplementation(() => {
        throw "String error";
      });

      await handler.startService(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "START_REQUEST_ERROR",
        "处理启动请求失败",
        undefined,
        500
      );
    });

    it("应该使用正确的环境变量", async () => {
      const originalEnv = process.env.XIAOZHI_CONFIG_DIR;
      process.env.XIAOZHI_CONFIG_DIR = "/custom/config/dir";

      await handler.startService(mockContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        "xiaozhi",
        ["start", "--daemon"],
        expect.objectContaining({
          env: expect.objectContaining({
            XIAOZHI_CONFIG_DIR: "/custom/config/dir",
          }),
        })
      );

      // Restore original environment
      if (originalEnv) {
        process.env.XIAOZHI_CONFIG_DIR = originalEnv;
      } else {
        process.env.XIAOZHI_CONFIG_DIR = undefined;
      }
    });

    it("should use current working directory when XIAOZHI_CONFIG_DIR is not set", async () => {
      const originalEnv = process.env.XIAOZHI_CONFIG_DIR;
      process.env.XIAOZHI_CONFIG_DIR = "";

      await handler.startService(mockContext);

      // Check that spawn was called with basic structure
      expect(mockSpawn).toHaveBeenCalledWith(
        "xiaozhi",
        ["start", "--daemon"],
        expect.objectContaining({
          detached: true,
          stdio: "ignore",
          env: expect.any(Object),
        })
      );

      // Check that the environment contains XIAOZHI_CONFIG_DIR
      const spawnCall = mockSpawn.mock.calls[0];
      const spawnOptions = spawnCall[2];
      expect(spawnOptions.env).toHaveProperty("XIAOZHI_CONFIG_DIR");

      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.XIAOZHI_CONFIG_DIR = originalEnv;
      } else {
        process.env.XIAOZHI_CONFIG_DIR = undefined;
      }
    });
  });

  describe("stopService", () => {
    it("should stop service successfully", async () => {
      await handler.stopService(mockContext);

      expect(mockSpawn).toHaveBeenCalledWith("xiaozhi", ["stop"], {
        detached: true,
        stdio: "ignore",
        env: expect.objectContaining({
          XIAOZHI_CONFIG_DIR: expect.any(String),
        }),
      });

      expect(mockContext.success).toHaveBeenCalledWith(null, "停止请求已接收");
    });

    it("should handle stop service error", async () => {
      const error = new Error("Stop failed");
      mockSpawn.mockImplementation(() => {
        throw error;
      });

      await handler.stopService(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "STOP_REQUEST_ERROR",
        "Stop failed",
        undefined,
        500
      );
    });

    it("should handle non-Error exceptions in stop", async () => {
      mockSpawn.mockImplementation(() => {
        throw "String error";
      });

      await handler.stopService(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "STOP_REQUEST_ERROR",
        "处理停止请求失败",
        undefined,
        500
      );
    });
  });

  describe("restartService", () => {
    it("should restart service successfully", async () => {
      await handler.restartService(mockContext);

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "service:restart:requested",
        expect.objectContaining({
          source: "http-api",
          serviceName: "unknown",
          delay: 0,
          attempt: 1,
          timestamp: expect.any(Number),
        })
      );

      expect(mockStatusService.updateRestartStatus).toHaveBeenCalledWith(
        "restarting"
      );

      expect(mockContext.success).toHaveBeenCalledWith(null, "重启请求已接收");
    });

    it("should handle restart service error", async () => {
      const error = new Error("Restart failed");
      mockEventBus.emitEvent.mockImplementation(() => {
        throw error;
      });

      await handler.restartService(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "RESTART_REQUEST_ERROR",
        "Restart failed",
        undefined,
        500
      );
    });

    it("should handle non-Error exceptions in restart", async () => {
      mockEventBus.emitEvent.mockImplementation(() => {
        throw "String error";
      });

      await handler.restartService(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "RESTART_REQUEST_ERROR",
        "处理重启请求失败",
        undefined,
        500
      );
    });

    it("should execute restart asynchronously for running service", async () => {
      mockMcpServiceManager.getStatus.mockReturnValue({
        isRunning: true,
        mode: "daemon",
        pid: 12345,
      });

      await handler.restartService(mockContext);

      // Fast-forward the initial timeout to trigger executeRestart
      await vi.advanceTimersByTimeAsync(500);

      expect(mockMcpServiceManager.getStatus).toHaveBeenCalled();
      expect(mockSpawn).toHaveBeenCalledWith(
        "xiaozhi",
        ["restart", "--daemon"],
        expect.objectContaining({
          detached: true,
          stdio: "ignore",
        })
      );

      // Fast-forward the success status timeout
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockStatusService.updateRestartStatus).toHaveBeenCalledWith(
        "completed"
      );
    });

    it("should start service when not running during restart", async () => {
      mockMcpServiceManager.getStatus.mockReturnValue({
        isRunning: false,
        mode: "daemon",
        pid: null,
      });

      await handler.restartService(mockContext);

      // Fast-forward the initial timeout to trigger executeRestart
      await vi.advanceTimersByTimeAsync(500);

      expect(mockSpawn).toHaveBeenCalledWith(
        "xiaozhi",
        ["start", "--daemon"],
        expect.objectContaining({
          detached: true,
          stdio: "ignore",
        })
      );
    });

    it("should handle restart execution error", async () => {
      mockMcpServiceManager.getStatus.mockImplementation(() => {
        throw new Error("Service manager error");
      });

      await handler.restartService(mockContext);

      // Fast-forward the initial timeout to trigger executeRestart
      await vi.advanceTimersByTimeAsync(500);

      // Allow async error handling to complete
      await vi.advanceTimersByTimeAsync(100);

      expect(mockStatusService.updateRestartStatus).toHaveBeenCalledWith(
        "failed",
        "Service manager error"
      );
    });

    it("should handle non-daemon mode restart", async () => {
      mockMcpServiceManager.getStatus.mockReturnValue({
        isRunning: true,
        mode: "standalone",
        pid: 12345,
      });

      await handler.restartService(mockContext);

      // Fast-forward the initial timeout to trigger executeRestart
      await vi.advanceTimersByTimeAsync(500);

      // 注意：实际代码逻辑是始终使用 --daemon 模式
      expect(mockSpawn).toHaveBeenCalledWith(
        "xiaozhi",
        ["restart", "--daemon"],
        expect.objectContaining({
          detached: true,
          stdio: "ignore",
        })
      );
    });
  });

  describe("environment handling", () => {
    it("should preserve existing environment variables", async () => {
      const originalPath = process.env.PATH;
      process.env.CUSTOM_VAR = "test-value";

      await handler.startService(mockContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        "xiaozhi",
        ["start", "--daemon"],
        expect.objectContaining({
          env: expect.objectContaining({
            PATH: originalPath,
            CUSTOM_VAR: "test-value",
            XIAOZHI_CONFIG_DIR: expect.any(String),
          }),
        })
      );

      // 清理
      process.env.CUSTOM_VAR = undefined;
    });
  });

  describe("error handling edge cases", () => {
    it("应该处理 spawn 返回 null", async () => {
      mockSpawn.mockReturnValue(null);

      await handler.startService(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "START_REQUEST_ERROR",
        "Cannot read properties of null (reading 'unref')",
        undefined,
        500
      );
    });

    it("应该处理没有 unref 方法的 spawn 子进程", async () => {
      mockSpawn.mockReturnValue({});

      await handler.startService(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "START_REQUEST_ERROR",
        "child.unref is not a function",
        undefined,
        500
      );
    });

    it("应该处理 unref 方法抛出错误", async () => {
      mockSpawn.mockReturnValue({
        unref: vi.fn().mockImplementation(() => {
          throw new Error("Unref failed");
        }),
      });

      await handler.startService(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "START_REQUEST_ERROR",
        "Unref failed",
        undefined,
        500
      );
    });
  });

  describe("integration scenarios", () => {
    it("应该处理多个并发的重启请求", async () => {
      const promise1 = handler.restartService(mockContext);
      const promise2 = handler.restartService(mockContext);

      await Promise.all([promise1, promise2]);

      expect(mockEventBus.emitEvent).toHaveBeenCalledTimes(2);
      expect(mockStatusService.updateRestartStatus).toHaveBeenCalledTimes(2);
      expect(mockContext.success).toHaveBeenCalledTimes(2);
    });

    it("应该处理服务管理器返回未定义状态", async () => {
      mockMcpServiceManager.getStatus.mockReturnValue(undefined);

      await handler.restartService(mockContext);

      // Fast-forward the initial timeout
      vi.advanceTimersByTime(500);

      // Should still attempt to execute restart
      expect(mockMcpServiceManager.getStatus).toHaveBeenCalled();
    });
  });

  describe("cleanupPendingRestarts", () => {
    it("应该清理所有待处理的重启定时器", async () => {
      // 发起多个重启请求
      await handler.restartService(mockContext);
      await handler.restartService(mockContext);
      await handler.restartService(mockContext);

      // 调用清理方法
      handler.cleanupPendingRestarts();

      // 验证定时器已被清理
      // 由于 cleanupPendingRestarts 清除了所有定时器
      // 即使推进时间也不应触发 executeRestart
      await vi.advanceTimersByTimeAsync(500);

      // 验证没有调用 spawn（因为定时器已被清除）
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("应该在没有待处理定时器时正常工作", () => {
      // 没有重启请求的情况下调用清理
      expect(() => handler.cleanupPendingRestarts()).not.toThrow();
    });

    it("应该清理成功通知定时器", async () => {
      await handler.restartService(mockContext);

      // 推进到重启执行完成
      await vi.advanceTimersByTimeAsync(500);

      // 在成功通知发送前清理
      handler.cleanupPendingRestarts();

      // 推进到成功通知应该触发的时间
      await vi.advanceTimersByTimeAsync(5000);

      // 验证成功状态未被更新（因为定时器已被清理）
      // 检查是否只有 "restarting" 状态被调用，没有 "completed"
      const updateRestartStatusMock =
        mockStatusService.updateRestartStatus as ReturnType<typeof vi.fn>;
      const restartCalls = updateRestartStatusMock.mock.calls;
      const hasCompleted = restartCalls.some(
        (call: unknown[]) => call[0] === "completed"
      );
      expect(hasCompleted).toBe(false);
    });

    it("应该在清理后允许新的重启请求", async () => {
      // 第一次重启
      await handler.restartService(mockContext);
      handler.cleanupPendingRestarts();

      // 重置 mock 以跟踪新的调用
      const updateRestartStatusMock =
        mockStatusService.updateRestartStatus as ReturnType<typeof vi.fn>;
      updateRestartStatusMock.mockClear();

      // 清理后的新重启请求应该正常工作
      await handler.restartService(mockContext);
      expect(mockStatusService.updateRestartStatus).toHaveBeenCalledWith(
        "restarting"
      );
    });
  });
});
