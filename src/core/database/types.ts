/**
 * 数据库相关类型定义
 */

/**
 * 日志级别枚举
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * 日志分类枚举
 */
export type LogCategory =
  | "mcp_tool"
  | "system"
  | "error"
  | "connection"
  | "startup"
  | "general";

/**
 * 日志条目接口
 */
export interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  type: string;
  message: string;
  metadata?: Record<string, any>;
  sessionId?: string;
}

/**
 * 数据库配置接口
 */
export interface DatabaseConfig {
  /** 数据库文件路径 */
  dbPath: string;
  /** 是否启用外键约束 */
  foreignKeys?: boolean;
  /** 是否启用 WAL 模式 */
  walMode?: boolean;
}

/**
 * 数据库初始化结果
 */
export interface DatabaseInitResult {
  success: boolean;
  error?: string;
  tablesCreated?: string[];
}

/**
 * 日志插入结果
 */
export interface LogInsertResult {
  success: boolean;
  error?: string;
  logId?: number;
}

/**
 * 数据库统计信息
 */
export interface DatabaseStats {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  logsByCategory: Record<LogCategory, number>;
  oldestLog?: Date;
  newestLog?: Date;
}

/**
 * 查询选项
 */
export interface LogQueryOptions {
  /** 限制返回数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
  /** 日志级别过滤 */
  level?: LogLevel;
  /** 日志分类过滤 */
  category?: LogCategory;
  /** 日志类型过滤 */
  type?: string;
  /** 会话ID过滤 */
  sessionId?: string;
  /** 开始时间 */
  startTime?: Date;
  /** 结束时间 */
  endTime?: Date;
  /** 按时间排序 */
  orderBy?: "ASC" | "DESC";
}
