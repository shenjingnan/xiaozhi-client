/**
 * 示例 04：多服务聚合示例
 *
 * 功能说明：
 * - 使用 MCPManager 同时管理多个 MCP 服务
 * - 展示并行连接多个服务
 * - 展示跨服务工具调用
 * - 展示服务状态监控
 *
 * 运行方式：
 * ```bash
 * pnpm run example:04
 * ```
 *
 * 依赖：
 * - @xiaozhi-client/calculator-mcp（通过 npx 自动安装）
 * - @xiaozhi-client/datetime-mcp（通过 npx 自动安装）
 */

import { MCPManager } from "@xiaozhi-client/mcp-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== 多服务聚合示例 ===\n");

  // 1. 创建 MCPManager 实例
  const manager = new MCPManager();

  // 检查是否使用本地 MCP 服务
  const useLocal = process.env.USE_LOCAL_MCP === "true";

  // 2. 监听管理器事件
  manager.on("connect", () => {
    console.log("🚀 开始连接所有服务...\n");
  });

  manager.on("connected", (data) => {
    console.log(`✅ 服务 ${data.serverName} 已连接`);
    console.log(`   发现 ${data.tools.length} 个工具`);
    console.log();
  });

  manager.on("disconnected", (data) => {
    console.log(`👋 服务 ${data.serverName} 已断开`);
  });

  manager.on("error", (data) => {
    console.error(`⚠️ 服务 ${data.serverName} 出错: ${data.error.message}`);
  });

  manager.on("disconnect", () => {
    console.log("\n所有服务已断开连接");
  });

  try {
    // 3. 添加多个服务
    console.log("配置服务:\n");

    // 根据模式选择服务配置
    const calculatorConfig = useLocal
      ? {
          type: "stdio",
          command: "node",
          args: [join(__dirname, "../../../mcps/calculator-mcp/run.js")],
        }
      : {
          type: "stdio",
          command: "npx",
          args: ["-y", "@xiaozhi-client/calculator-mcp"],
        };

    const datetimeConfig = useLocal
      ? {
          type: "stdio",
          command: "node",
          args: [join(__dirname, "../../../mcps/datetime-mcp/run.js")],
        }
      : {
          type: "stdio",
          command: "npx",
          args: ["-y", "@xiaozhi-client/datetime-mcp"],
        };

    // 添加计算器服务
    manager.addServer("calculator", calculatorConfig);
    console.log("  ✓ 添加 calculator 服务");

    // 添加日期时间服务
    manager.addServer("datetime", datetimeConfig);
    console.log("  ✓ 添加 datetime 服务");

    console.log(`  模式: ${useLocal ? "本地开发" : "npx 安装"}`);

    console.log("\n正在连接服务...");
    console.log("(首次运行可能需要下载 MCP 服务包，请耐心等待...)\n");

    // 4. 连接所有服务
    await manager.connect();

    // 5. 列出所有已配置的服务
    console.log("已配置的服务:");
    const serverNames = manager.getServerNames();
    serverNames.forEach((name) => {
      console.log(`  - ${name}`);
    });
    console.log();

    // 6. 列出所有已连接的服务
    console.log("已连接的服务:");
    const connectedNames = manager.getConnectedServerNames();
    connectedNames.forEach((name) => {
      console.log(`  - ${name}`);
    });
    console.log();

    // 7. 列出所有可用工具
    const allTools = manager.listTools();
    console.log(`所有可用工具 (共 ${allTools.length} 个):\n`);

    // 按服务分组显示工具
    const toolsByServer: Record<string, typeof allTools> = {};
    allTools.forEach((tool) => {
      if (!toolsByServer[tool.serverName]) {
        toolsByServer[tool.serverName] = [];
      }
      toolsByServer[tool.serverName].push(tool);
    });

    for (const [serverName, tools] of Object.entries(toolsByServer)) {
      console.log(`  ${serverName}:`);
      tools.forEach((tool) => {
        console.log(`    📦 ${tool.name}`);
        console.log(`       ${tool.description}`);
      });
      console.log();
    }

    // 8. 调用不同服务的工具
    console.log("调用工具:\n");

    // 调用计算器服务
    console.log("  1. 调用 calculator 服务的 calculator 工具:");
    console.log("     表达式: 10 * 20 + 30");
    const calcResult = await manager.callTool("calculator", "calculator", {
      expression: "10 * 20 + 30",
    });
    if (calcResult.content && calcResult.content.length > 0) {
      console.log(`     结果: ${calcResult.content[0].text}`);
    }
    console.log();

    // 调用日期时间服务
    console.log("  2. 调用 datetime 服务的 get_current_time 工具:");
    console.log("     格式: iso");
    const timeResult = await manager.callTool("datetime", "get_current_time", {
      format: "iso",
    });
    if (timeResult.content && timeResult.content.length > 0) {
      console.log(`     结果: ${timeResult.content[0].text}`);
    }
    console.log();

    // 再次调用计算器服务
    console.log("  3. 再次调用 calculator 服务:");
    console.log("     表达式: 2 ^ 8");
    const calcResult2 = await manager.callTool("calculator", "calculator", {
      expression: "2 ^ 8",
    });
    if (calcResult2.content && calcResult2.content.length > 0) {
      console.log(`     结果: ${calcResult2.content[0].text}`);
    }
    console.log();

    // 9. 查看服务状态
    console.log("服务状态:\n");
    const allStatus = manager.getAllServerStatus();
    for (const [serverName, status] of Object.entries(allStatus)) {
      console.log(`  ${serverName}:`);
      console.log(`    连接状态: ${status.connectionState}`);
      console.log(`    工具数量: ${status.toolsCount}`);
    }
    console.log();

    // 10. 检查特定服务的连接状态
    console.log("连接状态检查:");
    console.log(`  calculator 已连接: ${manager.isConnected("calculator")}`);
    console.log(`  datetime 已连接: ${manager.isConnected("datetime")}`);
    console.log();

    // 11. 提示信息
    console.log("💡 提示：");
    console.log("   MCPManager 可以同时管理多个 MCP 服务");
    console.log("   服务之间相互独立，可以并行调用工具");
    console.log("   适用于需要聚合多个 AI 能力的场景\n");
  } catch (error) {
    console.error("执行过程中出错:");
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    }
  } finally {
    // 12. 断开所有服务连接
    console.log("正在断开所有服务连接...");
    await manager.disconnect();
    console.log("\n=== 示例结束 ===");
  }
}

// 运行主函数
main().catch((error) => {
  console.error("未捕获的错误:", error);
  process.exit(1);
});
