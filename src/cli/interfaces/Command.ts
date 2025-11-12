/**
 * 命令接口定义
 */

import type { IDIContainer } from "@cli/interfaces/Config.js";
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
  /** 子命令 */
  subcommands?: SubCommand[];
  /** 执行命令 */
  execute(args: any[], options: any): Promise<void>;
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
 * 子命令接口
 */
export interface SubCommand {
  /** 子命令名称 */
  name: string;
  /** 子命令描述 */
  description: string;
  /** 子命令选项 */
  options?: CommandOption[];
  /** 执行子命令 */
  execute(args: any[], options: any): Promise<void>;
}

/**
 * 命令执行上下文
 */
export interface CommandContext {
  /** DI 容器 */
  container: IDIContainer;
  /** 命令行参数 */
  args: any[];
  /** 命令选项 */
  options: any;
}

/**
 * 基础命令处理器抽象类
 */
export abstract class BaseCommandHandler implements CommandHandler {
  abstract name: string;
  abstract description: string;
  options?: CommandOption[];
  subcommands?: SubCommand[];

  constructor(protected container: IDIContainer) {}

  abstract execute(args: any[], options: any): Promise<void>;

  /**
   * 获取服务实例
   */
  protected getService<T>(serviceName: string): T {
    return this.container.get(serviceName) as T;
  }

  /**
   * 处理错误
   */
  protected handleError(error: Error): void {
    const errorHandler = this.getService<any>("errorHandler");
    errorHandler.handle(error);
  }

  /**
   * 验证参数
   */
  protected validateArgs(args: any[], expectedCount: number): void {
    if (args.length < expectedCount) {
      throw new Error(
        `命令需要至少 ${expectedCount} 个参数，但只提供了 ${args.length} 个`
      );
    }
  }
}

/**
 * 命令注册器接口
 */
export interface ICommandRegistry {
  /** 注册所有命令到 Commander 程序 */
  registerCommands(program: Command): Promise<void>;
  /** 注册单个命令 */
  registerCommand(program: Command, handler: CommandHandler): void;
  /** 注册命令处理器 */
  registerHandler(handler: CommandHandler): void;
}

/**
 * 命令处理器工厂接口
 */
export interface ICommandHandlerFactory {
  /** 创建所有命令处理器 */
  createHandlers(): CommandHandler[];
  /** 创建指定类型的命令处理器 */
  createHandler(type: string): CommandHandler;
}
