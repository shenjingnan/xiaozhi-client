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

describe("Service Commands Integration Tests", () => {
  let serviceCommandHandler: ServiceCommandHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    serviceCommandHandler = new ServiceCommandHandler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("start command with daemon option", () => {
    it("should execute start command with daemon option correctly", async () => {
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

    it("should execute start command with daemon and ui options", async () => {
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

    it("should handle short form daemon option (-d)", async () => {
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

    it("should handle missing daemon option (foreground mode)", async () => {
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

  describe("status command", () => {
    it("should execute status command correctly", async () => {
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

    it("should handle status command when service is not running", async () => {
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

  describe("stop command", () => {
    it("should execute stop command correctly", async () => {
      mockServiceManager.stop.mockResolvedValue(undefined);

      await serviceCommandHandler.execute(["stop"], {});

      expect(mockServiceManager.stop).toHaveBeenCalled();
    });

    it("should handle stop command when service is not running", async () => {
      mockServiceManager.stop.mockRejectedValue(
        new Error("Service is not running")
      );

      await expect(serviceCommandHandler.execute(["stop"], {})).rejects.toThrow(
        "Service is not running"
      );
    });
  });

  describe("restart command", () => {
    it("should execute restart command with daemon option", async () => {
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

    it("should execute restart command without daemon option", async () => {
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

  describe("attach command", () => {
    it("should execute attach command correctly", async () => {
      mockServiceManager.attach.mockResolvedValue(undefined);

      await serviceCommandHandler.execute(["attach"], {});

      expect(mockServiceManager.attach).toHaveBeenCalled();
    });

    it("should handle attach command when service is not running", async () => {
      mockServiceManager.attach.mockRejectedValue(
        new Error("No service running to attach to")
      );

      await expect(
        serviceCommandHandler.execute(["attach"], {})
      ).rejects.toThrow("No service running to attach to");
    });
  });

  describe("option parsing and validation", () => {
    it("should handle numeric port conversion", async () => {
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

    it("should handle invalid port values", async () => {
      const options = {
        daemon: true,
        port: "invalid",
      };

      // Assuming the handler validates port values
      await expect(
        serviceCommandHandler.execute([], options)
      ).rejects.toThrow();
    });

    it("should handle boolean option variations", async () => {
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

  describe("error handling", () => {
    it("should handle service manager errors gracefully", async () => {
      const error = new Error("Service manager error");
      mockServiceManager.start.mockRejectedValue(error);

      await expect(
        serviceCommandHandler.execute([], { daemon: true })
      ).rejects.toThrow("Service manager error");
    });

    it("should handle unknown commands", async () => {
      await expect(
        serviceCommandHandler.execute(["unknown"], {})
      ).rejects.toThrow();
    });

    it("should handle missing required options", async () => {
      // Test cases where certain options might be required
      await expect(
        serviceCommandHandler.execute(["start"], {})
      ).resolves.not.toThrow();
    });
  });
});
