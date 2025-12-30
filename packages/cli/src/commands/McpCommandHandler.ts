/**
 * MCP管理命令处理器
 */

import { configManager } from "@xiaozhi/config";
import chalk from "chalk";
import Table from "cli-table3";
import consola from "consola";
import ora from "ora";
import type { SubCommand } from "../interfaces/Command";
import { BaseCommandHandler } from "../interfaces/Command";
import type {
  CallOptions,
  CommandArguments,
  CommandOptions,
  ListOptions,
} from "../interfaces/CommandTypes";
import { isLocalMCPServerConfig } from "../interfaces/CommandTypes";
import { ProcessManagerImpl } from "../services/ProcessManager";

// 工具调用结果接口
interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

/**
 * MCP管理命令处理器
 */
export class McpCommandHandler extends BaseCommandHandler {
  private processManager: ProcessManagerImpl;
  private baseUrl: string;

  constructor(...args: ConstructorParameters<typeof BaseCommandHandler>) {
    super(...args);
    this.processManager = new ProcessManagerImpl();

    // 获取 Web 服务器的端口
    try {
      const webPort = configManager.getWebUIPort() ?? 9999;
      this.baseUrl = `http://localhost:${webPort}`;
    } catch {
      this.baseUrl = "http://localhost:9999";
    }
  }

  /**
   * 中文字符正则表达式
   *
   * Unicode 范围说明：
   * - \u4e00-\u9fff: CJK 统一汉字（基本汉字）
   * - \u3400-\u4dbf: CJK 扩展 A（扩展汉字）
   * - \uff00-\uffef: 全角字符和半角片假名（包括中文标点符号）
   *
   * 注意：此范围可能不完全覆盖所有中日韩字符（如 CJK 扩展 B-F 等），
   * 但已覆盖绝大多数常用中文场景。
   */
  private static readonly CHINESE_CHAR_REGEX =
    /[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef]/;

  /**
   * 计算字符串的显示宽度（中文字符占2个宽度，英文字符占1个宽度）
   */
  private static getDisplayWidth(str: string): number {
    let width = 0;
    for (const char of str) {
      // 判断是否为中文字符（包括中文标点符号）
      if (McpCommandHandler.CHINESE_CHAR_REGEX.test(char)) {
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
  private static truncateToWidth(str: string, maxWidth: number): string {
    if (McpCommandHandler.getDisplayWidth(str) <= maxWidth) {
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
      const charWidth = McpCommandHandler.CHINESE_CHAR_REGEX.test(char) ? 2 : 1;

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
   * 解析 JSON 参数
   * @param argsString JSON 字符串
   * @returns 解析后的参数对象
   */
  private static parseJsonArgs(argsString: string): Record<string, unknown> {
    try {
      return JSON.parse(argsString);
    } catch (error) {
      throw new Error(
        `参数格式错误，请使用有效的 JSON 格式。错误详情: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 格式化工具调用结果输出
   * @param result 工具调用结果
   * @returns 格式化后的字符串
   */
  private static formatToolCallResult(result: ToolCallResult): string {
    return JSON.stringify(result);
  }

  override name = "mcp";
  override description = "MCP 服务和工具管理";

  override subcommands: SubCommand[] = [
    {
      name: "list",
      description: "列出 MCP 服务",
      options: [{ flags: "--tools", description: "显示所有服务的工具列表" }],
      execute: async (args: CommandArguments, options: CommandOptions) => {
        await this.handleList(options as ListOptions);
      },
    },
    {
      name: "server",
      description: "管理指定的 MCP 服务",
      execute: async (args: CommandArguments, options: CommandOptions) => {
        this.validateArgs(args, 1);
        await this.handleServer(args[0]);
      },
    },
    {
      name: "tool",
      description: "启用或禁用指定服务的工具",
      execute: async (args: CommandArguments, options: CommandOptions) => {
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
      execute: async (args: CommandArguments, options: CommandOptions) => {
        this.validateArgs(args, 2);
        const [serviceName, toolName] = args;
        await this.handleCall(
          serviceName,
          toolName,
          (options as CallOptions).args ?? "{}"
        );
      },
    },
  ];

  /**
   * 主命令执行（显示帮助）
   */
  async execute(
    args: CommandArguments,
    options: CommandOptions
  ): Promise<void> {
    console.log("MCP 服务和工具管理命令。使用 --help 查看可用的子命令。");
  }

  /**
   * 处理列出服务命令
   */
  private async handleList(options: ListOptions): Promise<void> {
    try {
      await this.handleListInternal(options);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 处理服务管理命令
   */
  private async handleServer(serverName: string): Promise<void> {
    try {
      await this.handleServerInternal(serverName);
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
      await this.handleToolInternal(serverName, toolName, enabled);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 验证服务状态
   * @private
   */
  private async validateServiceStatus(): Promise<void> {
    // 检查进程级别的服务状态
    const processStatus = this.processManager.getServiceStatus();
    if (!processStatus.running) {
      throw new Error(
        "xiaozhi 服务未启动。请先运行 'xiaozhi start' 或 'xiaozhi start -d' 启动服务。"
      );
    }

    // 检查 Web 服务器是否可访问
    try {
      const response = await fetch(`${this.baseUrl}/api/status`, {
        method: "GET",
        signal: AbortSignal.timeout(5000), // 5秒超时
      });

      if (!response.ok) {
        throw new Error(`Web 服务器响应错误: ${response.status}`);
      }
    } catch (error: unknown) {
      // 超时单独提示
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("连接 xiaozhi 服务超时。请检查服务是否正常运行。");
      }

      // 已知的 Error 实例，区分网络错误与其他错误
      if (error instanceof Error) {
        const isNetworkError =
          error instanceof TypeError &&
          /fetch|network|failed/i.test(error.message);

        if (isNetworkError) {
          throw new Error(
            `无法连接到 xiaozhi 服务（网络请求失败）。请检查网络连接或服务地址是否正确。原始错误: ${error.message}`
          );
        }

        throw new Error(
          `无法连接到 xiaozhi 服务。请检查服务状态。原始错误: ${error.message}`
        );
      }

      // 非 Error 对象的兜底处理，避免出现 [object Object]
      let detail: string;
      try {
        detail = JSON.stringify(error);
      } catch {
        detail = String(error);
      }

      throw new Error(
        `无法连接到 xiaozhi 服务。请检查服务状态。错误详情: ${detail}`
      );
    }
  }

  /**
   * 调用 MCP 工具的内部实现
   * @param serviceName 服务名称
   * @param toolName 工具名称
   * @param args 工具参数
   * @returns 工具调用结果
   */
  private async callToolInternal(
    serviceName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolCallResult> {
    // 1. 检查服务状态
    await this.validateServiceStatus();

    // 2. 通过 HTTP API 调用工具
    try {
      const response = await fetch(`${this.baseUrl}/api/tools/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serviceName,
          toolName,
          args,
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          const detailedMessage =
            errorData?.error?.message ?? errorData?.message;
          if (typeof detailedMessage === "string" && detailedMessage.trim()) {
            errorMessage = detailedMessage;
          }
        } catch {
          // 响应体不是 JSON 时，保留默认的 HTTP 错误信息
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();

      if (!responseData.success) {
        throw new Error(responseData.error?.message || "工具调用失败");
      }

      return responseData.data;
    } catch (error) {
      consola.error(
        `工具调用失败: ${serviceName}/${toolName}`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
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
    try {
      // 解析参数
      const args = McpCommandHandler.parseJsonArgs(argsString);

      // 调用工具
      const result = await this.callToolInternal(serviceName, toolName, args);

      console.log(McpCommandHandler.formatToolCallResult(result));
    } catch (error) {
      console.log(`工具调用失败: ${serviceName}/${toolName}`);
      console.error(chalk.red("错误:"), (error as Error).message);

      // 提供有用的提示
      const errorMessage = (error as Error).message;
      if (errorMessage.includes("服务未启动")) {
        console.log();
        console.log(chalk.yellow("💡 请先启动服务:"));
        console.log(chalk.gray("  xiaozhi start        # 前台启动"));
        console.log(chalk.gray("  xiaozhi start -d     # 后台启动"));
      } else if (errorMessage.includes("参数格式错误")) {
        console.log();
        console.log(chalk.yellow("💡 正确格式示例:"));
        console.log(
          chalk.gray(
            `  xiaozhi mcp call ${serviceName} ${toolName} --args '{"param": "value"}'`
          )
        );
      }

      // 测试环境：通过抛出错误让测试可以捕获并断言
      if (process.env.NODE_ENV === "test") {
        throw new Error("process.exit called");
      }

      process.exit(1);
    }
  }

  /**
   * 列出所有 MCP 服务
   */
  private async handleListInternal(
    options: { tools?: boolean } = {}
  ): Promise<void> {
    const spinner = ora("获取 MCP 服务列表...").start();

    try {
      const mcpServers = configManager.getMcpServers();
      const serverNames = Object.keys(mcpServers);

      // 检查是否有 customMCP 工具
      const customMCPTools = configManager.getCustomMCPTools();
      const hasCustomMCP = customMCPTools.length > 0;

      // 计算总服务数（包括 customMCP）
      const totalServices = serverNames.length + (hasCustomMCP ? 1 : 0);

      if (totalServices === 0) {
        spinner.warn("未配置任何 MCP 服务或 customMCP 工具");
        console.log(
          chalk.yellow(
            "💡 提示: 使用 'xiaozhi config' 命令配置 MCP 服务或在 xiaozhi.config.json 中配置 customMCP 工具"
          )
        );
        return;
      }

      spinner.succeed(
        `找到 ${totalServices} 个 MCP 服务${hasCustomMCP ? " (包括 customMCP)" : ""}`
      );

      if (options.tools) {
        // 显示所有服务的工具列表
        console.log();
        console.log(chalk.bold("MCP 服务工具列表:"));
        console.log();

        // 计算所有工具名称的最大长度，用于动态设置列宽
        let maxToolNameWidth = 8; // 默认最小宽度
        const allToolNames: string[] = [];

        // 添加标准 MCP 服务的工具名称
        for (const serverName of serverNames) {
          const toolsConfig = configManager.getServerToolsConfig(serverName);
          const toolNames = Object.keys(toolsConfig);
          allToolNames.push(...toolNames);
        }

        // 添加 customMCP 工具名称
        if (hasCustomMCP) {
          const customToolNames = customMCPTools.map((tool) => tool.name);
          allToolNames.push(...customToolNames);
        }

        // 计算最长工具名称的显示宽度
        for (const toolName of allToolNames) {
          const width = McpCommandHandler.getDisplayWidth(toolName);
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

        // 首先添加 customMCP 工具（如果存在）
        if (hasCustomMCP) {
          for (const customTool of customMCPTools) {
            const description = McpCommandHandler.truncateToWidth(
              customTool.description || "",
              32
            );

            table.push([
              "customMCP",
              customTool.name,
              chalk.green("启用"), // customMCP 工具默认启用
              description,
            ]);
          }
        }

        // 然后添加标准 MCP 服务的工具
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
            // 添加服务分隔行（如果表格不为空）
            if (table.length > 0) {
              table.push([{ colSpan: 4, content: "" }]);
            }

            for (const toolName of toolNames) {
              const toolConfig = toolsConfig[toolName];
              const status = toolConfig.enable
                ? chalk.green("启用")
                : chalk.red("禁用");

              // 截断描述到最大32个字符宽度（约16个中文字符）
              const description = McpCommandHandler.truncateToWidth(
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

        // 首先显示 customMCP 服务（如果存在）
        if (hasCustomMCP) {
          console.log(`${chalk.cyan("•")} ${chalk.bold("customMCP")}`);
          console.log(`  类型: ${chalk.gray("自定义 MCP 工具")}`);
          console.log(`  配置: ${chalk.gray("xiaozhi.config.json")}`);
          console.log(
            `  工具: ${chalk.green(customMCPTools.length)} 启用 / ${chalk.yellow(
              customMCPTools.length
            )} 总计`
          );
          console.log();
        }

        // 然后显示标准 MCP 服务
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
          } else if (isLocalMCPServerConfig(serverConfig)) {
            // 本地服务
            console.log(
              `  命令: ${chalk.gray(serverConfig.command)} ${chalk.gray(
                serverConfig.args.join(" ")
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
      console.log(
        chalk.gray("  - 使用 'xiaozhi mcp list --tools' 查看所有工具")
      );
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
  private async handleServerInternal(serverName: string): Promise<void> {
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
        const description = McpCommandHandler.truncateToWidth(
          toolConfig.description || "",
          40
        );

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
  private async handleToolInternal(
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
}
