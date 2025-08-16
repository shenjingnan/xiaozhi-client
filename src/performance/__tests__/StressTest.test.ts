import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Logger } from "../../logger.js";
import { LogContext } from "../../logger/LogContext.js";
import { PinoConfigManager } from "../../logger/PinoConfig.js";

interface StressTestMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  duration: number;
  averageThroughput: number;
  peakThroughput: number;
  memoryStats: {
    initial: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
    final: NodeJS.MemoryUsage;
    samples: NodeJS.MemoryUsage[];
  };
  errorRate: number;
  responseTimeStats: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };
}

interface StressTestConfig {
  name: string;
  duration: number; // 测试持续时间（毫秒）
  targetQPS: number; // 目标每秒查询数
  concurrency: number; // 并发数
  usePino: boolean;
  useContext: boolean;
  useStructured: boolean;
  samplingRate?: number;
  logLevel: string;
}

class StressTester {
  private isRunning = false;
  private metrics: StressTestMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    duration: 0,
    averageThroughput: 0,
    peakThroughput: 0,
    memoryStats: {
      initial: process.memoryUsage(),
      peak: process.memoryUsage(),
      final: process.memoryUsage(),
      samples: [],
    },
    errorRate: 0,
    responseTimeStats: {
      min: Number.POSITIVE_INFINITY,
      max: 0,
      avg: 0,
      p95: 0,
      p99: 0,
    },
  };
  private responseTimes: number[] = [];

  async runStressTest(config: StressTestConfig): Promise<StressTestMetrics> {
    console.log(`\n🔥 开始压力测试: ${config.name}`);
    console.log(
      `  目标QPS: ${config.targetQPS}, 并发数: ${config.concurrency}, 持续时间: ${config.duration}ms`
    );

    this.setupEnvironment(config);
    this.resetMetrics();

    const logger = new Logger().withTag("STRESS-TEST");
    const logContext = config.useContext ? LogContext.getInstance() : null;

    this.isRunning = true;
    const startTime = Date.now();

    // 启动内存监控
    const memoryMonitor = this.startMemoryMonitoring();

    // 启动吞吐量监控
    const throughputMonitor = this.startThroughputMonitoring();

    // 创建工作负载
    const workers = this.createWorkers(config, logger, logContext);

    // 等待测试完成
    await this.waitForCompletion(config.duration);

    // 停止所有监控
    this.isRunning = false;
    clearInterval(memoryMonitor);
    clearInterval(throughputMonitor);

    // 等待所有worker完成
    await Promise.allSettled(workers);

    const endTime = Date.now();
    this.metrics.duration = endTime - startTime;
    this.metrics.final = process.memoryUsage();

    // 计算统计数据
    this.calculateStats();

    console.log(
      `  ✅ 完成 - 总操作: ${this.metrics.totalOperations}, 成功率: ${(100 - this.metrics.errorRate).toFixed(2)}%`
    );
    console.log(
      `  📊 平均吞吐量: ${this.metrics.averageThroughput.toFixed(0)} ops/sec, 峰值: ${this.metrics.peakThroughput.toFixed(0)} ops/sec`
    );

    return { ...this.metrics };
  }

  private setupEnvironment(config: StressTestConfig): void {
    process.env.XIAOZHI_USE_PINO = config.usePino.toString();
    process.env.XIAOZHI_LOG_LEVEL = config.logLevel;
    process.env.XIAOZHI_LOG_ASYNC = "true";
    process.env.XIAOZHI_LOG_BUFFER_SIZE = "32768";
    process.env.XIAOZHI_LOG_SAMPLING_RATE = (
      config.samplingRate ?? 1.0
    ).toString();
    process.env.XIAOZHI_DAEMON = "false";
    process.env.XIAOZHI_LOG_CONTEXT_ENABLED = config.useContext.toString();

    const configManager = PinoConfigManager.getInstance();
    configManager.reloadFromEnvironment();
  }

  private resetMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      duration: 0,
      averageThroughput: 0,
      peakThroughput: 0,
      memoryStats: {
        initial: process.memoryUsage(),
        peak: process.memoryUsage(),
        final: process.memoryUsage(),
        samples: [],
      },
      errorRate: 0,
      responseTimeStats: {
        min: Number.POSITIVE_INFINITY,
        max: 0,
        avg: 0,
        p95: 0,
        p99: 0,
      },
    };
    this.responseTimes = [];
  }

  private startMemoryMonitoring(): NodeJS.Timeout {
    return setInterval(() => {
      if (!this.isRunning) return;

      const currentMemory = process.memoryUsage();
      this.metrics.memoryStats.samples.push(currentMemory);

      if (currentMemory.heapUsed > this.metrics.memoryStats.peak.heapUsed) {
        this.metrics.memoryStats.peak = currentMemory;
      }
    }, 1000); // 每秒采样一次
  }

  private startThroughputMonitoring(): NodeJS.Timeout {
    let lastOperationCount = 0;
    let lastTime = Date.now();

    return setInterval(() => {
      if (!this.isRunning) return;

      const currentTime = Date.now();
      const currentOperations = this.metrics.totalOperations;
      const timeDiff = (currentTime - lastTime) / 1000;
      const operationDiff = currentOperations - lastOperationCount;

      if (timeDiff > 0) {
        const currentThroughput = operationDiff / timeDiff;
        if (currentThroughput > this.metrics.peakThroughput) {
          this.metrics.peakThroughput = currentThroughput;
        }
      }

      lastOperationCount = currentOperations;
      lastTime = currentTime;
    }, 1000); // 每秒计算一次
  }

  private createWorkers(
    config: StressTestConfig,
    logger: Logger,
    logContext: LogContext | null
  ): Promise<void>[] {
    const workers: Promise<void>[] = [];
    const operationsPerWorker = Math.ceil(
      config.targetQPS / config.concurrency
    );
    const intervalMs = 1000 / operationsPerWorker;

    for (let i = 0; i < config.concurrency; i++) {
      const worker = this.createWorker(
        i,
        intervalMs,
        logger,
        logContext,
        config
      );
      workers.push(worker);
    }

    return workers;
  }

  private async createWorker(
    workerId: number,
    intervalMs: number,
    logger: Logger,
    logContext: LogContext | null,
    config: StressTestConfig
  ): Promise<void> {
    let operationCount = 0;

    while (this.isRunning) {
      const startTime = process.hrtime.bigint();

      try {
        await this.performLogOperation(
          workerId,
          operationCount,
          logger,
          logContext,
          config
        );
        this.metrics.successfulOperations++;
      } catch (error) {
        this.metrics.failedOperations++;
      }

      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      this.responseTimes.push(responseTime);

      this.metrics.totalOperations++;
      operationCount++;

      // 控制发送速率
      if (intervalMs > 0) {
        await this.sleep(intervalMs);
      }
    }
  }

  private async performLogOperation(
    workerId: number,
    operationCount: number,
    logger: Logger,
    logContext: LogContext | null,
    config: StressTestConfig
  ): Promise<void> {
    const testData = {
      workerId,
      operationCount,
      timestamp: new Date(),
      randomValue: Math.random(),
      payload: {
        data: new Array(100)
          .fill(0)
          .map((_, i) => ({ id: i, value: Math.random() })),
        metadata: {
          source: "stress-test",
          version: "1.0.0",
          worker: workerId,
        },
      },
    };

    if (config.useContext && logContext) {
      const context = logContext.createContextFromHeaders({
        "x-trace-id": `stress-${workerId}-${operationCount}`,
        "x-user-id": `user-${operationCount % 1000}`,
      });

      await logContext.runAsync(context, async () => {
        logger.info("Stress test operation", testData);

        // 模拟不同类型的日志
        if (operationCount % 10 === 0) {
          logger.warn("Warning in stress test", { workerId, operationCount });
        }

        if (operationCount % 100 === 0) {
          logger.error("Error in stress test", {
            workerId,
            operationCount,
            error: "Simulated error",
          });
        }
      });
    } else {
      logger.info("Stress test operation", testData);

      if (operationCount % 10 === 0) {
        logger.warn("Warning in stress test", { workerId, operationCount });
      }

      if (operationCount % 100 === 0) {
        logger.error("Error in stress test", {
          workerId,
          operationCount,
          error: "Simulated error",
        });
      }
    }
  }

  private async waitForCompletion(duration: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.isRunning = false;
        resolve();
      }, duration);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateStats(): void {
    if (this.metrics.duration > 0) {
      this.metrics.averageThroughput =
        (this.metrics.totalOperations / this.metrics.duration) * 1000;
    }

    if (this.metrics.totalOperations > 0) {
      this.metrics.errorRate =
        (this.metrics.failedOperations / this.metrics.totalOperations) * 100;
    }

    if (this.responseTimes.length > 0) {
      this.responseTimes.sort((a, b) => a - b);

      this.metrics.responseTimeStats.min = this.responseTimes[0];
      this.metrics.responseTimeStats.max =
        this.responseTimes[this.responseTimes.length - 1];
      this.metrics.responseTimeStats.avg =
        this.responseTimes.reduce((a, b) => a + b, 0) /
        this.responseTimes.length;

      const p95Index = Math.floor(this.responseTimes.length * 0.95);
      const p99Index = Math.floor(this.responseTimes.length * 0.99);

      this.metrics.responseTimeStats.p95 = this.responseTimes[p95Index];
      this.metrics.responseTimeStats.p99 = this.responseTimes[p99Index];
    }
  }

  generateStressTestReport(results: Map<string, StressTestMetrics>): string {
    let report = "\n=== 压力测试报告 ===\n\n";

    for (const [testName, metrics] of results.entries()) {
      report += `📊 ${testName}:\n`;
      report += `  总操作数: ${metrics.totalOperations.toLocaleString()}\n`;
      report += `  成功率: ${(100 - metrics.errorRate).toFixed(2)}%\n`;
      report += `  平均吞吐量: ${metrics.averageThroughput.toFixed(0)} ops/sec\n`;
      report += `  峰值吞吐量: ${metrics.peakThroughput.toFixed(0)} ops/sec\n`;
      report += `  响应时间 - 平均: ${metrics.responseTimeStats.avg.toFixed(2)}ms, P95: ${metrics.responseTimeStats.p95.toFixed(2)}ms, P99: ${metrics.responseTimeStats.p99.toFixed(2)}ms\n`;
      report += `  内存使用 - 初始: ${(metrics.memoryStats.initial.heapUsed / 1024 / 1024).toFixed(2)}MB, 峰值: ${(metrics.memoryStats.peak.heapUsed / 1024 / 1024).toFixed(2)}MB\n`;
      report += `  内存增长: ${((metrics.memoryStats.final.heapUsed - metrics.memoryStats.initial.heapUsed) / 1024 / 1024).toFixed(2)}MB\n\n`;
    }

    // 稳定性分析
    report += "🔍 稳定性分析:\n\n";

    for (const [testName, metrics] of results.entries()) {
      const memoryGrowth =
        (metrics.memoryStats.final.heapUsed -
          metrics.memoryStats.initial.heapUsed) /
        1024 /
        1024;
      const errorRate = metrics.errorRate;

      if (errorRate < 1) {
        report += `  ✅ ${testName}: 错误率低 (${errorRate.toFixed(2)}%)\n`;
      } else if (errorRate < 5) {
        report += `  ⚠️  ${testName}: 错误率中等 (${errorRate.toFixed(2)}%)\n`;
      } else {
        report += `  ❌ ${testName}: 错误率高 (${errorRate.toFixed(2)}%)\n`;
      }

      if (memoryGrowth < 50) {
        report += `  ✅ ${testName}: 内存使用稳定 (+${memoryGrowth.toFixed(2)}MB)\n`;
      } else if (memoryGrowth < 200) {
        report += `  ⚠️  ${testName}: 内存增长中等 (+${memoryGrowth.toFixed(2)}MB)\n`;
      } else {
        report += `  ❌ ${testName}: 内存增长过多 (+${memoryGrowth.toFixed(2)}MB)\n`;
      }
    }

    return report;
  }
}

describe("日志系统压力测试", () => {
  let tester: StressTester;
  const results = new Map<string, StressTestMetrics>();

  beforeEach(() => {
    tester = new StressTester();
  });

  afterEach(() => {
    // 清理
  });

  const stressTestConfigs: StressTestConfig[] = [
    {
      name: "高并发基础测试",
      duration: 30000, // 30秒
      targetQPS: 1000,
      concurrency: 10,
      usePino: true,
      useContext: false,
      useStructured: false,
      logLevel: "info",
    },
    {
      name: "高并发全功能测试",
      duration: 30000,
      targetQPS: 500,
      concurrency: 10,
      usePino: true,
      useContext: true,
      useStructured: true,
      logLevel: "info",
    },
    {
      name: "极高并发采样测试",
      duration: 30000,
      targetQPS: 2000,
      concurrency: 20,
      usePino: true,
      useContext: true,
      useStructured: true,
      samplingRate: 0.5,
      logLevel: "info",
    },
    {
      name: "长时间稳定性测试",
      duration: 120000, // 2分钟
      targetQPS: 200,
      concurrency: 5,
      usePino: true,
      useContext: true,
      useStructured: true,
      logLevel: "info",
    },
  ];

  it.skip("应该通过高并发基础测试", async () => {
    const config = stressTestConfigs[0];
    const metrics = await tester.runStressTest(config);
    results.set(config.name, metrics);

    // 基本稳定性检查
    expect(metrics.errorRate).toBeLessThan(5); // 错误率应低于5%
    expect(metrics.averageThroughput).toBeGreaterThan(config.targetQPS * 0.7); // 至少达到目标QPS的70%

    // 内存增长检查
    const memoryGrowth =
      (metrics.memoryStats.final.heapUsed -
        metrics.memoryStats.initial.heapUsed) /
      1024 /
      1024;
    expect(memoryGrowth).toBeLessThan(200); // 内存增长不应超过200MB
  }, 60000);

  it.skip("应该通过高并发全功能测试", async () => {
    const config = stressTestConfigs[1];
    const metrics = await tester.runStressTest(config);
    results.set(config.name, metrics);

    expect(metrics.errorRate).toBeLessThan(10); // 全功能模式下允许稍高的错误率
    expect(metrics.averageThroughput).toBeGreaterThan(config.targetQPS * 0.6); // 至少达到目标QPS的60%
  }, 60000);

  it.skip("应该通过极高并发采样测试", async () => {
    const config = stressTestConfigs[2];
    const metrics = await tester.runStressTest(config);
    results.set(config.name, metrics);

    expect(metrics.errorRate).toBeLessThan(5); // 采样应该降低错误率
    expect(metrics.averageThroughput).toBeGreaterThan(config.targetQPS * 0.5); // 极高并发下的最低要求
  }, 60000);

  it("应该通过长时间稳定性测试", async () => {
    const config = stressTestConfigs[3];
    const metrics = await tester.runStressTest(config);
    results.set(config.name, metrics);

    // 长时间运行的稳定性要求更严格
    expect(metrics.errorRate).toBeLessThan(2); // 错误率应低于2%
    expect(metrics.averageThroughput).toBeGreaterThan(config.targetQPS * 0.8); // 至少达到目标QPS的80%

    // 内存泄漏检查
    const memoryGrowth =
      (metrics.memoryStats.final.heapUsed -
        metrics.memoryStats.initial.heapUsed) /
      1024 /
      1024;
    expect(memoryGrowth).toBeLessThan(100); // 长时间运行内存增长应更少

    // 生成最终报告
    const report = tester.generateStressTestReport(results);
    console.log(report);
  }, 180000); // 3分钟超时
});
