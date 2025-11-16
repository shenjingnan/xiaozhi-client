/**
 * 服务管理命令处理器
 */

import type { SubCommand } from "@cli/interfaces/Command.js";
import { BaseCommandHandler } from "@cli/interfaces/Command.js";
import type { IDIContainer } from "@cli/interfaces/Config.js";
import { setGlobalLogLevel } from "@root/Logger.js";

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
      execute: async (args: any[], options: any) => {
        await this.handleStart(options);
      },
    },
    {
      name: "stop",
      description: "停止服务",
      execute: async (args: any[], options: any) => {
        await this.handleStop();
      },
    },
    {
      name: "status",
      description: "检查服务状态",
      execute: async (args: any[], options: any) => {
        await this.handleStatus();
      },
    },
    {
      name: "restart",
      description: "重启服务",
      options: [
        { flags: "-d, --daemon", description: "在后台运行服务" },
      ],
      execute: async (args: any[], options: any) => {
        await this.handleRestart(options);
      },
    },
    {
      name: "attach",
      description: "连接到后台服务查看日志",
      execute: async (args: any[], options: any) => {
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
  async execute(args: any[], options: any): Promise<void> {
    console.log("服务管理命令。使用 --help 查看可用的子命令。");
  }

  /**
   * 处理启动命令
   */
  private async handleStart(options: any): Promise<void> {
    try {
      // 处理--debug参数
      if (options.debug) {
        // 设置全局日志级别为debug，这将影响所有现有的和新的Logger实例
        setGlobalLogLevel("debug");
      }

      const serviceManager = this.getService<any>("serviceManager");

      if (options.stdio) {
        // stdio 模式 - 直接运行 mcpServerProxy
        await this.startStdioMode();
      } else {
        // 传统模式
        await serviceManager.start({
          daemon: options.daemon || false,
        });
      }
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
        console.log(`✅ 服务正在运行 (PID: ${status.pid})`);
        if (status.uptime) {
          console.log(`⏱️  运行时间: ${status.uptime}`);
        }
        if (status.mode) {
          console.log(`🔧 运行模式: ${status.mode}`);
        }
      } else {
        console.log("❌ 服务未运行");
      }
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 处理重启命令
   */
  private async handleRestart(options: any): Promise<void> {
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
   * 启动 stdio 模式
   */
  private async startStdioMode(): Promise<void> {
    const { spawn } = await import("node:child_process");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");

    const scriptPath = fileURLToPath(import.meta.url);
    const distDir = path.dirname(scriptPath);
    const mcpProxyPath = path.join(distDir, "mcpServerProxy.js");

    // 直接执行 mcpServerProxy，它已经支持 stdio
    spawn("node", [mcpProxyPath], {
      stdio: "inherit",
      env: {
        ...process.env,
        // 如果用户没有设置 XIAOZHI_CONFIG_DIR，则使用当前工作目录
        XIAOZHI_CONFIG_DIR: process.env.XIAOZHI_CONFIG_DIR || process.cwd(),
      },
    });
  }
}
