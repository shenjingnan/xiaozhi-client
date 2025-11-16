/**
 * UI命令处理器
 */

import { BaseCommandHandler } from "@cli/interfaces/Command.js";
import chalk from "chalk";
import ora from "ora";
import type { ConfigManager } from "../../configManager.js";

/**
 * UI命令处理器
 */
export class UICommandHandler extends BaseCommandHandler {
  override name = "ui";
  override description = "启动配置管理网页";

  /**
   * 执行UI命令
   */
  async execute(args: unknown[], options: unknown): Promise<void> {
    await this.handleUI();
  }

  /**
   * 处理UI启动命令
   */
  private async handleUI(): Promise<void> {
    const spinner = ora("启动 UI 服务...").start();

    try {
      const configManager = this.getService<ConfigManager>("configManager");

      // 检查配置是否存在
      if (!configManager.configExists()) {
        spinner.fail("配置文件不存在");
        console.log(
          chalk.yellow('💡 提示: 请先运行 "xiaozhi config init" 初始化配置')
        );
        return;
      }

      // 启动 Web 服务器
      const { WebServer } = await import("../../WebServer.js");
      const webServer = new WebServer();
      await webServer.start();

      spinner.succeed("UI 服务已启动");

      // 从配置获取端口号
      const port = configManager.getWebUIPort();
      console.log(chalk.green("✅ 配置管理网页已启动，可通过以下地址访问:"));
      console.log(chalk.green(`   本地访问: http://localhost:${port}`));
      console.log(chalk.green(`   网络访问: http://<你的IP地址>:${port}`));
      console.log(chalk.yellow("💡 提示: 按 Ctrl+C 停止服务"));
    } catch (error) {
      spinner.fail(
        `启动 UI 服务失败: ${error instanceof Error ? error.message : String(error)}`
      );
      this.handleError(error as Error);
    }
  }
}
