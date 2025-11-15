/**
 * 连接配置相关类型定义
 */

/**
 * 连接配置接口
 */
export interface ConnectionConfig {
  /** 心跳间隔（毫秒） */
  heartbeatInterval?: number;
  /** 心跳超时时间（毫秒） */
  heartbeatTimeout?: number;
  /** 重连间隔（毫秒） */
  reconnectInterval?: number;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
  /** 连接超时时间（毫秒） */
  connectionTimeout?: number;
  /** 是否启用自动重连 */
  autoReconnect?: boolean;
}

/**
 * 端点配置接口
 */
export interface EndpointConfig {
  /** 端点ID */
  id: string;
  /** 端点名称 */
  name: string;
  /** 端点URL */
  url: string;
  /** 是否启用 */
  enabled: boolean;
  /** 连接配置 */
  connection?: ConnectionConfig;
  /** 优先级（数字越小优先级越高） */
  priority?: number;
}

/**
 * 负载均衡配置
 */
export interface LoadBalancingConfig {
  /** 负载均衡策略 */
  strategy: "round-robin" | "random" | "least-connections" | "weighted";
  /** 健康检查间隔（毫秒） */
  healthCheckInterval?: number;
  /** 健康检查超时时间（毫秒） */
  healthCheckTimeout?: number;
}
