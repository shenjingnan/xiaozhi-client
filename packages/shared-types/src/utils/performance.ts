/**
 * 性能监控相关类型定义
 */

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  serviceName: string;
  connectionLatency: number; // 连接延迟（毫秒）
  averageToolCallLatency: number; // 平均工具调用延迟（毫秒）
  toolCallLatencies: Map<string, number[]>; // 每个工具的调用延迟历史
  successRate: number; // 成功率（0-1）
  errorRate: number; // 错误率（0-1）
  totalOperations: number; // 总操作数
  successfulOperations: number; // 成功操作数
  failedOperations: number; // 失败操作数
  lastUpdated: Date; // 最后更新时间
  uptime: number; // 运行时间（毫秒）
  startTime: Date; // 启动时间
}

/**
 * 操作类型枚举
 */
export enum OperationType {
  CONNECTION = "connection",
  TOOL_CALL = "tool_call",
  RECONNECTION = "reconnection",
  HEALTH_CHECK = "health_check",
}

/**
 * 计时器接口
 */
export interface Timer {
  id: string;
  operation: string;
  serviceName: string;
  startTime: number;
  type: OperationType;
}

/**
 * 性能统计摘要
 */
export interface PerformanceSummary {
  /** 总连接数 */
  totalConnections: number;
  /** 活跃连接数 */
  activeConnections: number;
  /** 平均连接延迟 */
  averageConnectionLatency: number;
  /** 平均工具调用延迟 */
  averageToolCallLatency: number;
  /** 总体成功率 */
  overallSuccessRate: number;
  /** 总操作数 */
  totalOperations: number;
  /** 性能评分（0-100） */
  performanceScore: number;
}