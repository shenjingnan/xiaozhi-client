/**
 * 配置管理命令处理器
 */

import type { ConfigManager } from "@xiaozhi-client/config";
import path from "node:path";
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
 * 配置管理命令处理器
 */
export class ConfigCommandHandler extends BaseCommandHandler {
  override name = "config";
  override description = "配置管理命令";

  override subcommands: SubCommand[] = [
    {
      name: "init",
      description: "初始化配置文件",
      options: [
        {
          flags: "-f, --format <format>",
          description: "配置文件格式 (json, json5, jsonc)",
          defaultValue: "json",
        },
      ],
      execute: async (args: CommandArguments, options: CommandOptions) => {
        await this.handleInit(options);
      },
    },
    {
      name: "get",
      description: "查看配置值",
      execute: async (args: CommandArguments, options: CommandOptions) => {
        this.validateArgs(args, 1);
        await this.handleGet(args[0]);
      },
    },
    {
      name: "set",
      description: "设置配置值",
      execute: async (args: CommandArguments, options: CommandOptions) => {
        this.validateArgs(args, 2);
        await this.handleSet(args[0], args[1]);
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
    console.log("配置管理命令。使用 --help 查看可用的子命令。");
  }

  /**
   * 处理初始化命令
   */
  private async handleInit(options: CommandOptions): Promise<void> {
    const spinner = ora("初始化配置...").start();

    try {
      const format = options.format as "json" | "json5" | "jsonc";
      if (format !== "json" && format !== "json5" && format !== "jsonc") {
        throw new Error("格式必须是 json, json5 或 jsonc");
      }

      const configManager = this.getService<ConfigManager>("configManager");

      if (configManager.configExists()) {
        spinner.warn("配置文件已存在");
        console.log(chalk.yellow("如需重新初始化，请先删除现有的配置文件"));
        return;
      }

      configManager.initConfig(format);
      spinner.succeed("配置文件初始化成功");

      // 获取实际创建的配置文件路径
      const configDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();
      const configFileName = `xiaozhi.config.${format}`;
      const configPath = path.join(configDir, configFileName);

      console.log(chalk.green(`✅ 配置文件已创建: ${configFileName}`));
      console.log(chalk.yellow("📝 请编辑配置文件设置你的 MCP 端点:"));
      console.log(chalk.gray(`   配置文件路径: ${configPath}`));
      console.log(chalk.yellow("💡 或者使用命令设置:"));
      console.log(
        chalk.gray("   xiaozhi config set mcpEndpoint <your-endpoint-url>")
      );
    } catch (error) {
      spinner.fail(
        `初始化配置失败: ${error instanceof Error ? error.message : String(error)}`
      );
      this.handleError(error as Error);
    }
  }

  /**
   * 处理获取配置命令
   */
  private async handleGet(key: string): Promise<void> {
    const spinner = ora("读取配置...").start();

    try {
      const configManager = this.getService<ConfigManager>("configManager");

      if (!configManager.configExists()) {
        spinner.fail("配置文件不存在");
        console.log(
          chalk.yellow('💡 提示: 请先运行 "xiaozhi config init" 初始化配置')
        );
        return;
      }

      const config = configManager.getConfig();

      switch (key) {
        case "mcpEndpoint": {
          spinner.succeed("配置信息");
          const endpoints = configManager.getMcpEndpoints();
          if (endpoints.length === 0) {
            console.log(chalk.yellow("未配置任何 MCP 端点"));
          } else if (endpoints.length === 1) {
            console.log(chalk.green(`MCP 端点: ${endpoints[0]}`));
          } else {
            console.log(chalk.green(`MCP 端点 (${endpoints.length} 个):`));
            endpoints.forEach((ep: string, index: number) => {
              console.log(chalk.gray(`  ${index + 1}. ${ep}`));
            });
          }
          break;
        }
        case "mcpServers":
          spinner.succeed("配置信息");
          console.log(chalk.green("MCP 服务:"));
          for (const [name, serverConfig] of Object.entries(
            config.mcpServers
          )) {
            const server = serverConfig as any;
            // 检查是否是 SSE 类型
            if ("type" in server && server.type === "sse") {
              console.log(chalk.gray(`  ${name}: [SSE] ${server.url}`));
            } else {
              console.log(
                chalk.gray(
                  `  ${name}: ${server.command} ${server.args.join(" ")}`
                )
              );
            }
          }
          break;
        case "connection": {
          spinner.succeed("配置信息");
          const connectionConfig = configManager.getConnectionConfig();
          console.log(chalk.green("连接配置:"));
          console.log(
            chalk.gray(
              `  心跳检测间隔: ${connectionConfig.heartbeatInterval}ms`
            )
          );
          console.log(
            chalk.gray(`  心跳超时时间: ${connectionConfig.heartbeatTimeout}ms`)
          );
          console.log(
            chalk.gray(`  重连间隔: ${connectionConfig.reconnectInterval}ms`)
          );
          break;
        }
        case "heartbeatInterval":
          spinner.succeed("配置信息");
          console.log(
            chalk.green(
              `心跳检测间隔: ${configManager.getHeartbeatInterval()}ms`
            )
          );
          break;
        case "heartbeatTimeout":
          spinner.succeed("配置信息");
          console.log(
            chalk.green(
              `心跳超时时间: ${configManager.getHeartbeatTimeout()}ms`
            )
          );
          break;
        case "reconnectInterval":
          spinner.succeed("配置信息");
          console.log(
            chalk.green(`重连间隔: ${configManager.getReconnectInterval()}ms`)
          );
          break;
        default:
          spinner.fail(`未知的配置项: ${key}`);
          console.log(
            chalk.yellow(
              "支持的配置项: mcpEndpoint, mcpServers, connection, heartbeatInterval, heartbeatTimeout, reconnectInterval"
            )
          );
      }
    } catch (error) {
      spinner.fail(
        `读取配置失败: ${error instanceof Error ? error.message : String(error)}`
      );
      this.handleError(error as Error);
    }
  }

  /**
   * 处理设置配置命令
   */
  private async handleSet(key: string, value: string): Promise<void> {
    const spinner = ora("更新配置...").start();

    try {
      const configManager = this.getService<ConfigManager>("configManager");

      if (!configManager.configExists()) {
        spinner.fail("配置文件不存在");
        console.log(
          chalk.yellow('💡 提示: 请先运行 "xiaozhi config init" 初始化配置')
        );
        return;
      }

      switch (key) {
        case "mcpEndpoint":
          configManager.updateMcpEndpoint(value);
          spinner.succeed(`MCP 端点已设置为: ${value}`);
          break;
        case "heartbeatInterval": {
          const interval = Number.parseInt(value);
          if (Number.isNaN(interval) || interval <= 0) {
            throw new Error("心跳检测间隔必须是正整数");
          }
          configManager.updateHeartbeatInterval(interval);
          spinner.succeed(`心跳检测间隔已设置为: ${interval}ms`);
          break;
        }
        case "heartbeatTimeout": {
          const timeout = Number.parseInt(value);
          if (Number.isNaN(timeout) || timeout <= 0) {
            throw new Error("心跳超时时间必须是正整数");
          }
          configManager.updateHeartbeatTimeout(timeout);
          spinner.succeed(`心跳超时时间已设置为: ${timeout}ms`);
          break;
        }
        case "reconnectInterval": {
          const interval = Number.parseInt(value);
          if (Number.isNaN(interval) || interval <= 0) {
            throw new Error("重连间隔必须是正整数");
          }
          configManager.updateReconnectInterval(interval);
          spinner.succeed(`重连间隔已设置为: ${interval}ms`);
          break;
        }
        default:
          spinner.fail(`不支持设置的配置项: ${key}`);
          console.log(
            chalk.yellow(
              "支持设置的配置项: mcpEndpoint, heartbeatInterval, heartbeatTimeout, reconnectInterval"
            )
          );
      }
    } catch (error) {
      spinner.fail(
        `设置配置失败: ${error instanceof Error ? error.message : String(error)}`
      );
      this.handleError(error as Error);
    }
  }
}
