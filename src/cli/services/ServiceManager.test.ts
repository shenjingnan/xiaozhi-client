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

// Mock PathUtils
vi.mock("../utils/PathUtils.js", () => ({
  PathUtils: {
    getWebServerStandalonePath: vi
      .fn()
      .mockReturnValue("/mock/path/WebServerStandalone.js"),
    getExecutablePath: vi.fn().mockReturnValue("/mock/path/cli.js"),
    getConfigDir: vi.fn().mockReturnValue("/mock/config"),
    getMcpServerProxyPath: vi
      .fn()
      .mockReturnValue("/mock/path/mcpServerProxy.js"),
    getLogFile: vi.fn().mockReturnValue("/mock/logs/xiaozhi.log"),
  },
}));

// Mock fs
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    createWriteStream: vi.fn().mockReturnValue({
      write: vi.fn(),
    }),
  },
}));

// Mock process.exit
const mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

describe("ServiceManagerImpl", () => {
  let serviceManager: ServiceManagerImpl;

  beforeEach(async () => {
    serviceManager = new ServiceManagerImpl(
      mockProcessManager,
      mockConfigManager,
      mockLogger
    );

    // 重置所有 mock
    vi.clearAllMocks();
    mockProcessExit.mockClear();

    // Reset PathUtils mocks
    const { PathUtils } = await import("../utils/PathUtils.js");
    vi.mocked(PathUtils.getWebServerStandalonePath).mockReturnValue(
      "/mock/path/WebServerStandalone.js"
    );
    vi.mocked(PathUtils.getExecutablePath).mockReturnValue("/mock/path/cli.js");
    vi.mocked(PathUtils.getConfigDir).mockReturnValue("/mock/config");
    vi.mocked(PathUtils.getMcpServerProxyPath).mockReturnValue(
      "/mock/path/mcpServerProxy.js"
    );
    vi.mocked(PathUtils.getLogFile).mockReturnValue("/mock/logs/xiaozhi.log");

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
    mockProcessExit.mockClear();
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

    describe("daemon mode", () => {
      it("should start WebServer in daemon mode and exit parent process", async () => {
        // Ensure file exists
        const fs = await import("node:fs");
        vi.mocked(fs.default.existsSync).mockReturnValue(true);

        const { spawn } = await import("node:child_process");
        const mockSpawn = vi.mocked(spawn);
        const mockChild = {
          pid: 1234,
          unref: vi.fn(),
        };
        mockSpawn.mockReturnValue(mockChild as any);

        const daemonOptions: ServiceStartOptions = {
          ...defaultOptions,
          daemon: true,
        };

        // 测试 daemon 模式启动
        await expect(serviceManager.start(daemonOptions)).rejects.toThrow(
          /process\.exit/
        );

        // 验证子进程正确启动
        expect(mockSpawn).toHaveBeenCalledWith(
          "node",
          ["/mock/path/WebServerStandalone.js"],
          {
            detached: true,
            stdio: ["ignore", "ignore", "ignore"],
            env: expect.objectContaining({
              XIAOZHI_CONFIG_DIR: "/mock/config",
              XIAOZHI_DAEMON: "true",
            }),
          }
        );

        // 验证 PID 信息保存
        expect(mockProcessManager.savePidInfo).toHaveBeenCalledWith(
          1234,
          "daemon"
        );

        // 验证子进程分离
        expect(mockChild.unref).toHaveBeenCalled();

        // 验证父进程退出 (通过异常抛出验证)
        // mockProcessExit 在测试中抛出异常，所以不直接检查调用
      });

      it("should start WebServer in daemon mode with browser option", async () => {
        // Ensure file exists
        const fs = await import("node:fs");
        vi.mocked(fs.default.existsSync).mockReturnValue(true);

        const { spawn } = await import("node:child_process");
        const mockSpawn = vi.mocked(spawn);
        const mockChild = {
          pid: 1234,
          unref: vi.fn(),
        };
        mockSpawn.mockReturnValue(mockChild as any);

        const daemonOptions: ServiceStartOptions = {
          ...defaultOptions,
          daemon: true,
          ui: true,
        };

        await expect(serviceManager.start(daemonOptions)).rejects.toThrow(
          /process\.exit/
        );

        expect(mockSpawn).toHaveBeenCalledWith(
          "node",
          ["/mock/path/WebServerStandalone.js", "--open-browser"],
          {
            detached: true,
            stdio: ["ignore", "ignore", "ignore"],
            env: expect.objectContaining({
              XIAOZHI_CONFIG_DIR: "/mock/config",
              XIAOZHI_DAEMON: "true",
            }),
          }
        );
      });

      it("should start MCP Server in daemon mode and exit parent process", async () => {
        // Ensure file exists
        const fs = await import("node:fs");
        vi.mocked(fs.default.existsSync).mockReturnValue(true);

        const { spawn } = await import("node:child_process");
        const mockSpawn = vi.mocked(spawn);
        const mockChild = {
          pid: 5678,
          unref: vi.fn(),
        };
        mockSpawn.mockReturnValue(mockChild as any);

        const mcpDaemonOptions: ServiceStartOptions = {
          ...defaultOptions,
          daemon: true,
          mode: "mcp-server",
          port: 3000,
        };

        await expect(serviceManager.start(mcpDaemonOptions)).rejects.toThrow(
          /process\.exit/
        );

        expect(mockSpawn).toHaveBeenCalledWith(
          "node",
          ["/mock/path/cli.js", "start", "--server", "3000"],
          {
            detached: true,
            stdio: ["ignore", "ignore", "ignore"],
            env: expect.objectContaining({
              XIAOZHI_CONFIG_DIR: "/mock/config",
              XIAOZHI_DAEMON: "true",
              MCP_SERVER_MODE: "true",
            }),
          }
        );

        expect(mockProcessManager.savePidInfo).toHaveBeenCalledWith(
          5678,
          "daemon"
        );
        expect(mockChild.unref).toHaveBeenCalled();
        // 验证父进程退出 (通过异常抛出验证)
        // mockProcessExit 在测试中抛出异常，所以不直接检查调用
      });

      it("should throw error if WebServer file does not exist", async () => {
        const fs = await import("node:fs");
        vi.mocked(fs.default.existsSync).mockReturnValue(false);

        const daemonOptions: ServiceStartOptions = {
          ...defaultOptions,
          daemon: true,
        };

        await expect(serviceManager.start(daemonOptions)).rejects.toThrow(
          /WebServer 文件不存在/
        );
      });

      it("should handle spawn errors gracefully", async () => {
        // Ensure file exists first
        const fs = await import("node:fs");
        vi.mocked(fs.default.existsSync).mockReturnValue(true);

        const { spawn } = await import("node:child_process");
        const mockSpawn = vi.mocked(spawn);

        mockSpawn.mockImplementation(() => {
          throw new Error("Failed to spawn process");
        });

        const daemonOptions: ServiceStartOptions = {
          ...defaultOptions,
          daemon: true,
        };

        await expect(serviceManager.start(daemonOptions)).rejects.toThrow(
          "Failed to spawn process"
        );
        expect(mockProcessExit).not.toHaveBeenCalled();
      });

      it("should handle child process without PID", async () => {
        // Ensure file exists
        const fs = await import("node:fs");
        vi.mocked(fs.default.existsSync).mockReturnValue(true);

        const { spawn } = await import("node:child_process");
        const mockSpawn = vi.mocked(spawn);
        const mockChild = {
          pid: undefined,
          unref: vi.fn(),
        };
        mockSpawn.mockReturnValue(mockChild as any);

        const daemonOptions: ServiceStartOptions = {
          ...defaultOptions,
          daemon: true,
        };

        // Should handle undefined PID gracefully
        await expect(serviceManager.start(daemonOptions)).rejects.toThrow(
          /process\.exit/
        );
        expect(mockProcessManager.savePidInfo).toHaveBeenCalledWith(
          undefined,
          "daemon"
        );
      });

      it("should pass correct environment variables", async () => {
        // Ensure file exists
        const fs = await import("node:fs");
        vi.mocked(fs.default.existsSync).mockReturnValue(true);

        const { spawn } = await import("node:child_process");
        const mockSpawn = vi.mocked(spawn);
        const mockChild = {
          pid: 1234,
          unref: vi.fn(),
        };
        mockSpawn.mockReturnValue(mockChild as any);

        // Set some existing environment variables
        const originalEnv = process.env;
        process.env = {
          ...originalEnv,
          EXISTING_VAR: "existing_value",
          PATH: "/usr/bin:/bin",
        };

        const daemonOptions: ServiceStartOptions = {
          ...defaultOptions,
          daemon: true,
        };

        await expect(serviceManager.start(daemonOptions)).rejects.toThrow(
          /process\.exit/
        );

        const spawnCall = mockSpawn.mock.calls[0];
        expect(spawnCall[2]?.env).toEqual(
          expect.objectContaining({
            EXISTING_VAR: "existing_value",
            PATH: "/usr/bin:/bin",
            XIAOZHI_CONFIG_DIR: "/mock/config",
            XIAOZHI_DAEMON: "true",
          })
        );

        // Restore original environment
        process.env = originalEnv;
      });
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
