import { FileError, ProcessError } from "@cli/errors/index.js";
import type {
  ProcessManager as IProcessManager,
  ServiceStatus,
} from "@cli/interfaces/Service.js";
import { FileUtils } from "@cli/utils/FileUtils.js";
import { FormatUtils } from "@cli/utils/FormatUtils.js";
import { PathUtils } from "@cli/utils/PathUtils.js";
import { PlatformUtils } from "@cli/utils/PlatformUtils.js";

/**
 * PID 文件信息接口
 */
interface PidFileInfo {
  pid: number;
  startTime: number;
  mode: "foreground" | "daemon";
}

/**
 * 进程管理器实现
 */
export class ProcessManagerImpl implements IProcessManager {
  /**
   * 获取 PID 文件路径
   */
  private getPidFilePath(): string {
    return PathUtils.getPidFile();
  }

  /**
   * 读取 PID 文件信息
   */
  private readPidFile(): PidFileInfo | null {
    try {
      const pidFilePath = this.getPidFilePath();

      if (!FileUtils.exists(pidFilePath)) {
        return null;
      }

      const pidContent = FileUtils.readFile(pidFilePath).trim();
      const [pidStr, startTimeStr, mode] = pidContent.split("|");

      const pid = Number.parseInt(pidStr);
      const startTime = Number.parseInt(startTimeStr);

      if (Number.isNaN(pid) || Number.isNaN(startTime)) {
        // PID 文件损坏，删除它
        this.cleanupPidFile();
        return null;
      }

      return {
        pid,
        startTime,
        mode: (mode as "foreground" | "daemon") || "foreground",
      };
    } catch (error) {
      // 读取失败，可能文件损坏
      this.cleanupPidFile();
      return null;
    }
  }

  /**
   * 写入 PID 文件信息
   */
  private writePidFile(pid: number, mode: "foreground" | "daemon"): void {
    try {
      const pidInfo = `${pid}|${Date.now()}|${mode}`;
      const pidFilePath = this.getPidFilePath();
      FileUtils.writeFile(pidFilePath, pidInfo, { overwrite: true });
    } catch (error) {
      throw new FileError("无法写入 PID 文件", this.getPidFilePath());
    }
  }

  /**
   * 检查是否为 xiaozhi 进程
   */
  isXiaozhiProcess(pid: number): boolean {
    return PlatformUtils.isXiaozhiProcess(pid);
  }

  /**
   * 获取服务状态
   */
  getServiceStatus(): ServiceStatus {
    try {
      const pidInfo = this.readPidFile();

      if (!pidInfo) {
        return { running: false };
      }

      // 检查进程是否还在运行且是 xiaozhi 进程
      if (!this.isXiaozhiProcess(pidInfo.pid)) {
        // 进程不存在或不是 xiaozhi 进程，删除 PID 文件
        this.cleanupPidFile();
        return { running: false };
      }

      // 计算运行时间
      const uptime = FormatUtils.formatUptime(Date.now() - pidInfo.startTime);

      return {
        running: true,
        pid: pidInfo.pid,
        uptime,
        mode: pidInfo.mode,
      };
    } catch (error) {
      return { running: false };
    }
  }

  /**
   * 保存进程信息
   */
  savePidInfo(pid: number, mode: "foreground" | "daemon"): void {
    this.writePidFile(pid, mode);
  }

  /**
   * 杀死进程
   */
  async killProcess(pid: number): Promise<void> {
    try {
      await PlatformUtils.killProcess(pid);
    } catch (error) {
      throw new ProcessError(
        `无法终止进程: ${error instanceof Error ? error.message : String(error)}`,
        pid
      );
    }
  }

  /**
   * 优雅停止进程
   */
  async gracefulKillProcess(pid: number): Promise<void> {
    try {
      // 尝试优雅停止
      process.kill(pid, "SIGTERM");

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
        `无法停止进程: ${error instanceof Error ? error.message : String(error)}`,
        pid
      );
    }
  }

  /**
   * 清理 PID 文件
   */
  cleanupPidFile(): void {
    try {
      const pidFilePath = this.getPidFilePath();
      if (FileUtils.exists(pidFilePath)) {
        FileUtils.deleteFile(pidFilePath);
      }
    } catch (error) {
      // 忽略清理错误，但可以记录日志
      console.warn("清理 PID 文件失败:", error);
    }
  }

  /**
   * 检查进程是否存在
   */
  processExists(pid: number): boolean {
    return PlatformUtils.processExists(pid);
  }

  /**
   * 清理容器环境的旧状态
   */
  cleanupContainerState(): void {
    if (PlatformUtils.isContainerEnvironment()) {
      try {
        this.cleanupPidFile();
      } catch (error) {
        // 忽略清理错误
      }
    }
  }

  /**
   * 获取进程信息
   */
  getProcessInfo(pid: number): { exists: boolean; isXiaozhi: boolean } {
    const exists = this.processExists(pid);
    const isXiaozhi = exists ? this.isXiaozhiProcess(pid) : false;

    return { exists, isXiaozhi };
  }

  /**
   * 验证 PID 文件完整性
   */
  validatePidFile(): boolean {
    try {
      const pidInfo = this.readPidFile();
      return pidInfo !== null;
    } catch {
      return false;
    }
  }
}
