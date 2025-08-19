/**
 * 命令注册器
 */

import type { Command } from "commander";
import { ErrorHandler } from "../errors/ErrorHandlers.js";
import type {
  CommandHandler,
  ICommandHandlerFactory,
  ICommandRegistry,
} from "../interfaces/Command.js";
import type { IDIContainer } from "../interfaces/Config.js";
import { CommandHandlerFactory } from "./CommandHandlerFactory.js";

/**
 * 命令注册器实现
 */
export class CommandRegistry implements ICommandRegistry {
  private handlers: CommandHandler[] = [];
  private handlerFactory: ICommandHandlerFactory;

  constructor(private container: IDIContainer) {
    this.handlerFactory = new CommandHandlerFactory(container);
  }

  /**
   * 注册所有命令到 Commander 程序
   */
  async registerCommands(program: Command): Promise<void> {
    try {
      // 注册基本命令
      this.registerVersionCommand(program);
      this.registerHelpCommand(program);

      // 创建并注册所有功能命令处理器
      const handlers = this.handlerFactory.createHandlers();
      for (const handler of handlers) {
        this.registerHandler(handler);
        this.registerCommand(program, handler);
      }
    } catch (error) {
      ErrorHandler.handle(error as Error);
    }
  }

  /**
   * 注册命令处理器
   */
  registerHandler(handler: CommandHandler): void {
    this.handlers.push(handler);
  }

  /**
   * 注册单个命令
   */
  registerCommand(program: Command, handler: CommandHandler): void {
    // 如果有子命令，创建命令组
    if (handler.subcommands && handler.subcommands.length > 0) {
      const commandGroup = program
        .command(handler.name)
        .description(handler.description);

      for (const subcommand of handler.subcommands) {
        let subcommandName = subcommand.name;

        // 特殊处理需要参数的子命令
        if (subcommand.name === "get") {
          subcommandName = "get <key>";
        } else if (subcommand.name === "set") {
          subcommandName = "set <key> <value>";
        }

        const cmd = commandGroup
          .command(subcommandName)
          .description(subcommand.description);

        // 添加子命令选项
        if (subcommand.options) {
          for (const option of subcommand.options) {
            cmd.option(option.flags, option.description, option.defaultValue);
          }
        }

        // 设置子命令处理函数
        cmd.action(async (...args) => {
          try {
            await subcommand.execute(args.slice(0, -1), args[args.length - 1]);
          } catch (error) {
            ErrorHandler.handle(error as Error);
          }
        });
      }

      // 设置主命令的默认行为
      commandGroup.action(async (...args) => {
        try {
          await handler.execute(args.slice(0, -1), args[args.length - 1]);
        } catch (error) {
          ErrorHandler.handle(error as Error);
        }
      });
    } else {
      // 没有子命令，注册为普通命令
      let commandName = handler.name;

      // 特殊处理 create 命令，需要接受项目名称参数
      if (handler.name === "create") {
        commandName = "create <projectName>";
      }

      const command = program
        .command(commandName)
        .description(handler.description);

      // 添加选项
      if (handler.options) {
        for (const option of handler.options) {
          command.option(option.flags, option.description, option.defaultValue);
        }
      }

      // 设置主命令处理函数
      command.action(async (...args) => {
        try {
          await handler.execute(args.slice(0, -1), args[args.length - 1]);
        } catch (error) {
          ErrorHandler.handle(error as Error);
        }
      });
    }
  }

  /**
   * 注册版本命令
   */
  private registerVersionCommand(program: Command): void {
    const versionUtils = this.container.get("versionUtils") as any;

    program
      .version(versionUtils.getVersion(), "-v, --version", "显示版本信息")
      .option("--version-info", "显示详细版本信息")
      .hook("preAction", (thisCommand) => {
        const options = thisCommand.opts();
        if (options.versionInfo) {
          const versionInfo = versionUtils.getVersionInfo();
          const platformUtils = this.container.get("platformUtils") as any;
          const systemInfo = platformUtils.getSystemInfo();

          console.log(
            `${versionInfo.name || "xiaozhi"} v${versionInfo.version}`
          );
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
      });
  }

  /**
   * 注册帮助命令
   */
  private registerHelpCommand(program: Command): void {
    program.helpOption("-h, --help", "显示帮助信息").addHelpText(
      "after",
      `
示例:
  xiaozhi init                     # 初始化配置文件
  xiaozhi start                    # 启动服务
  xiaozhi start -d                 # 后台启动服务
  xiaozhi start -u                 # 启动服务并打开 Web UI
  xiaozhi start -s 3000            # 以 MCP Server 模式启动
  xiaozhi stop                     # 停止服务
  xiaozhi status                   # 检查服务状态
  xiaozhi restart -d               # 重启服务（后台模式）
  xiaozhi config mcpEndpoint <url> # 设置 MCP 端点
  xiaozhi create my-project        # 创建项目
  xiaozhi mcp list                 # 列出 MCP 服务

更多信息请访问: https://github.com/your-org/xiaozhi-client
`
    );
  }

  /**
   * 注册服务管理命令（稍后实现）
   */
  // private async registerServiceCommands(program: Command): Promise<void> {
  //   const serviceCommand = this.container.get('serviceCommand');

  //   // start 命令
  //   program
  //     .command('start')
  //     .description('启动服务')
  //     .option('-d, --daemon', '在后台运行服务')
  //     .option('-u, --ui', '同时启动 Web UI 服务')
  //     .option('-s, --server [port]', '以 MCP Server 模式启动 (可选指定端口，默认 3000)')
  //     .option('--stdio', '以 stdio 模式运行 MCP Server (用于 Cursor 等客户端)')
  //     .action(async (options) => {
  //       await serviceCommand.start(options);
  //     });

  //   // stop 命令
  //   program
  //     .command('stop')
  //     .description('停止服务')
  //     .action(async () => {
  //       await serviceCommand.stop();
  //     });

  //   // status 命令
  //   program
  //     .command('status')
  //     .description('检查服务状态')
  //     .action(async () => {
  //       await serviceCommand.status();
  //     });

  //   // restart 命令
  //   program
  //     .command('restart')
  //     .description('重启服务')
  //     .option('-d, --daemon', '在后台运行服务')
  //     .option('-u, --ui', '同时启动 Web UI 服务')
  //     .action(async (options) => {
  //       await serviceCommand.restart(options);
  //     });

  //   // attach 命令
  //   program
  //     .command('attach')
  //     .description('连接到后台服务查看日志')
  //     .action(async () => {
  //       await serviceCommand.attach();
  //     });
  // }

  /**
   * 注册配置管理命令（稍后实现）
   */
  // private async registerConfigCommands(program: Command): Promise<void> {
  //   const configCommand = this.container.get('configCommand');

  //   // init 命令
  //   program
  //     .command('init')
  //     .description('初始化配置文件')
  //     .option('-f, --format <format>', '配置文件格式 (json, json5, jsonc)', 'json')
  //     .action(async (options) => {
  //       await configCommand.init(options);
  //     });

  //   // config 命令
  //   program
  //     .command('config <key> [value]')
  //     .description('查看或设置配置')
  //     .action(async (key, value) => {
  //       await configCommand.manage(key, value);
  //     });
  // }

  /**
   * 注册项目管理命令（稍后实现）
   */
  // private async registerProjectCommands(program: Command): Promise<void> {
  //   const projectCommand = this.container.get('projectCommand');

  //   // create 命令
  //   program
  //     .command('create <projectName>')
  //     .description('创建项目')
  //     .option('-t, --template <templateName>', '使用指定模板创建项目')
  //     .action(async (projectName, options) => {
  //       await projectCommand.create(projectName, options);
  //     });
  // }

  /**
   * 注册 MCP 管理命令（稍后实现）
   */
  // private async registerMcpCommands(program: Command): Promise<void> {
  //   const mcpCommand = this.container.get('mcpCommand');

  //   // mcp 命令组
  //   const mcpGroup = program.command('mcp').description('MCP 服务和工具管理');

  //   // mcp list 命令
  //   mcpGroup
  //     .command('list')
  //     .description('列出 MCP 服务')
  //     .option('--tools', '显示所有服务的工具列表')
  //     .action(async (options) => {
  //       await mcpCommand.list(options);
  //     });

  //   // mcp server 命令
  //   mcpGroup
  //     .command('server <serverName>')
  //     .description('管理指定的 MCP 服务')
  //     .action(async (serverName) => {
  //       await mcpCommand.server(serverName);
  //     });

  //   // mcp tool 命令
  //   mcpGroup
  //     .command('tool <serverName> <toolName> <action>')
  //     .description('管理 MCP 工具 (enable/disable)')
  //     .action(async (serverName, toolName, action) => {
  //       await mcpCommand.tool(serverName, toolName, action);
  //     });
  // }
}
