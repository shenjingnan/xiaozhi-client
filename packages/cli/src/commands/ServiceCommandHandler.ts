/**
 * 服务管理命令处理器
 */

import consola from "consola";
import type { SubCommand } from "../interfaces/Command";
import { BaseCommandHandler } from "../interfaces/Command";
import type {
  CommandArguments,
  CommandOptions,
} from "../interfaces/CommandTypes";
import type { IDIContainer } from "../interfaces/Config";

/**
 * 服务管理命令处理器
 */
export class ServiceCommandHandler extends BaseCommandHandler {
  override name = "service";
  override description = "服务管理命令";

  override subcommands: SubCommand[] = [
    {
      name: "start",
      description: "启动服务",
      options: [
        { flags: "-d, --daemon", description: "在后台运行服务" },
        { flags: "--debug", description: "启用调试模式 (输出DEBUG级别日志)" },
        {
          flags: "--stdio",
          description: "以 stdio 模式运行 MCP Server (用于 Cursor 等客户端)",
        },
      ],
      execute: async (args: CommandArguments, options: CommandOptions) => {
        await this.handleStart(options);
      },
    },
    {
      name: "stop",
      description: "停止服务",
      execute: async (args: CommandArguments, options: CommandOptions) => {
        await this.handleStop();
      },
    },
    {
      name: "status",
      description: "检查服务状态",
      execute: async (args: CommandArguments, options: CommandOptions) => {
        await this.handleStatus();
      },
    },
    {
      name: "restart",
      description: "重启服务",
      options: [{ flags: "-d, --daemon", description: "在后台运行服务" }],
      execute: async (args: CommandArguments, options: CommandOptions) => {
        await this.handleRestart(options);
      },
    },
    {
      name: "attach",
      description: "连接到后台服务查看日志",
      execute: async (args: CommandArguments, options: CommandOptions) => {
        await this.handleAttach();
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
    consola.info("服务管理命令。使用 --help 查看可用的子命令。");
  }

  /**
   * 处理启动命令
   */
  private async handleStart(options: CommandOptions): Promise<void> {
    try {
      // 处理--debug参数
      if (options.debug) {
        consola.level = 5; // debug 级别
      }

      const serviceManager = this.getService<any>("serviceManager");

      if (options.stdio) {
        // stdio 模式已迁移到 HTTP 方式
        this.showStdioMigrationGuide();
        return;
      }

      // 传统模式
      await serviceManager.start({
        daemon: options.daemon || false,
      });
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 处理停止命令
   */
  private async handleStop(): Promise<void> {
    try {
      const serviceManager = this.getService<any>("serviceManager");
      await serviceManager.stop();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 处理状态检查命令
   */
  private async handleStatus(): Promise<void> {
    try {
      const serviceManager = this.getService<any>("serviceManager");
      const status = await serviceManager.getStatus();

      if (status.running) {
        consola.log(`✅ 服务正在运行 (PID: ${status.pid})`);
        if (status.uptime) {
          consola.log(`⏱️  运行时间: ${status.uptime}`);
        }
        if (status.mode) {
          consola.log(`🔧 运行模式: ${status.mode}`);
        }
      } else {
        consola.log("❌ 服务未运行");
      }
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 处理重启命令
   */
  private async handleRestart(options: CommandOptions): Promise<void> {
    try {
      const serviceManager = this.getService<any>("serviceManager");
      await serviceManager.restart({
        daemon: options.daemon || false,
      });
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 处理附加命令
   */
  private async handleAttach(): Promise<void> {
    try {
      const daemonManager = this.getService<any>("daemonManager");
      await daemonManager.attachToLogs();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 显示 stdio 模式迁移指南
   */
  private showStdioMigrationGuide(): void {
    consola.log("\n❌ stdio 模式已废弃\n");
    consola.log("小智客户端已迁移到纯 HTTP 架构，请使用以下方式：\n");

    consola.log("1. 启动 Web 服务：");
    consola.log("   xiaozhi start\n");

    consola.log("2. 在 Cursor 中配置 HTTP 端点：");
    consola.log('   "mcpServers": {');
    consola.log('     "xiaozhi-client": {');
    consola.log('       "type": "streamableHttp",');
    consola.log('       "url": "http://localhost:9999/mcp"');
    consola.log("     }");
    consola.log("   }\n");
  }
}
