/**
 * 平台相关工具单元测试
 */

import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProcessError } from "../errors/index.js";
import { PlatformUtils } from "./PlatformUtils.js";

// Mock child_process module
vi.mock("node:child_process");
const mockedExecSync = vi.mocked(execSync);

describe("PlatformUtils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset process.env mock
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("getCurrentPlatform", () => {
    it("should return current platform", () => {
      // Since we can't easily change process.platform, we just test it returns a string
      const result = PlatformUtils.getCurrentPlatform();
      expect(typeof result).toBe("string");
      expect([
        "win32",
        "darwin",
        "linux",
        "freebsd",
        "openbsd",
        "sunos",
        "aix",
      ]).toContain(result);
    });
  });

  describe("isWindows", () => {
    it("should return true on Windows", () => {
      // Mock process.platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
      });

      expect(PlatformUtils.isWindows()).toBe(true);

      // Restore original platform
      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });

    it("should return false on non-Windows platforms", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "darwin",
        writable: true,
      });

      expect(PlatformUtils.isWindows()).toBe(false);

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });
  });

  describe("isMacOS", () => {
    it("should return true on macOS", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "darwin",
        writable: true,
      });

      expect(PlatformUtils.isMacOS()).toBe(true);

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });

    it("should return false on non-macOS platforms", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
      });

      expect(PlatformUtils.isMacOS()).toBe(false);

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });
  });

  describe("isLinux", () => {
    it("should return true on Linux", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
      });

      expect(PlatformUtils.isLinux()).toBe(true);

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });

    it("should return false on non-Linux platforms", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
      });

      expect(PlatformUtils.isLinux()).toBe(false);

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });
  });

  describe("isUnixLike", () => {
    it("should return true on Unix-like systems", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "darwin",
        writable: true,
      });

      expect(PlatformUtils.isUnixLike()).toBe(true);

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });

    it("should return false on Windows", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
      });

      expect(PlatformUtils.isUnixLike()).toBe(false);

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });
  });

  describe("isXiaozhiProcess", () => {
    const testPid = 1234;

    beforeEach(() => {
      // Mock process.kill
      vi.spyOn(process, "kill").mockImplementation(() => true);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return true in container environment when process exists", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", "true");

      const result = PlatformUtils.isXiaozhiProcess(testPid);

      expect(result).toBe(true);
      expect(process.kill).toHaveBeenCalledWith(testPid, 0);
    });

    it("should return true in test environment when process exists", () => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("XIAOZHI_CONTAINER", "false");

      const result = PlatformUtils.isXiaozhiProcess(testPid);

      expect(result).toBe(true);
      expect(process.kill).toHaveBeenCalledWith(testPid, 0);
    });

    it("should return false in container environment when process does not exist", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", "true");
      vi.spyOn(process, "kill").mockImplementation(() => {
        throw new Error("Process not found");
      });

      const result = PlatformUtils.isXiaozhiProcess(testPid);

      expect(result).toBe(false);
    });

    it("should check process command line on Windows", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
      });

      vi.stubEnv("XIAOZHI_CONTAINER", "false");
      vi.stubEnv("NODE_ENV", "production");
      mockedExecSync.mockReturnValue('"node.exe","xiaozhi-client.js"\r\n');

      const result = PlatformUtils.isXiaozhiProcess(testPid);

      expect(result).toBe(true);
      expect(mockedExecSync).toHaveBeenCalledWith(
        `tasklist /FI "PID eq ${testPid}" /FO CSV /NH`,
        {
          encoding: "utf8",
          timeout: 3000,
        }
      );

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });

    it("should check process command line on Unix-like systems", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
      });

      vi.stubEnv("XIAOZHI_CONTAINER", "false");
      vi.stubEnv("NODE_ENV", "production");
      mockedExecSync.mockReturnValue("node\n");

      const result = PlatformUtils.isXiaozhiProcess(testPid);

      expect(result).toBe(true);
      expect(mockedExecSync).toHaveBeenCalledWith(`ps -p ${testPid} -o comm=`, {
        encoding: "utf8",
        timeout: 3000,
      });

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });

    it("should fallback to simple PID check when command line check fails", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
      });

      vi.stubEnv("XIAOZHI_CONTAINER", "false");
      vi.stubEnv("NODE_ENV", "production");
      mockedExecSync.mockImplementation(() => {
        throw new Error("Command failed");
      });

      const result = PlatformUtils.isXiaozhiProcess(testPid);

      expect(result).toBe(true);
      expect(process.kill).toHaveBeenCalledWith(testPid, 0);

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });

    it("should return false when process does not exist", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.spyOn(process, "kill").mockImplementation(() => {
        throw new Error("Process not found");
      });
      mockedExecSync.mockImplementation(() => {
        throw new Error("Command failed");
      });

      const result = PlatformUtils.isXiaozhiProcess(testPid);

      expect(result).toBe(false);
    });

    it("should detect xiaozhi in process name", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
      });

      vi.stubEnv("XIAOZHI_CONTAINER", "false");
      vi.stubEnv("NODE_ENV", "production");
      mockedExecSync.mockReturnValue("xiaozhi\n");

      const result = PlatformUtils.isXiaozhiProcess(testPid);

      expect(result).toBe(true);

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });

    it("should return false for non-xiaozhi processes", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
      });

      vi.stubEnv("XIAOZHI_CONTAINER", "false");
      vi.stubEnv("NODE_ENV", "production");
      mockedExecSync.mockReturnValue("other-process\n");

      const result = PlatformUtils.isXiaozhiProcess(testPid);

      expect(result).toBe(false);

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });
  });

  describe("killProcess", () => {
    const testPid = 1234;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(process, "kill").mockImplementation(() => true);
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("should kill process successfully with SIGTERM", async () => {
      // First call succeeds, second call fails (process stopped)
      vi.spyOn(process, "kill")
        .mockImplementationOnce(() => true)
        .mockImplementationOnce(() => {
          throw new Error("Process not found");
        });

      const promise = PlatformUtils.killProcess(testPid, "SIGTERM");

      // 推进时间让进程停止检查完成
      await vi.advanceTimersByTimeAsync(100);

      await promise;

      expect(process.kill).toHaveBeenCalledWith(testPid, "SIGTERM");
      expect(process.kill).toHaveBeenCalledWith(testPid, 0);
    }, 1000);

    it("should force kill with SIGKILL if process doesn't stop", async () => {
      // Process keeps running for all 30 checks, then gets SIGKILLed
      let callCount = 0;
      vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
        callCount++;

        // 第一次调用：发送 SIGTERM
        if (callCount === 1) {
          return true;
        }

        // 第2-32次调用：检查进程是否还在（信号 0）
        // 让进程在31次检查后仍然"存活"（30次循环检查 + 1次SIGKILL前的检查）
        if (signal === 0 && callCount <= 32) {
          return true; // 进程仍然存活
        }

        // 第33次调用：发送 SIGKILL
        if (signal === "SIGKILL") {
          return true;
        }

        // SIGKILL 后的检查，进程已经停止（如果有）
        if (signal === 0 && callCount > 32) {
          throw new Error("Process not found");
        }
        return true;
      });

      const promise = PlatformUtils.killProcess(testPid, "SIGTERM");

      // 推进时间让完整的进程停止流程完成
      await vi.advanceTimersByTimeAsync(3500); // 30 * 100ms + 500ms + 余量

      await promise;

      // Should try SIGTERM first, then check multiple times, then SIGKILL
      expect(process.kill).toHaveBeenCalledWith(testPid, "SIGTERM");
      expect(process.kill).toHaveBeenCalledWith(testPid, "SIGKILL");
    }, 1000);

    it("should use default signal SIGTERM when not specified", async () => {
      vi.spyOn(process, "kill")
        .mockImplementationOnce(() => true)
        .mockImplementationOnce(() => {
          throw new Error("Process not found");
        });

      const promise = PlatformUtils.killProcess(testPid);

      // 推进时间让进程停止检查完成
      await vi.advanceTimersByTimeAsync(100);

      await promise;

      expect(process.kill).toHaveBeenCalledWith(testPid, "SIGTERM");
    }, 1000);

    it("should throw ProcessError when killing fails", async () => {
      vi.spyOn(process, "kill").mockImplementation(() => {
        throw new Error("Permission denied");
      });

      await expect(PlatformUtils.killProcess(testPid)).rejects.toThrow(
        ProcessError
      );
      await expect(PlatformUtils.killProcess(testPid)).rejects.toThrow(
        "无法终止进程"
      );
    }, 1000);

    it("should handle SIGKILL failure gracefully", async () => {
      // Process stops responding to SIGKILL
      vi.spyOn(process, "kill").mockImplementation(() => true);

      const promise = PlatformUtils.killProcess(testPid, "SIGTERM");

      // 推进时间让完整的kill流程完成（包括SIGKILL尝试）
      await vi.advanceTimersByTimeAsync(3500); // 足够时间完成整个流程

      await promise;

      // Should not throw even if SIGKILL fails
      expect(process.kill).toHaveBeenCalledWith(testPid, "SIGKILL");
    }, 1000);
  });

  describe("processExists", () => {
    const testPid = 1234;

    beforeEach(() => {
      vi.spyOn(process, "kill").mockImplementation(() => true);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return true when process exists", () => {
      const result = PlatformUtils.processExists(testPid);

      expect(result).toBe(true);
      expect(process.kill).toHaveBeenCalledWith(testPid, 0);
    });

    it("should return false when process does not exist", () => {
      vi.spyOn(process, "kill").mockImplementation(() => {
        throw new Error("Process not found");
      });

      const result = PlatformUtils.processExists(testPid);

      expect(result).toBe(false);
    });
  });

  describe("getSystemInfo", () => {
    beforeEach(() => {
      // Mock platform, arch, and version
      const originalPlatform = process.platform;
      const originalArch = process.arch;
      const originalVersion = process.version;

      Object.defineProperty(process, "platform", {
        value: "darwin",
        writable: true,
      });
      Object.defineProperty(process, "arch", {
        value: "x64",
        writable: true,
      });
      Object.defineProperty(process, "version", {
        value: "v18.0.0",
        writable: true,
      });

      return () => {
        Object.defineProperty(process, "platform", {
          value: originalPlatform,
          writable: true,
        });
        Object.defineProperty(process, "arch", {
          value: originalArch,
          writable: true,
        });
        Object.defineProperty(process, "version", {
          value: originalVersion,
          writable: true,
        });
      };
    });

    it("should return correct system info", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", "true");

      const result = PlatformUtils.getSystemInfo();

      expect(result).toEqual({
        platform: "darwin",
        arch: "x64",
        nodeVersion: "v18.0.0",
        isContainer: true,
      });
    });

    it("should detect non-container environment", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", "false");

      const result = PlatformUtils.getSystemInfo();

      expect(result.isContainer).toBe(false);
    });

    it("should handle missing container environment variable", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", undefined);

      const result = PlatformUtils.getSystemInfo();

      expect(result.isContainer).toBe(false);
    });
  });

  describe("getEnvVar", () => {
    beforeEach(() => {
      vi.stubEnv("TEST_VAR", "test-value");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("should return environment variable value", () => {
      const result = PlatformUtils.getEnvVar("TEST_VAR");
      expect(result).toBe("test-value");
    });

    it("should return undefined when environment variable does not exist", () => {
      const result = PlatformUtils.getEnvVar("NONEXISTENT_VAR");
      expect(result).toBeUndefined();
    });

    it("should return default value when environment variable does not exist", () => {
      const result = PlatformUtils.getEnvVar("NONEXISTENT_VAR", "default");
      expect(result).toBe("default");
    });

    it("should return actual value when environment variable exists even with default", () => {
      const result = PlatformUtils.getEnvVar("TEST_VAR", "default");
      expect(result).toBe("test-value");
    });
  });

  describe("setEnvVar", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("should set environment variable", () => {
      PlatformUtils.setEnvVar("TEST_VAR", "new-value");
      expect(process.env.TEST_VAR).toBe("new-value");
    });

    it("should overwrite existing environment variable", () => {
      vi.stubEnv("TEST_VAR", "old-value");
      PlatformUtils.setEnvVar("TEST_VAR", "new-value");
      expect(process.env.TEST_VAR).toBe("new-value");
    });
  });

  describe("isContainerEnvironment", () => {
    it("should return true in container environment", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", "true");
      expect(PlatformUtils.isContainerEnvironment()).toBe(true);
    });

    it("should return false when not in container environment", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", "false");
      expect(PlatformUtils.isContainerEnvironment()).toBe(false);
    });

    it("should return false when container environment variable is not set", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", undefined);
      expect(PlatformUtils.isContainerEnvironment()).toBe(false);
    });
  });

  describe("isTestEnvironment", () => {
    it("should return true in test environment", () => {
      vi.stubEnv("NODE_ENV", "test");
      expect(PlatformUtils.isTestEnvironment()).toBe(true);
    });

    it("should return false when not in test environment", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(PlatformUtils.isTestEnvironment()).toBe(false);
    });

    it("should return false when NODE_ENV is not set", () => {
      vi.stubEnv("NODE_ENV", undefined);
      expect(PlatformUtils.isTestEnvironment()).toBe(false);
    });
  });

  describe("isDevelopmentEnvironment", () => {
    it("should return true in development environment", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(PlatformUtils.isDevelopmentEnvironment()).toBe(true);
    });

    it("should return false when not in development environment", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(PlatformUtils.isDevelopmentEnvironment()).toBe(false);
    });

    it("should return false when NODE_ENV is not set", () => {
      vi.stubEnv("NODE_ENV", undefined);
      expect(PlatformUtils.isDevelopmentEnvironment()).toBe(false);
    });
  });

  describe("getTailCommand", () => {
    const testFile = "/path/to/log.txt";

    it("should return powershell command on Windows", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
      });

      const result = PlatformUtils.getTailCommand(testFile);

      expect(result).toEqual({
        command: "powershell",
        args: ["-Command", `Get-Content -Path "${testFile}" -Wait`],
      });

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });

    it("should return tail command on Unix-like systems", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "darwin",
        writable: true,
      });

      const result = PlatformUtils.getTailCommand(testFile);

      expect(result).toEqual({
        command: "tail",
        args: ["-f", testFile],
      });

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });

    it("should handle special characters in file path", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
      });

      const fileWithSpaces = "/path/with spaces/log.txt";
      const result = PlatformUtils.getTailCommand(fileWithSpaces);

      expect(result.args[1]).toContain(fileWithSpaces);

      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });
  });
});
