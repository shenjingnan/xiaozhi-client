/**
 * MCP 服务管理器单例
 * 提供全局唯一的 MCPServiceManager 实例，解决多实例资源冲突问题
 */

import MCPServiceManager from "./MCPServiceManager.js";

// 重新导出相关类型，便于外部使用
export type { Tool } from "@modelcontextprotocol/sdk/types.js";
export type { LocalMCPServerConfig } from "../configManager.js";

// 单例状态枚举
enum SingletonState {
  NOT_INITIALIZED = "not_initialized",
  INITIALIZING = "initializing",
  INITIALIZED = "initialized",
  FAILED = "failed",
  CLEANUP = "cleanup",
}

// 单例状态接口
interface SingletonStatus {
  state: SingletonState;
  initializationTime?: Date;
  lastError?: Error;
  instanceId?: string;
}

// 单例状态管理变量
let instance: MCPServiceManager | null = null;
let initPromise: Promise<MCPServiceManager> | null = null;
let state: SingletonState = SingletonState.NOT_INITIALIZED;
let lastError: Error | null = null;
let instanceId: string | null = null;

/**
 * 创建 MCPServiceManager 实例（私有函数）
 */
async function createInstance(): Promise<MCPServiceManager> {
  console.log("🚀 正在初始化 MCPServiceManager 单例...");

  const manager = new MCPServiceManager();

  return manager;
}

/**
 * 获取 MCPServiceManager 单例实例
 *
 * @returns Promise<MCPServiceManager> 管理器实例
 * @throws Error 如果初始化失败
 */
async function getInstance(): Promise<MCPServiceManager> {
  // 如果已经初始化完成，直接返回实例
  if (instance && state === SingletonState.INITIALIZED) {
    return instance;
  }

  // 如果正在初始化中，等待同一个初始化Promise
  if (initPromise && state === SingletonState.INITIALIZING) {
    return initPromise;
  }

  // 如果之前初始化失败，重置状态准备重试
  if (state === SingletonState.FAILED) {
    reset();
  }

  // 开始新的初始化过程
  state = SingletonState.INITIALIZING;
  initPromise = createInstance();

  try {
    instance = await initPromise;
    state = SingletonState.INITIALIZED;
    instanceId = `mcp-manager-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    lastError = null;

    console.log(`✅ MCPServiceManager 单例初始化成功，实例ID: ${instanceId}`);
    return instance;
  } catch (error) {
    state = SingletonState.FAILED;
    lastError = error as Error;
    initPromise = null;

    console.error(
      "❌ MCPServiceManager 单例初始化失败:",
      (error as Error).message
    );
    throw error;
  }
}

/**
 * 清理单例资源
 *
 * @returns Promise<void>
 */
async function cleanup(): Promise<void> {
  if (state === SingletonState.CLEANUP) {
    console.log("⚠️  MCPServiceManager 单例已在清理中，跳过重复清理");
    return;
  }

  console.log("🧹 正在清理 MCPServiceManager 单例资源...");
  state = SingletonState.CLEANUP;

  try {
    // 清理初始化Promise
    if (initPromise) {
      try {
        const instanceFromPromise = await initPromise;
        await instanceFromPromise.stopAllServices();
      } catch (error) {
        console.error("清理初始化中的实例失败:", (error as Error).message);
      }
      initPromise = null;
    }

    // 清理已初始化的实例
    if (instance) {
      await instance.stopAllServices();
      instance = null;
    }

    state = SingletonState.NOT_INITIALIZED;
    lastError = null;
    instanceId = null;

    console.log("✅ MCPServiceManager 单例资源清理完成");
  } catch (error) {
    console.error(
      "❌ MCPServiceManager 单例清理失败:",
      (error as Error).message
    );
    // 即使清理失败，也要重置状态，避免永久锁定
    reset();
    throw error;
  }
}

/**
 * 重置单例状态（用于错误恢复）
 *
 * 注意：这个方法不会清理资源，只是重置状态
 * 如果需要清理资源，请使用 cleanup() 方法
 */
function reset(): void {
  console.log("🔄 重置 MCPServiceManager 单例状态");

  instance = null;
  initPromise = null;
  state = SingletonState.NOT_INITIALIZED;
  lastError = null;
  instanceId = null;
}

/**
 * 检查单例是否已初始化
 *
 * @returns boolean 是否已初始化
 */
function isInitialized(): boolean {
  return state === SingletonState.INITIALIZED && instance !== null;
}

/**
 * 获取单例状态信息
 *
 * @returns SingletonStatus 状态信息
 */
function getStatus(): SingletonStatus {
  return {
    state: state,
    initializationTime: instanceId ? new Date() : undefined,
    lastError: lastError || undefined,
    instanceId: instanceId || undefined,
  };
}

/**
 * 强制重新初始化单例
 *
 * 这个方法会先清理现有资源，然后重新初始化
 *
 * @returns Promise<MCPServiceManager> 新的管理器实例
 */
async function forceReinitialize(): Promise<MCPServiceManager> {
  console.log("🔄 强制重新初始化 MCPServiceManager 单例...");

  await cleanup();
  return getInstance();
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
 * 等待初始化完成（如果正在初始化中）
 *
 * @returns Promise<boolean> 是否成功初始化
 */
async function waitForInitialization(): Promise<boolean> {
  if (state === SingletonState.INITIALIZED) {
    return true;
  }

  if (state === SingletonState.INITIALIZING && initPromise) {
    try {
      await initPromise;
      return true;
    } catch (error) {
      return false;
    }
  }

  return false;
}

/**
 * MCPServiceManager 全局单例管理器
 *
 * 使用对象包装模块级函数，保持原有API接口不变
 */
export const MCPServiceManagerSingleton = {
  getInstance,
  cleanup,
  reset,
  isInitialized,
  getStatus,
  forceReinitialize,
  getCurrentInstance,
  waitForInitialization,
} as const;

// 导出默认实例（便于使用）
export default MCPServiceManagerSingleton;

// 进程退出时自动清理资源
process.on("exit", () => {
  if (MCPServiceManagerSingleton.isInitialized()) {
    console.log("🔄 进程退出，正在清理 MCPServiceManager 单例...");
    // 注意：这里不能使用 await，因为 exit 事件是同步的
    MCPServiceManagerSingleton.reset();
  }
});

// 处理未捕获的异常
process.on("uncaughtException", async (error) => {
  console.error("💥 未捕获的异常，清理 MCPServiceManager 单例:", error);
  try {
    await MCPServiceManagerSingleton.cleanup();
  } catch (cleanupError) {
    console.error("清理过程中发生错误:", cleanupError);
  }
});

// 处理未处理的Promise拒绝
process.on("unhandledRejection", async (reason) => {
  console.error("💥 未处理的Promise拒绝，清理 MCPServiceManager 单例:", reason);
  try {
    await MCPServiceManagerSingleton.cleanup();
  } catch (cleanupError) {
    console.error("清理过程中发生错误:", cleanupError);
  }
});
