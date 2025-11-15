/**
 * MCP 传输层类型定义
 */

import type { TransportConfig } from "./message";

/**
 * 扩展的传输配置接口
 * 支持不同传输协议的特定配置
 */
export interface ExtendedTransportConfig extends TransportConfig {
  /** 传输协议类型 */
  protocol?: "stdio" | "http" | "websocket" | "sse";

  /** WebSocket 特定配置 */
  websocket?: {
    url?: string;
    path?: string;
    port?: number;
  };

  /** HTTP 特定配置 */
  http?: {
    port?: number;
    hostname?: string;
    path?: string;
  };

  /** SSE 特定配置 */
  sse?: {
    path?: string;
    port?: number;
  };

  /** Stdio 特定配置 */
  stdio?: {
    command?: string;
    args?: string[];
  };
}

/**
 * 连接统计信息
 */
export interface ConnectionStats {
  /** 连接ID */
  connectionId: string;
  /** 连接建立时间 */
  connectedAt: string;
  /** 最后活动时间 */
  lastActivity: string;
  /** 发送消息数 */
  messagesSent: number;
  /** 接收消息数 */
  messagesReceived: number;
  /** 错误次数 */
  errorCount: number;
  /** 平均响应时间（毫秒） */
  averageResponseTime: number;
}
