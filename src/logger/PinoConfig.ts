export interface PinoConfigOptions {
  // 基础配置
  level: string;
  isDaemonMode: boolean;

  // 文件配置
  logFilePath: string;
  enableFileLogging: boolean;

  // 性能配置
  asyncLogging: boolean;
  bufferSize: number;
  flushInterval: number;

  // 格式配置
  prettyPrint: boolean;
  structuredLogging: boolean;

  // 高级配置
  redactPaths: string[];
  samplingRate: number;
}

export class PinoConfigManager {
  private static instance: PinoConfigManager | null = null;
  private config: PinoConfigOptions;
  private configListeners: Array<(config: PinoConfigOptions) => void> = [];

  private constructor() {
    this.config = this.createDefaultConfig();
    this.loadFromEnvironment();
    this.validateConfig();
  }

  static getInstance(): PinoConfigManager {
    if (!PinoConfigManager.instance) {
      PinoConfigManager.instance = new PinoConfigManager();
    }
    return PinoConfigManager.instance;
  }

  private createDefaultConfig(): PinoConfigOptions {
    return {
      // 基础配置
      level: "info",
      isDaemonMode: false,

      // 文件配置
      logFilePath: "./xiaozhi.log",
      enableFileLogging: true,

      // 性能配置
      asyncLogging: true,
      bufferSize: 8192,
      flushInterval: 1000,

      // 格式配置
      prettyPrint: process.env.NODE_ENV === "development",
      structuredLogging: true,

      // 高级配置
      redactPaths: [],
      samplingRate: 1.0,
    };
  }

  private loadFromEnvironment(): void {
    // 基础配置
    if (
      process.env.XIAOZHI_LOG_LEVEL &&
      process.env.XIAOZHI_LOG_LEVEL !== "undefined"
    ) {
      this.config.level = process.env.XIAOZHI_LOG_LEVEL;
    }

    if (process.env.XIAOZHI_DAEMON === "true") {
      this.config.isDaemonMode = true;
    }

    // 文件配置
    if (process.env.XIAOZHI_LOG_FILE) {
      this.config.logFilePath = process.env.XIAOZHI_LOG_FILE;
    }

    if (process.env.XIAOZHI_LOG_FILE_ENABLED === "false") {
      this.config.enableFileLogging = false;
    }

    // 性能配置
    if (process.env.XIAOZHI_LOG_ASYNC === "false") {
      this.config.asyncLogging = false;
    }

    if (process.env.XIAOZHI_LOG_BUFFER_SIZE) {
      const bufferSize = Number.parseInt(
        process.env.XIAOZHI_LOG_BUFFER_SIZE,
        10
      );
      if (!Number.isNaN(bufferSize)) {
        this.config.bufferSize = bufferSize;
      }
    }

    if (process.env.XIAOZHI_LOG_FLUSH_INTERVAL) {
      const flushInterval = Number.parseInt(
        process.env.XIAOZHI_LOG_FLUSH_INTERVAL,
        10
      );
      if (!Number.isNaN(flushInterval)) {
        this.config.flushInterval = flushInterval;
      }
    }

    // 格式配置
    if (process.env.XIAOZHI_LOG_STRUCTURED === "false") {
      this.config.structuredLogging = false;
    }

    // 高级配置
    if (process.env.XIAOZHI_LOG_REDACT) {
      this.config.redactPaths = process.env.XIAOZHI_LOG_REDACT.split(",")
        .map((path) => path.trim())
        .filter((path) => path.length > 0);
    }

    if (process.env.XIAOZHI_LOG_SAMPLING_RATE) {
      const samplingRate = Number.parseFloat(
        process.env.XIAOZHI_LOG_SAMPLING_RATE
      );
      if (!Number.isNaN(samplingRate)) {
        this.config.samplingRate = samplingRate;
      }
    }
  }

  private validateConfig(): void {
    // 验证采样率
    if (this.config.samplingRate < 0 || this.config.samplingRate > 1) {
      throw new Error("采样率必须在0-1之间");
    }

    // 验证缓冲区大小
    if (this.config.bufferSize < 1024) {
      throw new Error("缓冲区大小不能小于1024字节");
    }

    // 验证刷新间隔
    if (this.config.flushInterval < 100) {
      throw new Error("刷新间隔不能小于100毫秒");
    }

    // 验证日志级别
    const validLevels = ["trace", "debug", "info", "warn", "error", "fatal"];
    if (!validLevels.includes(this.config.level.toLowerCase())) {
      throw new Error(`无效的日志级别: ${this.config.level}`);
    }
  }

  getConfig(): PinoConfigOptions {
    return { ...this.config };
  }

  updateConfig(updates: Partial<PinoConfigOptions>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };

    try {
      this.validateConfig();
      this.notifyConfigChange();
    } catch (error) {
      // 回滚配置
      this.config = oldConfig;
      throw error;
    }
  }

  reloadFromEnvironment(): void {
    this.loadFromEnvironment();
    this.validateConfig();
    this.notifyConfigChange();
  }

  onConfigChange(listener: (config: PinoConfigOptions) => void): void {
    this.configListeners.push(listener);
  }

  removeConfigListener(listener: (config: PinoConfigOptions) => void): void {
    const index = this.configListeners.indexOf(listener);
    if (index > -1) {
      this.configListeners.splice(index, 1);
    }
  }

  private notifyConfigChange(): void {
    const config = this.getConfig();
    for (const listener of this.configListeners) {
      try {
        listener(config);
      } catch (error) {
        console.error("配置变更监听器执行失败:", error);
      }
    }
  }

  // 获取特定配置的便捷方法
  getLogLevel(): string {
    return this.config.level;
  }

  isDaemon(): boolean {
    return this.config.isDaemonMode;
  }

  isAsyncLogging(): boolean {
    return this.config.asyncLogging;
  }

  getBufferSize(): number {
    return this.config.bufferSize;
  }

  getFlushInterval(): number {
    return this.config.flushInterval;
  }

  getSamplingRate(): number {
    return this.config.samplingRate;
  }

  getRedactPaths(): string[] {
    return [...this.config.redactPaths];
  }

  isStructuredLogging(): boolean {
    return this.config.structuredLogging;
  }

  // 重置为默认配置
  reset(): void {
    this.config = this.createDefaultConfig();
    this.loadFromEnvironment();
    this.validateConfig();
    this.notifyConfigChange();
  }

  // 获取配置摘要（用于调试）
  getConfigSummary(): string {
    return JSON.stringify(
      {
        level: this.config.level,
        isDaemonMode: this.config.isDaemonMode,
        asyncLogging: this.config.asyncLogging,
        bufferSize: this.config.bufferSize,
        flushInterval: this.config.flushInterval,
        samplingRate: this.config.samplingRate,
        structuredLogging: this.config.structuredLogging,
        redactPathsCount: this.config.redactPaths.length,
      },
      null,
      2
    );
  }
}
