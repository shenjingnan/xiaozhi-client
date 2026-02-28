/**
 * 配置事件总线
 *
 * 负责配置相关的事件订阅和发布
 */
import type { ConfigErrorPayload, ConfigUpdatePayload } from "./types.js";

/**
 * 配置事件总线类
 * 用于解耦配置变更通知
 */
export class ConfigEventBus {
  private eventCallbacks: Map<string, Array<(data: unknown) => void>> =
    new Map();

  /**
   * 注册事件监听器
   */
  public on(eventName: string, callback: (data: unknown) => void): void {
    if (!this.eventCallbacks.has(eventName)) {
      this.eventCallbacks.set(eventName, []);
    }
    this.eventCallbacks.get(eventName)?.push(callback);
  }

  /**
   * 移除事件监听器
   */
  public off(eventName: string, callback: (data: unknown) => void): void {
    const callbacks = this.eventCallbacks.get(eventName);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 发射配置更新事件
   */
  public emitConfigUpdated(payload: ConfigUpdatePayload): void {
    this.emit("config:updated", payload);
  }

  /**
   * 发射配置错误事件
   */
  public emitConfigError(payload: ConfigErrorPayload): void {
    this.emit("config:error", payload);
  }

  /**
   * 发射事件（内部方法）
   */
  private emit(eventName: string, data: unknown): void {
    const callbacks = this.eventCallbacks.get(eventName);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件回调执行失败 [${eventName}]:`, error);
        }
      }
    }
  }

  /**
   * 清除所有事件监听器
   */
  public clear(): void {
    this.eventCallbacks.clear();
  }

  /**
   * 获取事件监听器数量（用于调试）
   */
  public getListenerCount(eventName: string): number {
    return this.eventCallbacks.get(eventName)?.length || 0;
  }
}
