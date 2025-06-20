import fs from "node:fs";
import path from "node:path";
import { consola } from "consola";

export class Logger {
  private logFilePath: string | null = null;
  private writeStream: fs.WriteStream | null = null;

  constructor() {
    // 设置 consola 的格式
    consola.options.formatOptions = {
      date: true,
      colors: true,
    };
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
    consola.info(message, ...args);
    this.logToFile("info", message, ...args);
  }

  success(message: string, ...args: any[]): void {
    consola.success(message, ...args);
    this.logToFile("success", message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    consola.warn(message, ...args);
    this.logToFile("warn", message, ...args);
  }

  error(message: string, ...args: any[]): void {
    consola.error(message, ...args);
    this.logToFile("error", message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    consola.debug(message, ...args);
    this.logToFile("debug", message, ...args);
  }

  log(message: string, ...args: any[]): void {
    consola.log(message, ...args);
    this.logToFile("log", message, ...args);
  }

  /**
   * 创建一个带标签的日志实例
   * @param tag 标签
   */
  withTag(tag: string): Logger {
    const taggedLogger = new Logger();
    taggedLogger.logFilePath = this.logFilePath;
    taggedLogger.writeStream = this.writeStream;

    // 重写所有日志方法，添加标签
    const methods = [
      "info",
      "success",
      "warn",
      "error",
      "debug",
      "log",
    ] as const;
    for (const method of methods) {
      const originalMethod = taggedLogger[method].bind(taggedLogger);
      (taggedLogger as any)[method] = (message: string, ...args: any[]) => {
        originalMethod(`[${tag}] ${message}`, ...args);
      };
    }

    return taggedLogger;
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
