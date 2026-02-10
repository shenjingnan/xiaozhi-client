/**
 * 配置事件管理模块
 * 负责配置相关事件的发布订阅
 */

/**
 * 事件回调函数类型
 */
export type EventCallback = (data: unknown) => void;

/**
 * 事件回调映射
 */
type EventCallbacksMap = Map<string, Array<EventCallback>>;

/**
 * 配置事件管理器
 * 负责管理配置相关的事件发布订阅
 */
export class ConfigEvents {
  private static instance: ConfigEvents;
  private eventCallbacks: EventCallbacksMap = new Map();

  private constructor() {}

  /**
   * 获取事件管理器单例实例
   */
  public static getInstance(): ConfigEvents {
    if (!ConfigEvents.instance) {
      ConfigEvents.instance = new ConfigEvents();
    }
    return ConfigEvents.instance;
  }

  /**
   * 注册事件监听器
   * @param eventName 事件名称
   * @param callback 事件回调函数
   */
  public on(eventName: string, callback: EventCallback): void {
    if (!this.eventCallbacks.has(eventName)) {
      this.eventCallbacks.set(eventName, []);
    }
    this.eventCallbacks.get(eventName)?.push(callback);
  }

  /**
   * 移除事件监听器
   * @param eventName 事件名称
   * @param callback 要移除的事件回调函数
   */
  public off(eventName: string, callback: EventCallback): void {
    const callbacks = this.eventCallbacks.get(eventName);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 发射事件
   * @param eventName 事件名称
   * @param data 事件数据
   */
  public emit(eventName: string, data: unknown): void {
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
   * 移除所有事件监听器
   * @param eventName 可选的事件名称，如果不提供则移除所有事件
   */
  public removeAllListeners(eventName?: string): void {
    if (eventName) {
      this.eventCallbacks.delete(eventName);
    } else {
      this.eventCallbacks.clear();
    }
  }

  /**
   * 获取事件监听器数量
   * @param eventName 事件名称
   */
  public listenerCount(eventName: string): number {
    return this.eventCallbacks.get(eventName)?.length || 0;
  }
}

// 导出单例实例
export const configEvents = ConfigEvents.getInstance();
