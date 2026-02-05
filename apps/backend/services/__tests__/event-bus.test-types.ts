/**
 * EventBus 测试专用事件类型定义
 *
 * 这些事件类型仅用于测试，不应该在生产代码中使用。
 */

/**
 * 测试用事件总线事件类型
 */
export interface EventBusTestEvents {
  // 高频事件测试
  "high-frequency": {
    id: number;
    timestamp: number;
  };

  // 批量监听器测试
  "bulk-test": {
    id: number;
    timestamp: number;
  };

  // 错误处理测试
  "error-test": {
    error: string;
    timestamp: number;
  };

  // 大数据测试
  "large-data-test": {
    data: unknown;
    timestamp: number;
  };

  // 销毁测试
  "destroy-test": {
    message: string;
    timestamp: number;
  };

  // 链式事件测试
  "chain-event-1": {
    value: number;
    timestamp: number;
  };
  "chain-event-2": {
    value: number;
    timestamp: number;
  };
  "chain-event-3": {
    value: number;
    timestamp: number;
  };

  // 性能测试
  "performance-test": {
    data: unknown;
    timestamp: number;
  };
  "test:performance": {
    id: number;
    timestamp: number;
  };

  // 链式测试
  "chain:start": {
    value: number;
    timestamp: number;
  };
  "chain:middle": {
    value: number;
    timestamp: number;
  };
  "chain:end": {
    value: number;
    timestamp: number;
  };

  // 错误测试
  "test:error": {
    error: boolean;
    timestamp: number;
  };

  // 移除测试
  "test:remove": {
    id: number;
    timestamp: number;
  };
}
