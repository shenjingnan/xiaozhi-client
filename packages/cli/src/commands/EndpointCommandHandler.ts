/**
 * 端点管理命令处理器
 */

import chalk from "chalk";
import ora from "ora";
import type { SubCommand } from "../interfaces/Command";
import { BaseCommandHandler } from "../interfaces/Command";
import type {
  CommandArguments,
  CommandOptions,
} from "../interfaces/CommandTypes";
import type { IDIContainer } from "../interfaces/Config";

/**
 * 端点管理命令处理器
 */
export class EndpointCommandHandler extends BaseCommandHandler {
  override name = "endpoint";
  override description = "管理 MCP 端点";

  override subcommands: SubCommand[] = [
    {
      name: "list",
      description: "列出所有 MCP 端点",
      execute: async (args: CommandArguments, options: CommandOptions) => {
        await this.handleList();
      },
    },
    {
      name: "add",
      description: "添加新的 MCP 端点",
      execute: async (args: CommandArguments, options: CommandOptions) => {
        this.validateArgs(args, 1);
        await this.handleAdd(args[0]);
      },
    },
    {
      name: "remove",
      description: "移除指定的 MCP 端点",
      execute: async (args: CommandArguments, options: CommandOptions) => {
        this.validateArgs(args, 1);
        await this.handleRemove(args[0]);
      },
    },
    {
      name: "set",
      description: "设置 MCP 端点（可以是单个或多个）",
      execute: async (args: CommandArguments, options: CommandOptions) => {
        this.validateArgs(args, 1);
        await this.handleSet(args);
      },
    },
  ];

  constructor(container: IDIContainer) {
    super(container);
  }

  /**
   * 主命令执行（显示帮助）
   */
  override async execute(
    args: CommandArguments,
    options: CommandOptions
  ): Promise<void> {
    console.log("MCP 端点管理命令。使用 --help 查看可用的子命令。");
  }

  /**
   * 处理列出端点命令
   */
  protected async handleList(): Promise<void> {
    const spinner = ora("读取端点配置...").start();

    try {
      const configManager = this.getService<any>("configManager");
      const endpoints = configManager.getMcpEndpoints();
      spinner.succeed("端点列表");

      if (endpoints.length === 0) {
        console.log(chalk.yellow("未配置任何 MCP 端点"));
      } else {
        console.log(chalk.green(`共 ${endpoints.length} 个端点:`));
        endpoints.forEach((ep: string, index: number) => {
          console.log(chalk.gray(`  ${index + 1}. ${ep}`));
        });
      }
    } catch (error) {
      spinner.fail(
        `读取端点失败: ${error instanceof Error ? error.message : String(error)}`
      );
      this.handleError(error as Error);
    }
  }

  /**
   * 处理添加端点命令
   */
  protected async handleAdd(url: string): Promise<void> {
    const spinner = ora("添加端点...").start();

    try {
      const configManager = this.getService<any>("configManager");
      configManager.addMcpEndpoint(url);
      spinner.succeed(`成功添加端点: ${url}`);

      const endpoints = configManager.getMcpEndpoints();
      console.log(chalk.gray(`当前共 ${endpoints.length} 个端点`));
    } catch (error) {
      spinner.fail(
        `添加端点失败: ${error instanceof Error ? error.message : String(error)}`
      );
      this.handleError(error as Error);
    }
  }

  /**
   * 处理移除端点命令
   */
  protected async handleRemove(url: string): Promise<void> {
    const spinner = ora("移除端点...").start();

    try {
      const configManager = this.getService<any>("configManager");
      configManager.removeMcpEndpoint(url);
      spinner.succeed(`成功移除端点: ${url}`);

      const endpoints = configManager.getMcpEndpoints();
      console.log(chalk.gray(`当前剩余 ${endpoints.length} 个端点`));
    } catch (error) {
      spinner.fail(
        `移除端点失败: ${error instanceof Error ? error.message : String(error)}`
      );
      this.handleError(error as Error);
    }
  }

  /**
   * 处理设置端点命令
   */
  protected async handleSet(urls: string[]): Promise<void> {
    const spinner = ora("设置端点...").start();

    try {
      const configManager = this.getService<any>("configManager");

      if (urls.length === 1) {
        configManager.updateMcpEndpoint(urls[0]);
        spinner.succeed(`成功设置端点: ${urls[0]}`);
      } else {
        configManager.updateMcpEndpoint(urls);
        spinner.succeed(`成功设置 ${urls.length} 个端点`);
        for (const [index, url] of urls.entries()) {
          console.log(chalk.gray(`  ${index + 1}. ${url}`));
        }
      }
    } catch (error) {
      spinner.fail(
        `设置端点失败: ${error instanceof Error ? error.message : String(error)}`
      );
      this.handleError(error as Error);
    }
  }
}
