/**
 * 前端事件总线服务
 * 提供统一的事件发布订阅机制，用于解耦模块间的通信
 *
 * 特性：
 * - 类型安全的事件订阅和发布
 * - 支持多个订阅者
 * - 返回取消订阅函数，便于管理
 */

/**
 * 事件监听器类型
 */
export type EventListener<T = unknown> = (data: T) => void;

/**
 * 事件总线类 - 支持多个订阅者
 * 使用泛型支持不同的事件类型映射
 * @template EventMap 事件类型映射，键为事件名称，值为事件数据类型
 */
export class EventBus<EventMap = Record<string, unknown>> {
  private listeners: Map<keyof EventMap, Set<EventListener<unknown>>> =
    new Map();

  /**
   * 订阅事件
   * @param event 事件名称
   * @param listener 事件监听器
   * @returns 取消订阅函数
   */
  on<K extends keyof EventMap>(
    event: K,
    listener: EventListener<EventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as EventListener<unknown>);

    // 返回取消订阅函数
    return () => {
      this.off(event, listener);
    };
  }

  /**
   * 取消订阅事件
   * @param event 事件名称
   * @param listener 事件监听器
   */
  off<K extends keyof EventMap>(
    event: K,
    listener: EventListener<EventMap[K]>
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener as EventListener<unknown>);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * 发布事件
   * @param event 事件名称
   * @param data 事件数据
   */
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(data);
        } catch (error) {
          // 将事件名称转换为字符串以支持可能的 symbol 类型
          const eventName = String(event);
          console.error(`[EventBus] 事件监听器执行失败 (${eventName}):`, error);
        }
      }
    }
  }

  /**
   * 清除所有监听器
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * 获取事件监听器数量
   * @param event 可选的事件名称，如果不提供则返回所有监听器总数
   */
  getListenerCount(event?: keyof EventMap): number {
    if (event) {
      return this.listeners.get(event)?.size || 0;
    }
    return Array.from(this.listeners.values()).reduce(
      (total, listeners) => total + listeners.size,
      0
    );
  }
}
