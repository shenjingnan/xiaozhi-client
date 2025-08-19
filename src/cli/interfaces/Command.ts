/**
 * 命令接口定义
 */

import type { Command } from "commander";

/**
 * 命令处理器接口
 */
export interface CommandHandler {
  /** 命令名称 */
  name: string;
  /** 命令描述 */
  description: string;
  /** 命令选项 */
  options?: CommandOption[];
  /** 执行命令 */
  execute(args: any, options: any): Promise<void>;
}

/**
 * 命令选项接口
 */
export interface CommandOption {
  /** 选项标志 */
  flags: string;
  /** 选项描述 */
  description: string;
  /** 默认值 */
  defaultValue?: any;
}

/**
 * 命令执行上下文
 */
export interface CommandContext {
  /** 加载指示器 */
  spinner: any;
  /** 日志记录器 */
  logger: any;
  /** 配置管理器 */
  configManager: any;
}

/**
 * 命令注册器接口
 */
export interface ICommandRegistry {
  /** 注册所有命令到 Commander 程序 */
  registerCommands(program: Command): Promise<void>;
  /** 注册单个命令 */
  registerCommand(program: Command, handler: CommandHandler): void;
}
