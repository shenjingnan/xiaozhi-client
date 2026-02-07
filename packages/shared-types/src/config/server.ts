/**
 * 服务器配置相关类型定义
 */

/**
 * 客户端状态信息
 */
export interface ClientStatus {
  status: "connected" | "disconnected";
  mcpEndpoint: string;
  activeMCPServers: string[];
  lastHeartbeat?: number;
}

/**
 * 服务器信息
 */
export interface ServerInfo {
  /** 服务器版本 */
  version: string;
  /** 启动时间 */
  startTime: string;
  /** 运行时长（毫秒） */
  uptime: number;
  /** 主机名 */
  hostname: string;
  /** 进程ID */
  pid: number;
  /** Node.js 版本 */
  nodeVersion: string;
  /** 系统平台 */
  platform: string;
}

/**
 * 重启状态
 */
export interface RestartStatus {
  /** 重启状态 */
  status: "restarting" | "completed" | "failed";
  /** 错误信息 */
  error?: string;
  /** 时间戳 */
  timestamp: number;
  /** 服务名称（可选） */
  serviceName?: string;
  /** 重试次数（可选） */
  attempt?: number;
}
