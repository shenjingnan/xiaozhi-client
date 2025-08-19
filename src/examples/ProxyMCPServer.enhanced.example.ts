/**
 * ProxyMCPServer 增强功能示例
 * 演示第二阶段实现的性能监控、重试机制和配置管理功能
 */

import { ProxyMCPServer } from "../ProxyMCPServer.js";
import { MCPServiceManager } from "../services/MCPServiceManager.js";

async function demonstrateEnhancedFeatures() {
  console.log("=== ProxyMCPServer 增强功能演示 ===\n");

  // 创建 ProxyMCPServer 实例
  const proxyServer = new ProxyMCPServer("ws://localhost:8080");

  // 创建模拟的 MCPServiceManager
  const serviceManager = new MCPServiceManager();
  proxyServer.setServiceManager(serviceManager);

  console.log("1. 配置管理演示");
  console.log("================");

  // 获取默认配置
  const defaultConfig = proxyServer.getConfiguration();
  console.log("默认配置:", JSON.stringify(defaultConfig, null, 2));

  // 更新工具调用配置
  proxyServer.updateToolCallConfig({
    timeout: 60000, // 60秒超时
    retryAttempts: 5, // 最多重试5次
  });

  // 更新重试配置
  proxyServer.updateRetryConfig({
    maxAttempts: 5,
    initialDelay: 2000, // 初始延迟2秒
    maxDelay: 30000, // 最大延迟30秒
    backoffMultiplier: 2.5, // 退避倍数2.5
  });

  const updatedConfig = proxyServer.getConfiguration();
  console.log("更新后配置:", JSON.stringify(updatedConfig, null, 2));

  console.log("\n2. 性能监控演示");
  console.log("================");

  // 获取初始性能指标
  let metrics = proxyServer.getPerformanceMetrics();
  console.log("初始性能指标:", JSON.stringify(metrics, null, 2));

  // 模拟一些工具调用（这里只是演示，实际需要真实的调用）
  console.log("模拟工具调用...");

  // 获取更新后的性能指标
  metrics = proxyServer.getPerformanceMetrics();
  console.log("更新后性能指标:", JSON.stringify(metrics, null, 2));

  // 获取调用记录
  const records = proxyServer.getCallRecords(5); // 获取最近5条记录
  console.log("最近调用记录:", JSON.stringify(records, null, 2));

  console.log("\n3. 增强状态信息演示");
  console.log("==================");

  // 获取增强状态信息
  const enhancedStatus = proxyServer.getEnhancedStatus();
  console.log("增强状态信息:", JSON.stringify(enhancedStatus, null, 2));

  console.log("\n4. 性能指标重置演示");
  console.log("==================");

  console.log("重置前的性能指标:");
  console.log("- 总调用次数:", proxyServer.getPerformanceMetrics().totalCalls);

  // 重置性能指标
  proxyServer.resetPerformanceMetrics();

  console.log("重置后的性能指标:");
  console.log("- 总调用次数:", proxyServer.getPerformanceMetrics().totalCalls);

  console.log("\n=== 演示完成 ===");
}

// 运行演示
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateEnhancedFeatures().catch(console.error);
}

export { demonstrateEnhancedFeatures };
