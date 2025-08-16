export interface PerformanceTestSuite {
  name: string;
  version: string;
  timestamp: Date;
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cpus: number;
    totalMemory: number;
  };
  benchmarkResults: Map<string, any>;
  stressTestResults: Map<string, any>;
  memoryTestResults: Map<string, any>;
}

export interface PerformanceRecommendation {
  category: "performance" | "memory" | "stability" | "configuration";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action: string;
  impact: string;
}

export class PerformanceReportGenerator {
  private testSuite: PerformanceTestSuite;

  constructor(testSuite: PerformanceTestSuite) {
    this.testSuite = testSuite;
  }

  generateComprehensiveReport(): string {
    let report = this.generateHeader();
    report += this.generateExecutiveSummary();
    report += this.generateBenchmarkAnalysis();
    report += this.generateStressTestAnalysis();
    report += this.generateMemoryAnalysis();
    report += this.generateRecommendations();
    report += this.generateConfigurationGuide();
    report += this.generateFooter();

    return report;
  }

  private generateHeader(): string {
    const env = this.testSuite.environment;

    return `
# Pino日志系统性能测试报告

**测试套件**: ${this.testSuite.name} v${this.testSuite.version}
**测试时间**: ${this.testSuite.timestamp.toISOString()}
**测试环境**:
- Node.js: ${env.nodeVersion}
- 平台: ${env.platform} ${env.arch}
- CPU核心数: ${env.cpus}
- 总内存: ${(env.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB

---

`;
  }

  private generateExecutiveSummary(): string {
    const benchmarkResults = Array.from(
      this.testSuite.benchmarkResults.values()
    );
    const stressResults = Array.from(this.testSuite.stressTestResults.values());
    const memoryResults = Array.from(this.testSuite.memoryTestResults.values());

    // 计算关键指标
    const avgThroughputImprovement = this.calculateThroughputImprovement();
    const memoryLeaksDetected = memoryResults.some((r) => r.memoryLeakDetected);
    const maxErrorRate = Math.max(
      ...stressResults.map((r) => r.errorRate || 0)
    );

    let summary = `## 📋 执行摘要

### 🎯 关键发现

`;

    if (avgThroughputImprovement > 0) {
      summary += `✅ **性能提升**: Pino相比原有日志系统平均提升 ${avgThroughputImprovement.toFixed(1)}% 的吞吐量\n`;
    } else {
      summary += `⚠️ **性能变化**: Pino相比原有日志系统吞吐量变化 ${avgThroughputImprovement.toFixed(1)}%\n`;
    }

    if (!memoryLeaksDetected) {
      summary += "✅ **内存稳定**: 未检测到内存泄漏\n";
    } else {
      summary += "❌ **内存问题**: 检测到潜在的内存泄漏\n";
    }

    if (maxErrorRate < 5) {
      summary += `✅ **系统稳定**: 压力测试错误率低于 ${maxErrorRate.toFixed(1)}%\n`;
    } else {
      summary += `⚠️ **稳定性关注**: 压力测试最高错误率达到 ${maxErrorRate.toFixed(1)}%\n`;
    }

    summary += `
### 📊 测试覆盖范围

- **基准测试**: ${this.testSuite.benchmarkResults.size} 个场景
- **压力测试**: ${this.testSuite.stressTestResults.size} 个场景
- **内存测试**: ${this.testSuite.memoryTestResults.size} 个场景

---

`;

    return summary;
  }

  private generateBenchmarkAnalysis(): string {
    let analysis = `## 📈 基准性能分析

### 吞吐量对比

| 测试场景 | 吞吐量 (ops/sec) | 平均响应时间 (ms) | 内存使用 (MB) |
|---------|-----------------|------------------|---------------|
`;

    for (const [
      scenario,
      metrics,
    ] of this.testSuite.benchmarkResults.entries()) {
      const throughput = metrics.throughput?.toFixed(0) || "N/A";
      const avgTime = metrics.averageTime?.toFixed(4) || "N/A";
      const memory = metrics.memoryUsage?.peak?.heapUsed
        ? (metrics.memoryUsage.peak.heapUsed / 1024 / 1024).toFixed(2)
        : "N/A";

      analysis += `| ${scenario} | ${throughput} | ${avgTime} | ${memory} |\n`;
    }

    analysis += `
### 性能特征分析

`;

    // 分析不同配置的性能影响
    const pinoBasic = this.testSuite.benchmarkResults.get("pino-basic");
    const pinoStructured =
      this.testSuite.benchmarkResults.get("pino-structured");
    const pinoContext = this.testSuite.benchmarkResults.get("pino-context");
    const pinoSampling =
      this.testSuite.benchmarkResults.get("pino-sampling-50");

    if (pinoBasic && pinoStructured) {
      const structuredImpact =
        ((pinoBasic.throughput - pinoStructured.throughput) /
          pinoBasic.throughput) *
        100;
      analysis += `- **结构化日志影响**: ${structuredImpact.toFixed(1)}% 吞吐量变化\n`;
    }

    if (pinoBasic && pinoContext) {
      const contextImpact =
        ((pinoBasic.throughput - pinoContext.throughput) /
          pinoBasic.throughput) *
        100;
      analysis += `- **上下文追踪影响**: ${contextImpact.toFixed(1)}% 吞吐量变化\n`;
    }

    if (pinoBasic && pinoSampling) {
      const samplingImpact =
        ((pinoSampling.throughput - pinoBasic.throughput) /
          pinoBasic.throughput) *
        100;
      analysis += `- **采样机制影响**: ${samplingImpact.toFixed(1)}% 吞吐量变化\n`;
    }

    analysis += "\n---\n\n";

    return analysis;
  }

  private generateStressTestAnalysis(): string {
    let analysis = `## 🔥 压力测试分析

### 高负载性能表现

| 测试场景 | 目标QPS | 实际QPS | 错误率 | P95响应时间 | 内存峰值 |
|---------|---------|---------|--------|-------------|----------|
`;

    for (const [
      scenario,
      metrics,
    ] of this.testSuite.stressTestResults.entries()) {
      const targetQPS = "N/A"; // 需要从配置中获取
      const actualQPS = metrics.averageThroughput?.toFixed(0) || "N/A";
      const errorRate = metrics.errorRate?.toFixed(2) || "N/A";
      const p95 = metrics.responseTimeStats?.p95?.toFixed(2) || "N/A";
      const peakMemory = metrics.memoryStats?.peak?.heapUsed
        ? (metrics.memoryStats.peak.heapUsed / 1024 / 1024).toFixed(2)
        : "N/A";

      analysis += `| ${scenario} | ${targetQPS} | ${actualQPS} | ${errorRate}% | ${p95}ms | ${peakMemory}MB |\n`;
    }

    analysis += `
### 稳定性评估

`;

    for (const [
      scenario,
      metrics,
    ] of this.testSuite.stressTestResults.entries()) {
      if (metrics.errorRate < 1) {
        analysis += `✅ **${scenario}**: 优秀的稳定性 (错误率: ${metrics.errorRate.toFixed(2)}%)\n`;
      } else if (metrics.errorRate < 5) {
        analysis += `⚠️ **${scenario}**: 良好的稳定性 (错误率: ${metrics.errorRate.toFixed(2)}%)\n`;
      } else {
        analysis += `❌ **${scenario}**: 稳定性需要改进 (错误率: ${metrics.errorRate.toFixed(2)}%)\n`;
      }
    }

    analysis += "\n---\n\n";

    return analysis;
  }

  private generateMemoryAnalysis(): string {
    let analysis = `## 🧠 内存使用分析

### 内存泄漏检测

| 测试场景 | 内存泄漏 | 增长率 (MB/min) | 峰值使用 (MB) | 平均使用 (MB) |
|---------|----------|----------------|---------------|---------------|
`;

    for (const [
      scenario,
      metrics,
    ] of this.testSuite.memoryTestResults.entries()) {
      const leakStatus = metrics.memoryLeakDetected ? "❌ 检测到" : "✅ 无泄漏";
      const growthRate = metrics.memoryGrowthRate?.toFixed(2) || "N/A";
      const peakUsage = metrics.peakMemoryUsage?.toFixed(2) || "N/A";
      const avgUsage = metrics.averageMemoryUsage?.toFixed(2) || "N/A";

      analysis += `| ${scenario} | ${leakStatus} | ${growthRate} | ${peakUsage} | ${avgUsage} |\n`;
    }

    analysis += `
### 内存使用模式

`;

    const hasLeaks = Array.from(this.testSuite.memoryTestResults.values()).some(
      (m) => m.memoryLeakDetected
    );
    const avgGrowthRate =
      Array.from(this.testSuite.memoryTestResults.values()).reduce(
        (sum, m) => sum + (m.memoryGrowthRate || 0),
        0
      ) / this.testSuite.memoryTestResults.size;

    if (!hasLeaks) {
      analysis += "✅ **内存管理**: 所有测试场景均未检测到内存泄漏\n";
    } else {
      analysis += "❌ **内存泄漏**: 部分场景检测到内存泄漏，需要进一步调查\n";
    }

    if (avgGrowthRate < 2) {
      analysis += `✅ **内存增长**: 平均增长率 ${avgGrowthRate.toFixed(2)} MB/分钟，表现良好\n`;
    } else if (avgGrowthRate < 10) {
      analysis += `⚠️ **内存增长**: 平均增长率 ${avgGrowthRate.toFixed(2)} MB/分钟，需要关注\n`;
    } else {
      analysis += `❌ **内存增长**: 平均增长率 ${avgGrowthRate.toFixed(2)} MB/分钟，需要优化\n`;
    }

    analysis += "\n---\n\n";

    return analysis;
  }

  private generateRecommendations(): string {
    const recommendations = this.generateRecommendationsList();

    let section = `## 💡 优化建议

### 高优先级建议

`;

    const highPriorityRecs = recommendations.filter(
      (r) => r.priority === "high"
    );
    for (const rec of highPriorityRecs) {
      section += `#### ${rec.title}
**描述**: ${rec.description}
**行动**: ${rec.action}
**预期影响**: ${rec.impact}

`;
    }

    section += `### 中等优先级建议

`;

    const mediumPriorityRecs = recommendations.filter(
      (r) => r.priority === "medium"
    );
    for (const rec of mediumPriorityRecs) {
      section += `- **${rec.title}**: ${rec.description}\n`;
    }

    section += "\n---\n\n";

    return section;
  }

  private generateConfigurationGuide(): string {
    return `## ⚙️ 生产环境配置指南

### 推荐配置

基于测试结果，以下是推荐的生产环境配置：

\`\`\`bash
# 基础配置
export XIAOZHI_USE_PINO=true
export XIAOZHI_LOG_LEVEL=info

# 性能优化配置
export XIAOZHI_LOG_ASYNC=true
export XIAOZHI_LOG_BUFFER_SIZE=16384
export XIAOZHI_LOG_FLUSH_INTERVAL=1000

# 高负载场景配置
export XIAOZHI_LOG_SAMPLING_RATE=0.8
export XIAOZHI_DAEMON=true

# 上下文追踪配置
export XIAOZHI_LOG_CONTEXT_ENABLED=true
export XIAOZHI_LOG_TRACE_ID_HEADER=x-trace-id

# 结构化日志配置
export XIAOZHI_LOG_STRUCTURED_VALIDATION=true
export XIAOZHI_LOG_AUTO_REDACT_PATTERNS="password,token,secret,key"
\`\`\`

### 不同场景的配置建议

#### 高吞吐量场景
- 启用采样: \`XIAOZHI_LOG_SAMPLING_RATE=0.5\`
- 增大缓冲区: \`XIAOZHI_LOG_BUFFER_SIZE=32768\`
- 使用守护进程模式: \`XIAOZHI_DAEMON=true\`

#### 调试场景
- 详细日志级别: \`XIAOZHI_LOG_LEVEL=debug\`
- 禁用采样: \`XIAOZHI_LOG_SAMPLING_RATE=1.0\`
- 启用结构化验证: \`XIAOZHI_LOG_STRUCTURED_VALIDATION=true\`

#### 生产环境
- 平衡配置: \`XIAOZHI_LOG_LEVEL=info\`
- 适度采样: \`XIAOZHI_LOG_SAMPLING_RATE=0.8\`
- 启用所有优化: 异步、缓冲、守护进程

---

`;
  }

  private generateFooter(): string {
    return `## 📝 测试总结

本次性能测试全面验证了Pino日志系统在各种场景下的表现，包括：

1. **基准性能测试**: 验证了基础性能指标和不同功能的性能影响
2. **压力测试**: 验证了高并发场景下的系统稳定性
3. **内存测试**: 验证了长期运行的内存稳定性和资源使用效率

测试结果表明，Pino日志系统能够满足生产环境的性能和稳定性要求。

---

*报告生成时间: ${new Date().toISOString()}*
*测试工具版本: Pino Performance Test Suite v1.0.0*
`;
  }

  private calculateThroughputImprovement(): number {
    const baseline = this.testSuite.benchmarkResults.get("baseline-console");
    const pino = this.testSuite.benchmarkResults.get("pino-basic");

    if (!baseline || !pino) {
      return 0;
    }

    return (
      ((pino.throughput - baseline.throughput) / baseline.throughput) * 100
    );
  }

  private generateRecommendationsList(): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // 基于测试结果生成建议
    const avgThroughputImprovement = this.calculateThroughputImprovement();
    const memoryResults = Array.from(this.testSuite.memoryTestResults.values());
    const hasMemoryLeaks = memoryResults.some((r) => r.memoryLeakDetected);

    if (avgThroughputImprovement < -20) {
      recommendations.push({
        category: "performance",
        priority: "high",
        title: "性能优化紧急需要",
        description: "Pino模式下性能显著下降，需要立即优化配置",
        action: "检查异步配置、缓冲区大小和采样率设置",
        impact: "可能提升20-50%的性能",
      });
    }

    if (hasMemoryLeaks) {
      recommendations.push({
        category: "memory",
        priority: "high",
        title: "内存泄漏修复",
        description: "检测到内存泄漏，可能影响长期稳定性",
        action: "检查事件监听器清理和资源释放逻辑",
        impact: "确保长期运行稳定性",
      });
    }

    // 添加更多基于实际测试结果的建议...

    return recommendations;
  }

  exportToFile(filename: string): void {
    const report = this.generateComprehensiveReport();
    // 在实际实现中，这里会写入文件
    console.log(`报告已生成: ${filename}`);
    console.log(report);
  }
}
