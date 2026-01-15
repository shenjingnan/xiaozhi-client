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

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== MCPManager 多服务管理示例 ===\n");

  // 1. 创建管理器
  const manager = new MCPManager();

  // 2. 配置事件监听
  manager.on("connect", () => {
    console.log("🔄 开始连接所有服务...");
  });

  manager.on("connected", ({ serverName, tools }) => {
    console.log(`✅ 服务 ${serverName} 已连接`);
    console.log(`   发现 ${tools.length} 个工具`);
    console.log();
  });

  manager.on("error", ({ serverName, error }) => {
    console.error(`❌ 服务 ${serverName} 出错: ${error.message}`);
  });

  manager.on("disconnected", ({ serverName, reason }) => {
    console.log(`👋 服务 ${serverName} 已断开`);
    console.log(`   原因: ${reason || "正常关闭"}`);
  });

  manager.on("disconnect", () => {
    console.log("🔄 所有服务已断开");
  });

  // 3. 添加服务配置
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

  try {
    // 4. 连接所有服务
    console.log("正在连接到服务...");
    console.log("(首次运行可能需要下载 MCP 服务包，请耐心等待...)");
    console.log();

    await manager.connect();

    // 5. 获取所有已连接的服务
    const connectedServers = manager.getConnectedServerNames();
    console.log("已连接的服务:");
    for (const serverName of connectedServers) {
      console.log(`  - ${serverName}`);
    }
    console.log();

    // 6. 分别列出每个服务的工具
    console.log("各服务的工具列表:");
    console.log();

    const allTools = manager.listTools();

    // 按服务分组工具
    const toolsByServer: Record<string, typeof allTools> = {};
    for (const tool of allTools) {
      if (!toolsByServer[tool.serverName]) {
        toolsByServer[tool.serverName] = [];
      }
      toolsByServer[tool.serverName].push(tool);
    }

    // 打印每个服务的工具
    for (const [serverName, tools] of Object.entries(toolsByServer)) {
      console.log(`【${serverName}】`);
      console.log(`  工具数量: ${tools.length}`);
      console.log("  工具列表:");
      for (const tool of tools) {
        console.log(`    - ${tool.name}`);
        if (tool.description) {
          console.log(`      描述: ${tool.description}`);
        }
      }
      console.log();
    }

    // 7. 调用示例工具

    // 调用 calculator 服务的工具
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

    // 8. 查询服务状态
    console.log("服务状态:");
    const allStatus = manager.getAllServerStatus();
    for (const [serverName, status] of Object.entries(allStatus)) {
      console.log(`  【${serverName}】`);
      console.log(`    已连接: ${status.connected ? "是" : "否"}`);
      console.log(`    工具数: ${status.toolCount}`);
    }
    console.log();

    // 9. 列出所有可用工具（跨服务）
    console.log("所有可用工具（跨服务）:");
    for (const tool of allTools) {
      console.log(`  ${tool.serverName}/${tool.name}`);
    }
    console.log();
  } catch (error) {
    console.error("执行过程中出错:");
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    }
  } finally {
    // 10. 断开所有连接
    console.log("正在断开所有连接...");
    await manager.disconnect();
    console.log();
    console.log("=== 示例结束 ===");
  }
}

// 运行主函数
main().catch((error) => {
  console.error("未捕获的错误:", error);
  process.exit(1);
});
