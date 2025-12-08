/**
 * 创建一个模拟的 WebSocket 对象，带有事件监听器功能
 */
export function createMockWebSocket() {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  const mockWs = {
    readyState: 1, // WebSocket.OPEN
    send: vi.fn(),
    on: vi
      .fn()
      .mockImplementation(
        (event: string, callback: (...args: unknown[]) => void) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(callback);
        }
      ),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    removeAllListeners: vi.fn(),

    // 触发事件的方法
    trigger: (event: string, ...args: unknown[]) => {
      if (listeners[event]) {
        for (const callback of listeners[event]) {
          callback(...args);
        }
      }
    },

    // 获取监听器
    getListeners: () => listeners,
  };

  return mockWs;
}

/**
 * 等待指定时间
 */
export function wait(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
