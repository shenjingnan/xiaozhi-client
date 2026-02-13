/**
 * 示例代码共享工具模块
 *
 * 功能说明：
 * - 提供统一的错误处理逻辑
 * - 提供工具列表显示功能
 * - 提供连接状态显示功能
 * - 提供清理逻辑
 *
 * 目的：消除示例代码中的重复代码，遵循 DRY 原则
 */

import type { Endpoint } from "@xiaozhi-client/endpoint";

/**
 * 显示连接状态
 */
export function displayConnectionStatus(
  endpoint: Endpoint,
  label?: string
): void {
  const status = endpoint.getStatus();
  console.log(`${label || "连接状态"}:`);
  console.log(`  已连接: ${status.connected ? "是" : "否"}`);
  console.log(`  已初始化: ${status.initialized ? "是" : "否"}`);
  console.log(`  连接状态: ${status.connectionState}`);
  console.log(`  可用工具数: ${status.availableTools}`);
  console.log();
}

/**
 * 显示工具列表
 */
export function displayTools(
  tools: readonly { name: string; description?: string; inputSchema?: unknown }[],
  label?: string
): void {
  console.log(`📦 ${label || "工具列表"}:`);
  for (const tool of tools) {
    console.log(`  - ${tool.name}`);
    if (tool.description) {
      console.log(`    描述: ${tool.description}`);
    }
    // 显示输入参数 schema（如果有的话）
    if (tool.inputSchema && typeof tool.inputSchema === "object" && Object.keys(tool.inputSchema).length > 0) {
      const properties = (tool.inputSchema as { properties?: Record<string, unknown> }).properties;
      if (properties && Object.keys(properties).length > 0) {
        console.log(`    参数: ${Object.keys(properties).join(", ")}`);
      }
    }
  }
  console.log();
}

/**
 * 处理错误并显示连接状态
 */
export function handleError(
  error: unknown,
  endpoint: Endpoint | Endpoint[] | undefined,
  endpointLabels?: string[]
): void {
  console.error();
  console.error("❌ 执行过程中出错:");
  if (error instanceof Error) {
    console.error(`   错误信息: ${error.message}`);
    if (error.stack) {
      console.error(`   堆栈: ${error.stack.split("\n").slice(1, 3).join("\n")}`);
    }
  }
  console.error();

  // 显示连接状态（如果可能）
  const endpoints = Array.isArray(endpoint) ? endpoint : endpoint ? [endpoint] : [];
  const labels = endpointLabels || [];

  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    const label = labels[i] ? `${labels[i]} - ` : "";

    try {
      const status = ep.getStatus();
      console.error(`${label}当前连接状态:`);
      console.error(`  已连接: ${status.connected ? "是" : "否"}`);
      console.error(`  连接状态: ${status.connectionState}`);
      if (status.lastError) {
        console.error(`  最后错误: ${status.lastError}`);
      }
    } catch {
      // 忽略获取状态的错误
    }
  }
}

/**
 * 断开连接并清理
 */
export async function cleanupConnections(
  endpoints: (Endpoint | undefined)[],
  showEndMessage = true
): Promise<void> {
  console.log();
  console.log("正在断开连接...");

  try {
    for (const endpoint of endpoints) {
      if (endpoint) {
        await endpoint.disconnect();
      }
    }
    console.log("✅ 连接已断开");
  } catch {
    console.log("⚠️  断开连接时出现错误（可能已断开）");
  }

  if (showEndMessage) {
    console.log();
    console.log("=== 示例结束 ===");
  }
}

/**
 * 全局未捕获错误处理器
 */
export function handleUncaughtError(error: unknown): void {
  console.error("未捕获的错误:", error);
  process.exit(1);
}
