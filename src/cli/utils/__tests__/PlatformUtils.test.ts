/**
 * 平台相关工具单元测试
 */

import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProcessError } from "../../errors/index";
import { PlatformUtils } from "../PlatformUtils";

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

  describe("获取当前平台", () => {
    it("应返回当前平台", () => {
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

  describe("是否为Windows系统", () => {
    it("在Windows上应返回 true", () => {
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

    it("在非Windows平台上应返回 false", () => {
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

  describe("是否为macOS系统", () => {
    it("在macOS上应返回 true", () => {
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

    it("在非macOS平台上应返回 false", () => {
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

  describe("是否为Linux系统", () => {
    it("在Linux上应返回 true", () => {
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

    it("在非Linux平台上应返回 false", () => {
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

  describe("是否为类Unix系统", () => {
    it("在类Unix系统上应返回 true", () => {
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

    it("在Windows上应返回 false", () => {
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

  describe("是否为小智进程", () => {
    const testPid = 1234;

    beforeEach(() => {
      // Mock process.kill
      vi.spyOn(process, "kill").mockImplementation(() => true);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("在容器环境中进程存在时应返回 true", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", "true");

      const result = PlatformUtils.isXiaozhiProcess(testPid);

      expect(result).toBe(true);
      expect(process.kill).toHaveBeenCalledWith(testPid, 0);
    });

    it("在测试环境中进程存在时应返回 true", () => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("XIAOZHI_CONTAINER", "false");

      const result = PlatformUtils.isXiaozhiProcess(testPid);

      expect(result).toBe(true);
      expect(process.kill).toHaveBeenCalledWith(testPid, 0);
    });

    it("在容器环境中进程不存在时应返回 false", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", "true");
      vi.spyOn(process, "kill").mockImplementation(() => {
        throw new Error("Process not found");
      });

      const result = PlatformUtils.isXiaozhiProcess(testPid);

      expect(result).toBe(false);
    });

    it("应在Windows上检查进程命令行", () => {
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

    it("应在类Unix系统上检查进程命令行", () => {
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

    it("命令行检查失败时应回退到简单PID检查", () => {
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

    it("进程不存在时应返回 false", () => {
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

    it("应在进程名中检测到小智", () => {
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

    it("对于非小智进程应返回 false", () => {
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

  describe("终止进程", () => {
    const testPid = 1234;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(process, "kill").mockImplementation(() => true);
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("应使用SIGTERM成功终止进程", async () => {
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

    it("如果进程不停止应使用SIGKILL强制终止", async () => {
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

    it("未指定时应使用默认信号SIGTERM", async () => {
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

    it("终止失败时应抛出进程错误", async () => {
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

    it("应优雅处理SIGKILL失败", async () => {
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

  describe("进程是否存在", () => {
    const testPid = 1234;

    beforeEach(() => {
      vi.spyOn(process, "kill").mockImplementation(() => true);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("进程存在时应返回 true", () => {
      const result = PlatformUtils.processExists(testPid);

      expect(result).toBe(true);
      expect(process.kill).toHaveBeenCalledWith(testPid, 0);
    });

    it("进程不存在时应返回 false", () => {
      vi.spyOn(process, "kill").mockImplementation(() => {
        throw new Error("Process not found");
      });

      const result = PlatformUtils.processExists(testPid);

      expect(result).toBe(false);
    });
  });

  describe("获取系统信息", () => {
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

    it("应返回正确的系统信息", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", "true");

      const result = PlatformUtils.getSystemInfo();

      expect(result).toEqual({
        platform: "darwin",
        arch: "x64",
        nodeVersion: "v18.0.0",
        isContainer: true,
      });
    });

    it("应检测非容器环境", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", "false");

      const result = PlatformUtils.getSystemInfo();

      expect(result.isContainer).toBe(false);
    });

    it("应处理缺失的容器环境变量", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", undefined);

      const result = PlatformUtils.getSystemInfo();

      expect(result.isContainer).toBe(false);
    });
  });

  describe("获取环境变量", () => {
    beforeEach(() => {
      vi.stubEnv("TEST_VAR", "test-value");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("应返回环境变量值", () => {
      const result = PlatformUtils.getEnvVar("TEST_VAR");
      expect(result).toBe("test-value");
    });

    it("环境变量不存在时应返回 undefined", () => {
      const result = PlatformUtils.getEnvVar("NONEXISTENT_VAR");
      expect(result).toBeUndefined();
    });

    it("环境变量不存在时应返回默认值", () => {
      const result = PlatformUtils.getEnvVar("NONEXISTENT_VAR", "default");
      expect(result).toBe("default");
    });

    it("即使有默认值，环境变量存在时也应返回实际值", () => {
      const result = PlatformUtils.getEnvVar("TEST_VAR", "default");
      expect(result).toBe("test-value");
    });
  });

  describe("设置环境变量", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("应设置环境变量", () => {
      PlatformUtils.setEnvVar("TEST_VAR", "new-value");
      expect(process.env.TEST_VAR).toBe("new-value");
    });

    it("应覆盖现有环境变量", () => {
      vi.stubEnv("TEST_VAR", "old-value");
      PlatformUtils.setEnvVar("TEST_VAR", "new-value");
      expect(process.env.TEST_VAR).toBe("new-value");
    });
  });

  describe("是否为容器环境", () => {
    it("在容器环境中应返回 true", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", "true");
      expect(PlatformUtils.isContainerEnvironment()).toBe(true);
    });

    it("不在容器环境中时应返回 false", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", "false");
      expect(PlatformUtils.isContainerEnvironment()).toBe(false);
    });

    it("未设置容器环境变量时应返回 false", () => {
      vi.stubEnv("XIAOZHI_CONTAINER", undefined);
      expect(PlatformUtils.isContainerEnvironment()).toBe(false);
    });
  });

  describe("是否为测试环境", () => {
    it("在测试环境中应返回 true", () => {
      vi.stubEnv("NODE_ENV", "test");
      expect(PlatformUtils.isTestEnvironment()).toBe(true);
    });

    it("不在测试环境中时应返回 false", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(PlatformUtils.isTestEnvironment()).toBe(false);
    });

    it("测试环境未设置NODE_ENV时应返回 false", () => {
      vi.stubEnv("NODE_ENV", undefined);
      expect(PlatformUtils.isTestEnvironment()).toBe(false);
    });
  });

  describe("是否为开发环境", () => {
    it("在开发环境中应返回 true", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(PlatformUtils.isDevelopmentEnvironment()).toBe(true);
    });

    it("不在开发环境中时应返回 false", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(PlatformUtils.isDevelopmentEnvironment()).toBe(false);
    });

    it("开发环境未设置NODE_ENV时应返回 false", () => {
      vi.stubEnv("NODE_ENV", undefined);
      expect(PlatformUtils.isDevelopmentEnvironment()).toBe(false);
    });
  });

  describe("获取tail命令", () => {
    const testFile = "/path/to/log.txt";

    it("在Windows上应返回powershell命令", () => {
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

    it("在类Unix系统上应返回tail命令", () => {
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

    it("应处理文件路径中的特殊字符", () => {
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
