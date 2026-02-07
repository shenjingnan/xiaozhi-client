/**
 * 平台相关工具
 */

import { execSync } from "node:child_process";
import { TIMEOUT_CONSTANTS } from "../Constants";
import { ProcessError } from "../errors/index";
import type { Platform } from "../Types";

/**
 * 平台工具类
 */
export class PlatformUtils {
  /**
   * 获取当前平台
   */
  static getCurrentPlatform(): Platform {
    return process.platform as Platform;
  }

  /**
   * 检查是否为 Windows 平台
   */
  static isWindows(): boolean {
    return process.platform === "win32";
  }

  /**
   * 检查是否为 macOS 平台
   */
  static isMacOS(): boolean {
    return process.platform === "darwin";
  }

  /**
   * 检查是否为 Linux 平台
   */
  static isLinux(): boolean {
    return process.platform === "linux";
  }

  /**
   * 检查是否为类 Unix 系统
   */
  static isUnixLike(): boolean {
    return !PlatformUtils.isWindows();
  }

  /**
   * 检查进程是否为 xiaozhi-client 进程
   */
  static isXiaozhiProcess(pid: number): boolean {
    try {
      // 在容器环境或测试环境中，使用更宽松的检查策略
      if (
        process.env.XIAOZHI_CONTAINER === "true" ||
        process.env.NODE_ENV === "test"
      ) {
        // 容器环境或测试环境中，如果 PID 存在就认为是有效的
        // 因为容器通常只运行一个主要应用，测试环境中mock了进程检查
        process.kill(pid, 0);
        return true;
      }

      // 非容器环境中，尝试更严格的进程检查
      try {
        let cmdline = "";
        if (PlatformUtils.isWindows()) {
          // Windows 系统
          const result = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
            encoding: "utf8",
            timeout: TIMEOUT_CONSTANTS.PROCESS_STOP,
          });
          cmdline = result.toLowerCase();
        } else {
          // Unix-like 系统
          const result = execSync(`ps -p ${pid} -o comm=`, {
            encoding: "utf8",
            timeout: TIMEOUT_CONSTANTS.PROCESS_STOP,
          });
          cmdline = result.toLowerCase();
        }

        // 检查是否包含 node 或 xiaozhi 相关关键词
        return cmdline.includes("node") || cmdline.includes("xiaozhi");
      } catch (_error) {
        // 如果无法获取进程信息，回退到简单的 PID 检查
        process.kill(pid, 0);
        return true;
      }
    } catch (_error) {
      return false;
    }
  }

  /**
   * 杀死进程
   */
  static async killProcess(
    pid: number,
    signal: NodeJS.Signals = "SIGTERM"
  ): Promise<void> {
    try {
      process.kill(pid, signal);

      // 等待进程停止
      let attempts = 0;
      const maxAttempts = 30; // 3秒超时

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100));

        try {
          process.kill(pid, 0);
          attempts++;
        } catch {
          // 进程已停止
          return;
        }
      }

      // 如果还在运行，强制停止
      try {
        process.kill(pid, 0);
        process.kill(pid, "SIGKILL");
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch {
        // 进程已停止
      }
    } catch (error) {
      throw new ProcessError(
        `无法终止进程: ${error instanceof Error ? error.message : String(error)}`,
        pid
      );
    }
  }

  /**
   * 检查进程是否存在
   */
  static processExists(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取系统信息
   */
  static getSystemInfo(): {
    platform: Platform;
    arch: string;
    nodeVersion: string;
    isContainer: boolean;
  } {
    return {
      platform: PlatformUtils.getCurrentPlatform(),
      arch: process.arch,
      nodeVersion: process.version,
      isContainer: process.env.XIAOZHI_CONTAINER === "true",
    };
  }

  /**
   * 获取环境变量
   */
  static getEnvVar(name: string, defaultValue?: string): string | undefined {
    return process.env[name] || defaultValue;
  }

  /**
   * 设置环境变量
   */
  static setEnvVar(name: string, value: string): void {
    process.env[name] = value;
  }

  /**
   * 检查是否在容器环境中运行
   */
  static isContainerEnvironment(): boolean {
    return process.env.XIAOZHI_CONTAINER === "true";
  }

  /**
   * 检查是否在测试环境中运行
   */
  static isTestEnvironment(): boolean {
    return process.env.NODE_ENV === "test";
  }

  /**
   * 检查是否在开发环境中运行
   */
  static isDevelopmentEnvironment(): boolean {
    return process.env.NODE_ENV === "development";
  }

  /**
   * 获取合适的 tail 命令
   */
  static getTailCommand(filePath: string): { command: string; args: string[] } {
    if (PlatformUtils.isWindows()) {
      return {
        command: "powershell",
        args: ["-Command", `Get-Content -Path "${filePath}" -Wait`],
      };
    }
    return {
      command: "tail",
      args: ["-f", filePath],
    };
  }
}
