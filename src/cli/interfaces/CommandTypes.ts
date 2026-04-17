/**
 * CLI 命令相关类型定义
 * 用于替代命令处理器中的 any 类型使用，提供类型安全保障
 */

import type {
  LocalMCPServerConfig,
  MCPServerConfig,
} from "@xiaozhi-client/config";

// =========================
// 基础命令参数和选项类型
// =========================

/**
 * 命令行参数类型
 * 替代 any[] 类型
 */
export type CommandArguments = string[];

/**
 * 命令选项类型
 * 替代 any 类型
 */
export type CommandOptions = Record<string, unknown>;

// =========================
// 子命令具体选项类型
// =========================

/**
 * list 子命令选项
 */
export interface ListOptions {
  /** 是否显示所有服务的工具列表 */
  tools?: boolean;
}

/**
 * call 子命令选项
 */
export interface CallOptions {
  /** 工具参数 (JSON 格式) */
  args?: string;
}

// =========================
// 类型守卫函数
// =========================

/**
 * 检查对象是否为本地 MCP 服务配置
 * @param obj 待检查的对象
 * @returns 是否为本地服务配置
 */
export function isLocalMCPServerConfig(
  obj: unknown
): obj is LocalMCPServerConfig {
  const config = obj as MCPServerConfig;
  return (
    typeof config === "object" &&
    config !== null &&
    "command" in config &&
    "args" in config &&
    typeof config.command === "string" &&
    Array.isArray(config.args) &&
    config.args.every((arg: unknown) => typeof arg === "string")
  );
}

// =========================
// 类型化子命令接口
// =========================

/**
 * 类型化子命令接口
 * 提供类型安全的子命令定义
 */
export interface TypedSubCommand<TOptions = CommandOptions> {
  /** 子命令名称 */
  name: string;
  /** 子命令描述 */
  description: string;
  /** 子命令选项 */
  options?: Array<{
    /** 选项标志 */
    flags: string;
    /** 选项描述 */
    description: string;
    /** 默认值 */
    defaultValue?: unknown;
  }>;
  /** 执行子命令 */
  execute: (args: CommandArguments, options: TOptions) => Promise<void>;
}
