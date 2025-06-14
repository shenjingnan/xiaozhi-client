import chalk from "chalk";
import ora from "ora";
import { configManager } from "./configManager.js";

/**
 * MCP 相关的命令行功能
 */

/**
 * 列出所有 MCP 服务
 */
export async function listMcpServers(
  options: { tools?: boolean } = {}
): Promise<void> {
  const spinner = ora("获取 MCP 服务列表...").start();

  try {
    const mcpServers = configManager.getMcpServers();
    const serverNames = Object.keys(mcpServers);

    if (serverNames.length === 0) {
      spinner.warn("未配置任何 MCP 服务");
      console.log(
        chalk.yellow("💡 提示: 使用 'xiaozhi config' 命令配置 MCP 服务")
      );
      return;
    }

    spinner.succeed(`找到 ${serverNames.length} 个 MCP 服务`);

    if (options.tools) {
      // 显示所有服务的工具列表
      console.log();
      console.log(chalk.bold("MCP 服务工具列表:"));
      console.log();

      // 表头
      const headers = ["服务名称", "工具名称", "工具描述", "状态"];
      const colWidths = [20, 30, 40, 8];

      console.log(
        headers
          .map((header, i) => chalk.bold(header.padEnd(colWidths[i])))
          .join(" | ")
      );
      console.log(headers.map((_, i) => "-".repeat(colWidths[i])).join("-|-"));

      for (const serverName of serverNames) {
        const toolsConfig = configManager.getServerToolsConfig(serverName);
        const toolNames = Object.keys(toolsConfig);

        if (toolNames.length === 0) {
          console.log(
            [
              serverName.padEnd(colWidths[0]),
              chalk.gray("(无工具)").padEnd(colWidths[1]),
              chalk.gray("请先启动服务扫描工具").padEnd(colWidths[2]),
              chalk.gray("-").padEnd(colWidths[3]),
            ].join(" | ")
          );
        } else {
          let displayServerName = serverName;
          for (const toolName of toolNames) {
            const toolConfig = toolsConfig[toolName];
            const status = toolConfig.enable
              ? chalk.green("启用")
              : chalk.red("禁用");
            const description = (toolConfig.description || "").substring(0, 35);

            console.log(
              [
                displayServerName.padEnd(colWidths[0]),
                toolName.padEnd(colWidths[1]),
                description.padEnd(colWidths[2]),
                status.padEnd(colWidths[3]),
              ].join(" | ")
            );

            // 只显示第一行服务名称
            displayServerName = "";
          }
        }
      }
    } else {
      // 只显示服务列表
      console.log();
      console.log(chalk.bold("MCP 服务列表:"));
      console.log();

      for (const serverName of serverNames) {
        const serverConfig = mcpServers[serverName];
        const toolsConfig = configManager.getServerToolsConfig(serverName);
        const toolCount = Object.keys(toolsConfig).length;
        const enabledCount = Object.values(toolsConfig).filter(
          (t) => t.enable !== false
        ).length;

        console.log(`${chalk.cyan("•")} ${chalk.bold(serverName)}`);
        console.log(
          `  命令: ${chalk.gray(serverConfig.command)} ${chalk.gray(serverConfig.args.join(" "))}`
        );
        if (toolCount > 0) {
          console.log(
            `  工具: ${chalk.green(enabledCount)} 启用 / ${chalk.yellow(toolCount)} 总计`
          );
        } else {
          console.log(`  工具: ${chalk.gray("未扫描 (请先启动服务)")}`);
        }
        console.log();
      }
    }

    console.log(chalk.gray("💡 提示:"));
    console.log(chalk.gray("  - 使用 'xiaozhi mcp list --tools' 查看所有工具"));
    console.log(
      chalk.gray("  - 使用 'xiaozhi mcp <服务名> list' 查看指定服务的工具")
    );
    console.log(
      chalk.gray(
        "  - 使用 'xiaozhi mcp <服务名> <工具名> enable/disable' 启用/禁用工具"
      )
    );
  } catch (error) {
    spinner.fail("获取 MCP 服务列表失败");
    console.error(
      chalk.red(
        `错误: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

/**
 * 列出指定服务的工具
 */
export async function listServerTools(serverName: string): Promise<void> {
  const spinner = ora(`获取 ${serverName} 服务的工具列表...`).start();

  try {
    const mcpServers = configManager.getMcpServers();

    if (!mcpServers[serverName]) {
      spinner.fail(`服务 '${serverName}' 不存在`);
      console.log(
        chalk.yellow("💡 提示: 使用 'xiaozhi mcp list' 查看所有可用服务")
      );
      return;
    }

    const toolsConfig = configManager.getServerToolsConfig(serverName);
    const toolNames = Object.keys(toolsConfig);

    if (toolNames.length === 0) {
      spinner.warn(`服务 '${serverName}' 暂无工具信息`);
      console.log(chalk.yellow("💡 提示: 请先启动服务以扫描工具列表"));
      return;
    }

    spinner.succeed(`服务 '${serverName}' 共有 ${toolNames.length} 个工具`);

    console.log();
    console.log(chalk.bold(`${serverName} 服务工具列表:`));
    console.log();

    // 表头
    const headers = ["工具名称", "工具描述", "状态"];
    const colWidths = [30, 50, 8];

    console.log(
      headers
        .map((header, i) => chalk.bold(header.padEnd(colWidths[i])))
        .join(" | ")
    );
    console.log(headers.map((_, i) => "-".repeat(colWidths[i])).join("-|-"));

    for (const toolName of toolNames) {
      const toolConfig = toolsConfig[toolName];
      const status = toolConfig.enable
        ? chalk.green("启用")
        : chalk.red("禁用");
      const description = (toolConfig.description || "").substring(0, 45);

      console.log(
        [
          toolName.padEnd(colWidths[0]),
          description.padEnd(colWidths[1]),
          status.padEnd(colWidths[2]),
        ].join(" | ")
      );
    }

    console.log();
    console.log(chalk.gray("💡 提示:"));
    console.log(
      chalk.gray(
        `  - 使用 'xiaozhi mcp ${serverName} <工具名> enable' 启用工具`
      )
    );
    console.log(
      chalk.gray(
        `  - 使用 'xiaozhi mcp ${serverName} <工具名> disable' 禁用工具`
      )
    );
  } catch (error) {
    spinner.fail("获取工具列表失败");
    console.error(
      chalk.red(
        `错误: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

/**
 * 启用或禁用工具
 */
export async function setToolEnabled(
  serverName: string,
  toolName: string,
  enabled: boolean
): Promise<void> {
  const action = enabled ? "启用" : "禁用";
  const spinner = ora(`${action}工具 ${serverName}/${toolName}...`).start();

  try {
    const mcpServers = configManager.getMcpServers();

    if (!mcpServers[serverName]) {
      spinner.fail(`服务 '${serverName}' 不存在`);
      console.log(
        chalk.yellow("💡 提示: 使用 'xiaozhi mcp list' 查看所有可用服务")
      );
      return;
    }

    const toolsConfig = configManager.getServerToolsConfig(serverName);

    if (!toolsConfig[toolName]) {
      spinner.fail(`工具 '${toolName}' 在服务 '${serverName}' 中不存在`);
      console.log(
        chalk.yellow(
          `💡 提示: 使用 'xiaozhi mcp ${serverName} list' 查看该服务的所有工具`
        )
      );
      return;
    }

    // 更新工具状态
    configManager.setToolEnabled(
      serverName,
      toolName,
      enabled,
      toolsConfig[toolName].description
    );

    spinner.succeed(
      `成功${action}工具 ${chalk.cyan(serverName)}/${chalk.cyan(toolName)}`
    );

    console.log();
    console.log(chalk.gray("💡 提示: 工具状态更改将在下次启动服务时生效"));
  } catch (error) {
    spinner.fail(`${action}工具失败`);
    console.error(
      chalk.red(
        `错误: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}
