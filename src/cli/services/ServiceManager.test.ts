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

describe("ServiceManagerImpl 服务管理器实现", () => {
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

  describe("start 启动服务", () => {
    const defaultOptions: ServiceStartOptions = {
      daemon: false,
      ui: false,
      mode: "normal",
    };

    it("如果服务已在运行应自动重启", async () => {
      // 第一次调用返回服务正在运行
      (mockProcessManager.getServiceStatus as any)
        .mockReturnValueOnce({
          running: true,
          pid: 1234,
        })
        // 第二次调用（停止后）返回服务未运行
        .mockReturnValueOnce({
          running: false,
        });

      // Mock gracefulKillProcess 方法
      mockProcessManager.gracefulKillProcess = vi
        .fn()
        .mockResolvedValue(undefined);
      mockProcessManager.cleanupPidFile = vi.fn();

      await serviceManager.start(defaultOptions);

      // 验证调用了停止进程的方法
      expect(mockProcessManager.gracefulKillProcess).toHaveBeenCalledWith(1234);
      expect(mockProcessManager.cleanupPidFile).toHaveBeenCalled();

      // 验证最终启动了服务
      expect(mockWebServerInstance.start).toHaveBeenCalled();
    });

    it("如果配置不存在应抛出错误", async () => {
      mockConfigManager.configExists.mockReturnValue(false);

      await expect(serviceManager.start(defaultOptions)).rejects.toThrow(
        ServiceError
      );
    });

    it("应验证端口选项", async () => {
      const invalidOptions: ServiceStartOptions = {
        ...defaultOptions,
        port: 99999, // Invalid port
      };

      await expect(serviceManager.start(invalidOptions)).rejects.toThrow();
    });

    it("应验证模式选项", async () => {
      const invalidOptions: ServiceStartOptions = {
        ...defaultOptions,
        mode: "invalid" as any,
      };

      await expect(serviceManager.start(invalidOptions)).rejects.toThrow(
        ServiceError
      );
    });

    it("启动前应清理容器状态", async () => {
      await serviceManager.start(defaultOptions);

      expect(mockProcessManager.cleanupContainerState).toHaveBeenCalled();
    });

    it("默认应以普通模式启动", async () => {
      await serviceManager.start(defaultOptions);

      expect(mockWebServerInstance.start).toHaveBeenCalled();
      expect(mockProcessManager.savePidInfo).toHaveBeenCalledWith(
        process.pid,
        "foreground"
      );
    });

    it("应以 MCP 服务器模式启动", async () => {
      const mcpOptions: ServiceStartOptions = {
        ...defaultOptions,
        mode: "mcp-server",
        port: 3000,
      };

      await serviceManager.start(mcpOptions);

      expect(mockMCPServerInstance.start).toHaveBeenCalled();
    });

    it("应处理 stdio 模式", async () => {
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

    describe("daemon 模式", () => {
      it("应以 daemon 模式启动 WebServer 并退出父进程", async () => {
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

      it("应以 daemon 模式启动 WebServer 并支持浏览器选项", async () => {
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

      it("应以 daemon 模式启动 MCP Server 并退出父进程", async () => {
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

      it("如果 WebServer 文件不存在应抛出错误", async () => {
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

      it("应优雅地处理 spawn 错误", async () => {
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

      it("应处理没有 PID 的子进程", async () => {
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

      it("应传递正确的环境变量", async () => {
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

  describe("stop 停止服务", () => {
    it("如果服务未运行应抛出错误", async () => {
      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: false,
      });

      await expect(serviceManager.stop()).rejects.toThrow(ServiceError);
    });

    it("应优雅地终止进程并清理 PID 文件", async () => {
      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: true,
        pid: 1234,
      });

      await serviceManager.stop();

      expect(mockProcessManager.gracefulKillProcess).toHaveBeenCalledWith(1234);
      expect(mockProcessManager.cleanupPidFile).toHaveBeenCalled();
    });

    it("应处理终止进程错误", async () => {
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

  describe("restart 重启服务", () => {
    it("应停止并启动服务", async () => {
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

    it("如果服务未运行应启动服务", async () => {
      const options: ServiceStartOptions = { daemon: false, ui: false };

      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: false,
      });

      await serviceManager.restart(options);

      expect(mockProcessManager.gracefulKillProcess).not.toHaveBeenCalled();
      expect(mockWebServerInstance.start).toHaveBeenCalled();
    });
  });

  describe("getStatus 获取状态", () => {
    it("应委托给进程管理器", () => {
      const expectedStatus = { running: true, pid: 1234, uptime: "1分钟" };
      (mockProcessManager.getServiceStatus as any).mockReturnValue(
        expectedStatus
      );

      const status = serviceManager.getStatus();

      expect(status).toEqual(expectedStatus);
      expect(mockProcessManager.getServiceStatus).toHaveBeenCalled();
    });
  });

  describe("checkEnvironment 检查环境", () => {
    it("如果配置不存在应抛出 ConfigError", () => {
      mockConfigManager.configExists.mockReturnValue(false);

      expect(() => (serviceManager as any).checkEnvironment()).toThrow(
        ConfigError
      );
    });

    it("如果配置无效应抛出 ConfigError", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getConfig.mockReturnValue(null);

      expect(() => (serviceManager as any).checkEnvironment()).toThrow(
        ConfigError
      );
    });

    it("如果配置有效应通过", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getConfig.mockReturnValue({ valid: true });

      expect(() => (serviceManager as any).checkEnvironment()).not.toThrow();
    });
  });

  describe("validateStartOptions 验证启动选项", () => {
    it("应验证端口", () => {
      const invalidOptions = { port: 99999 };

      expect(() =>
        (serviceManager as any).validateStartOptions(invalidOptions)
      ).toThrow();
    });

    it("应验证模式", () => {
      const invalidOptions = { mode: "invalid" };

      expect(() =>
        (serviceManager as any).validateStartOptions(invalidOptions)
      ).toThrow(ServiceError);
    });

    it("应通过有效选项", () => {
      const validOptions = { port: 3000, mode: "normal" };

      expect(() =>
        (serviceManager as any).validateStartOptions(validOptions)
      ).not.toThrow();
    });
  });
});
