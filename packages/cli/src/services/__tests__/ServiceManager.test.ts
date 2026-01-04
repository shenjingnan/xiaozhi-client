/**
 * 服务管理服务单元测试
 */

import { ConfigError, ServiceError } from "../../errors/index.js";
import type {
  ProcessManager,
  ServiceStartOptions,
} from "../../interfaces/Service.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceManagerImpl } from "../ServiceManager";

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
} as any;

const mockWebServerInstance = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
};

const mockMCPServerInstance = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@root/WebServer.js", () => ({
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
  exec: vi.fn().mockImplementation((cmd: string, callback: any) => {
    callback(null, { stdout: "", stderr: "" });
  }),
}));

vi.mock("@services/MCPServer.js", () => ({
  MCPServer: vi.fn().mockImplementation(() => mockMCPServerInstance),
}));

// Mock PathUtils
vi.mock("../../utils/PathUtils.js", () => ({
  PathUtils: {
    getWebServerLauncherPath: vi
      .fn()
      .mockReturnValue("/mock/path/WebServerLauncher.js"),
    getExecutablePath: vi.fn().mockReturnValue("/mock/path/cli.js"),
    getConfigDir: vi.fn().mockReturnValue("/mock/config"),
    getLogFile: vi.fn().mockReturnValue("/mock/logs/xiaozhi.log"),
  },
}));

// Mock ConfigManager for WebServer
vi.mock("@/lib/config/manager.js", () => {
  const mockConfig = {
    mcpEndpoint: "ws://localhost:3000",
    mcpServers: {},
    webServer: { port: 9999 },
  };
  const mockConfigManager = {
    configExists: vi.fn().mockReturnValue(true),
    getConfig: vi.fn().mockReturnValue(mockConfig),
    loadConfig: vi.fn().mockResolvedValue(mockConfig),
    getToolCallLogConfig: vi.fn().mockReturnValue({ enabled: false }),
    getMcpServers: vi.fn().mockReturnValue({}),
    getMcpEndpoint: vi.fn().mockReturnValue("ws://localhost:3000"),
    getConfigDir: vi.fn().mockReturnValue("/mock/config"),
  };
  return {
    configManager: mockConfigManager,
    ConfigManager: vi.fn().mockImplementation(() => mockConfigManager),
  };
});

// Mock fs
vi.mock("node:fs", () => {
  const mockExistsSync = vi.fn().mockReturnValue(true);
  const mockReadFileSync = vi.fn().mockReturnValue(
    JSON.stringify({
      mcpEndpoint: "ws://localhost:3000",
      mcpServers: {},
    })
  );
  return {
    default: {
      existsSync: mockExistsSync,
      readFileSync: mockReadFileSync,
      writeFileSync: vi.fn(),
      copyFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      readdirSync: vi.fn().mockReturnValue([]),
      statSync: vi
        .fn()
        .mockReturnValue({ isFile: () => true, isDirectory: () => false }),
      createWriteStream: vi.fn().mockReturnValue({
        write: vi.fn(),
      }),
    },
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: vi.fn(),
    copyFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
    statSync: vi
      .fn()
      .mockReturnValue({ isFile: () => true, isDirectory: () => false }),
    createWriteStream: vi.fn().mockReturnValue({
      write: vi.fn(),
    }),
    promises: {
      readFile: vi.fn().mockResolvedValue("mock content"),
      writeFile: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// Mock process.exit
const mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

describe("ServiceManagerImpl 服务管理器实现", () => {
  let serviceManager: ServiceManagerImpl;

  beforeEach(async () => {
    serviceManager = new ServiceManagerImpl(
      mockProcessManager,
      mockConfigManager
    );

    // 重置所有 mock
    vi.clearAllMocks();
    mockProcessExit.mockClear();

    // Reset PathUtils mocks
    const { PathUtils } = await import("../../utils/PathUtils.js");
    vi.mocked(PathUtils.getWebServerLauncherPath).mockReturnValue(
      "/mock/path/WebServerLauncher.js"
    );
    vi.mocked(PathUtils.getExecutablePath).mockReturnValue("/mock/path/cli.js");
    vi.mocked(PathUtils.getConfigDir).mockReturnValue("/mock/config");
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
    vi.doMock("@root/WebServer.js", () => ({
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

    it("如果停止现有服务失败应继续启动新服务", async () => {
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

      // Mock gracefulKillProcess 抛出错误
      const stopError = new Error("无法停止进程");
      mockProcessManager.gracefulKillProcess = vi
        .fn()
        .mockRejectedValue(stopError);
      mockProcessManager.cleanupPidFile = vi.fn();

      // Mock console.warn 来验证警告信息
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await serviceManager.start(defaultOptions);

      // 验证调用了停止进程的方法
      expect(mockProcessManager.gracefulKillProcess).toHaveBeenCalledWith(1234);
      // 注意：当 gracefulKillProcess 失败时，cleanupPidFile 不会在 catch 块中被调用
      // 这是当前实现的行为，所以我们不应该期望它被调用

      // 验证输出了警告信息
      expect(consoleSpy).toHaveBeenCalledWith(
        "停止现有服务时出现警告: 无法停止进程"
      );

      // 验证最终仍然启动了服务
      expect(mockWebServerInstance.start).toHaveBeenCalled();

      consoleSpy.mockRestore();
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

      expect(mockWebServerInstance.start).toHaveBeenCalled();
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
          ["/mock/path/WebServerLauncher.js"],
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

      it("应以 daemon 模式启动 WebServer", async () => {
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

        await expect(serviceManager.start(daemonOptions)).rejects.toThrow(
          /process\.exit/
        );

        expect(mockSpawn).toHaveBeenCalledWith(
          "node",
          ["/mock/path/WebServerLauncher.js"],
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
          0,
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

    it("应处理重启过程中的错误", async () => {
      const options: ServiceStartOptions = { daemon: false, ui: false };

      // Mock running service
      (mockProcessManager.getServiceStatus as any)
        .mockReturnValueOnce({ running: true, pid: 1234 }) // restart() check
        .mockReturnValueOnce({ running: true, pid: 1234 }); // stop() check

      // Mock gracefulKillProcess to throw error (this will cause stop() to throw)
      const killError = new Error("无法停止进程");
      mockProcessManager.gracefulKillProcess = vi
        .fn()
        .mockRejectedValue(killError);

      await expect(serviceManager.restart(options)).rejects.toThrow(
        ServiceError
      );
    });

    it("应处理启动过程中的错误", async () => {
      const options: ServiceStartOptions = { daemon: false, ui: false };

      // Mock service not running
      (mockProcessManager.getServiceStatus as any)
        .mockReturnValueOnce({ running: false }) // restart() check
        .mockReturnValueOnce({ running: false }); // start() check

      // Mock WebServer start to throw error
      const startError = new Error("启动失败");
      mockWebServerInstance.start.mockRejectedValue(startError);

      await expect(serviceManager.restart(options)).rejects.toThrow(
        ServiceError
      );
      await expect(serviceManager.restart(options)).rejects.toThrow(
        "重启服务失败: 服务启动失败: 启动失败"
      );
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

    it("应处理配置获取时的异常", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getConfig.mockImplementation(() => {
        throw new Error("配置解析失败");
      });

      expect(() => (serviceManager as any).checkEnvironment()).toThrow(
        ConfigError
      );
      expect(() => (serviceManager as any).checkEnvironment()).toThrow(
        "配置文件错误: 配置解析失败"
      );
    });

    it("应处理非 Error 类型的异常", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getConfig.mockImplementation(() => {
        throw "字符串错误";
      });

      expect(() => (serviceManager as any).checkEnvironment()).toThrow(
        ConfigError
      );
      expect(() => (serviceManager as any).checkEnvironment()).toThrow(
        "配置文件错误: 字符串错误"
      );
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
