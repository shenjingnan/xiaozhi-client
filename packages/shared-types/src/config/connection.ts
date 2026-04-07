/**
 * 连接配置相关类型定义
 */

// 从 app.ts 导入 ConnectionConfig，避免重复定义
import type { ConnectionConfig } from "./app";

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
