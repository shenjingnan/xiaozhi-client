#!/usr/bin/env node

/**
 * 小智客户端 CLI 入口文件（重构版）
 */

import chalk from "chalk";
import { Command } from "commander";
import { createContainer } from "./cli/Container.js";
import { CommandRegistry } from "./cli/commands/index.js";

const program = new Command();

/**
 * 显示帮助信息
 */
function showHelp(): void {
  console.log(chalk.blue("🤖 小智 MCP 客户端"));
  console.log();
  console.log(
    "一个强大的 MCP (Model Context Protocol) 客户端，支持多种连接方式和服务管理。"
  );
  console.log();
  console.log(chalk.yellow("主要功能:"));
  console.log("  • 支持 WebSocket 和 HTTP 连接");
  console.log("  • 多 MCP 服务管理");
  console.log("  • 工具调用和资源访问");
  console.log("  • 配置管理和模板创建");
  console.log("  • 后台服务和 Web UI");
  console.log();
  console.log(chalk.yellow("快速开始:"));
  console.log("  xiaozhi config init          # 初始化配置");
  console.log("  xiaozhi start                # 启动服务");
  console.log("  xiaozhi ui                   # 启动 Web UI");
  console.log();
  console.log("使用 'xiaozhi --help' 查看所有可用命令");
}

/**
 * 显示详细信息
 */
function showDetailedInfo(container: any): void {
  const versionUtils = container.get("versionUtils") as any;
  const platformUtils = container.get("platformUtils") as any;

  const versionInfo = versionUtils.getVersionInfo();
  const systemInfo = platformUtils.getSystemInfo();

  console.log(chalk.blue("🤖 小智 MCP 客户端 - 详细信息"));
  console.log();
  console.log(chalk.green("版本信息:"));
  console.log(`  名称: ${versionInfo.name || "xiaozhi"}`);
  console.log(`  版本: ${versionInfo.version}`);
  if (versionInfo.description) {
    console.log(`  描述: ${versionInfo.description}`);
  }
  console.log();
  console.log(chalk.green("系统信息:"));
  console.log(`  Node.js: ${systemInfo.nodeVersion}`);
  console.log(`  平台: ${systemInfo.platform} ${systemInfo.arch}`);
  if (systemInfo.isContainer) {
    console.log("  环境: Container");
  }
  console.log();
  console.log(chalk.green("配置信息:"));
  const configManager = container.get("configManager") as any;
  if (configManager.configExists()) {
    const configPath = configManager.getConfigPath();
    console.log(`  配置文件: ${configPath}`);

    try {
      const endpoints = configManager.getMcpEndpoints();
      console.log(`  MCP 端点: ${endpoints.length} 个`);
    } catch (error) {
      console.log("  MCP 端点: 读取失败");
    }
  } else {
    console.log("  配置文件: 未初始化");
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    // 检查是否有 --info 参数，如果有则直接处理
    if (process.argv.includes("--info")) {
      const container = await createContainer();
      showDetailedInfo(container);
      process.exit(0);
    }

    // 检查是否有 --version-info 参数，如果有则直接处理
    if (process.argv.includes("--version-info")) {
      const container = await createContainer();
      const versionUtils = container.get("versionUtils") as any;
      const platformUtils = container.get("platformUtils") as any;

      const versionInfo = versionUtils.getVersionInfo();
      const systemInfo = platformUtils.getSystemInfo();

      console.log(`${versionInfo.name || "xiaozhi"} v${versionInfo.version}`);
      if (versionInfo.description) {
        console.log(versionInfo.description);
      }
      console.log(`Node.js: ${systemInfo.nodeVersion}`);
      console.log(`Platform: ${systemInfo.platform} ${systemInfo.arch}`);
      if (systemInfo.isContainer) {
        console.log("Environment: Container");
      }
      process.exit(0);
    }

    // 创建 DI 容器
    const container = await createContainer();

    // 创建命令注册器
    const commandRegistry = new CommandRegistry(container);

    // 设置程序基本信息
    program
      .name("xiaozhi")
      .description("小智 MCP 客户端 - 强大的 Model Context Protocol 客户端");

    // 注册所有命令
    await commandRegistry.registerCommands(program);

    // 自定义帮助信息
    program.helpOption("-h, --help", "显示帮助信息").addHelpText(
      "after",
      `
示例:
  xiaozhi config init              # 初始化配置文件
  xiaozhi start                    # 启动服务
  xiaozhi start -d                 # 后台启动服务
  xiaozhi start -u                 # 启动服务并打开 Web UI
  xiaozhi start -s 3000            # 以 MCP Server 模式启动
  xiaozhi stop                     # 停止服务
  xiaozhi status                   # 检查服务状态
  xiaozhi restart -d               # 重启服务（后台模式）
  xiaozhi config set mcpEndpoint <url> # 设置 MCP 端点
  xiaozhi create my-project        # 创建项目
  xiaozhi mcp list                 # 列出 MCP 服务
  xiaozhi endpoint list            # 列出 MCP 端点
  xiaozhi ui                       # 启动 Web UI

更多信息请访问: https://github.com/your-org/xiaozhi-client
`
    );

    // 处理无参数情况，显示帮助
    if (process.argv.length <= 2) {
      showHelp();
      process.exit(0);
    }

    // 解析命令行参数
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(
      chalk.red("程序启动失败:"),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// 启动程序
main().catch((error) => {
  console.error(
    chalk.red("程序执行失败:"),
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
