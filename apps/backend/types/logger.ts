/**
 * Logger 相关的类型定义
 * 用于替换 Logger.ts 中的 any 类型，提升类型安全性
 */

/**
 * 日志对象接口，用于描述 Pino 日志对象的结构
 */
export interface LogObject {
  /** 日志级别数值 */
  level: number;
  /** 日志消息 */
  msg: string;
  /** 额外的参数数组 */
  args?: unknown[];
  /** 时间戳 */
  time?: string;
  /** 其他额外字段 */
  [key: string]: unknown;
}

/**
 * 错误对象接口，用于标准化错误处理
 */
export interface ErrorLike {
  message: string;
  stack?: string;
  name?: string;
  cause?: unknown;
  [key: string]: unknown;
}

/**
 * 日志级别映射信息
 */
export interface LevelInfo {
  /** 级别名称 */
  name: string;
  /** 颜色函数 */
  color: (text: string) => string;
}

/**
 * 日志参数类型，可以是任意类型但需要明确类型标注
 */
export type LogArgument =
  | string
  | number
  | boolean
  | null
  | undefined
  | object
  | unknown[];

/**
 * 结构化日志对象类型
 */
export type StructuredLogObject = Record<string, unknown>;

/**
 * 日志方法重载的参数类型
 */
export type LogMethodParams =
  | [message: string, ...args: LogArgument[]]
  | [obj: StructuredLogObject, message?: string];
