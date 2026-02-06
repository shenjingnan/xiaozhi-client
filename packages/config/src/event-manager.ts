/**
 * 配置事件管理器
 * 负责管理配置变更事件的订阅和通知
 */

/**
 * 事件回调函数类型
 */
export type EventCallback = (data: unknown) => void;

/**
 * 配置事件管理器
 * 提供事件的订阅、取消订阅和发射功能
 */
export class ConfigEventManager {
  private eventCallbacks: Map<string, Array<EventCallback>> = new Map();

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
   * 取消事件监听器
   * @param eventName 事件名称
   * @param callback 要取消的事件回调函数
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
   * 移除所有指定事件的监听器
   * @param eventName 事件名称
   */
  public removeAllListeners(eventName: string): void {
    this.eventCallbacks.delete(eventName);
  }

  /**
   * 清空所有事件监听器
   */
  public clear(): void {
    this.eventCallbacks.clear();
  }

  /**
   * 获取指定事件的监听器数量
   * @param eventName 事件名称
   */
  public listenerCount(eventName: string): number {
    const callbacks = this.eventCallbacks.get(eventName);
    return callbacks ? callbacks.length : 0;
  }
}
