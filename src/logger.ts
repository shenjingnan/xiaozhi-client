import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { type consola, createConsola } from "consola";

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
  private writeStream: fs.WriteStream | null = null;
  private consolaInstance: typeof consola;
  private isDaemonMode: boolean;

  constructor() {
    // 检查是否为守护进程模式
    this.isDaemonMode = process.env.XIAOZHI_DAEMON === "true";
    // 创建自定义的 consola 实例，禁用图标并自定义格式
    this.consolaInstance = createConsola({
      formatOptions: {
        date: false,
        colors: true,
        compact: true,
      },
      fancy: false,
    });

    // 保存对当前实例的引用，以便在闭包中访问
    const isDaemonMode = this.isDaemonMode;

    // 自定义格式化器
    this.consolaInstance.setReporters([
      {
        log: (logObj) => {
          const levelMap: Record<string, string> = {
            info: "INFO",
            success: "SUCCESS",
            warn: "WARN",
            error: "ERROR",
            debug: "DEBUG",
            log: "LOG",
          };

          const colorMap: Record<string, (text: string) => string> = {
            info: chalk.blue,
            success: chalk.green,
            warn: chalk.yellow,
            error: chalk.red,
            debug: chalk.gray,
            log: (text: string) => text,
          };

          const level = levelMap[logObj.type] || logObj.type.toUpperCase();
          const colorFn = colorMap[logObj.type] || ((text: string) => text);
          const timestamp = formatDateTime(new Date());

          // 为级别添加颜色
          const coloredLevel = colorFn(`[${level}]`);
          const message = `[${timestamp}] ${coloredLevel} ${logObj.args.join(
            " "
          )}`;

          // 守护进程模式下不输出到控制台，只写入文件
          if (!isDaemonMode) {
            // 输出到 stderr（与原来保持一致）
            try {
              console.error(message);
            } catch (error) {
              // 忽略 EPIPE 错误
              if (error instanceof Error && error.message.includes('EPIPE')) {
                return;
              }
              throw error;
            }
          }
        },
      },
    ]);
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

    // 创建写入流，追加模式
    this.writeStream = fs.createWriteStream(this.logFilePath, {
      flags: "a",
      encoding: "utf8",
    });
  }

  /**
   * 记录日志到文件
   * @param level 日志级别
   * @param message 日志消息
   * @param args 额外参数
   */
  private logToFile(level: string, message: string, ...args: any[]): void {
    if (this.writeStream) {
      const timestamp = new Date().toISOString();
      const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      const fullMessage =
        args.length > 0
          ? `${formattedMessage} ${args
              .map((arg) =>
                typeof arg === "object" ? JSON.stringify(arg) : String(arg)
              )
              .join(" ")}`
          : formattedMessage;

      this.writeStream.write(`${fullMessage}\n`);
    }
  }

  /**
   * 设置是否启用文件日志
   * @param enable 是否启用
   */
  enableFileLogging(enable: boolean): void {
    if (enable && !this.writeStream && this.logFilePath) {
      this.writeStream = fs.createWriteStream(this.logFilePath, {
        flags: "a",
        encoding: "utf8",
      });
    } else if (!enable && this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }
  }

  /**
   * 日志方法
   */
  info(message: string, ...args: any[]): void {
    this.consolaInstance.info(message, ...args);
    this.logToFile("info", message, ...args);
  }

  success(message: string, ...args: any[]): void {
    this.consolaInstance.success(message, ...args);
    this.logToFile("success", message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.consolaInstance.warn(message, ...args);
    this.logToFile("warn", message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.consolaInstance.error(message, ...args);
    this.logToFile("error", message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.consolaInstance.debug(message, ...args);
    this.logToFile("debug", message, ...args);
  }

  log(message: string, ...args: any[]): void {
    this.consolaInstance.log(message, ...args);
    this.logToFile("log", message, ...args);
  }

  /**
   * 创建一个带标签的日志实例（已废弃，直接返回原实例）
   * @param tag 标签（不再使用）
   * @deprecated 标签功能已移除
   */
  withTag(tag: string): Logger {
    // 不再添加标签，直接返回共享实例
    return this;
  }

  /**
   * 关闭日志文件流
   */
  close(): void {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }
  }
}

// 导出单例实例
export const logger = new Logger();
