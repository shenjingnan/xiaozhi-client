/**
 * MCPManager 多服务管理示例
 *
 * 功能说明：
 * - 展示如何使用 MCPManager 管理多个 MCP 服务
 * - 展示如何分别列出每个服务的工具列表
 * - 展示事件监听、工具调用和状态查询功能
 *
 * 运行方式：
 * ```bash
 * pnpm connect:multi
 * ```
 *
 * 如何修改为自己的 MCP 服务：
 * 只需要修改 addServer 调用的服务名称和配置即可。
 * 例如：
 *
 * manager.addServer('my-service', {
 *   type: 'stdio',                       // 传输类型
 *   command: 'npx',                     // 执行命令
 *   args: ['-y', '@xiaozhi-client/my-mcp']         // 命令参数
 * });
 *
 * 或者使用 npx 安装远程 MCP 服务：
 *
 * manager.addServer('my-service', {
 *   type: 'stdio',
 *   command: 'npx',
 *   args: ['-y', '@xiaozhi-client/my-mcp']  // -y 表示自动确认安装
 * });
 */

import { MCPManager } from "@xiaozhi-client/mcp-core";
import {
  setupManagerEventListeners,
  runManagerExample,
  printToolsByServer,
  printAllTools,
} from "./utils/connection-helpers";

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== MCPManager 多服务管理示例 ===\n");

  // 创建管理器
  const manager = new MCPManager();

  // 配置事件监听（使用通用辅助函数）
  setupManagerEventListeners(manager);

  // 添加服务配置
  console.log("配置服务:");
  console.log("  1. calculator - 计算器服务");
  console.log("     提供: 数学表达式计算功能");
  console.log("  2. datetime - 日期时间服务");
  console.log("     提供: 日期时间处理功能");
  console.log();

  // 添加计算器服务
  // 注意：这里使用本地构建的 run.js 进行演示
  // 生产环境可以使用 npx 方式：
  // manager.addServer("calculator", {
  //   type: "stdio",
  //   command: "npx",
  //   args: ["-y", "@xiaozhi-client/calculator-mcp"]
  // });
  manager.addServer("calculator", {
    type: "stdio",
    command: "npx",
    args: ["-y", "@xiaozhi-client/calculator-mcp"],
  });

  // 添加日期时间服务
  manager.addServer("datetime", {
    type: "stdio",
    command: "npx",
    args: ["-y", "@xiaozhi-client/datetime-mcp"],
  });

  // 使用通用框架运行示例
  await runManagerExample(manager, async () => {
    // 分别列出每个服务的工具
    const allTools = manager.listTools();
    printToolsByServer(allTools);

    // 调用示例工具
    console.log("调用 calculator 服务:");
    console.log("  工具: calculator");
    console.log("  参数: { expression: '12 * 3 + 4' }");

    const calcResult = await manager.callTool("calculator", "calculator", {
      expression: "12 * 3 + 4",
    });

    console.log("  结果:");
    if (calcResult.content && calcResult.content.length > 0) {
      console.log(`    ${calcResult.content[0].text}`);
    }
    console.log();

    // 调用 datetime 服务的工具
    console.log("调用 datetime 服务:");
    console.log("  工具: get_current_time");
    console.log("  参数: { format: 'locale' }");

    const timeResult = await manager.callTool("datetime", "get_current_time", {
      format: "locale",
    });

    console.log("  结果:");
    if (timeResult.content && timeResult.content.length > 0) {
      console.log(`    ${timeResult.content[0].text}`);
    }
    console.log();

    // 再次调用 datetime 服务展示另一个工具
    console.log("再调用 datetime 服务:");
    console.log("  工具: get_current_date");
    console.log("  参数: { format: 'yyyy-mm-dd' }");

    const dateResult = await manager.callTool("datetime", "get_current_date", {
      format: "yyyy-mm-dd",
    });

    console.log("  结果:");
    if (dateResult.content && dateResult.content.length > 0) {
      console.log(`    ${dateResult.content[0].text}`);
    }
    console.log();

    // 列出所有可用工具（跨服务）
    printAllTools(allTools);
  });
}

// 运行主函数
main().catch((error) => {
  console.error("未捕获的错误:", error);
  process.exit(1);
});