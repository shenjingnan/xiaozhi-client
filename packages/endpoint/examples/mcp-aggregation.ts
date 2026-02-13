/**
 * 双 MCP 服务聚合示例
 *
 * 功能说明：
 * - 展示如何在同一个接入点连接并聚合多个 MCP 服务器
 * - 展示如何配置 calculator 和 datetime 两个 MCP 服务
 * - 展示工具列表聚合后如何获取所有服务的工具
 *
 * 运行方式：
 * ```bash
 * cd packages/endpoint
 * pnpm start:agg
 * ```
 *
 * 测试验证：
 * 示例启动后，可以通过以下 API 验证工具列表是否正确注册：
 *
 * ```bash
 * curl "https://api.xiaozhi.me/mcp/endpoints/list?endpoint_ids=agent_1324149" \
 *   -H "authorization: Bearer YOUR_TOKEN"
 * ```
 *
 * 如何修改为自己的服务：
 * 1. 替换 `endpointUrl` 为你的小智接入点地址
 * 2. 在 `mcpServers` 中添加或修改你的 MCP 服务配置
 * 3. stdio 类型配置示例：
 *    ```typescript
 *    mcpServers: {
 *      myService: {
 *        command: "npx",
 *        args: ["-y", "@your-org/your-mcp@version"]
 *      }
 *    }
 *    ```
 */

import { Endpoint } from "@xiaozhi-client/endpoint";
import {
  cleanupConnections,
  displayConnectionStatus,
  displayTools,
  handleError,
  handleUncaughtError,
} from "./shared/endpoint-helpers";

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== 双 MCP 服务聚合示例 ===\n");

  // 1. 配置小智接入点 URL
  // 注意：请将此处的 URL 替换为你自己的接入点地址
  const endpointUrl = "wss://api.xiaozhi.me/mcp/?token=<token>";

  console.log("接入点配置:");
  console.log(`  URL: ${endpointUrl.slice(0, 50)}...`);
  console.log();

  let endpoint: Endpoint | undefined;

  try {
    // 2. 创建 Endpoint 实例（使用工厂方法）
    // 配置要聚合的 MCP 服务器
    endpoint = await Endpoint.create({
      endpointUrl,
      // MCP 服务器配置
      mcpServers: {
        // 计算器 MCP 服务（stdio 类型）
        calculator: {
          command: "npx",
          args: ["-y", "@xiaozhi-client/calculator-mcp"],
        },
        // 日期时间 MCP 服务（stdio 类型）
        datetime: {
          command: "npx",
          args: ["-y", "@xiaozhi-client/datetime-mcp"],
        },
      },
      // 可选：重连延迟（毫秒），默认 2000
      reconnectDelay: 2000,
    });

    console.log("MCP 服务配置:");
    console.log("  - calculator: 计算器服务");
    console.log("    提供数学表达式计算功能");
    console.log("  - datetime: 日期时间服务");
    console.log("    提供当前日期时间查询功能");
    console.log();
    // 3. 连接到小智接入点
    console.log("正在连接到小智接入点...");
    console.log("(首次运行可能需要下载 MCP 服务包，请耐心等待...)");
    console.log();

    await endpoint.connect();

    console.log("✅ WebSocket 连接已建立");
    console.log();

    // 4. 获取连接状态
    displayConnectionStatus(endpoint);

    // 5. 获取工具列表
    const tools = endpoint.getTools();
    console.log(`发现 ${tools.length} 个工具（来自 calculator 和 datetime 服务）:`);
    console.log();

    // 按服务分组显示工具
    const calculatorTools = tools.filter((tool) => tool.name.startsWith("calculator_"));
    const datetimeTools = tools.filter((tool) => tool.name.startsWith("datetime_"));

    displayTools(calculatorTools, "计算器服务工具");
    displayTools(datetimeTools, "日期时间服务工具");

    // 6. 保持连接供测试使用
    console.log("=".repeat(50));
    console.log("连接已建立，服务正在运行...");
    console.log();
    console.log("💡 测试验证方法:");
    console.log("   使用以下 API 验证工具列表:");
    console.log();
    console.log('   fetch("https://api.xiaozhi.me/mcp/endpoints/list?endpoint_ids=agent_1324149", {');
    console.log("     headers: {");
    console.log('       "authorization": "Bearer YOUR_TOKEN"');
    console.log("     }");
    console.log("   });");
    console.log();
    console.log("   或使用 curl:");
    console.log('   curl "https://api.xiaozhi.me/mcp/endpoints/list?endpoint_ids=agent_1324149" \\');
    console.log('     -H "authorization: Bearer YOUR_TOKEN"');
    console.log();
    console.log("   预期结果：返回的工具列表应包含 calculator 和 datetime 两个服务的工具");
    console.log("=".repeat(50));
    console.log();
    console.log("按 Ctrl+C 退出...");

    // 保持连接运行
    await new Promise(() => {
      // 无限期保持，直到用户中断
    });
  } catch (error) {
    handleError(error, endpoint);
  } finally {
    // 7. 断开连接
    await cleanupConnections([endpoint]);
  }
}

// 运行主函数
main().catch(handleUncaughtError);
