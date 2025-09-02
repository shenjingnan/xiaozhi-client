/**
 * MCP管理命令处理器
 */

import chalk from "chalk";
import ora from "ora";
import { ToolCallService } from "../../services/ToolCallService.js";
import type { SubCommand } from "../interfaces/Command.js";
import { BaseCommandHandler } from "../interfaces/Command.js";
import type { IDIContainer } from "../interfaces/Config.js";

/**
 * MCP管理命令处理器
 */
export class McpCommandHandler extends BaseCommandHandler {
  override name = "mcp";
  override description = "MCP 服务和工具管理";

  override subcommands: SubCommand[] = [
    {
      name: "list",
      description: "列出 MCP 服务",
      options: [{ flags: "--tools", description: "显示所有服务的工具列表" }],
      execute: async (args: any[], options: any) => {
        await this.handleList(options);
      },
    },
    {
      name: "server",
      description: "管理指定的 MCP 服务",
      execute: async (args: any[], options: any) => {
        this.validateArgs(args, 1);
        await this.handleServer(args[0]);
      },
    },
    {
      name: "tool",
      description: "启用或禁用指定服务的工具",
      execute: async (args: any[], options: any) => {
        this.validateArgs(args, 3);
        const [serverName, toolName, action] = args;

        if (action !== "enable" && action !== "disable") {
          console.error(chalk.red("错误: 操作必须是 'enable' 或 'disable'"));
          process.exit(1);
        }

        const enabled = action === "enable";
        await this.handleTool(serverName, toolName, enabled);
      },
    },
    {
      name: "call",
      description: "调用指定服务的工具",
      options: [
        {
          flags: "--args <json>",
          description: "工具参数 (JSON 格式)",
          defaultValue: "{}",
        },
      ],
      execute: async (args: any[], options: any) => {
        this.validateArgs(args, 2);
        const [serviceName, toolName] = args;
        await this.handleCall(serviceName, toolName, options.args);
      },
    },
  ];

  constructor(container: IDIContainer) {
    super(container);
  }

  /**
   * 主命令执行（显示帮助）
   */
  async execute(args: any[], options: any): Promise<void> {
    console.log("MCP 服务和工具管理命令。使用 --help 查看可用的子命令。");
  }

  /**
   * 处理列出服务命令
   */
  private async handleList(options: any): Promise<void> {
    try {
      // 动态导入 mcpCommands 模块
      const { listMcpServers } = await import("../../mcpCommands.js");
      await listMcpServers(options);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 处理服务管理命令
   */
  private async handleServer(serverName: string): Promise<void> {
    try {
      // 动态导入 mcpCommands 模块
      const { listServerTools } = await import("../../mcpCommands.js");
      await listServerTools(serverName);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 处理工具管理命令
   */
  private async handleTool(
    serverName: string,
    toolName: string,
    enabled: boolean
  ): Promise<void> {
    try {
      // 动态导入 mcpCommands 模块
      const { setToolEnabled } = await import("../../mcpCommands.js");
      await setToolEnabled(serverName, toolName, enabled);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 处理工具调用命令
   */
  private async handleCall(
    serviceName: string,
    toolName: string,
    argsString: string
  ): Promise<void> {
    const spinner = ora(`调用工具 ${serviceName}/${toolName}...`).start();

    try {
      const toolCallService = new ToolCallService();

      // 解析参数
      const args = toolCallService.parseJsonArgs(argsString);

      // 调用工具
      const result = await toolCallService.callTool(
        serviceName,
        toolName,
        args
      );

      spinner.succeed(`工具调用成功: ${serviceName}/${toolName}`);

      // 输出原始响应
      console.log();
      console.log(chalk.bold("调用结果:"));
      console.log(toolCallService.formatOutput(result));
    } catch (error) {
      spinner.fail(`工具调用失败: ${serviceName}/${toolName}`);
      console.log();
      console.error(chalk.red("错误:"), (error as Error).message);

      // 提供有用的提示
      if ((error as Error).message.includes("服务未启动")) {
        console.log();
        console.log(chalk.yellow("💡 请先启动服务:"));
        console.log(chalk.gray("  xiaozhi start        # 前台启动"));
        console.log(chalk.gray("  xiaozhi start -d     # 后台启动"));
      } else if ((error as Error).message.includes("参数格式错误")) {
        console.log();
        console.log(chalk.yellow("💡 正确格式示例:"));
        console.log(
          chalk.gray(
            `  xiaozhi mcp call ${serviceName} ${toolName} --args '{"param": "value"}'`
          )
        );
      }

      process.exit(1);
    }
  }
}
