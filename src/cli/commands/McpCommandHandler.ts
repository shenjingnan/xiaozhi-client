/**
 * MCP管理命令处理器
 */

import chalk from "chalk";
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
}
