/**
 * CLI 核心类型定义
 */

/**
 * 平台类型
 */
export type Platform =
  | "win32"
  | "darwin"
  | "linux"
  | "freebsd"
  | "openbsd"
  | "sunos"
  | "aix";

/**
 * 日志级别
 */
export type LogLevel = "error" | "warn" | "info" | "debug";

/**
 * 配置文件格式
 */
export type ConfigFormat = "json" | "json5" | "jsonc";

/**
 * 命令执行结果
 */
export interface CommandResult {
  /** 是否成功 */
  success: boolean;
  /** 结果消息 */
  message?: string;
  /** 错误信息 */
  error?: Error;
  /** 退出码 */
  exitCode?: number;
}

/**
 * 文件操作选项
 */
export interface FileOperationOptions {
  /** 是否递归 */
  recursive?: boolean;
  /** 排除的文件/目录 */
  exclude?: string[];
  /** 是否覆盖现有文件 */
  overwrite?: boolean;
}

/**
 * 进程信息
 */
export interface ProcessInfo {
  /** 进程 ID */
  pid: number;
  /** 进程名称 */
  name: string;
  /** 启动时间 */
  startTime: number;
  /** 命令行参数 */
  args: string[];
}

/**
 * 模板信息
 */
export interface TemplateInfo {
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 模板路径 */
  path: string;
  /** 是否有效 */
  valid: boolean;
}
