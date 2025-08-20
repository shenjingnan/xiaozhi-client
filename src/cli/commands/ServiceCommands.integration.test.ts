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

describe("服务命令集成测试", () => {
  let serviceCommandHandler: ServiceCommandHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    serviceCommandHandler = new ServiceCommandHandler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("带 daemon 选项的 start 命令", () => {
    it("应正确执行带 daemon 选项的 start 命令", async () => {
      const options = {
        daemon: true,
        port: "3000",
        ui: false,
      };

      await serviceCommandHandler.execute([], options);

      expect(mockServiceManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          daemon: true,
          port: 3000,
          ui: false,
        })
      );
    });

    it("应执行带 daemon 和 ui 选项的 start 命令", async () => {
      const options = {
        daemon: true,
        ui: true,
        port: "8080",
      };

      await serviceCommandHandler.execute([], options);

      expect(mockServiceManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          daemon: true,
          ui: true,
          port: 8080,
        })
      );
    });

    it("应处理短格式的 daemon 选项 (-d)", async () => {
      const options = {
        d: true, // short form
        port: "3000",
      };

      await serviceCommandHandler.execute([], options);

      expect(mockServiceManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          daemon: true,
          port: 3000,
        })
      );
    });

    it("应处理缺失 daemon 选项的情况（前台模式）", async () => {
      const options = {
        port: "3000",
        ui: true,
      };

      await serviceCommandHandler.execute([], options);

      expect(mockServiceManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          daemon: false,
          port: 3000,
          ui: true,
        })
      );
    });
  });

  describe("status 命令", () => {
    it("应正确执行 status 命令", async () => {
      const mockStatus = {
        isRunning: true,
        pid: 12345,
        mode: "daemon",
        uptime: "2h 30m",
        port: 3000,
      };

      mockServiceManager.getStatus.mockResolvedValue(mockStatus);

      await serviceCommandHandler.execute(["status"], {});

      expect(mockServiceManager.getStatus).toHaveBeenCalled();
    });

    it("应处理服务未运行时的 status 命令", async () => {
      const mockStatus = {
        isRunning: false,
        pid: null,
        mode: null,
        uptime: null,
        port: null,
      };

      mockServiceManager.getStatus.mockResolvedValue(mockStatus);

      await serviceCommandHandler.execute(["status"], {});

      expect(mockServiceManager.getStatus).toHaveBeenCalled();
    });
  });

  describe("stop 命令", () => {
    it("应正确执行 stop 命令", async () => {
      mockServiceManager.stop.mockResolvedValue(undefined);

      await serviceCommandHandler.execute(["stop"], {});

      expect(mockServiceManager.stop).toHaveBeenCalled();
    });

    it("应处理服务未运行时的 stop 命令", async () => {
      mockServiceManager.stop.mockRejectedValue(
        new Error("Service is not running")
      );

      await expect(serviceCommandHandler.execute(["stop"], {})).rejects.toThrow(
        "Service is not running"
      );
    });
  });

  describe("restart 命令", () => {
    it("应执行带 daemon 选项的 restart 命令", async () => {
      const options = {
        daemon: true,
        port: "3000",
      };

      mockServiceManager.restart.mockResolvedValue(undefined);

      await serviceCommandHandler.execute(["restart"], options);

      expect(mockServiceManager.restart).toHaveBeenCalledWith(
        expect.objectContaining({
          daemon: true,
          port: 3000,
        })
      );
    });

    it("应执行不带 daemon 选项的 restart 命令", async () => {
      const options = {
        port: "3000",
        ui: true,
      };

      mockServiceManager.restart.mockResolvedValue(undefined);

      await serviceCommandHandler.execute(["restart"], options);

      expect(mockServiceManager.restart).toHaveBeenCalledWith(
        expect.objectContaining({
          daemon: false,
          port: 3000,
          ui: true,
        })
      );
    });
  });

  describe("attach 命令", () => {
    it("应正确执行 attach 命令", async () => {
      mockServiceManager.attach.mockResolvedValue(undefined);

      await serviceCommandHandler.execute(["attach"], {});

      expect(mockServiceManager.attach).toHaveBeenCalled();
    });

    it("应处理服务未运行时的 attach 命令", async () => {
      mockServiceManager.attach.mockRejectedValue(
        new Error("No service running to attach to")
      );

      await expect(
        serviceCommandHandler.execute(["attach"], {})
      ).rejects.toThrow("No service running to attach to");
    });
  });

  describe("选项解析和验证", () => {
    it("应处理数字端口转换", async () => {
      const options = {
        daemon: true,
        port: "8080",
      };

      await serviceCommandHandler.execute([], options);

      expect(mockServiceManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 8080, // Should be converted to number
        })
      );
    });

    it("应处理无效的端口值", async () => {
      const options = {
        daemon: true,
        port: "invalid",
      };

      // Assuming the handler validates port values
      await expect(
        serviceCommandHandler.execute([], options)
      ).rejects.toThrow();
    });

    it("应处理布尔选项的各种变体", async () => {
      const testCases = [
        { daemon: true, expected: true },
        { daemon: false, expected: false },
        { daemon: "true", expected: true },
        { daemon: "false", expected: false },
        { d: true, expected: true },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        await serviceCommandHandler.execute([], testCase);

        expect(mockServiceManager.start).toHaveBeenCalledWith(
          expect.objectContaining({
            daemon: testCase.expected,
          })
        );
      }
    });
  });

  describe("错误处理", () => {
    it("应优雅地处理服务管理器错误", async () => {
      const error = new Error("Service manager error");
      mockServiceManager.start.mockRejectedValue(error);

      await expect(
        serviceCommandHandler.execute([], { daemon: true })
      ).rejects.toThrow("Service manager error");
    });

    it("应处理未知命令", async () => {
      await expect(
        serviceCommandHandler.execute(["unknown"], {})
      ).rejects.toThrow();
    });

    it("应处理缺失的必需选项", async () => {
      // Test cases where certain options might be required
      await expect(
        serviceCommandHandler.execute(["start"], {})
      ).resolves.not.toThrow();
    });
  });
});
