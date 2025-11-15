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
  /** 是否正在重启 */
  restarting: boolean;
  /** 重启时间 */
  restartTime?: string;
  /** 重启原因 */
  reason?: string;
  /** 预计完成时间 */
  estimatedCompletion?: string;
}