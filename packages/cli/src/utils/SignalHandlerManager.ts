/**
 * 信号处理器管理器
 *
 * 统一管理 process 信号监听器，避免重复注册导致的 MaxListeners 超限警告。
 * 采用单例模式确保全局只注册一次信号处理器。
 *
 * @module packages/cli/src/utils/SignalHandlerManager
 */

/**
 * 清理函数类型
 */
type CleanupFunction = () => Promise<void> | void;

/**
 * 信号处理器管理器
 *
 * 使用单例模式确保 process 信号监听器全局只注册一次。
 * 支持注册多个清理函数，在信号触发时依次执行。
 */
export class SignalHandlerManager {
  private static instance: SignalHandlerManager;
  private cleanupHandlers: Map<string, CleanupFunction> = new Map();
  private handlersRegistered = false;
  private registeredSignals: Set<string> = new Set();

  /**
   * 获取单例实例
   */
  static getInstance(): SignalHandlerManager {
    if (!SignalHandlerManager.instance) {
      SignalHandlerManager.instance = new SignalHandlerManager();
    }
    return SignalHandlerManager.instance;
  }

  /**
   * 注册信号处理器
   *
   * @param signal - 信号名称（如 SIGINT, SIGTERM, SIGHUP）
   * @param handlerId - 处理器唯一标识符
   * @param cleanup - 清理函数
   */
  registerHandler(
    signal: "SIGINT" | "SIGTERM" | "SIGHUP",
    handlerId: string,
    cleanup: CleanupFunction
  ): void {
    // 添加或更新清理函数
    this.cleanupHandlers.set(handlerId, cleanup);

    // 如果该信号尚未注册全局监听器，则注册
    if (!this.registeredSignals.has(signal)) {
      this.registerSignalListener(signal);
      this.registeredSignals.add(signal);
    }
  }

  /**
   * 移除指定处理器
   *
   * @param handlerId - 处理器唯一标识符
   */
  removeHandler(handlerId: string): void {
    this.cleanupHandlers.delete(handlerId);
  }

  /**
   * 清理所有处理器
   */
  clearAllHandlers(): void {
    this.cleanupHandlers.clear();
  }

  /**
   * 重置管理器状态（主要用于测试场景）
   */
  reset(): void {
    this.cleanupHandlers.clear();
    this.registeredSignals.clear();
    this.handlersRegistered = false;
    SignalHandlerManager.instance =
      undefined as unknown as SignalHandlerManager;
  }

  /**
   * 注册信号监听器
   *
   * @param signal - 信号名称
   */
  private registerSignalListener(signal: string): void {
    process.once(signal, async () => {
      await this.executeCleanupHandlers();
      process.exit(0);
    });
  }

  /**
   * 执行所有清理函数
   */
  private async executeCleanupHandlers(): Promise<void> {
    const handlers = Array.from(this.cleanupHandlers.values());

    for (const handler of handlers) {
      try {
        await handler();
      } catch (error) {
        // 记录错误但继续执行其他清理函数
        console.error(
          `清理函数执行失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
}
