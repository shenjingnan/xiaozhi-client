import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Logger } from "../../logger.js";
import { LogContext } from "../../logger/LogContext.js";
import { PerformanceIntegration } from "../../logger/PerformanceIntegration.js";
import { PinoConfigManager } from "../../logger/PinoConfig.js";
import { StructuredLogger } from "../../logger/StructuredLogger.js";

interface PerformanceMetrics {
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  throughput: number; // operations per second
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
  };
}

interface TestScenario {
  name: string;
  iterations: number;
  logLevel: string;
  usePino: boolean;
  useStructured: boolean;
  useContext: boolean;
  useSampling: boolean;
  samplingRate?: number;
  asyncMode?: boolean;
  bufferSize?: number;
}

class PerformanceTester {
  private originalEnv: Record<string, string | undefined> = {};

  constructor() {
    this.saveEnvironment();
  }

  private saveEnvironment(): void {
    this.originalEnv = {
      XIAOZHI_USE_PINO: process.env.XIAOZHI_USE_PINO,
      XIAOZHI_LOG_LEVEL: process.env.XIAOZHI_LOG_LEVEL,
      XIAOZHI_LOG_ASYNC: process.env.XIAOZHI_LOG_ASYNC,
      XIAOZHI_LOG_BUFFER_SIZE: process.env.XIAOZHI_LOG_BUFFER_SIZE,
      XIAOZHI_LOG_SAMPLING_RATE: process.env.XIAOZHI_LOG_SAMPLING_RATE,
      XIAOZHI_DAEMON: process.env.XIAOZHI_DAEMON,
      XIAOZHI_LOG_CONTEXT_ENABLED: process.env.XIAOZHI_LOG_CONTEXT_ENABLED,
    };
  }

  private restoreEnvironment(): void {
    for (const [key, value] of Object.entries(this.originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  private setupEnvironment(scenario: TestScenario): void {
    process.env.XIAOZHI_USE_PINO = scenario.usePino.toString();
    process.env.XIAOZHI_LOG_LEVEL = scenario.logLevel;
    process.env.XIAOZHI_LOG_ASYNC = (scenario.asyncMode ?? true).toString();
    process.env.XIAOZHI_LOG_BUFFER_SIZE = (
      scenario.bufferSize ?? 8192
    ).toString();
    process.env.XIAOZHI_LOG_SAMPLING_RATE = (
      scenario.samplingRate ?? 1.0
    ).toString();
    process.env.XIAOZHI_DAEMON = "false"; // 测试时不使用守护进程模式
    process.env.XIAOZHI_LOG_CONTEXT_ENABLED = scenario.useContext.toString();
  }

  async runPerformanceTest(
    scenario: TestScenario
  ): Promise<PerformanceMetrics> {
    this.setupEnvironment(scenario);

    // 重新初始化配置
    const configManager = PinoConfigManager.getInstance();
    configManager.reloadFromEnvironment();

    const logger = new Logger().withTag("PERF-TEST");
    const structuredLogger = scenario.useStructured
      ? new StructuredLogger()
      : null;
    const logContext = scenario.useContext ? LogContext.getInstance() : null;

    // 预热
    for (let i = 0; i < 100; i++) {
      logger.info("Warmup message", { iteration: i });
    }

    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
    }

    const memoryBefore = process.memoryUsage();
    let peakMemory = memoryBefore;
    const times: number[] = [];

    const startTime = process.hrtime.bigint();

    for (let i = 0; i < scenario.iterations; i++) {
      const iterationStart = process.hrtime.bigint();

      if (scenario.useContext && logContext) {
        const context = logContext.createContextFromHeaders({
          "x-trace-id": `trace-${i}`,
          "x-user-id": `user-${i % 100}`,
        });

        await logContext.runAsync(context, async () => {
          await this.performLogOperation(logger, structuredLogger, i);
        });
      } else {
        await this.performLogOperation(logger, structuredLogger, i);
      }

      const iterationEnd = process.hrtime.bigint();
      times.push(Number(iterationEnd - iterationStart) / 1000000); // Convert to milliseconds

      // 监控内存使用峰值
      if (i % 100 === 0) {
        const currentMemory = process.memoryUsage();
        if (currentMemory.heapUsed > peakMemory.heapUsed) {
          peakMemory = currentMemory;
        }
      }
    }

    const endTime = process.hrtime.bigint();
    const memoryAfter = process.memoryUsage();

    const totalTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const throughput = (scenario.iterations / totalTime) * 1000; // operations per second

    this.restoreEnvironment();

    return {
      totalTime,
      averageTime,
      minTime,
      maxTime,
      throughput,
      memoryUsage: {
        before: memoryBefore,
        after: memoryAfter,
        peak: peakMemory,
      },
    };
  }

  private async performLogOperation(
    logger: Logger,
    structuredLogger: StructuredLogger | null,
    iteration: number
  ): Promise<void> {
    const testData = {
      iteration,
      timestamp: new Date(),
      userId: `user-${iteration % 1000}`,
      operation: "performance-test",
      data: {
        nested: {
          value: Math.random(),
          array: [1, 2, 3, iteration],
        },
        metadata: {
          source: "performance-test",
          version: "1.0.0",
        },
      },
    };

    // 基础日志
    logger.info("Performance test message", testData);

    // 结构化日志（如果启用）
    if (structuredLogger) {
      const result = structuredLogger.formatStructuredData("business_event", {
        event: "performance_test",
        userId: testData.userId,
        data: testData.data,
        timestamp: testData.timestamp,
      });

      if (result.success) {
        logger.debug("Structured log processed", result.data);
      }
    }

    // 不同级别的日志
    if (iteration % 10 === 0) {
      logger.warn("Warning message", { iteration, type: "warning" });
    }

    if (iteration % 100 === 0) {
      logger.error("Error message", { iteration, type: "error" });
    }

    if (iteration % 50 === 0) {
      logger.success("Success message", { iteration, type: "success" });
    }
  }

  generateReport(results: Map<string, PerformanceMetrics>): string {
    let report = "\n=== 性能测试报告 ===\n\n";

    // 基准对比
    const baseline = results.get("baseline-console");
    const pinoBasic = results.get("pino-basic");

    if (baseline && pinoBasic) {
      const throughputImprovement =
        ((pinoBasic.throughput - baseline.throughput) / baseline.throughput) *
        100;
      const memoryDiff =
        pinoBasic.memoryUsage.peak.heapUsed -
        baseline.memoryUsage.peak.heapUsed;

      report += "📊 基准对比 (Console vs Pino):\n";
      report += `  吞吐量提升: ${throughputImprovement.toFixed(2)}%\n`;
      report += `  内存差异: ${(memoryDiff / 1024 / 1024).toFixed(2)} MB\n\n`;
    }

    // 详细结果
    report += "📈 详细测试结果:\n\n";

    for (const [scenario, metrics] of results.entries()) {
      report += `${scenario}:\n`;
      report += `  总时间: ${metrics.totalTime.toFixed(2)} ms\n`;
      report += `  平均时间: ${metrics.averageTime.toFixed(4)} ms/op\n`;
      report += `  吞吐量: ${metrics.throughput.toFixed(0)} ops/sec\n`;
      report += `  内存使用: ${(metrics.memoryUsage.peak.heapUsed / 1024 / 1024).toFixed(2)} MB (峰值)\n`;
      report += `  内存增长: ${((metrics.memoryUsage.after.heapUsed - metrics.memoryUsage.before.heapUsed) / 1024 / 1024).toFixed(2)} MB\n\n`;
    }

    // 性能建议
    report += "💡 性能优化建议:\n\n";

    const asyncResults = Array.from(results.entries()).filter(([name]) =>
      name.includes("async")
    );
    const syncResults = Array.from(results.entries()).filter(([name]) =>
      name.includes("sync")
    );

    if (asyncResults.length > 0 && syncResults.length > 0) {
      const avgAsyncThroughput =
        asyncResults.reduce((sum, [, metrics]) => sum + metrics.throughput, 0) /
        asyncResults.length;
      const avgSyncThroughput =
        syncResults.reduce((sum, [, metrics]) => sum + metrics.throughput, 0) /
        syncResults.length;

      if (avgAsyncThroughput > avgSyncThroughput) {
        report += "  ✅ 异步模式性能更优，建议在生产环境使用异步日志\n";
      } else {
        report += "  ⚠️  同步模式在当前测试中表现更好，但可能影响应用响应性\n";
      }
    }

    const samplingResults = Array.from(results.entries()).filter(([name]) =>
      name.includes("sampling")
    );
    if (samplingResults.length > 0) {
      const avgSamplingThroughput =
        samplingResults.reduce(
          (sum, [, metrics]) => sum + metrics.throughput,
          0
        ) / samplingResults.length;
      const noSamplingResult = results.get("pino-basic");

      if (
        noSamplingResult &&
        avgSamplingThroughput > noSamplingResult.throughput
      ) {
        report += "  ✅ 采样机制有效提升性能，建议在高负载场景使用\n";
      }
    }

    report += "  📝 建议的生产环境配置:\n";
    report += "    - XIAOZHI_USE_PINO=true\n";
    report += "    - XIAOZHI_LOG_ASYNC=true\n";
    report += "    - XIAOZHI_LOG_BUFFER_SIZE=16384\n";
    report += "    - XIAOZHI_LOG_SAMPLING_RATE=0.8 (高负载时)\n";
    report += "    - XIAOZHI_DAEMON=true (长期运行服务)\n\n";

    return report;
  }
}

describe("日志系统性能测试", () => {
  let tester: PerformanceTester;
  const results = new Map<string, PerformanceMetrics>();

  beforeEach(() => {
    tester = new PerformanceTester();
  });

  afterEach(() => {
    // 清理
  });

  const testScenarios: TestScenario[] = [
    {
      name: "baseline-console",
      iterations: 1000,
      logLevel: "info",
      usePino: false,
      useStructured: false,
      useContext: false,
      useSampling: false,
    },
    {
      name: "pino-basic",
      iterations: 1000,
      logLevel: "info",
      usePino: true,
      useStructured: false,
      useContext: false,
      useSampling: false,
    },
    {
      name: "pino-structured",
      iterations: 1000,
      logLevel: "info",
      usePino: true,
      useStructured: true,
      useContext: false,
      useSampling: false,
    },
    {
      name: "pino-context",
      iterations: 1000,
      logLevel: "info",
      usePino: true,
      useStructured: false,
      useContext: true,
      useSampling: false,
    },
    {
      name: "pino-full-features",
      iterations: 1000,
      logLevel: "info",
      usePino: true,
      useStructured: true,
      useContext: true,
      useSampling: false,
    },
    {
      name: "pino-sampling-50",
      iterations: 1000,
      logLevel: "info",
      usePino: true,
      useStructured: true,
      useContext: true,
      useSampling: true,
      samplingRate: 0.5,
    },
    {
      name: "pino-async-mode",
      iterations: 1000,
      logLevel: "info",
      usePino: true,
      useStructured: true,
      useContext: true,
      useSampling: false,
      asyncMode: true,
      bufferSize: 16384,
    },
    {
      name: "pino-sync-mode",
      iterations: 1000,
      logLevel: "info",
      usePino: true,
      useStructured: true,
      useContext: true,
      useSampling: false,
      asyncMode: false,
    },
  ];

  it("应该运行所有性能测试场景", async () => {
    console.log("\n🚀 开始性能基准测试...\n");

    for (const scenario of testScenarios) {
      console.log(`📊 测试场景: ${scenario.name}`);
      const metrics = await tester.runPerformanceTest(scenario);
      results.set(scenario.name, metrics);

      console.log(
        `  ✅ 完成 - 吞吐量: ${metrics.throughput.toFixed(0)} ops/sec, 平均时间: ${metrics.averageTime.toFixed(4)} ms/op`
      );
    }

    // 生成报告
    const report = tester.generateReport(results);
    console.log(report);

    // 基本性能断言
    const baseline = results.get("baseline-console");
    const pinoBasic = results.get("pino-basic");

    expect(baseline).toBeDefined();
    expect(pinoBasic).toBeDefined();

    if (baseline && pinoBasic) {
      // Pino应该有合理的性能表现（不应该比baseline慢太多）
      const performanceRatio = pinoBasic.throughput / baseline.throughput;
      expect(performanceRatio).toBeGreaterThan(0.5); // 至少保持50%的性能

      // 内存使用应该合理
      const memoryIncrease =
        (pinoBasic.memoryUsage.peak.heapUsed -
          baseline.memoryUsage.peak.heapUsed) /
        1024 /
        1024;
      expect(memoryIncrease).toBeLessThan(100); // 内存增长不应超过100MB
    }

    // 采样应该提升性能
    const sampling = results.get("pino-sampling-50");
    const fullFeatures = results.get("pino-full-features");

    if (sampling && fullFeatures) {
      expect(sampling.throughput).toBeGreaterThanOrEqual(
        fullFeatures.throughput * 0.9
      ); // 采样应该不会显著降低性能
    }
  }, 60000); // 60秒超时
});
