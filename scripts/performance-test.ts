#!/usr/bin/env tsx

/**
 * 多端点连接管理性能测试脚本
 *
 * 用于验证以下性能指标：
 * - 多连接启动时间不超过单连接的2倍
 * - 内存使用线性增长
 * - 连接切换延迟小于100ms
 */

import { Logger } from "../src/logger.js";
import { XiaozhiConnectionManager } from "../src/services/XiaozhiConnectionManager.js";

interface PerformanceTestResult {
  singleConnectionTime: number;
  multiConnectionTime: number;
  connectionTimeRatio: number;
  memoryGrowth: number;
  switchingLatency: number;
  passed: boolean;
  details: string[];
}

class PerformanceTest {
  private logger: Logger;

  constructor() {
    this.logger = new Logger("PerformanceTest");
  }

  /**
   * 运行完整的性能测试套件
   */
  async runPerformanceTests(): Promise<PerformanceTestResult> {
    this.logger.info("开始性能测试...");

    const results: PerformanceTestResult = {
      singleConnectionTime: 0,
      multiConnectionTime: 0,
      connectionTimeRatio: 0,
      memoryGrowth: 0,
      switchingLatency: 0,
      passed: false,
      details: [],
    };

    try {
      // 测试1: 单连接启动时间
      results.singleConnectionTime = await this.testSingleConnectionTime();
      results.details.push(`单连接启动时间: ${results.singleConnectionTime}ms`);

      // 测试2: 多连接启动时间
      results.multiConnectionTime = await this.testMultiConnectionTime();
      results.details.push(`多连接启动时间: ${results.multiConnectionTime}ms`);

      // 计算比率
      results.connectionTimeRatio =
        results.multiConnectionTime / results.singleConnectionTime;
      results.details.push(
        `启动时间比率: ${results.connectionTimeRatio.toFixed(2)}x`
      );

      // 测试3: 内存使用增长
      results.memoryGrowth = await this.testMemoryGrowth();
      results.details.push(
        `内存增长: ${(results.memoryGrowth / 1024 / 1024).toFixed(2)}MB`
      );

      // 测试4: 连接切换延迟
      results.switchingLatency = await this.testSwitchingLatency();
      results.details.push(`连接切换延迟: ${results.switchingLatency}ms`);

      // 验证性能指标
      results.passed = this.validatePerformance(results);

      this.logger.info("性能测试完成");
      return results;
    } catch (error) {
      this.logger.error("性能测试失败:", error);
      results.details.push(`测试失败: ${error}`);
      return results;
    }
  }

  /**
   * 测试单连接启动时间
   */
  private async testSingleConnectionTime(): Promise<number> {
    this.logger.info("测试单连接启动时间...");

    const manager = new XiaozhiConnectionManager();
    const startTime = Date.now();

    try {
      await manager.initialize(["wss://mock-endpoint.com"], []);
      await manager.connect();

      const endTime = Date.now();
      const duration = endTime - startTime;

      await manager.cleanup();
      return duration;
    } catch (error) {
      // Mock 连接失败是预期的，我们主要测试初始化时间
      const endTime = Date.now();
      const duration = endTime - startTime;

      await manager.cleanup();
      return duration;
    }
  }

  /**
   * 测试多连接启动时间
   */
  private async testMultiConnectionTime(): Promise<number> {
    this.logger.info("测试多连接启动时间...");

    const manager = new XiaozhiConnectionManager();
    const endpoints = [
      "wss://mock-endpoint-1.com",
      "wss://mock-endpoint-2.com",
      "wss://mock-endpoint-3.com",
      "wss://mock-endpoint-4.com",
    ];

    const startTime = Date.now();

    try {
      await manager.initialize(endpoints, []);
      await manager.connect();

      const endTime = Date.now();
      const duration = endTime - startTime;

      await manager.cleanup();
      return duration;
    } catch (error) {
      // Mock 连接失败是预期的，我们主要测试初始化时间
      const endTime = Date.now();
      const duration = endTime - startTime;

      await manager.cleanup();
      return duration;
    }
  }

  /**
   * 测试内存使用增长
   */
  private async testMemoryGrowth(): Promise<number> {
    this.logger.info("测试内存使用增长...");

    const initialMemory = process.memoryUsage().heapUsed;

    const manager = new XiaozhiConnectionManager();
    const endpoints = Array.from(
      { length: 10 },
      (_, i) => `wss://mock-endpoint-${i}.com`
    );

    try {
      await manager.initialize(endpoints, []);

      // 强制垃圾回收以获得更准确的内存测量
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      await manager.cleanup();

      return memoryGrowth;
    } catch (error) {
      await manager.cleanup();
      throw error;
    }
  }

  /**
   * 测试连接切换延迟
   */
  private async testSwitchingLatency(): Promise<number> {
    this.logger.info("测试连接切换延迟...");

    const manager = new XiaozhiConnectionManager();
    const endpoints = [
      "wss://mock-endpoint-1.com",
      "wss://mock-endpoint-2.com",
    ];

    try {
      await manager.initialize(endpoints, []);

      // 模拟连接状态
      const connectionStatus = manager.getConnectionStatus();
      for (const status of connectionStatus) {
        status.connected = true;
        status.healthScore = 80;
      }

      const iterations = 100;
      const startTime = Date.now();

      // 执行多次连接选择以测试切换延迟
      for (let i = 0; i < iterations; i++) {
        manager.selectBestConnection();
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageLatency = totalTime / iterations;

      await manager.cleanup();

      return averageLatency;
    } catch (error) {
      await manager.cleanup();
      throw error;
    }
  }

  /**
   * 验证性能指标是否达到目标
   */
  private validatePerformance(results: PerformanceTestResult): boolean {
    const checks = [];

    // 检查1: 多连接启动时间不超过单连接的2倍
    const timeRatioCheck = results.connectionTimeRatio <= 2.0;
    checks.push({
      name: "启动时间比率",
      passed: timeRatioCheck,
      expected: "≤ 2.0x",
      actual: `${results.connectionTimeRatio.toFixed(2)}x`,
    });

    // 检查2: 内存使用线性增长（每个连接不超过5MB）
    const memoryPerConnection = results.memoryGrowth / 10; // 10个端点
    const memoryCheck = memoryPerConnection <= 5 * 1024 * 1024; // 5MB
    checks.push({
      name: "内存使用",
      passed: memoryCheck,
      expected: "≤ 5MB/连接",
      actual: `${(memoryPerConnection / 1024 / 1024).toFixed(2)}MB/连接`,
    });

    // 检查3: 连接切换延迟小于100ms
    const latencyCheck = results.switchingLatency < 100;
    checks.push({
      name: "连接切换延迟",
      passed: latencyCheck,
      expected: "< 100ms",
      actual: `${results.switchingLatency.toFixed(2)}ms`,
    });

    // 输出检查结果
    this.logger.info("性能指标验证结果:");
    for (const check of checks) {
      const status = check.passed ? "✅ PASS" : "❌ FAIL";
      this.logger.info(
        `  ${check.name}: ${status} (期望: ${check.expected}, 实际: ${check.actual})`
      );
      results.details.push(
        `${check.name}: ${status} (期望: ${check.expected}, 实际: ${check.actual})`
      );
    }

    return checks.every((check) => check.passed);
  }

  /**
   * 生成性能报告
   */
  generateReport(results: PerformanceTestResult): string {
    const report = [
      "# 多端点连接管理性能测试报告",
      "",
      `## 测试结果: ${results.passed ? "✅ PASS" : "❌ FAIL"}`,
      "",
      "## 性能指标",
      "",
      `- **单连接启动时间**: ${results.singleConnectionTime}ms`,
      `- **多连接启动时间**: ${results.multiConnectionTime}ms`,
      `- **启动时间比率**: ${results.connectionTimeRatio.toFixed(2)}x`,
      `- **内存增长**: ${(results.memoryGrowth / 1024 / 1024).toFixed(2)}MB`,
      `- **连接切换延迟**: ${results.switchingLatency.toFixed(2)}ms`,
      "",
      "## 详细信息",
      "",
      ...results.details.map((detail) => `- ${detail}`),
      "",
      `## 测试时间: ${new Date().toISOString()}`,
    ];

    return report.join("\n");
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new PerformanceTest();

  test
    .runPerformanceTests()
    .then((results) => {
      const report = test.generateReport(results);
      console.log(report);

      // 如果测试失败，退出码为1
      process.exit(results.passed ? 0 : 1);
    })
    .catch((error) => {
      console.error("性能测试执行失败:", error);
      process.exit(1);
    });
}

export { PerformanceTest };
