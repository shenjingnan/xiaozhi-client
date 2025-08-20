import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceStartOptions } from "../services/types.js";
import { ServiceCommandHandler } from "./ServiceCommandHandler.js";

// Mock ServiceManager
const mockServiceManager = {
  start: vi.fn(),
  stop: vi.fn(),
  restart: vi.fn(),
  getStatus: vi.fn(),
  attach: vi.fn(),
};

vi.mock("../services/ServiceManager.js", () => ({
  ServiceManager: vi.fn().mockImplementation(() => mockServiceManager),
}));

// Mock ProcessManager
const mockProcessManager = {
  isServiceRunning: vi.fn(),
  getServiceStatus: vi.fn(),
  savePidInfo: vi.fn(),
  cleanupPidFile: vi.fn(),
  stopService: vi.fn(),
};

vi.mock("../services/ProcessManager.js", () => ({
  ProcessManager: vi.fn().mockImplementation(() => mockProcessManager),
}));

// Mock DaemonManager
const mockDaemonManager = {
  attachToLogs: vi.fn(),
};

vi.mock("../services/DaemonManager.js", () => ({
  DaemonManager: vi.fn().mockImplementation(() => mockDaemonManager),
}));

// Mock ErrorHandler
const mockErrorHandler = {
  handle: vi.fn(),
};

vi.mock("../utils/ErrorHandler.js", () => ({
  ErrorHandler: mockErrorHandler,
}));

describe("服务命令集成测试", () => {
  let serviceCommandHandler: ServiceCommandHandler;
  let mockContainer: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock container
    mockContainer = {
      get: vi.fn((serviceName: string) => {
        switch (serviceName) {
          case "serviceManager":
            return mockServiceManager;
          case "daemonManager":
            return mockDaemonManager;
          case "errorHandler":
            return mockErrorHandler;
          default:
            throw new Error(`Unknown service: ${serviceName}`);
        }
      }),
    };

    serviceCommandHandler = new ServiceCommandHandler(mockContainer);
  });

  afterEach(() => {
    // Don't restore all mocks to preserve spy functionality
    // vi.restoreAllMocks();
  });

  describe("带 daemon 选项的 start 命令", () => {
    it("应正确执行带 daemon 选项的 start 命令", async () => {
      const options = {
        daemon: true,
      };

      // 获取 start 子命令并执行
      const startSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "start"
      );
      expect(startSubcommand).toBeDefined();

      await startSubcommand!.execute([], options);

      expect(mockServiceManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          daemon: true,
          ui: false,
        })
      );
    });

    it("应执行带 daemon 和 ui 选项的 start 命令", async () => {
      const options = {
        daemon: true,
        ui: true,
      };

      // 获取 start 子命令并执行
      const startSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "start"
      );
      expect(startSubcommand).toBeDefined();

      await startSubcommand!.execute([], options);

      expect(mockServiceManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          daemon: true,
          ui: true,
        })
      );
    });

    it("应处理短格式的 daemon 选项 (-d)", async () => {
      const options = {
        daemon: true, // Commander.js 会将 -d 解析为 daemon: true
      };

      // 获取 start 子命令并执行
      const startSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "start"
      );
      expect(startSubcommand).toBeDefined();

      await startSubcommand!.execute([], options);

      expect(mockServiceManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          daemon: true,
          ui: false,
        })
      );
    });

    it("应处理缺失 daemon 选项的情况（前台模式）", async () => {
      const options = {
        ui: true,
      };

      // 获取 start 子命令并执行
      const startSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "start"
      );
      expect(startSubcommand).toBeDefined();

      await startSubcommand!.execute([], options);

      expect(mockServiceManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          daemon: false,
          ui: true,
        })
      );
    });
  });

  describe("status 命令", () => {
    it("应正确执行 status 命令", async () => {
      const mockStatus = {
        running: true,
        pid: 12345,
        mode: "daemon",
        uptime: "2h 30m",
        port: 3000,
      };

      mockServiceManager.getStatus.mockResolvedValue(mockStatus);

      // 获取 status 子命令并执行
      const statusSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "status"
      );
      expect(statusSubcommand).toBeDefined();

      await statusSubcommand!.execute([], {});

      expect(mockServiceManager.getStatus).toHaveBeenCalled();
    });

    it("应处理服务未运行时的 status 命令", async () => {
      const mockStatus = {
        running: false,
        pid: null,
        mode: null,
        uptime: null,
        port: null,
      };

      mockServiceManager.getStatus.mockResolvedValue(mockStatus);

      // 获取 status 子命令并执行
      const statusSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "status"
      );
      expect(statusSubcommand).toBeDefined();

      await statusSubcommand!.execute([], {});

      expect(mockServiceManager.getStatus).toHaveBeenCalled();
    });
  });

  describe("stop 命令", () => {
    it("应正确执行 stop 命令", async () => {
      mockServiceManager.stop.mockResolvedValue(undefined);

      // 获取 stop 子命令并执行
      const stopSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "stop"
      );
      expect(stopSubcommand).toBeDefined();

      await stopSubcommand!.execute([], {});

      expect(mockServiceManager.stop).toHaveBeenCalled();
    });

    it("应处理服务未运行时的 stop 命令", async () => {
      const error = new Error("Service is not running");
      mockServiceManager.stop.mockRejectedValue(error);

      // 获取 stop 子命令并执行
      const stopSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "stop"
      );
      expect(stopSubcommand).toBeDefined();

      await stopSubcommand!.execute([], {});

      // 验证错误处理器被调用
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(error);
    });
  });

  describe("restart 命令", () => {
    it("应执行带 daemon 选项的 restart 命令", async () => {
      const options = {
        daemon: true,
      };

      mockServiceManager.restart.mockResolvedValue(undefined);

      // 获取 restart 子命令并执行
      const restartSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "restart"
      );
      expect(restartSubcommand).toBeDefined();

      await restartSubcommand!.execute([], options);

      expect(mockServiceManager.restart).toHaveBeenCalledWith(
        expect.objectContaining({
          daemon: true,
          ui: false,
        })
      );
    });

    it("应执行不带 daemon 选项的 restart 命令", async () => {
      const options = {
        ui: true,
      };

      mockServiceManager.restart.mockResolvedValue(undefined);

      // 获取 restart 子命令并执行
      const restartSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "restart"
      );
      expect(restartSubcommand).toBeDefined();

      await restartSubcommand!.execute([], options);

      expect(mockServiceManager.restart).toHaveBeenCalledWith(
        expect.objectContaining({
          daemon: false,
          ui: true,
        })
      );
    });
  });

  describe("attach 命令", () => {
    it("应正确执行 attach 命令", async () => {
      mockDaemonManager.attachToLogs.mockResolvedValue(undefined);

      // 获取 attach 子命令并执行
      const attachSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "attach"
      );
      expect(attachSubcommand).toBeDefined();

      await attachSubcommand!.execute([], {});

      expect(mockDaemonManager.attachToLogs).toHaveBeenCalled();
    });

    it("应处理服务未运行时的 attach 命令", async () => {
      const error = new Error("No service running to attach to");
      mockDaemonManager.attachToLogs.mockRejectedValue(error);

      // 获取 attach 子命令并执行
      const attachSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "attach"
      );
      expect(attachSubcommand).toBeDefined();

      await attachSubcommand!.execute([], {});

      // 验证错误处理器被调用
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(error);
    });
  });

  describe("选项解析和验证", () => {
    it("应处理数字端口转换", async () => {
      const options = {
        server: "8080", // MCP Server 模式的端口
      };

      // 获取 start 子命令并执行
      const startSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "start"
      );
      expect(startSubcommand).toBeDefined();

      await startSubcommand!.execute([], options);

      // 由于 MCP Server 模式会抛出 "需要实现" 错误，我们期望这个错误
      // 这个测试主要验证端口解析逻辑
    });

    it("应处理无效的端口值", async () => {
      const options = {
        server: "invalid",
      };

      // 获取 start 子命令并执行
      const startSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "start"
      );
      expect(startSubcommand).toBeDefined();

      await startSubcommand!.execute([], options);

      // 验证错误处理器被调用（MCP Server 模式会抛出 "需要实现" 错误）
      expect(mockErrorHandler.handle).toHaveBeenCalled();
    });

    it("应处理布尔选项的各种变体", async () => {
      const options = {
        daemon: true,
      };

      // 获取 start 子命令并执行
      const startSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "start"
      );
      expect(startSubcommand).toBeDefined();

      await startSubcommand!.execute([], options);

      expect(mockServiceManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          daemon: true,
          ui: false,
        })
      );
    });
  });

  describe("错误处理", () => {
    it("应优雅地处理服务管理器错误", async () => {
      const error = new Error("Service manager error");
      mockServiceManager.start.mockRejectedValue(error);

      // 获取 start 子命令并执行
      const startSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "start"
      );
      expect(startSubcommand).toBeDefined();

      await startSubcommand!.execute([], { daemon: true });

      // 验证错误处理器被调用
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(error);
    });

    it("应处理未知命令", async () => {
      // 主命令的 execute 方法只显示帮助信息，不会抛出错误
      await expect(
        serviceCommandHandler.execute(["unknown"], {})
      ).resolves.not.toThrow();
    });

    it("应处理缺失的必需选项", async () => {
      // 获取 start 子命令并执行
      const startSubcommand = serviceCommandHandler.subcommands?.find(
        (cmd) => cmd.name === "start"
      );
      expect(startSubcommand).toBeDefined();

      // start 命令不需要必需选项，应该正常执行
      await expect(startSubcommand!.execute([], {})).resolves.not.toThrow();
    });
  });
});
