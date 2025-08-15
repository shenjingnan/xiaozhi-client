import pino, { type Logger as PinoLogger } from "pino";

export interface PinoAdapterConfig {
  level: string;
  isDaemonMode: boolean;
  logFilePath?: string;
  enableFileLogging: boolean;
}

export class PinoAdapter {
  private pinoLogger: PinoLogger;
  private config: PinoAdapterConfig;

  constructor(config: PinoAdapterConfig) {
    this.config = config;
    this.pinoLogger = this.createPinoInstance();
  }

  private createPinoInstance(): PinoLogger {
    const baseConfig = {
      level: this.config.level,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label: string) => ({ level: label.toUpperCase() }),
      },
    };

    // 守护进程模式：只输出到文件
    if (this.config.isDaemonMode && this.config.enableFileLogging) {
      return pino(
        baseConfig,
        pino.destination({
          dest: this.config.logFilePath,
          sync: false, // 异步写入
          mkdir: true,
        })
      );
    }

    // 开发模式：美化输出到控制台
    if (!this.config.isDaemonMode) {
      return pino(
        baseConfig,
        pino.transport({
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "yyyy-mm-dd HH:MM:ss",
            ignore: "pid,hostname",
          },
        })
      );
    }

    // 默认：控制台输出
    return pino(baseConfig);
  }

  // 兼容性方法
  info(message: string, ...args: any[]): void {
    if (args.length > 0) {
      this.pinoLogger.info({ args }, message);
    } else {
      this.pinoLogger.info(message);
    }
  }

  error(message: string, ...args: any[]): void {
    if (args.length > 0) {
      this.pinoLogger.error({ args }, message);
    } else {
      this.pinoLogger.error(message);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (args.length > 0) {
      this.pinoLogger.warn({ args }, message);
    } else {
      this.pinoLogger.warn(message);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (args.length > 0) {
      this.pinoLogger.debug({ args }, message);
    } else {
      this.pinoLogger.debug(message);
    }
  }

  success(message: string, ...args: any[]): void {
    // Pino没有success级别，映射到info
    if (args.length > 0) {
      this.pinoLogger.info({ args, type: "success" }, message);
    } else {
      this.pinoLogger.info({ type: "success" }, message);
    }
  }

  log(message: string, ...args: any[]): void {
    this.info(message, ...args);
  }

  // 子logger支持
  withTag(tag: string): PinoAdapter {
    const childLogger = this.pinoLogger.child({ tag });
    const childAdapter = Object.create(this);
    childAdapter.pinoLogger = childLogger;
    return childAdapter;
  }

  // 配置更新
  setLevel(level: string): void {
    this.pinoLogger.level = this.mapLogLevel(level);
  }

  private mapLogLevel(level: string): string {
    switch (level.toLowerCase()) {
      case "error":
        return "error";
      case "warn":
        return "warn";
      case "info":
        return "info";
      case "debug":
        return "debug";
      case "success":
        return "info"; // success映射到info
      case "log":
        return "info"; // log映射到info
      default:
        return "info";
    }
  }

  // 获取原生Pino实例（用于高级功能）
  getPinoInstance(): PinoLogger {
    return this.pinoLogger;
  }
}
