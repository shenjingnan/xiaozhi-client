/**
 * 服务相关的共享类型定义
 *
 * 此文件包含多个服务之间共享的接口类型，避免服务之间的循环依赖。
 */

/**
 * 客户端信息接口
 */
export interface ClientInfo {
  status: "connected" | "disconnected";
  mcpEndpoint: string;
  activeMCPServers: string[];
  lastHeartbeat?: number;
}

/**
 * 重启状态接口
 */
export interface RestartStatus {
  status: "restarting" | "completed" | "failed";
  error?: string;
  timestamp: number;
  serviceName?: string;
  attempt?: number;
}
