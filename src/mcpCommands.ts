import chalk from "chalk";
import Table from "cli-table3";
import ora from "ora";
import { configManager } from "./configManager";

/**
 * MCP 相关的命令行功能
 */

/**
 * 计算字符串的显示宽度（中文字符占2个宽度，英文字符占1个宽度）
 */
export function getDisplayWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    // 判断是否为中文字符（包括中文标点符号）
    if (/[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef]/.test(char)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * 截断字符串到指定的显示宽度
 */
export function truncateToWidth(str: string, maxWidth: number): string {
  if (getDisplayWidth(str) <= maxWidth) {
    return str;
  }

  // 如果最大宽度小于等于省略号的宽度，返回空字符串
  if (maxWidth <= 3) {
    return "";
  }

  let result = "";
  let currentWidth = 0;
  let hasAddedChar = false;

  for (const char of str) {
    const charWidth = /[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef]/.test(char)
      ? 2
      : 1;

    // 如果加上当前字符会超出限制
    if (currentWidth + charWidth > maxWidth - 3) {
      // 如果还没有添加任何字符，说明连一个字符都放不下，返回空字符串
      if (!hasAddedChar) {
        return "";
      }
      // 否则添加省略号并退出
      result += "...";
      break;
    }

    result += char;
    currentWidth += charWidth;
    hasAddedChar = true;
  }

  return result;
}

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

      // 计算所有工具名称的最大长度，用于动态设置列宽
      let maxToolNameWidth = 8; // 默认最小宽度
      const allToolNames: string[] = [];

      for (const serverName of serverNames) {
        const toolsConfig = configManager.getServerToolsConfig(serverName);
        const toolNames = Object.keys(toolsConfig);
        allToolNames.push(...toolNames);
      }

      // 计算最长工具名称的显示宽度
      for (const toolName of allToolNames) {
        const width = getDisplayWidth(toolName);
        if (width > maxToolNameWidth) {
          maxToolNameWidth = width;
        }
      }

      // 确保工具名称列宽度至少为10，最多为30
      maxToolNameWidth = Math.max(10, Math.min(maxToolNameWidth + 2, 30));

      // 使用 cli-table3 创建表格
      const table = new Table({
        head: [
          chalk.bold("MCP"),
          chalk.bold("工具名称"),
          chalk.bold("状态"),
          chalk.bold("描述"),
        ],
        colWidths: [15, maxToolNameWidth, 8, 40], // MCP | 工具名称 | 状态 | 描述
        wordWrap: true,
        style: {
          head: [],
          border: [],
        },
      });

      for (const serverName of serverNames) {
        const toolsConfig = configManager.getServerToolsConfig(serverName);
        const toolNames = Object.keys(toolsConfig);

        if (toolNames.length === 0) {
          // 服务没有工具时显示提示信息
          table.push([
            chalk.gray(serverName),
            chalk.gray("-"),
            chalk.gray("-"),
            chalk.gray("暂未识别到相关工具"),
          ]);
        } else {
          // 添加服务分隔行
          if (table.length > 0) {
            table.push([{ colSpan: 4, content: "" }]);
          }

          for (const toolName of toolNames) {
            const toolConfig = toolsConfig[toolName];
            const status = toolConfig.enable
              ? chalk.green("启用")
              : chalk.red("禁用");

            // 截断描述到最大32个字符宽度（约16个中文字符）
            const description = truncateToWidth(
              toolConfig.description || "",
              32
            );

            // 只显示工具名称，不包含服务名前缀
            table.push([serverName, toolName, status, description]);
          }
        }
      }

      console.log(table.toString());
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

        // 检查服务类型并显示相应信息
        if ("url" in serverConfig) {
          // URL 类型的服务（SSE 或 Streamable HTTP）
          if ("type" in serverConfig && serverConfig.type === "sse") {
            console.log(`  类型: ${chalk.gray("SSE")}`);
          } else {
            console.log(`  类型: ${chalk.gray("Streamable HTTP")}`);
          }
          console.log(`  URL: ${chalk.gray(serverConfig.url)}`);
        } else {
          // 本地服务
          console.log(
            `  命令: ${chalk.gray((serverConfig as any).command)} ${chalk.gray(
              (serverConfig as any).args.join(" ")
            )}`
          );
        }
        if (toolCount > 0) {
          console.log(
            `  工具: ${chalk.green(enabledCount)} 启用 / ${chalk.yellow(
              toolCount
            )} 总计`
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

    // 使用 cli-table3 创建表格
    const table = new Table({
      head: [chalk.bold("工具名称"), chalk.bold("状态"), chalk.bold("描述")],
      colWidths: [30, 8, 50], // 工具名称 | 状态 | 描述
      wordWrap: true,
      style: {
        head: [],
        border: [],
      },
    });

    for (const toolName of toolNames) {
      const toolConfig = toolsConfig[toolName];
      const status = toolConfig.enable
        ? chalk.green("启用")
        : chalk.red("禁用");

      // 截断描述到最大40个字符宽度（约20个中文字符）
      const description = truncateToWidth(toolConfig.description || "", 40);

      table.push([toolName, status, description]);
    }

    console.log(table.toString());

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
