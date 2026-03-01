import consola from "consola";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceStartOptions } from "../../interfaces/Service.js";
import { PathUtils } from "../../utils/PathUtils.js";
import { ServiceManagerImpl } from "../ServiceManager";

// Mock external dependencies
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    createWriteStream: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn(),
  createWriteStream: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("../../utils/PathUtils.js", () => ({
  PathUtils: {
    getWebServerLauncherPath: vi.fn(),
    getExecutablePath: vi.fn(),
    getConfigDir: vi.fn(),
    getLogFile: vi.fn(),
    getMcpServerProxyPath: vi.fn(),
  },
}));

// Mock process.exit
const mockProcessExit = vi.spyOn(process, "exit").mockImplementation((code) => {
  throw new Error(`process.exit unexpectedly called with "${code}"`);
});

// Mock consola.success
const mockConsolaSuccess = vi
  .spyOn(consola, "success")
  .mockImplementation(() => {});

describe("Daemon 模式集成测试", () => {
  let serviceManager: ServiceManagerImpl;
  let mockProcessManager: any;

  beforeEach(async () => {
    // Reset all mocks but preserve implementations
    mockProcessExit.mockClear();
    mockConsolaSuccess.mockClear();

    // Re-setup mock implementations
    mockProcessExit.mockImplementation((code) => {
      throw new Error(`process.exit unexpectedly called with "${code}"`);
    });
    mockConsolaSuccess.mockImplementation(() => {});

    // Setup PathUtils mocks
    vi.mocked(PathUtils.getWebServerLauncherPath).mockReturnValue(
      "/test/WebServerLauncher.js"
    );
    vi.mocked(PathUtils.getExecutablePath).mockImplementation(
      (name: string) => {
        return `/test/${name}.js`;
      }
    );
    vi.mocked(PathUtils.getConfigDir).mockReturnValue("/test/config");
    vi.mocked(PathUtils.getLogFile).mockReturnValue("/test/logs/xiaozhi.log");

    // Setup fs mocks
    const fs = await import("node:fs");
    vi.mocked(fs.default.existsSync).mockReturnValue(true);

    // Setup ProcessManager mock
    mockProcessManager = {
      savePidInfo: vi.fn(),
      cleanupPidFile: vi.fn(),
      isServiceRunning: vi.fn().mockReturnValue(false),
      getServiceStatus: vi.fn().mockReturnValue({ running: false }),
      stopService: vi.fn(),
      cleanupContainerState: vi.fn(),
      killProcess: vi.fn(),
      isXiaozhiProcess: vi.fn(),
      gracefulKillProcess: vi.fn(),
      processExists: vi.fn(),
      getProcessInfo: vi.fn(),
      validatePidFile: vi.fn(),
    };

    // Setup ConfigManager mock
    const mockConfigManager = {
      configExists: vi.fn().mockReturnValue(true),
      getConfig: vi.fn().mockReturnValue({ webServer: { port: 9999 } }),
    } as any;

    serviceManager = new ServiceManagerImpl(
      mockProcessManager,
      mockConfigManager
    );
  });

  afterEach(() => {
    // Don't restore mocks to preserve spy functionality
    // vi.restoreAllMocks();
  });

  describe("WebServer Daemon 模式", () => {
    it("应完成完整的 daemon 启动工作流程", async () => {
      const { spawn } = await import("node:child_process");
      const mockSpawn = vi.mocked(spawn);

      const mockChild = {
        pid: 12345,
        unref: vi.fn(),
        on: vi.fn(),
        stdout: null,
        stderr: {
          on: vi.fn(),
        },
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const options: ServiceStartOptions = {
        daemon: true,
        mode: "normal",
        port: 3000,
      };

      // Execute daemon start
      await expect(serviceManager.start(options)).rejects.toThrow(
        "process.exit unexpectedly called"
      );

      // Verify complete workflow
      expect(PathUtils.getWebServerLauncherPath).toHaveBeenCalled();
      expect(mockSpawn).toHaveBeenCalledWith(
        "node",
        ["/test/WebServerLauncher.js"],
        {
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: expect.objectContaining({
            XIAOZHI_CONFIG_DIR: "/test/config",
            XIAOZHI_DAEMON: "true",
          }),
        }
      );
      expect(mockProcessManager.savePidInfo).toHaveBeenCalledWith(
        12345,
        "daemon"
      );
      expect(mockChild.unref).toHaveBeenCalled();
      expect(mockConsolaSuccess).toHaveBeenCalledWith(
        "后台服务已启动 (PID: 12345)"
      );
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it("应处理默认 daemon 启动", async () => {
      const { spawn } = await import("node:child_process");
      const mockSpawn = vi.mocked(spawn);

      const mockChild = {
        pid: 12346,
        unref: vi.fn(),
        on: vi.fn(),
        stderr: {
          on: vi.fn(),
        },
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const options: ServiceStartOptions = {
        daemon: true,
        mode: "normal",
        port: 3000,
      };

      await expect(serviceManager.start(options)).rejects.toThrow(
        "process.exit unexpectedly called"
      );

      expect(mockSpawn).toHaveBeenCalledWith(
        "node",
        ["/test/WebServerLauncher.js"],
        {
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: expect.objectContaining({
            XIAOZHI_CONFIG_DIR: "/test/config",
            XIAOZHI_DAEMON: "true",
          }),
        }
      );
    });
  });

  describe("MCP Server Daemon 模式", () => {
    it("应完成完整的 MCP daemon 启动工作流程", async () => {
      // Re-setup consola.success mock for this specific test
      mockConsolaSuccess.mockClear();
      mockConsolaSuccess.mockImplementation(() => {});

      const { spawn } = await import("node:child_process");
      const mockSpawn = vi.mocked(spawn);

      const mockChild = {
        pid: 54321,
        unref: vi.fn(),
        on: vi.fn(),
        stderr: {
          on: vi.fn(),
        },
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const options: ServiceStartOptions = {
        daemon: true,
        mode: "mcp-server",
        port: 4000,
      };

      // Execute daemon start
      await expect(serviceManager.start(options)).rejects.toThrow(
        "process.exit unexpectedly called"
      );

      expect(mockSpawn).toHaveBeenCalledWith(
        "node",
        ["/test/cli.js", "start", "--server", "4000"],
        {
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: expect.objectContaining({
            XIAOZHI_CONFIG_DIR: "/test/config",
            XIAOZHI_DAEMON: "true",
            MCP_SERVER_MODE: "true",
          }),
        }
      );
      expect(mockProcessManager.savePidInfo).toHaveBeenCalledWith(
        54321,
        "daemon"
      );
      expect(mockChild.unref).toHaveBeenCalled();

      // Verify consola.success was called with the success message
      expect(mockConsolaSuccess).toHaveBeenCalledWith(
        "MCP Server 已在后台启动 (PID: 54321, Port: 4000)"
      );
    });
  });

  describe("错误处理", () => {
    it("应处理缺失的 WebServer 文件", async () => {
      const fs = await import("node:fs");
      vi.mocked(fs.default.existsSync).mockReturnValue(false);

      const options: ServiceStartOptions = {
        daemon: true,
        mode: "normal",
        port: 3000,
      };

      await expect(serviceManager.start(options)).rejects.toThrow(
        "WebServer 文件不存在: /test/WebServerLauncher.js"
      );

      // Should not attempt to spawn or exit
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it("应处理 spawn 错误", async () => {
      const { spawn } = await import("node:child_process");
      const mockSpawn = vi.mocked(spawn);

      mockSpawn.mockImplementation(() => {
        throw new Error("Spawn failed");
      });

      const options: ServiceStartOptions = {
        daemon: true,
        mode: "normal",
        port: 3000,
      };

      await expect(serviceManager.start(options)).rejects.toThrow(
        "Spawn failed"
      );
      expect(mockProcessExit).not.toHaveBeenCalled();
    });
  });

  describe("进程分离", () => {
    it("应确保完全的进程分离", async () => {
      const { spawn } = await import("node:child_process");
      const mockSpawn = vi.mocked(spawn);

      const mockChild = {
        pid: 99999,
        unref: vi.fn(),
        on: vi.fn(),
        stdout: { pipe: vi.fn() },
        stderr: {
          on: vi.fn(),
        },
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const options: ServiceStartOptions = {
        daemon: true,
        mode: "normal",
        port: 3000,
      };

      await expect(serviceManager.start(options)).rejects.toThrow(
        "process.exit unexpectedly called"
      );

      // Verify stdio is set to pipe for stdout and stderr (to capture errors)
      expect(mockChild.stderr.on).toHaveBeenCalled();

      // Verify process is detached and unreferenced
      const spawnCall = mockSpawn.mock.calls[0];
      expect(spawnCall[2]).toEqual(
        expect.objectContaining({
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
        })
      );
      expect(mockChild.unref).toHaveBeenCalled();

      // Note: process.exit is called but the test catches the error
      // The fact that we reach this point means the daemon setup worked correctly
    });
  });
});
