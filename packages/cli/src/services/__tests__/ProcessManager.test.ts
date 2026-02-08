/**
 * 进程管理服务单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileUtils } from "../../utils/FileUtils.js";
import { PathUtils } from "../../utils/PathUtils.js";
import { PlatformUtils } from "../../utils/PlatformUtils.js";
import { ProcessManagerImpl } from "../ProcessManager";

// Mock 依赖
vi.mock("../../utils/FileUtils.js");
vi.mock("../../utils/PathUtils.js");
vi.mock("../../utils/PlatformUtils.js");

const mockFileUtils = vi.mocked(FileUtils);
const mockPathUtils = vi.mocked(PathUtils);
const mockPlatformUtils = vi.mocked(PlatformUtils);

describe("ProcessManagerImpl", () => {
  let processManager: ProcessManagerImpl;
  const mockPidFilePath = "/test/.xiaozhi-mcp-service.pid";

  beforeEach(() => {
    processManager = new ProcessManagerImpl();

    // 重置所有 mock
    vi.clearAllMocks();

    // 设置默认 mock 返回值
    mockPathUtils.getPidFile.mockReturnValue(mockPidFilePath);
    mockPlatformUtils.isXiaozhiProcess.mockReturnValue(true);
    mockPlatformUtils.processExists.mockReturnValue(true);
    mockPlatformUtils.isContainerEnvironment.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getServiceStatus", () => {
    it("should return not running when PID file does not exist", () => {
      mockFileUtils.exists.mockReturnValue(false);

      const status = processManager.getServiceStatus();

      expect(status.running).toBe(false);
      expect(status.pid).toBeUndefined();
      expect(status.uptime).toBeUndefined();
    });

    it("should return not running when PID file is corrupted", () => {
      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue("invalid-content");

      const status = processManager.getServiceStatus();

      expect(status.running).toBe(false);
      expect(mockFileUtils.deleteFile).toHaveBeenCalledWith(mockPidFilePath);
    });

    it("should return not running when process is not xiaozhi process", () => {
      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue("1234|1640000000000|daemon");
      mockPlatformUtils.isXiaozhiProcess.mockReturnValue(false);

      const status = processManager.getServiceStatus();

      expect(status.running).toBe(false);
      expect(mockFileUtils.deleteFile).toHaveBeenCalledWith(mockPidFilePath);
    });

    it("should return running status when process is valid", () => {
      const startTime = Date.now() - 60000; // 1 minute ago
      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue(`1234|${startTime}|daemon`);
      mockPlatformUtils.isXiaozhiProcess.mockReturnValue(true);

      const status = processManager.getServiceStatus();

      expect(status.running).toBe(true);
      expect(status.pid).toBe(1234);
      expect(status.mode).toBe("daemon");
      expect(status.uptime).toBeDefined();
    });

    it("should handle missing mode in PID file", () => {
      const startTime = Date.now() - 60000;
      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue(`1234|${startTime}`);
      mockPlatformUtils.isXiaozhiProcess.mockReturnValue(true);

      const status = processManager.getServiceStatus();

      expect(status.running).toBe(true);
      expect(status.mode).toBe("foreground");
    });
  });

  describe("savePidInfo", () => {
    it("should save PID info to file", () => {
      const pid = 1234;
      const mode = "daemon";

      processManager.savePidInfo(pid, mode);

      expect(mockFileUtils.writeFile).toHaveBeenCalledWith(
        mockPidFilePath,
        expect.stringMatching(/^1234\|\d+\|daemon$/),
        { overwrite: true }
      );
    });

    it("should throw error when file write fails", () => {
      mockFileUtils.writeFile.mockImplementation(() => {
        throw new Error("Write failed");
      });

      expect(() => processManager.savePidInfo(1234, "daemon")).toThrow();
    });
  });

  describe("killProcess", () => {
    it("should kill process successfully", async () => {
      mockPlatformUtils.killProcess.mockResolvedValue();

      await processManager.killProcess(1234);

      expect(mockPlatformUtils.killProcess).toHaveBeenCalledWith(1234);
    });

    it("should throw ProcessError when kill fails", async () => {
      mockPlatformUtils.killProcess.mockRejectedValue(new Error("Kill failed"));

      await expect(processManager.killProcess(1234)).rejects.toThrow(
        "无法终止进程"
      );
    });
  });

  describe("gracefulKillProcess", () => {
    it("应优雅停止进程", async () => {
      mockPlatformUtils.killProcess.mockResolvedValue();

      await processManager.gracefulKillProcess(1234);

      expect(mockPlatformUtils.killProcess).toHaveBeenCalledWith(
        1234,
        "SIGTERM"
      );
    });

    it("停止失败时应抛出 ProcessError", async () => {
      mockPlatformUtils.killProcess.mockRejectedValue(new Error("Kill failed"));

      await expect(processManager.gracefulKillProcess(1234)).rejects.toThrow(
        "无法停止进程"
      );
    });
  });

  describe("cleanupPidFile", () => {
    it("should delete PID file if it exists", () => {
      mockFileUtils.exists.mockReturnValue(true);

      processManager.cleanupPidFile();

      expect(mockFileUtils.deleteFile).toHaveBeenCalledWith(mockPidFilePath);
    });

    it("should not throw error if file does not exist", () => {
      mockFileUtils.exists.mockReturnValue(false);

      expect(() => processManager.cleanupPidFile()).not.toThrow();
    });

    it("should not throw error if delete fails", () => {
      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.deleteFile.mockImplementation(() => {
        throw new Error("Delete failed");
      });

      expect(() => processManager.cleanupPidFile()).not.toThrow();
    });
  });

  describe("isXiaozhiProcess", () => {
    it("should delegate to PlatformUtils", () => {
      mockPlatformUtils.isXiaozhiProcess.mockReturnValue(true);

      const result = processManager.isXiaozhiProcess(1234);

      expect(result).toBe(true);
      expect(mockPlatformUtils.isXiaozhiProcess).toHaveBeenCalledWith(1234);
    });
  });

  describe("processExists", () => {
    it("should delegate to PlatformUtils", () => {
      mockPlatformUtils.processExists.mockReturnValue(true);

      const result = processManager.processExists(1234);

      expect(result).toBe(true);
      expect(mockPlatformUtils.processExists).toHaveBeenCalledWith(1234);
    });
  });

  describe("cleanupContainerState", () => {
    it("should cleanup PID file in container environment", () => {
      mockPlatformUtils.isContainerEnvironment.mockReturnValue(true);
      mockFileUtils.exists.mockReturnValue(true);

      processManager.cleanupContainerState();

      expect(mockFileUtils.deleteFile).toHaveBeenCalledWith(mockPidFilePath);
    });

    it("should not cleanup in non-container environment", () => {
      mockPlatformUtils.isContainerEnvironment.mockReturnValue(false);

      processManager.cleanupContainerState();

      expect(mockFileUtils.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe("getProcessInfo", () => {
    it("should return process information", () => {
      mockPlatformUtils.processExists.mockReturnValue(true);
      mockPlatformUtils.isXiaozhiProcess.mockReturnValue(true);

      const info = processManager.getProcessInfo(1234);

      expect(info.exists).toBe(true);
      expect(info.isXiaozhi).toBe(true);
    });

    it("should return false for non-existent process", () => {
      mockPlatformUtils.processExists.mockReturnValue(false);

      const info = processManager.getProcessInfo(1234);

      expect(info.exists).toBe(false);
      expect(info.isXiaozhi).toBe(false);
    });
  });

  describe("validatePidFile", () => {
    it("should return true for valid PID file", () => {
      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue("1234|1640000000000|daemon");

      const isValid = processManager.validatePidFile();

      expect(isValid).toBe(true);
    });

    it("should return false for invalid PID file", () => {
      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue("invalid");

      const isValid = processManager.validatePidFile();

      expect(isValid).toBe(false);
    });

    it("should return false when PID file does not exist", () => {
      mockFileUtils.exists.mockReturnValue(false);

      const isValid = processManager.validatePidFile();

      expect(isValid).toBe(false);
    });
  });
});
