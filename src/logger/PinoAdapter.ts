import pino, { type Logger as PinoLogger } from "pino";
import { PinoConfigManager } from "./PinoConfig";
import { PinoSampler } from "./PinoSampler";

export interface PinoAdapterConfig {
  level: string;
  isDaemonMode: boolean;
  logFilePath?: string;
  enableFileLogging: boolean;
}

export interface LoggerInterface {
  info(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  success(message: string, ...args: any[]): void;
  log(message: string, ...args: any[]): void;
  withTag(tag: string): LoggerInterface;
}

export class PinoAdapter implements LoggerInterface {
  private pinoLogger: PinoLogger;
  private config: PinoAdapterConfig;
  private configManager: PinoConfigManager;
  private sampler: PinoSampler;
  private tag?: string;

  constructor(config?: PinoAdapterConfig, tag?: string) {
    this.tag = tag;
    this.configManager = PinoConfigManager.getInstance();

    // 如果提供了配置，使用它；否则从配置管理器获取
    if (config) {
      this.config = config;
    } else {
      const globalConfig = this.configManager.getConfig();
      this.config = {
        level: globalConfig.level,
        isDaemonMode: globalConfig.isDaemonMode,
        logFilePath: globalConfig.logFilePath,
        enableFileLogging: globalConfig.enableFileLogging,
      };
    }

    this.sampler = this.createSampler();
    this.pinoLogger = this.createPinoInstance();

    // 监听配置变更
    this.configManager.onConfigChange(() => {
      const globalConfig = this.configManager.getConfig();
      this.config = {
        level: globalConfig.level,
        isDaemonMode: globalConfig.isDaemonMode,
        logFilePath: globalConfig.logFilePath,
        enableFileLogging: globalConfig.enableFileLogging,
      };
      this.pinoLogger = this.createPinoInstance();
      this.sampler = this.createSampler();
    });
  }

  private createSampler(): PinoSampler {
    const globalConfig = this.configManager.getConfig();
    return new PinoSampler({
      globalSamplingRate: globalConfig.samplingRate,
      duplicateSuppressionEnabled: true,
      duplicateSuppressionWindow: 60000,
      duplicateSuppressionMaxCount: 5,
      alwaysLogErrors: true,
      alwaysLogWarnings: true,
    });
  }

  private createPinoInstance(): PinoLogger {
    const globalConfig = this.configManager.getConfig();

    const baseConfig = {
      level: this.config.level,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label: string) => ({ level: label.toUpperCase() }),
      },
      ...(this.tag && { tag: this.tag }),
      ...(globalConfig.redactPaths.length > 0 && {
        redact: globalConfig.redactPaths,
      }),
    };

    // 守护进程模式：高性能文件输出
    if (this.config.isDaemonMode && this.config.enableFileLogging) {
      return pino(baseConfig, this.createDaemonTransport(globalConfig));
    }

    // 开发模式：美化输出到控制台
    if (!this.config.isDaemonMode && globalConfig.prettyPrint) {
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

  private createDaemonTransport(globalConfig: any) {
    const transportOptions: any = {
      dest: this.config.logFilePath,
      mkdir: true,
    };

    if (globalConfig.asyncLogging) {
      transportOptions.sync = false;
      transportOptions.bufferSize = globalConfig.bufferSize;
      transportOptions.flushInterval = globalConfig.flushInterval;
    } else {
      transportOptions.sync = true;
    }

    return pino.destination(transportOptions);
  }

  private shouldLog(level: string, message: string): boolean {
    return this.sampler.shouldSample(level, message);
  }

  // 兼容性方法（集成采样）
  info(message: string, ...args: any[]): void {
    if (this.shouldLog("info", message)) {
      if (args.length > 0) {
        this.pinoLogger.info({ args }, message);
      } else {
        this.pinoLogger.info(message);
      }
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog("error", message)) {
      if (args.length > 0) {
        this.pinoLogger.error({ args }, message);
      } else {
        this.pinoLogger.error(message);
      }
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog("warn", message)) {
      if (args.length > 0) {
        this.pinoLogger.warn({ args }, message);
      } else {
        this.pinoLogger.warn(message);
      }
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog("debug", message)) {
      if (args.length > 0) {
        this.pinoLogger.debug({ args }, message);
      } else {
        this.pinoLogger.debug(message);
      }
    }
  }

  success(message: string, ...args: any[]): void {
    // Pino没有success级别，映射到info
    if (this.shouldLog("info", message)) {
      if (args.length > 0) {
        this.pinoLogger.info({ args, type: "success" }, message);
      } else {
        this.pinoLogger.info({ type: "success" }, message);
      }
    }
  }

  log(message: string, ...args: any[]): void {
    this.info(message, ...args);
  }

  // 子logger支持
  withTag(tag: string): LoggerInterface {
    return new PinoAdapter(this.config, tag);
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

  // 获取采样统计信息
  getSamplingStats(): string {
    return this.sampler.getStatsSummary();
  }

  // 重置采样统计
  resetSamplingStats(): void {
    this.sampler.resetStats();
  }

  // 清理资源
  destroy(): void {
    this.sampler.destroy();
  }
}
