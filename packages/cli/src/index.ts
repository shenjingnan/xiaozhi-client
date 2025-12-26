#!/usr/bin/env node

/**
 * CLI 入口文件
 * 负责初始化依赖注入容器和启动命令处理器
 */

import { Command } from "commander";
import { DIContainer } from "./Container";
import { CommandRegistry } from "./commands/index";
import { ErrorHandler } from "./errors/ErrorHandlers";

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
      .description("小智 MCP 客户端")
      .helpOption("-h, --help", "显示帮助信息");

    // 解析命令行参数
    await program.parseAsync(process.argv);
  } catch (error) {
    ErrorHandler.handle(error as Error);
  }
}

// 启动 CLI 应用
// 使用更可靠的检测方法，兼容 Windows 路径
// 将路径转换为 URL 格式进行比较
const scriptPath = process.argv[1].replace(/\\/g, "/");
const isMainModule =
  import.meta.url === `file:///${scriptPath}` ||
  import.meta.url === `file://${scriptPath}`;
if (isMainModule) {
  initializeCLI();
}

export { initializeCLI };
