/**
 * 守护进程管理服务单元测试
 */

import { ServiceError } from "@cli/errors/index.js";
import type { ProcessManager } from "@cli/interfaces/Service.js";
import type { DaemonOptions } from "@cli/services/DaemonManager.js";
import { DaemonManagerImpl } from "@cli/services/DaemonManager.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock 依赖
const mockProcessManager: ProcessManager = {
  getServiceStatus: vi.fn(),
  killProcess: vi.fn(),
  cleanupPidFile: vi.fn(),
  isXiaozhiProcess: vi.fn(),
  savePidInfo: vi.fn(),
  gracefulKillProcess: vi.fn(),
  processExists: vi.fn(),
  cleanupContainerState: vi.fn(),
  getProcessInfo: vi.fn(),
  validatePidFile: vi.fn(),
} as any;

const mockLogger = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
};

// Mock child_process
const mockChild = {
  pid: 1234,
  stdout: { pipe: vi.fn() },
  stderr: { pipe: vi.fn() },
  on: vi.fn(),
  unref: vi.fn(),
  kill: vi.fn(),
};

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => mockChild),
}));

// Mock fs
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn(() => ({
      write: vi.fn(),
    })),
  },
}));

// Mock utils
vi.mock("@cli/utils/PathUtils.js", () => ({
  PathUtils: {
    getWebServerStandalonePath: vi.fn(() => "/path/to/webserver.js"),
    getConfigDir: vi.fn(() => "/config"),
    getLogFile: vi.fn(() => "/logs/xiaozhi.log"),
  },
}));

vi.mock("@cli/utils/PlatformUtils.js", () => ({
  PlatformUtils: {
    getTailCommand: vi.fn(() => ({
      command: "tail",
      args: ["-f", "/logs/xiaozhi.log"],
    })),
  },
}));

describe("DaemonManagerImpl", () => {
  let daemonManager: DaemonManagerImpl;
  const mockServerFactory = vi.fn();

  beforeEach(() => {
    daemonManager = new DaemonManagerImpl(mockProcessManager, mockLogger);

    // 重置所有 mock
    vi.clearAllMocks();

    // 设置默认 mock 返回值
    (mockProcessManager.getServiceStatus as any).mockReturnValue({
      running: false,
    });
    mockChild.on.mockImplementation((event, callback) => {
      // 不立即调用回调，让测试控制
      return mockChild;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("startDaemon", () => {
    it("should throw error if daemon is already running", async () => {
      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: true,
        pid: 1234,
      });

      await expect(
        daemonManager.startDaemon(mockServerFactory)
      ).rejects.toThrow(ServiceError);
    });

    it("should start daemon successfully", async () => {
      const { spawn } = await import("node:child_process");

      await daemonManager.startDaemon(mockServerFactory);

      expect(spawn).toHaveBeenCalledWith("node", ["/path/to/webserver.js"], {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: expect.objectContaining({
          XIAOZHI_CONFIG_DIR: "/config",
          XIAOZHI_DAEMON: "true",
        }),
        cwd: process.cwd(),
      });

      expect(mockProcessManager.savePidInfo).toHaveBeenCalledWith(
        1234,
        "daemon"
      );
      expect(mockChild.unref).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "守护进程已启动 (PID: 1234)"
      );
    });

    it("should start daemon with options", async () => {
      const options: DaemonOptions = {
        openBrowser: true,
        env: { CUSTOM_VAR: "value" },
        cwd: "/custom/cwd",
      };

      const { spawn } = await import("node:child_process");

      await daemonManager.startDaemon(mockServerFactory, options);

      expect(spawn).toHaveBeenCalledWith(
        "node",
        ["/path/to/webserver.js", "--open-browser"],
        {
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: expect.objectContaining({
            XIAOZHI_CONFIG_DIR: "/config",
            XIAOZHI_DAEMON: "true",
            CUSTOM_VAR: "value",
          }),
          cwd: "/custom/cwd",
        }
      );
    });

    it("should setup logging", async () => {
      const fs = await import("node:fs");
      const mockLogStream = { write: vi.fn() };
      (fs.default.createWriteStream as any).mockReturnValue(mockLogStream);

      await daemonManager.startDaemon(mockServerFactory);

      expect(fs.default.createWriteStream).toHaveBeenCalledWith(
        "/logs/xiaozhi.log",
        { flags: "a" }
      );
      expect(mockChild.stdout.pipe).toHaveBeenCalledWith(mockLogStream);
      expect(mockChild.stderr.pipe).toHaveBeenCalledWith(mockLogStream);
      expect(mockLogStream.write).toHaveBeenCalledWith(
        expect.stringContaining("守护进程启动 (PID: 1234)")
      );
    });

    it("should setup event handlers", async () => {
      await daemonManager.startDaemon(mockServerFactory);

      expect(mockChild.on).toHaveBeenCalledWith("exit", expect.any(Function));
      expect(mockChild.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockChild.on).toHaveBeenCalledWith(
        "disconnect",
        expect.any(Function)
      );
    });
  });

  describe("stopDaemon", () => {
    it("should throw error if daemon is not running", async () => {
      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: false,
      });

      await expect(daemonManager.stopDaemon()).rejects.toThrow(ServiceError);
    });

    it("should stop daemon successfully", async () => {
      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: true,
        pid: 1234,
      });

      await daemonManager.stopDaemon();

      expect(mockProcessManager.gracefulKillProcess).toHaveBeenCalledWith(1234);
      expect(mockProcessManager.cleanupPidFile).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("守护进程已停止");
    });

    it("should handle stop errors", async () => {
      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: true,
        pid: 1234,
      });
      (mockProcessManager.gracefulKillProcess as any).mockRejectedValue(
        new Error("Kill failed")
      );

      await expect(daemonManager.stopDaemon()).rejects.toThrow(ServiceError);
    });
  });

  describe("restartDaemon", () => {
    it("should restart daemon", async () => {
      // Mock running daemon - restartDaemon() calls getServiceStatus(), then stopDaemon() calls getServiceStatus() again
      (mockProcessManager.getServiceStatus as any)
        .mockReturnValueOnce({ running: true, pid: 1234 }) // restartDaemon() check
        .mockReturnValueOnce({ running: true, pid: 1234 }) // stopDaemon() check
        .mockReturnValueOnce({ running: false }); // after stop

      // Mock gracefulKillProcess to resolve successfully
      (mockProcessManager.gracefulKillProcess as any).mockResolvedValue(
        undefined
      );

      await daemonManager.restartDaemon(mockServerFactory);

      expect(mockProcessManager.gracefulKillProcess).toHaveBeenCalledWith(1234);
      expect(mockProcessManager.cleanupPidFile).toHaveBeenCalled();
      expect(mockProcessManager.savePidInfo).toHaveBeenCalledWith(
        1234,
        "daemon"
      );
    });

    it("should start daemon if not running", async () => {
      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: false,
      });

      await daemonManager.restartDaemon(mockServerFactory);

      expect(mockProcessManager.gracefulKillProcess).not.toHaveBeenCalled();
      expect(mockProcessManager.savePidInfo).toHaveBeenCalledWith(
        1234,
        "daemon"
      );
    });
  });

  describe("getDaemonStatus", () => {
    it("should delegate to process manager", () => {
      const expectedStatus = { running: true, pid: 1234, uptime: "1分钟" };
      (mockProcessManager.getServiceStatus as any).mockReturnValue(
        expectedStatus
      );

      const status = daemonManager.getDaemonStatus();

      expect(status).toEqual(expectedStatus);
      expect(mockProcessManager.getServiceStatus).toHaveBeenCalled();
    });
  });

  describe("attachToLogs", () => {
    it("should throw error if log file does not exist", async () => {
      const fs = await import("node:fs");
      (fs.default.existsSync as any).mockReturnValue(false);

      await expect(daemonManager.attachToLogs()).rejects.toThrow(ServiceError);
    });

    it("should attach to logs successfully", async () => {
      const fs = await import("node:fs");
      const { spawn } = await import("node:child_process");

      (fs.default.existsSync as any).mockReturnValue(true);

      await daemonManager.attachToLogs();

      expect(spawn).toHaveBeenCalledWith("tail", ["-f", "/logs/xiaozhi.log"], {
        stdio: "inherit",
      });
    });
  });

  describe("checkHealth", () => {
    it("should return false if daemon is not running", async () => {
      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: false,
      });

      const isHealthy = await daemonManager.checkHealth();

      expect(isHealthy).toBe(false);
    });

    it("should return true if daemon is healthy", async () => {
      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: true,
        pid: 1234,
      });
      (mockProcessManager.getProcessInfo as any).mockReturnValue({
        exists: true,
        isXiaozhi: true,
      });

      const isHealthy = await daemonManager.checkHealth();

      expect(isHealthy).toBe(true);
    });

    it("should return false if process is not xiaozhi", async () => {
      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: true,
        pid: 1234,
      });
      (mockProcessManager.getProcessInfo as any).mockReturnValue({
        exists: true,
        isXiaozhi: false,
      });

      const isHealthy = await daemonManager.checkHealth();

      expect(isHealthy).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("should cleanup current daemon", async () => {
      // Start a daemon first
      await daemonManager.startDaemon(mockServerFactory);

      daemonManager.cleanup();

      expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");
      expect(daemonManager.getCurrentDaemon()).toBeNull();
    });

    it("should handle cleanup errors gracefully", async () => {
      await daemonManager.startDaemon(mockServerFactory);
      mockChild.kill.mockImplementation(() => {
        throw new Error("Kill failed");
      });

      expect(() => daemonManager.cleanup()).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should do nothing if no current daemon", () => {
      expect(() => daemonManager.cleanup()).not.toThrow();
      expect(mockChild.kill).not.toHaveBeenCalled();
    });
  });

  describe("getCurrentDaemon", () => {
    it("should return null initially", () => {
      expect(daemonManager.getCurrentDaemon()).toBeNull();
    });

    it("should return current daemon after start", async () => {
      await daemonManager.startDaemon(mockServerFactory);
      expect(daemonManager.getCurrentDaemon()).toBe(mockChild);
    });
  });
});
