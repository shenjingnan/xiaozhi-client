/**
 * 服务管理服务单元测试
 */

import consola from "consola";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigError, ServiceError } from "../../errors/index.js";
import type {
  ProcessManager,
  ServiceStartOptions,
} from "../../interfaces/Service.js";
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

    // 设置默认 mock 返回值
    mockConfigManager.configExists.mockReturnValue(true);
    mockConfigManager.getConfig.mockReturnValue({ webServer: { port: 9999 } });
    (mockProcessManager.getServiceStatus as any).mockReturnValue({
      running: false,
    });
    (mockProcessManager.gracefulKillProcess as any).mockResolvedValue(
      undefined
    );

    // 默认 WebServerLauncher 文件存在（daemon 模式需要）
    const fs = await import("node:fs");
    vi.mocked(fs.default.existsSync).mockReturnValue(true);

    // 默认 spawn 返回有效的子进程对象（daemon 模式需要）
    const { spawn } = await import("node:child_process");
    vi.mocked(spawn).mockReturnValue({
      pid: 1234,
      stdout: { pipe: vi.fn() },
      stderr: { pipe: vi.fn() },
      on: vi.fn(),
      unref: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockProcessExit.mockClear();
  });

  /** 获取 spawn mock 的便捷方法 */
  async function getMockSpawn() {
    const { spawn } = await import("node:child_process");
    return vi.mocked(spawn);
  }

  describe("start 启动服务", () => {
    const defaultOptions: ServiceStartOptions = {
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

      // start 现在走 daemon 路径会触发 process.exit
      await expect(serviceManager.start(defaultOptions)).rejects.toThrow(
        /process\.exit/
      );

      // 验证调用了停止进程的方法
      expect(mockProcessManager.gracefulKillProcess).toHaveBeenCalledWith(1234);
      expect(mockProcessManager.cleanupPidFile).toHaveBeenCalled();

      // 验证最终启动了守护进程（通过 spawn 调用验证）
      const mockSpawn = await getMockSpawn();
      expect(mockSpawn).toHaveBeenCalled();
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

      // Mock consola.warn 来验证警告信息
      const mockConsolaWarn = vi
        .spyOn(consola, "warn")
        .mockImplementation(() => {});

      // start 现在走 daemon 路径会触发 process.exit
      await expect(serviceManager.start(defaultOptions)).rejects.toThrow(
        /process\.exit/
      );

      // 验证调用了停止进程的方法
      expect(mockProcessManager.gracefulKillProcess).toHaveBeenCalledWith(1234);

      // 验证输出了警告信息
      expect(mockConsolaWarn).toHaveBeenCalledWith(
        "停止现有服务时出现警告: 无法停止进程"
      );

      // 验证最终仍然启动了守护进程
      const mockSpawn = await getMockSpawn();
      expect(mockSpawn).toHaveBeenCalled();

      mockConsolaWarn.mockRestore();
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
      // start 会因 process.exit 抛出异常，需要 expect 包装
      await expect(serviceManager.start(defaultOptions)).rejects.toThrow(
        /process\.exit/
      );

      expect(mockProcessManager.cleanupContainerState).toHaveBeenCalled();
    });

    it("默认应以守护进程方式启动 WebServer 并退出父进程", async () => {
      // Ensure file exists
      const fs = await import("node:fs");
      vi.mocked(fs.default.existsSync).mockReturnValue(true);

      const mockSpawn = await getMockSpawn();
      const mockChild = {
        pid: 1234,
        unref: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockChild as any);

      // 测试默认启动（始终使用 daemon 模式）
      await expect(serviceManager.start(defaultOptions)).rejects.toThrow(
        /process\.exit/
      );

      // 验证子进程正确启动（使用 WebServerLauncher）
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

      // 验证 PID 信息保存为 daemon 模式
      expect(mockProcessManager.savePidInfo).toHaveBeenCalledWith(
        1234,
        "daemon"
      );

      // 验证子进程分离
      expect(mockChild.unref).toHaveBeenCalled();
    });

    it("应以守护进程方式启动 MCP Server 并退出父进程", async () => {
      // Ensure file exists
      const fs = await import("node:fs");
      vi.mocked(fs.default.existsSync).mockReturnValue(true);

      const mockSpawn = await getMockSpawn();
      const mockChild = {
        pid: 5678,
        unref: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const mcpOptions: ServiceStartOptions = {
        ...defaultOptions,
        mode: "mcp-server",
        port: 3000,
      };

      await expect(serviceManager.start(mcpOptions)).rejects.toThrow(
        /process\.exit/
      );

      // MCP Server 模式也使用守护进程方式，通过 CLI 脚本启动
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
    });

    it("如果 WebServer 文件不存在应抛出错误", async () => {
      const fs = await import("node:fs");
      vi.mocked(fs.default.existsSync).mockReturnValue(false);

      await expect(serviceManager.start(defaultOptions)).rejects.toThrow(
        /WebServer 文件不存在/
      );
    });

    it("应优雅地处理 spawn 错误", async () => {
      // Ensure file exists first
      const fs = await import("node:fs");
      vi.mocked(fs.default.existsSync).mockReturnValue(true);

      const mockSpawn = await getMockSpawn();

      mockSpawn.mockImplementation(() => {
        throw new Error("Failed to spawn process");
      });

      await expect(serviceManager.start(defaultOptions)).rejects.toThrow(
        "Failed to spawn process"
      );
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it("应处理没有 PID 的子进程", async () => {
      // Ensure file exists
      const fs = await import("node:fs");
      vi.mocked(fs.default.existsSync).mockReturnValue(true);

      const mockSpawn = await getMockSpawn();
      const mockChild = {
        pid: undefined,
        unref: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockChild as any);

      // spawn 返回 undefined PID 时应抛出错误而非报告启动成功
      await expect(serviceManager.start(defaultOptions)).rejects.toThrow(
        /无法创建守护进程/
      );
      // 不应保存无效的 PID 信息
      expect(mockProcessManager.savePidInfo).not.toHaveBeenCalled();
    });

    it("应传递正确的环境变量", async () => {
      // Ensure file exists
      const fs = await import("node:fs");
      vi.mocked(fs.default.existsSync).mockReturnValue(true);

      const mockSpawn = await getMockSpawn();
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

      await expect(serviceManager.start(defaultOptions)).rejects.toThrow(
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

    it("stdio 模式应走 normal 启动路径（废弃兼容）", async () => {
      const fs = await import("node:fs");
      vi.mocked(fs.default.existsSync).mockReturnValue(true);

      const mockSpawn = await getMockSpawn();
      const mockChild = { pid: 3456, unref: vi.fn() };
      mockSpawn.mockReturnValue(mockChild as any);

      const stdioOptions: ServiceStartOptions = {
        ...defaultOptions,
        mode: "stdio",
      };

      // stdio 模式内部调用 startNormalMode，最终走 daemon 路径
      await expect(serviceManager.start(stdioOptions)).rejects.toThrow(
        /process\.exit/
      );

      // 验证使用了 WebServerLauncher（而非 MCP Server 路径）
      expect(mockSpawn).toHaveBeenCalledWith(
        "node",
        ["/mock/path/WebServerLauncher.js"],
        expect.not.objectContaining({
          env: expect.objectContaining({ MCP_SERVER_MODE: "true" }),
        })
      );
    });

    it("未设置 mode 时应回退到 normal 启动路径（default 分支）", async () => {
      const fs = await import("node:fs");
      vi.mocked(fs.default.existsSync).mockReturnValue(true);

      const mockSpawn = await getMockSpawn();
      const mockChild = { pid: 7890, unref: vi.fn() };
      mockSpawn.mockReturnValue(mockChild as any);

      // 不设置 mode → undefined → 触发 switch default 分支
      const noModeOptions: ServiceStartOptions = {
        ui: false,
      };

      await expect(serviceManager.start(noModeOptions)).rejects.toThrow(
        /process\.exit/
      );

      expect(mockSpawn).toHaveBeenCalledWith(
        "node",
        ["/mock/path/WebServerLauncher.js"],
        expect.any(Object)
      );
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
    const restartOptions: ServiceStartOptions = { ui: false };

    /** 为 restart 测试设置 daemon 路径所需 mock */
    async function setupDaemonMocks() {
      const fs = await import("node:fs");
      vi.mocked(fs.default.existsSync).mockReturnValue(true);

      const { spawn } = await import("node:child_process");
      const mockSpawn = vi.mocked(spawn);
      mockSpawn.mockReturnValue({
        pid: 9999,
        unref: vi.fn(),
      } as any);
      return mockSpawn;
    }

    it("应停止并重启服务", async () => {
      const mockSpawn = await setupDaemonMocks();

      // Mock running service - restart() calls getStatus(), then stop() calls getStatus() again
      (mockProcessManager.getServiceStatus as any)
        .mockReturnValueOnce({ running: true, pid: 1234 }) // restart() check
        .mockReturnValueOnce({ running: true, pid: 1234 }) // stop() check
        .mockReturnValueOnce({ running: false }); // after stop

      // Mock gracefulKillProcess to resolve successfully
      (mockProcessManager.gracefulKillProcess as any).mockResolvedValue(
        undefined
      );

      // restart 内部调用 start，start 现在始终走 daemon 路径会触发 process.exit
      await expect(serviceManager.restart(restartOptions)).rejects.toThrow(
        /process\.exit/
      );

      expect(mockProcessManager.gracefulKillProcess).toHaveBeenCalledWith(1234);
      expect(mockProcessManager.cleanupPidFile).toHaveBeenCalled();

      // 验证启动了新的守护进程
      expect(mockSpawn).toHaveBeenCalled();
    });

    it("如果服务未运行应直接启动服务", async () => {
      const mockSpawn = await setupDaemonMocks();

      (mockProcessManager.getServiceStatus as any).mockReturnValue({
        running: false,
      });

      // start 始终走 daemon 路径会触发 process.exit
      await expect(serviceManager.restart(restartOptions)).rejects.toThrow(
        /process\.exit/
      );

      expect(mockProcessManager.gracefulKillProcess).not.toHaveBeenCalled();

      // 验证启动了守护进程
      expect(mockSpawn).toHaveBeenCalled();
    });

    it("应处理重启过程中的错误", async () => {
      // Mock running service
      (mockProcessManager.getServiceStatus as any)
        .mockReturnValueOnce({ running: true, pid: 1234 }) // restart() check
        .mockReturnValueOnce({ running: true, pid: 1234 }); // stop() check

      // Mock gracefulKillProcess to throw error (this will cause stop() to throw)
      const killError = new Error("无法停止进程");
      mockProcessManager.gracefulKillProcess = vi
        .fn()
        .mockRejectedValue(killError);

      await expect(serviceManager.restart(restartOptions)).rejects.toThrow(
        ServiceError
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
    it("如果配置不存在应抛出 ConfigError", async () => {
      mockConfigManager.configExists.mockReturnValue(false);

      await expect((serviceManager as any).checkEnvironment()).rejects.toThrow(
        ConfigError
      );
    });

    it("如果配置无效应抛出 ConfigError", async () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getConfig.mockReturnValue(null);

      await expect((serviceManager as any).checkEnvironment()).rejects.toThrow(
        ConfigError
      );
    });

    it("如果配置有效应通过", async () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getConfig.mockReturnValue({ valid: true });

      await expect(
        (serviceManager as any).checkEnvironment()
      ).resolves.not.toThrow();
    });

    it("应处理配置获取时的异常", async () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getConfig.mockImplementation(() => {
        throw new Error("配置解析失败");
      });

      await expect((serviceManager as any).checkEnvironment()).rejects.toThrow(
        ConfigError
      );
      await expect((serviceManager as any).checkEnvironment()).rejects.toThrow(
        "配置文件错误: 配置解析失败"
      );
    });

    it("应处理非 Error 类型的异常", async () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getConfig.mockImplementation(() => {
        throw "字符串错误";
      });

      await expect((serviceManager as any).checkEnvironment()).rejects.toThrow(
        ConfigError
      );
      await expect((serviceManager as any).checkEnvironment()).rejects.toThrow(
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
