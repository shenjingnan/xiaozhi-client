/**
 * 连接配置相关类型定义
 *
 * 包含心跳检测、重连等连接参数配置类型
 */

/**
 * 连接配置
 */
export interface ConnectionConfig {
  heartbeatInterval?: number; // 心跳检测间隔（毫秒），默认30000
  heartbeatTimeout?: number; // 心跳超时时间（毫秒），默认10000
  reconnectInterval?: number; // 重连间隔（毫秒），默认5000
}
