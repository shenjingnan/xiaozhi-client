export interface SamplingStats {
  totalMessages: number;
  sampledMessages: number;
  droppedMessages: number;
  samplingRate: number;
  levelStats: Record<
    string,
    {
      total: number;
      sampled: number;
      dropped: number;
    }
  >;
  duplicateStats: {
    total: number;
    suppressed: number;
  };
}

export interface SamplingConfig {
  // 全局采样率 (0-1)
  globalSamplingRate: number;

  // 按级别的采样率
  levelSamplingRates: Record<string, number>;

  // 重复日志抑制配置
  duplicateSuppressionEnabled: boolean;
  duplicateSuppressionWindow: number; // 毫秒
  duplicateSuppressionMaxCount: number;

  // 错误和警告始终记录
  alwaysLogErrors: boolean;
  alwaysLogWarnings: boolean;
}

export class PinoSampler {
  private config: SamplingConfig;
  private stats: SamplingStats;
  private duplicateTracker: Map<
    string,
    {
      count: number;
      firstSeen: number;
      lastSeen: number;
    }
  >;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<SamplingConfig> = {}) {
    this.config = {
      globalSamplingRate: 1.0,
      levelSamplingRates: {
        trace: 0.1,
        debug: 0.5,
        info: 1.0,
        warn: 1.0,
        error: 1.0,
        fatal: 1.0,
      },
      duplicateSuppressionEnabled: true,
      duplicateSuppressionWindow: 60000, // 1分钟
      duplicateSuppressionMaxCount: 5,
      alwaysLogErrors: true,
      alwaysLogWarnings: true,
      ...config,
    };

    this.stats = this.createEmptyStats();
    this.duplicateTracker = new Map();

    // 启动清理定时器
    this.startCleanupTimer();
  }

  private createEmptyStats(): SamplingStats {
    return {
      totalMessages: 0,
      sampledMessages: 0,
      droppedMessages: 0,
      samplingRate: this.config.globalSamplingRate,
      levelStats: {},
      duplicateStats: {
        total: 0,
        suppressed: 0,
      },
    };
  }

  private startCleanupTimer(): void {
    // 每5分钟清理一次过期的重复日志记录
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredDuplicates();
      },
      5 * 60 * 1000
    );
  }

  private cleanupExpiredDuplicates(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, record] of this.duplicateTracker.entries()) {
      if (now - record.lastSeen > this.config.duplicateSuppressionWindow) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.duplicateTracker.delete(key);
    }
  }

  private generateMessageKey(level: string, message: string): string {
    // 生成消息的唯一键，用于重复检测
    // 只使用消息的前100个字符来避免内存过度使用
    const truncatedMessage = message.substring(0, 100);
    return `${level}:${truncatedMessage}`;
  }

  private shouldSuppressDuplicate(level: string, message: string): boolean {
    if (!this.config.duplicateSuppressionEnabled) {
      return false;
    }

    const key = this.generateMessageKey(level, message);
    const now = Date.now();
    const record = this.duplicateTracker.get(key);

    this.stats.duplicateStats.total++;

    if (!record) {
      // 第一次看到这个消息
      this.duplicateTracker.set(key, {
        count: 1,
        firstSeen: now,
        lastSeen: now,
      });
      return false;
    }

    // 检查是否在抑制窗口内
    if (now - record.firstSeen > this.config.duplicateSuppressionWindow) {
      // 超出窗口，重置计数
      this.duplicateTracker.set(key, {
        count: 1,
        firstSeen: now,
        lastSeen: now,
      });
      return false;
    }

    // 更新记录
    record.count++;
    record.lastSeen = now;

    // 检查是否超过最大计数
    if (record.count > this.config.duplicateSuppressionMaxCount) {
      this.stats.duplicateStats.suppressed++;
      return true;
    }

    return false;
  }

  private getLevelSamplingRate(level: string): number {
    // 错误和警告始终记录
    if (
      this.config.alwaysLogErrors &&
      (level === "error" || level === "fatal")
    ) {
      return 1.0;
    }

    if (this.config.alwaysLogWarnings && level === "warn") {
      return 1.0;
    }

    // 使用级别特定的采样率，如果没有则使用全局采样率
    return (
      this.config.levelSamplingRates[level] ?? this.config.globalSamplingRate
    );
  }

  private updateStats(level: string, sampled: boolean): void {
    this.stats.totalMessages++;

    if (!this.stats.levelStats[level]) {
      this.stats.levelStats[level] = {
        total: 0,
        sampled: 0,
        dropped: 0,
      };
    }

    this.stats.levelStats[level].total++;

    if (sampled) {
      this.stats.sampledMessages++;
      this.stats.levelStats[level].sampled++;
    } else {
      this.stats.droppedMessages++;
      this.stats.levelStats[level].dropped++;
    }

    // 更新整体采样率
    this.stats.samplingRate =
      this.stats.totalMessages > 0
        ? this.stats.sampledMessages / this.stats.totalMessages
        : 0;
  }

  shouldSample(level: string, message: string): boolean {
    // 检查重复抑制
    if (this.shouldSuppressDuplicate(level, message)) {
      this.updateStats(level, false);
      return false;
    }

    // 获取该级别的采样率
    const samplingRate = this.getLevelSamplingRate(level);

    // 进行采样决策
    const shouldSample = Math.random() < samplingRate;

    this.updateStats(level, shouldSample);

    return shouldSample;
  }

  updateConfig(newConfig: Partial<SamplingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): SamplingConfig {
    return { ...this.config };
  }

  getStats(): SamplingStats {
    return {
      ...this.stats,
      levelStats: { ...this.stats.levelStats },
      duplicateStats: { ...this.stats.duplicateStats },
    };
  }

  resetStats(): void {
    this.stats = this.createEmptyStats();
  }

  clearDuplicateTracker(): void {
    this.duplicateTracker.clear();
  }

  getDuplicateTrackerSize(): number {
    return this.duplicateTracker.size;
  }

  // 获取采样统计摘要
  getStatsSummary(): string {
    const stats = this.getStats();
    const summary = {
      totalMessages: stats.totalMessages,
      sampledMessages: stats.sampledMessages,
      droppedMessages: stats.droppedMessages,
      overallSamplingRate: `${(stats.samplingRate * 100).toFixed(2)}%`,
      duplicatesSuppressed: stats.duplicateStats.suppressed,
      duplicateTrackerSize: this.getDuplicateTrackerSize(),
      levelBreakdown: Object.entries(stats.levelStats).map(
        ([level, levelStats]) => ({
          level,
          total: levelStats.total,
          sampled: levelStats.sampled,
          dropped: levelStats.dropped,
          samplingRate: `${((levelStats.sampled / levelStats.total) * 100).toFixed(2)}%`,
        })
      ),
    };

    return JSON.stringify(summary, null, 2);
  }

  // 清理资源
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.duplicateTracker.clear();
  }
}
