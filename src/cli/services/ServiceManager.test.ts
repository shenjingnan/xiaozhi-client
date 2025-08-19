/**
 * 服务管理服务单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigError, ServiceError } from "../errors/index.js";
import type {
  ProcessManager,
  ServiceStartOptions,
} from "../interfaces/Service.js";
import { ServiceManagerImpl } from "./ServiceManager.js";

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

const mockConfigManager = {
  configExists: vi.fn(),
  getConfig: vi.fn(),
};

const mockLogger = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
};

const mockWebServerInstance = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
};

const mockMCPServerInstance = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../../WebServer.js", () => ({
  WebServer: vi.fn().mockImplementation(() => mockWebServerInstance),
}));

// Mock dynamic imports
vi.mock("node:child_process", () => ({
  spawn: vi.fn().mockReturnValue({
    pid: 1234,
    stdout: { pipe: vi.fn() },
    stderr: { pipe: vi.fn() },
    on: vi.fn(),
    unref: vi.fn(),
  }),
}));

vi.mock("../../services/MCPServer.js", () => ({
  MCPServer: vi.fn().mockImplementation(() => mockMCPServerInstance),
}));

describe("ServiceManagerImpl", () => {
  let serviceManager: ServiceManagerImpl;

  beforeEach(() => {
    serviceManager = new ServiceManagerImpl(
      mockProcessManager,
      mockConfigManager,
      mockLogger
    );

    // 重置所有 mock
    vi.clearAllMocks();

    // 重置 mock 实例
    mockWebServerInstance.start.mockClear();
    mockWebServerInstance.stop.mockClear();
    mockMCPServerInstance.start.mockClear();
    mockMCPServerInstance.stop.mockClear();

    // 设置默认 mock 返回值
    mockConfigManager.configExists.mockReturnValue(true);
    mockConfigManager.getConfig.mockReturnValue({ webServer: { port: 9999 } });
    (mockProcessManager.getServiceStatus as any).mockReturnValue({
      running: false,
    });
    (mockProcessManager.gracefulKillProcess as any).mockResolvedValue(
      undefined
    );

    // Mock dynamic import for WebServer
    vi.doMock("../../WebServer.js", () => ({
      WebServer: vi.fn().mockImplementation(() => mockWebServerInstance),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("start", () => {
    const defaultOptions: ServiceStartOptions = {
      daemon: false,
      ui: false,
      mode: "normal",
    };

    it("should throw error if service is already running", async () => {
      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: true,
        pid: 1234,
      });

      await expect(serviceManager.start(defaultOptions)).rejects.toThrow(
        ServiceError
      );
    });

    it("should throw error if config does not exist", async () => {
      mockConfigManager.configExists.mockReturnValue(false);

      await expect(serviceManager.start(defaultOptions)).rejects.toThrow(
        ServiceError
      );
    });

    it("should validate port option", async () => {
      const invalidOptions: ServiceStartOptions = {
        ...defaultOptions,
        port: 99999, // Invalid port
      };

      await expect(serviceManager.start(invalidOptions)).rejects.toThrow();
    });

    it("should validate mode option", async () => {
      const invalidOptions: ServiceStartOptions = {
        ...defaultOptions,
        mode: "invalid" as any,
      };

      await expect(serviceManager.start(invalidOptions)).rejects.toThrow(
        ServiceError
      );
    });

    it("should cleanup container state before starting", async () => {
      await serviceManager.start(defaultOptions);

      expect(mockProcessManager.cleanupContainerState).toHaveBeenCalled();
    });

    it("should start in normal mode by default", async () => {
      await serviceManager.start(defaultOptions);

      expect(mockWebServerInstance.start).toHaveBeenCalled();
      expect(mockProcessManager.savePidInfo).toHaveBeenCalledWith(
        process.pid,
        "foreground"
      );
    });

    it("should start in MCP server mode", async () => {
      const mcpOptions: ServiceStartOptions = {
        ...defaultOptions,
        mode: "mcp-server",
        port: 3000,
      };

      await serviceManager.start(mcpOptions);

      expect(mockMCPServerInstance.start).toHaveBeenCalled();
    });

    it("should handle stdio mode", async () => {
      const { spawn } = await import("node:child_process");
      const mockSpawn = vi.mocked(spawn);
      mockSpawn.mockReturnValue({
        pid: 1234,
      } as any);

      const stdioOptions: ServiceStartOptions = {
        ...defaultOptions,
        mode: "stdio",
      };

      await serviceManager.start(stdioOptions);

      expect(mockSpawn).toHaveBeenCalled();
      expect(mockProcessManager.savePidInfo).toHaveBeenCalledWith(
        1234,
        "foreground"
      );
    });
  });

  describe("stop", () => {
    it("should throw error if service is not running", async () => {
      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: false,
      });

      await expect(serviceManager.stop()).rejects.toThrow(ServiceError);
    });

    it("should gracefully kill process and cleanup PID file", async () => {
      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: true,
        pid: 1234,
      });

      await serviceManager.stop();

      expect(mockProcessManager.gracefulKillProcess).toHaveBeenCalledWith(1234);
      expect(mockProcessManager.cleanupPidFile).toHaveBeenCalled();
    });

    it("should handle kill process errors", async () => {
      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: true,
        pid: 1234,
      });
      (mockProcessManager.gracefulKillProcess as any).mockRejectedValue(
        new Error("Kill failed")
      );

      await expect(serviceManager.stop()).rejects.toThrow(ServiceError);
    });
  });

  describe("restart", () => {
    it("should stop and start service", async () => {
      const options: ServiceStartOptions = { daemon: false, ui: false };

      // Mock running service - restart() calls getStatus(), then stop() calls getStatus() again
      (mockProcessManager.getServiceStatus as any)
        .mockReturnValueOnce({ running: true, pid: 1234 }) // restart() check
        .mockReturnValueOnce({ running: true, pid: 1234 }) // stop() check
        .mockReturnValueOnce({ running: false }); // after stop

      // Mock gracefulKillProcess to resolve successfully
      (mockProcessManager.gracefulKillProcess as any).mockResolvedValue(
        undefined
      );

      await serviceManager.restart(options);

      expect(mockProcessManager.gracefulKillProcess).toHaveBeenCalledWith(1234);
      expect(mockProcessManager.cleanupPidFile).toHaveBeenCalled();
      expect(mockWebServerInstance.start).toHaveBeenCalled();
    });

    it("should start service if not running", async () => {
      const options: ServiceStartOptions = { daemon: false, ui: false };

      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: false,
      });

      await serviceManager.restart(options);

      expect(mockProcessManager.gracefulKillProcess).not.toHaveBeenCalled();
      expect(mockWebServerInstance.start).toHaveBeenCalled();
    });
  });

  describe("getStatus", () => {
    it("should delegate to process manager", () => {
      const expectedStatus = { running: true, pid: 1234, uptime: "1分钟" };
      (mockProcessManager.getServiceStatus as any).mockReturnValue(
        expectedStatus
      );

      const status = serviceManager.getStatus();

      expect(status).toEqual(expectedStatus);
      expect(mockProcessManager.getServiceStatus).toHaveBeenCalled();
    });
  });

  describe("checkEnvironment", () => {
    it("should throw ConfigError if config does not exist", () => {
      mockConfigManager.configExists.mockReturnValue(false);

      expect(() => (serviceManager as any).checkEnvironment()).toThrow(
        ConfigError
      );
    });

    it("should throw ConfigError if config is invalid", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getConfig.mockReturnValue(null);

      expect(() => (serviceManager as any).checkEnvironment()).toThrow(
        ConfigError
      );
    });

    it("should pass if config is valid", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getConfig.mockReturnValue({ valid: true });

      expect(() => (serviceManager as any).checkEnvironment()).not.toThrow();
    });
  });

  describe("validateStartOptions", () => {
    it("should validate port", () => {
      const invalidOptions = { port: 99999 };

      expect(() =>
        (serviceManager as any).validateStartOptions(invalidOptions)
      ).toThrow();
    });

    it("should validate mode", () => {
      const invalidOptions = { mode: "invalid" };

      expect(() =>
        (serviceManager as any).validateStartOptions(invalidOptions)
      ).toThrow(ServiceError);
    });

    it("should pass valid options", () => {
      const validOptions = { port: 3000, mode: "normal" };

      expect(() =>
        (serviceManager as any).validateStartOptions(validOptions)
      ).not.toThrow();
    });
  });
});
