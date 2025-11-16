import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import pino from "pino";
import type { Logger as PinoLogger } from "pino";
import { z } from "zod";
import type {
  ErrorLike,
  LevelInfo,
  LogArgument,
  LogObject,
  StructuredLogObject,
} from "./types";

const LogLevelSchema = z.enum([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
]);
type Level = z.infer<typeof LogLevelSchema>;

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm:ss 格式
 * @param date 要格式化的日期对象
 * @returns 格式化后的日期时间字符串
 */
function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 高性能日志记录器，基于 pino 实现
 *
 * 特性：
 * - 支持控制台和文件双重输出
 * - 支持守护进程模式（仅文件输出）
 * - 支持结构化日志记录
 * - 自动日志文件轮转和管理
 * - 高性能异步写入
 * - 完整的错误堆栈跟踪
 */
export class Logger {
  private logFilePath: string | null = null;
  private pinoInstance: PinoLogger;
  private isDaemonMode: boolean;
  private logLevel: Level; // 新增：动态日志级别
  private maxLogFileSize = 10 * 1024 * 1024; // 10MB 默认最大文件大小
  private maxLogFiles = 5; // 最多保留5个日志文件

  constructor(level: Level = "info") {
    // 检查是否为守护进程模式
    this.isDaemonMode = process.env.XIAOZHI_DAEMON === "true";

    // 设置并验证日志级别
    this.logLevel = this.validateLogLevel(level);

    // 创建 pino 实例
    this.pinoInstance = this.createPinoInstance();
  }

  /**
   * 验证日志级别
   * @param level 日志级别
   * @returns 验证后的日志级别
   */
  private validateLogLevel(level: string): Level {
    const normalizedLevel = level.toLowerCase();
    const result = LogLevelSchema.safeParse(normalizedLevel);

    if (result.success) {
      return result.data;
    }

    return "info";
  }

  private createPinoInstance(): PinoLogger {
    const streams: pino.StreamEntry[] = [];

    // 控制台流 - 只在非守护进程模式下添加
    if (!this.isDaemonMode) {
      // 使用高性能的控制台输出流
      const consoleStream = this.createOptimizedConsoleStream();
      streams.push({
        level: this.logLevel, // 修改：使用动态日志级别
        stream: consoleStream,
      });
    }

    // 文件流 - 如果有日志文件路径，使用高性能异步写入
    if (this.logFilePath) {
      streams.push({
        level: this.logLevel, // 修改：使用动态日志级别
        stream: pino.destination({
          dest: this.logFilePath,
          sync: false, // 异步写入提升性能
          append: true,
          mkdir: true,
        }),
      });
    }

    // 如果没有流，创建一个空的流避免错误
    if (streams.length === 0) {
      streams.push({
        level: this.logLevel, // 修改：使用动态日志级别
        stream: pino.destination({ dest: "/dev/null" }),
      });
    }

    return pino(
      {
        level: this.logLevel, // 修改：使用动态日志级别
        // 高性能配置
        timestamp:
          pino.stdTimeFunctions?.isoTime || (() => `,"time":${Date.now()}`),
        formatters: {
          // 优化级别格式化
          level: (_label: string, number: number) => ({ level: number }),
        },
        // 禁用不必要的功能以提升性能
        base: null, // 不包含 pid 和 hostname
        serializers: {
          // 优化错误序列化，在测试环境中安全处理
          err: pino.stdSerializers?.err || ((err: ErrorLike) => err),
        },
      },
      pino.multistream(streams, { dedupe: true })
    );
  }

  private createOptimizedConsoleStream() {
    // 预编译级别映射以提升性能
    const levelMap = new Map([
      [20, { name: "DEBUG", color: chalk.gray }],
      [30, { name: "INFO", color: chalk.blue }],
      [40, { name: "WARN", color: chalk.yellow }],
      [50, { name: "ERROR", color: chalk.red }],
      [60, { name: "FATAL", color: chalk.red }],
    ]);

    return {
      write: (chunk: string) => {
        try {
          const logObj = JSON.parse(chunk);
          const message = this.formatConsoleMessageOptimized(logObj, levelMap);
          // 在测试环境中安全地写入
          this.safeWrite(`${message}\n`);
        } catch (error) {
          // 如果解析失败，直接输出原始内容
          this.safeWrite(chunk);
        }
      },
    };
  }

  /**
   * 安全地写入到 stderr，在测试环境中避免错误
   */
  private safeWrite(content: string): void {
    try {
      if (process.stderr && typeof process.stderr.write === "function") {
        process.stderr.write(content);
      } else if (console && typeof console.error === "function") {
        // 在测试环境中回退到 console.error
        console.error(content.trim());
      }
    } catch (error) {
      // 在极端情况下静默失败，避免测试中断
    }
  }

  private formatConsoleMessageOptimized(
    logObj: LogObject,
    levelMap: Map<number, LevelInfo>
  ): string {
    const timestamp = formatDateTime(new Date());

    const levelInfo = levelMap.get(logObj.level) || {
      name: "UNKNOWN",
      color: (text: string) => text,
    };
    const coloredLevel = levelInfo.color(`[${levelInfo.name}]`);

    // 处理结构化日志中的 args，保持兼容性
    let message = logObj.msg;
    if (logObj.args && Array.isArray(logObj.args)) {
      const argsStr = logObj.args
        .map((arg: unknown) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg)
        )
        .join(" ");
      message = `${message} ${argsStr}`;
    }

    return `[${timestamp}] ${coloredLevel} ${message}`;
  }

  /**
   * 初始化日志文件
   * @param projectDir 项目目录
   */
  initLogFile(projectDir: string): void {
    this.logFilePath = path.join(projectDir, "xiaozhi.log");

    // 检查并轮转日志文件
    this.rotateLogFileIfNeeded();

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
   * 记录信息级别日志
   * @param message 日志消息
   * @param args 额外参数
   * @example
   * logger.info('用户登录', 'userId', 12345);
   * logger.info({ userId: 12345, action: 'login' }, '用户登录');
   */
  info(message: string, ...args: LogArgument[]): void;
  /**
   * 记录结构化信息级别日志
   * @param obj 结构化日志对象
   * @param message 可选的日志消息
   */
  info(obj: StructuredLogObject, message?: string): void;
  info(
    messageOrObj: string | StructuredLogObject,
    ...args: LogArgument[]
  ): void {
    if (typeof messageOrObj === "string") {
      if (args.length === 0) {
        this.pinoInstance.info(messageOrObj);
      } else {
        this.pinoInstance.info({ args }, messageOrObj);
      }
    } else {
      // 结构化日志支持
      this.pinoInstance.info(messageOrObj, args[0] as string || "");
    }
  }

  success(message: string, ...args: LogArgument[]): void;
  success(obj: StructuredLogObject, message?: string): void;
  success(
    messageOrObj: string | StructuredLogObject,
    ...args: LogArgument[]
  ): void {
    // success 映射为 info 级别，保持 API 兼容性
    if (typeof messageOrObj === "string") {
      if (args.length === 0) {
        this.pinoInstance.info(messageOrObj);
      } else {
        this.pinoInstance.info({ args }, messageOrObj);
      }
    } else {
      this.pinoInstance.info(messageOrObj, args[0] as string || "");
    }
  }

  warn(message: string, ...args: LogArgument[]): void;
  warn(obj: StructuredLogObject, message?: string): void;
  warn(
    messageOrObj: string | StructuredLogObject,
    ...args: LogArgument[]
  ): void {
    if (typeof messageOrObj === "string") {
      if (args.length === 0) {
        this.pinoInstance.warn(messageOrObj);
      } else {
        this.pinoInstance.warn({ args }, messageOrObj);
      }
    } else {
      this.pinoInstance.warn(messageOrObj, args[0] as string || "");
    }
  }

  error(message: string, ...args: LogArgument[]): void;
  error(obj: StructuredLogObject, message?: string): void;
  error(
    messageOrObj: string | StructuredLogObject,
    ...args: LogArgument[]
  ): void {
    if (typeof messageOrObj === "string") {
      if (args.length === 0) {
        this.pinoInstance.error(messageOrObj);
      } else {
        // 改进错误处理 - 特殊处理 Error 对象
        const errorArgs = args.map((arg) => {
          if (arg instanceof Error) {
            if (this.pinoInstance.level === "debug") return arg.message;
            return {
              message: arg.message,
              stack: arg.stack,
              name: arg.name,
              cause: arg.cause,
            };
          }
          return arg;
        });
        this.pinoInstance.error({ args: errorArgs }, messageOrObj);
      }
    } else {
      // 结构化错误日志，自动提取错误信息
      const enhancedObj = this.enhanceErrorObject(messageOrObj);
      this.pinoInstance.error(enhancedObj, args[0] as string || "");
    }
  }

  debug(message: string, ...args: LogArgument[]): void;
  debug(obj: StructuredLogObject, message?: string): void;
  debug(
    messageOrObj: string | StructuredLogObject,
    ...args: LogArgument[]
  ): void {
    if (typeof messageOrObj === "string") {
      if (args.length === 0) {
        this.pinoInstance.debug(messageOrObj);
      } else {
        this.pinoInstance.debug({ args }, messageOrObj);
      }
    } else {
      this.pinoInstance.debug(messageOrObj, args[0] as string || "");
    }
  }

  log(message: string, ...args: LogArgument[]): void;
  log(obj: StructuredLogObject, message?: string): void;
  log(
    messageOrObj: string | StructuredLogObject,
    ...args: LogArgument[]
  ): void {
    // log 方法使用 info 级别
    if (typeof messageOrObj === "string") {
      if (args.length === 0) {
        this.pinoInstance.info(messageOrObj);
      } else {
        this.pinoInstance.info({ args }, messageOrObj);
      }
    } else {
      this.pinoInstance.info(messageOrObj, args[0] as string || "");
    }
  }

  /**
   * 增强错误对象，提取更多错误信息
   */
  private enhanceErrorObject(obj: StructuredLogObject): StructuredLogObject {
    const enhanced = { ...obj };

    // 遍历对象属性，查找 Error 实例
    for (const [key, value] of Object.entries(enhanced)) {
      if (value instanceof Error) {
        enhanced[key] = {
          message: value.message,
          stack: value.stack,
          name: value.name,
          cause: value.cause,
        };
      }
    }

    return enhanced;
  }

  /**
   * 检查并轮转日志文件（如果需要）
   */
  private rotateLogFileIfNeeded(): void {
    if (!this.logFilePath || !fs.existsSync(this.logFilePath)) {
      return;
    }

    try {
      const stats = fs.statSync(this.logFilePath);
      if (stats.size > this.maxLogFileSize) {
        this.rotateLogFile();
      }
    } catch (error) {
      // 忽略文件状态检查错误
    }
  }

  /**
   * 轮转日志文件
   */
  private rotateLogFile(): void {
    if (!this.logFilePath) return;

    try {
      const logDir = path.dirname(this.logFilePath);
      const logName = path.basename(this.logFilePath, ".log");

      // 移动现有的编号日志文件
      for (let i = this.maxLogFiles - 1; i >= 1; i--) {
        const oldFile = path.join(logDir, `${logName}.${i}.log`);
        const newFile = path.join(logDir, `${logName}.${i + 1}.log`);

        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            // 删除最老的文件
            fs.unlinkSync(oldFile);
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // 将当前日志文件重命名为 .1.log
      const firstRotatedFile = path.join(logDir, `${logName}.1.log`);
      fs.renameSync(this.logFilePath, firstRotatedFile);
    } catch (error) {
      // 轮转失败时忽略错误，继续使用当前文件
    }
  }

  /**
   * 清理旧的日志文件
   */
  cleanupOldLogs(): void {
    if (!this.logFilePath) return;

    try {
      const logDir = path.dirname(this.logFilePath);
      const logName = path.basename(this.logFilePath, ".log");

      // 删除超过最大数量的日志文件
      for (let i = this.maxLogFiles + 1; i <= this.maxLogFiles + 10; i++) {
        const oldFile = path.join(logDir, `${logName}.${i}.log`);
        if (fs.existsSync(oldFile)) {
          fs.unlinkSync(oldFile);
        }
      }
    } catch (error) {
      // 忽略清理错误
    }
  }

  /**
   * 设置日志文件管理参数
   */
  setLogFileOptions(maxSize: number, maxFiles: number): void {
    this.maxLogFileSize = maxSize;
    this.maxLogFiles = maxFiles;
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

  /**
   * 动态设置日志级别
   * @param level 新的日志级别
   * @description 动态更新Logger实例的日志级别
   */
  setLevel(level: Level): void {
    this.logLevel = this.validateLogLevel(level);

    // 重新创建pino实例以应用新的日志级别
    this.pinoInstance = this.createPinoInstance();
  }

  /**
   * 获取当前日志级别
   * @returns 当前日志级别
   */
  getLevel(): Level {
    return this.logLevel;
  }
}

// 全局Logger实例管理
let globalLogger: Logger | null = null;
let globalLogLevel: Level = "info"; // 全局日志级别

/**
 * 创建Logger实例
 * @param level 日志级别，默认为全局级别
 * @returns Logger实例
 */
export function createLogger(level?: Level): Logger {
  return new Logger(level || globalLogLevel);
}

/**
 * 获取全局Logger实例
 * @returns 全局Logger实例
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(globalLogLevel); // 使用全局级别
  }
  return globalLogger;
}

/**
 * 设置全局Logger实例
 * @param logger 新的Logger实例
 */
export function setGlobalLogger(logger: Logger): void {
  globalLogger = logger;
}

/**
 * 设置全局日志级别
 * @param level 新的日志级别
 * @description 更新全局日志级别，并影响现有和未来的Logger实例
 */
export function setGlobalLogLevel(level: Level): void {
  globalLogLevel = level;

  // 如果已存在全局Logger实例，更新其级别
  if (globalLogger) {
    globalLogger.setLevel(level);
  }
}

/**
 * 获取当前全局日志级别
 * @returns 当前日志级别
 */
export function getGlobalLogLevel(): Level {
  return globalLogLevel;
}

// 导出默认实例（向后兼容）
export const logger = getLogger();
