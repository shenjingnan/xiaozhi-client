/**
 * MCP 服务管理器单例
 * 提供全局唯一的 MCPServiceManager 实例，简化实现以满足项目实际需求
 */

import { MCPServiceManager } from "@/lib/mcp";

// 重新导出相关类型，便于外部使用
export type { Tool } from "@modelcontextprotocol/sdk/types.js";
export type { LocalMCPServerConfig } from "@root/configManager.js";

// 简单的实例缓存
let instance: MCPServiceManager | null = null;

/**
 * 获取 MCPServiceManager 单例实例
 *
 * @returns Promise<MCPServiceManager> 管理器实例
 */
async function getInstance(): Promise<MCPServiceManager> {
  try {
    if (!instance) {
      instance = new MCPServiceManager();
    }

    return instance;
  } catch (error) {
    // 简化的错误处理：重新创建实例
    console.error("创建或更新 MCPServiceManager 实例失败，正在重试:", error);
    instance = new MCPServiceManager();
    return instance;
  }
}

/**
 * 清理单例资源
 *
 * @returns Promise<void>
 */
async function cleanup(): Promise<void> {
  console.log("🧹 正在清理 MCPServiceManager 单例资源...");

  try {
    if (instance) {
      await instance.stopAllServices();
      instance = null;
      currentLogger = undefined;
    }
  } catch (error) {
    globalLogger.error(
      "❌ MCPServiceManager 单例清理失败:",
      (error as Error).message
    );
    // 即使清理失败，也要重置状态
    instance = null;
    currentLogger = undefined;
    throw error;
  }
}

/**
 * 重置单例状态（用于错误恢复和测试）
 *
 * 注意：这个方法不会清理资源，只是重置状态
 * 如果需要清理资源，请使用 cleanup() 方法
 */
function reset(): void {
  console.log("🔄 重置 MCPServiceManager 单例状态");
  instance = null;
  currentLogger = undefined;
}

/**
 * 检查单例是否已初始化
 *
 * @returns boolean 是否已初始化
 */
function isInitialized(): boolean {
  return instance !== null;
}

/**
 * 获取当前实例（同步方法，仅在确定已初始化时使用）
 *
 * @returns MCPServiceManager | null 当前实例或null
 */
function getCurrentInstance(): MCPServiceManager | null {
  return instance;
}

/**
 * MCPServiceManager 全局单例管理器
 *
 * 简化实现，保持核心功能和API兼容性
 */
export const MCPServiceManagerSingleton = {
  getInstance,
  cleanup,
  reset,
  isInitialized,
  getCurrentInstance,
} as const;

// 导出默认实例（便于使用）
export default MCPServiceManagerSingleton;

// 处理未捕获的异常，简化清理逻辑
process.on("uncaughtException", async (error) => {
  globalLogger.error("💥 未捕获的异常，清理 MCPServiceManager 单例:", error);
  try {
    await MCPServiceManagerSingleton.cleanup();
  } catch (cleanupError) {
    globalLogger.error("清理过程中发生错误:", cleanupError);
  }
});

// 处理未处理的Promise拒绝
process.on("unhandledRejection", async (reason) => {
  globalLogger.error(
    "💥 未处理的Promise拒绝，清理 MCPServiceManager 单例:",
    reason
  );
  try {
    await MCPServiceManagerSingleton.cleanup();
  } catch (cleanupError) {
    globalLogger.error("清理过程中发生错误:", cleanupError);
  }
});
