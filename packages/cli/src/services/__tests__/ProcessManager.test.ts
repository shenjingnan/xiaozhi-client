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
    it("PID 文件不存在时应返回未运行状态", () => {
      mockFileUtils.exists.mockReturnValue(false);

      const status = processManager.getServiceStatus();

      expect(status.running).toBe(false);
      expect(status.pid).toBeUndefined();
      expect(status.uptime).toBeUndefined();
    });

    it("PID 文件损坏时应返回未运行状态", () => {
      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue("invalid-content");

      const status = processManager.getServiceStatus();

      expect(status.running).toBe(false);
      expect(mockFileUtils.deleteFile).toHaveBeenCalledWith(mockPidFilePath);
    });

    it("进程不是小智进程时应返回未运行状态", () => {
      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue("1234|1640000000000|daemon");
      mockPlatformUtils.isXiaozhiProcess.mockReturnValue(false);

      const status = processManager.getServiceStatus();

      expect(status.running).toBe(false);
      expect(mockFileUtils.deleteFile).toHaveBeenCalledWith(mockPidFilePath);
    });

    it("进程有效时应返回运行状态", () => {
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

    it("应处理 PID 文件中缺失的模式", () => {
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
    it("应将 PID 信息保存到文件", () => {
      const pid = 1234;
      const mode = "daemon";

      processManager.savePidInfo(pid, mode);

      expect(mockFileUtils.writeFile).toHaveBeenCalledWith(
        mockPidFilePath,
        expect.stringMatching(/^1234\|\d+\|daemon$/),
        { overwrite: true }
      );
    });

    it("文件写入失败时应抛出错误", () => {
      mockFileUtils.writeFile.mockImplementation(() => {
        throw new Error("Write failed");
      });

      expect(() => processManager.savePidInfo(1234, "daemon")).toThrow();
    });
  });

  describe("killProcess", () => {
    it("应成功杀死进程", async () => {
      mockPlatformUtils.killProcess.mockResolvedValue();

      await processManager.killProcess(1234);

      expect(mockPlatformUtils.killProcess).toHaveBeenCalledWith(1234);
    });

    it("杀死失败时应抛出 ProcessError", async () => {
      mockPlatformUtils.killProcess.mockRejectedValue(new Error("Kill failed"));

      await expect(processManager.killProcess(1234)).rejects.toThrow(
        "无法终止进程"
      );
    });
  });

  describe("gracefulKillProcess", () => {
    let originalKill: typeof process.kill;

    beforeEach(() => {
      originalKill = process.kill;
      process.kill = vi.fn();
    });

    afterEach(() => {
      process.kill = originalKill;
    });

    it("应优雅地杀死进程", async () => {
      let killCallCount = 0;
      (process.kill as any).mockImplementation((pid: number, signal: any) => {
        killCallCount++;
        if (killCallCount > 1) {
          throw new Error("ESRCH"); // Process stopped
        }
      });

      await processManager.gracefulKillProcess(1234);

      expect(process.kill).toHaveBeenCalledWith(1234, "SIGTERM");
    });

    it("优雅杀死失败时应强制杀死", async () => {
      (process.kill as any).mockImplementation((pid: number, signal: any) => {
        if (signal === "SIGKILL") {
          throw new Error("ESRCH"); // Process stopped
        }
        // Process still running for SIGTERM and signal 0
      });

      await processManager.gracefulKillProcess(1234);

      expect(process.kill).toHaveBeenCalledWith(1234, "SIGTERM");
      expect(process.kill).toHaveBeenCalledWith(1234, "SIGKILL");
    });
  });

  describe("cleanupPidFile", () => {
    it("应删除存在的 PID 文件", () => {
      mockFileUtils.exists.mockReturnValue(true);

      processManager.cleanupPidFile();

      expect(mockFileUtils.deleteFile).toHaveBeenCalledWith(mockPidFilePath);
    });

    it("文件不存在时不应抛出错误", () => {
      mockFileUtils.exists.mockReturnValue(false);

      expect(() => processManager.cleanupPidFile()).not.toThrow();
    });

    it("删除失败时不应抛出错误", () => {
      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.deleteFile.mockImplementation(() => {
        throw new Error("Delete failed");
      });

      expect(() => processManager.cleanupPidFile()).not.toThrow();
    });
  });

  describe("isXiaozhiProcess", () => {
    it("应使用默认非严格模式委托给 PlatformUtils", () => {
      mockPlatformUtils.isXiaozhiProcess.mockReturnValue(true);

      const result = processManager.isXiaozhiProcess(1234);

      expect(result).toBe(true);
      expect(mockPlatformUtils.isXiaozhiProcess).toHaveBeenCalledWith(1234, false);
    });

    it("应支持 strict 参数", () => {
      mockPlatformUtils.isXiaozhiProcess.mockReturnValue(true);

      const result = processManager.isXiaozhiProcess(1234, true);

      expect(result).toBe(true);
      expect(mockPlatformUtils.isXiaozhiProcess).toHaveBeenCalledWith(1234, true);
    });

    it("非严格模式下应避免调用 execSync", () => {
      mockPlatformUtils.isXiaozhiProcess.mockReturnValue(true);

      const result = processManager.isXiaozhiProcess(1234);

      expect(result).toBe(true);
      expect(mockPlatformUtils.isXiaozhiProcess).toHaveBeenCalledWith(1234, false);
    });
  });

  describe("processExists", () => {
    it("应委托给 PlatformUtils", () => {
      mockPlatformUtils.processExists.mockReturnValue(true);

      const result = processManager.processExists(1234);

      expect(result).toBe(true);
      expect(mockPlatformUtils.processExists).toHaveBeenCalledWith(1234);
    });
  });

  describe("cleanupContainerState", () => {
    it("应在容器环境中清理 PID 文件", () => {
      mockPlatformUtils.isContainerEnvironment.mockReturnValue(true);
      mockFileUtils.exists.mockReturnValue(true);

      processManager.cleanupContainerState();

      expect(mockFileUtils.deleteFile).toHaveBeenCalledWith(mockPidFilePath);
    });

    it("在非容器环境中不应清理", () => {
      mockPlatformUtils.isContainerEnvironment.mockReturnValue(false);

      processManager.cleanupContainerState();

      expect(mockFileUtils.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe("getProcessInfo", () => {
    it("应返回进程信息", () => {
      mockPlatformUtils.processExists.mockReturnValue(true);
      mockPlatformUtils.isXiaozhiProcess.mockReturnValue(true);

      const info = processManager.getProcessInfo(1234);

      expect(info.exists).toBe(true);
      expect(info.isXiaozhi).toBe(true);
    });

    it("对于不存在的进程应返回 false", () => {
      mockPlatformUtils.processExists.mockReturnValue(false);

      const info = processManager.getProcessInfo(1234);

      expect(info.exists).toBe(false);
      expect(info.isXiaozhi).toBe(false);
    });
  });

  describe("validatePidFile", () => {
    it("有效的 PID 文件应返回 true", () => {
      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue("1234|1640000000000|daemon");

      const isValid = processManager.validatePidFile();

      expect(isValid).toBe(true);
    });

    it("无效的 PID 文件应返回 false", () => {
      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue("invalid");

      const isValid = processManager.validatePidFile();

      expect(isValid).toBe(false);
    });

    it("PID 文件不存在应返回 false", () => {
      mockFileUtils.exists.mockReturnValue(false);

      const isValid = processManager.validatePidFile();

      expect(isValid).toBe(false);
    });
  });
});
