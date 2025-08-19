#!/usr/bin/env node

/**
 * CLI 入口文件
 * 负责初始化依赖注入容器和启动命令处理器
 */

import { Command } from "commander";
import { DIContainer } from "./Container.js";
import { CommandRegistry } from "./commands/index.js";
import { ErrorHandler } from "./errors/ErrorHandlers.js";

const program = new Command();

/**
 * 初始化 CLI 应用
 */
async function initializeCLI(): Promise<void> {
  try {
    // 创建依赖注入容器
    const container = DIContainer.create();

    // 创建命令注册器
    const commandRegistry = new CommandRegistry(container);

    // 注册所有命令
    await commandRegistry.registerCommands(program);

    // 配置程序基本信息
    program
      .name("xiaozhi")
      .description("MCP Calculator Service CLI Tool")
      .version("1.6.2", "-v, --version", "显示版本信息")
      .helpOption("-h, --help", "显示帮助信息");

    // 解析命令行参数
    await program.parseAsync(process.argv);
  } catch (error) {
    ErrorHandler.handle(error as Error);
  }
}

// 启动 CLI 应用
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeCLI();
}

export { initializeCLI };
