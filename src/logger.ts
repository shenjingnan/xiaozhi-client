import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import pino from "pino";
import type { Logger as PinoLogger } from "pino";

function formatDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export class Logger {
  private logFilePath: string | null = null;
  private pinoInstance: PinoLogger;
  private isDaemonMode: boolean;

  constructor() {
    // 检查是否为守护进程模式
    this.isDaemonMode = process.env.XIAOZHI_DAEMON === "true";

    // 创建 pino 实例
    this.pinoInstance = this.createPinoInstance();
  }

  private createPinoInstance(): PinoLogger {
    const streams: pino.StreamEntry[] = [];

    // 控制台流 - 只在非守护进程模式下添加
    if (!this.isDaemonMode) {
      // 创建自定义的控制台输出流
      const consoleStream = {
        write: (chunk: string) => {
          try {
            const logObj = JSON.parse(chunk);
            const message = this.formatConsoleMessage(logObj);
            process.stderr.write(`${message}\n`);
          } catch (error) {
            // 如果解析失败，直接输出原始内容
            process.stderr.write(chunk);
          }
        }
      };

      streams.push({
        level: "debug",
        stream: consoleStream,
      });
    }

    // 文件流 - 如果有日志文件路径
    if (this.logFilePath) {
      streams.push({
        level: "debug",
        stream: fs.createWriteStream(this.logFilePath, { flags: "a" }),
      });
    }

    // 如果没有流，创建一个空的流避免错误
    if (streams.length === 0) {
      streams.push({
        level: "debug",
        stream: pino.destination({ dest: "/dev/null" }),
      });
    }

    return pino(
      {
        level: "debug",
        timestamp: pino.stdTimeFunctions?.isoTime || (() => `,"time":${Date.now()}`),
      },
      pino.multistream(streams)
    );
  }

  private formatConsoleMessage(logObj: any): string {
    const timestamp = formatDateTime(new Date());

    // 级别映射和颜色（pino 的级别值）
    const levelMap: Record<number, { name: string; color: (text: string) => string }> = {
      20: { name: "DEBUG", color: chalk.gray },
      30: { name: "INFO", color: chalk.blue },
      40: { name: "WARN", color: chalk.yellow },
      50: { name: "ERROR", color: chalk.red },
      60: { name: "FATAL", color: chalk.red },
    };

    const levelInfo = levelMap[logObj.level] || { name: "UNKNOWN", color: (text: string) => text };
    const coloredLevel = levelInfo.color(`[${levelInfo.name}]`);

    return `[${timestamp}] ${coloredLevel} ${logObj.msg}`;
  }

  /**
   * 初始化日志文件
   * @param projectDir 项目目录
   */
  initLogFile(projectDir: string): void {
    this.logFilePath = path.join(projectDir, "xiaozhi.log");

    // 确保日志文件存在
    if (!fs.existsSync(this.logFilePath)) {
      fs.writeFileSync(this.logFilePath, "");
    }

    // 重新创建 pino 实例以包含文件流
    this.pinoInstance = this.createPinoInstance();
  }



  /**
   * 设置是否启用文件日志
   * @param enable 是否启用
   */
  enableFileLogging(enable: boolean): void {
    // 在 pino 实现中，文件日志的启用/禁用通过重新创建实例来实现
    // 这里保持方法兼容性，但实际上文件日志在 initLogFile 时就已经启用
    if (enable && this.logFilePath) {
      // 重新创建 pino 实例以确保文件流正确配置
      this.pinoInstance = this.createPinoInstance();
    }
  }

  /**
   * 日志方法
   */
  info(message: string, ...args: any[]): void {
    const fullMessage = args.length > 0 ? `${message} ${args.join(' ')}` : message;
    this.pinoInstance.info(fullMessage);
  }

  success(message: string, ...args: any[]): void {
    // success 映射为 info 级别，保持 API 兼容性
    const fullMessage = args.length > 0 ? `${message} ${args.join(' ')}` : message;
    this.pinoInstance.info(fullMessage);
  }

  warn(message: string, ...args: any[]): void {
    const fullMessage = args.length > 0 ? `${message} ${args.join(' ')}` : message;
    this.pinoInstance.warn(fullMessage);
  }

  error(message: string, ...args: any[]): void {
    const fullMessage = args.length > 0 ? `${message} ${args.join(' ')}` : message;
    this.pinoInstance.error(fullMessage);
  }

  debug(message: string, ...args: any[]): void {
    const fullMessage = args.length > 0 ? `${message} ${args.join(' ')}` : message;
    this.pinoInstance.debug(fullMessage);
  }

  log(message: string, ...args: any[]): void {
    const fullMessage = args.length > 0 ? `${message} ${args.join(' ')}` : message;
    // log 方法使用 info 级别
    this.pinoInstance.info(fullMessage);
  }

  /**
   * 创建一个带标签的日志实例（已废弃，直接返回原实例）
   * @param tag 标签（不再使用）
   * @deprecated 标签功能已移除
   */
  withTag(_tag: string): Logger {
    // 不再添加标签，直接返回共享实例
    return this;
  }

  /**
   * 关闭日志文件流
   */
  close(): void {
    // pino 实例会自动处理流的关闭
    // 这里保持方法兼容性
  }
}

// 导出单例实例
export const logger = new Logger();
