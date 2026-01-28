import type { StatusService } from "@services/StatusService.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceApiHandler } from "../service.handler.js";

// Mock dependencies
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

vi.mock("@services/EventBus.js", () => ({
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

    // Mock StatusService
    mockStatusService = {
      updateRestartStatus: vi.fn(),
    } as any;

    // Mock MCPServiceManager
    mockMcpServiceManager = {
      getStatus: vi.fn().mockReturnValue({
        isRunning: true,
        mode: "daemon",
        pid: 12345,
      }),
    };

    // Mock Hono Context
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
        return undefined;
      }),
    };

    // Mock spawn
    mockSpawn = vi.fn().mockReturnValue({
      unref: vi.fn(),
    });
    const { spawn } = await import("node:child_process");
    vi.mocked(spawn).mockImplementation(mockSpawn);

    // Mock EventBus
    mockEventBus = {
      emitEvent: vi.fn(),
    };
    const { getEventBus } = await import("@services/EventBus.js");
    vi.mocked(getEventBus).mockReturnValue(mockEventBus);

    handler = new ServiceApiHandler(mockStatusService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should initialize with correct dependencies", () => {
      expect(handler).toBeInstanceOf(ServiceApiHandler);
      expect(mockEventBus).toBeDefined();
    });
  });

  describe("getServiceStatus", () => {
    it("should return service status successfully", async () => {
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

    it("should handle service status error", async () => {
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

    it("should handle non-Error exceptions", async () => {
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
    it("should return service health successfully", async () => {
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

      // Restore original functions
      process.uptime = originalUptime;
      process.memoryUsage = originalMemoryUsage;
      Object.defineProperty(process, "version", {
        value: originalVersion,
        writable: true,
      });
    });

    it("should handle health check error", async () => {
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

      // Restore original function
      process.uptime = originalUptime;
    });
  });

  describe("startService", () => {
    it("should start service successfully", async () => {
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

    it("should handle start service error", async () => {
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

    it("should handle non-Error exceptions in start", async () => {
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

    it("should use correct environment variables", async () => {
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

      // Cleanup
      process.env.CUSTOM_VAR = undefined;
    });
  });

  describe("error handling edge cases", () => {
    it("should handle spawn returning null", async () => {
      mockSpawn.mockReturnValue(null);

      await handler.startService(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "START_REQUEST_ERROR",
        "Cannot read properties of null (reading 'unref')",
        undefined,
        500
      );
    });

    it("should handle spawn child without unref method", async () => {
      mockSpawn.mockReturnValue({});

      await handler.startService(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "START_REQUEST_ERROR",
        "child.unref is not a function",
        undefined,
        500
      );
    });

    it("should handle unref method throwing error", async () => {
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
    it("should handle multiple concurrent restart requests", async () => {
      const promise1 = handler.restartService(mockContext);
      const promise2 = handler.restartService(mockContext);

      await Promise.all([promise1, promise2]);

      expect(mockEventBus.emitEvent).toHaveBeenCalledTimes(2);
      expect(mockStatusService.updateRestartStatus).toHaveBeenCalledTimes(2);
      expect(mockContext.success).toHaveBeenCalledTimes(2);
    });

    it("should handle service manager returning undefined status", async () => {
      mockMcpServiceManager.getStatus.mockReturnValue(undefined);

      await handler.restartService(mockContext);

      // Fast-forward the initial timeout
      vi.advanceTimersByTime(500);

      // Should still attempt to execute restart
      expect(mockMcpServiceManager.getStatus).toHaveBeenCalled();
    });
  });
});
