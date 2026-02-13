/**
 * 双接入点独立 MCP 连接示例
 *
 * 功能说明：
 * - 展示如何使用 EndpointManager 管理两个独立的接入点
 * - 展示每个接入点连接一个独立的 MCP 服务
 * - 展示接入点之间的隔离性：每个接入点只能获取自己配置的 MCP 工具
 *
 * 与 dual-mcp-aggregation.ts 的区别：
 * - dual-mcp-aggregation.ts: 单接入点聚合多个 MCP 服务
 * - dual-endpoint-isolation.ts: 双独立接入点，各自连接一个 MCP 服务
 *
 * 运行方式：
 * ```bash
 * cd packages/endpoint
 * pnpm start:iso
 * ```
 *
 * 测试验证：
 * 示例启动后，可以通过以下 API 验证工具列表是否正确隔离：
 *
 * ```bash
 * # 验证接入点 1 只有 calculator 工具
 * curl "https://api.xiaozhi.me/mcp/endpoints/list?endpoint_ids=agent_1324149" \
 *   -H "authorization: Bearer YOUR_TOKEN"
 *
 * # 验证接入点 2 只有 datetime 工具
 * curl "https://api.xiaozhi.me/mcp/endpoints/list?endpoint_ids=agent_1324320" \
 *   -H "authorization: Bearer YOUR_TOKEN"
 * ```
 *
 * 如何修改为自己的服务：
 * 1. 替换 `endpointUrl1` 和 `endpointUrl2` 为你的小智接入点地址
 * 2. 在各自的 `mcpServers` 中添加或修改你的 MCP 服务配置
 */

import { Endpoint, EndpointManager } from "@xiaozhi-client/endpoint";
import {
  cleanupConnections,
  displayTools,
  handleError,
  handleUncaughtError,
} from "./shared/endpoint-helpers";

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== 双接入点独立 MCP 连接示例 ===\n");

  // 1. 配置两个小智接入点 URL
  // 接入点 1：连接 calculator 服务
  const endpointUrl1 =
    "wss://api.xiaozhi.me/mcp/?token=<token>";

  // 接入点 2：连接 datetime 服务
  const endpointUrl2 =
    "wss://api.xiaozhi.me/mcp/?token=<token>";

  // 提取 endpoint ID 用于显示
  const endpointId1 = "agent_1324149";
  const endpointId2 = "agent_1324320";

  console.log("接入点配置:");
  console.log(`  接入点 1: ${endpointId1} → calculator`);
  console.log(`    URL: ${endpointUrl1.slice(0, 60)}...`);
  console.log(`  接入点 2: ${endpointId2} → datetime`);
  console.log(`    URL: ${endpointUrl2.slice(0, 60)}...`);
  console.log();

  let endpoint1: Endpoint | undefined;
  let endpoint2: Endpoint | undefined;

  try {
    // 2. 创建两个独立的 Endpoint 实例（使用工厂方法）
    // 接入点 1：配置 calculator 服务
    endpoint1 = await Endpoint.create({
      endpointUrl: endpointUrl1,
      mcpServers: {
        calculator: {
          command: "npx",
          args: ["-y", "@xiaozhi-client/calculator-mcp"],
        },
      },
      reconnectDelay: 2000,
    });

    // 接入点 2：配置 datetime 服务
    endpoint2 = await Endpoint.create({
      endpointUrl: endpointUrl2,
      mcpServers: {
        datetime: {
          command: "npx",
          args: ["-y", "@xiaozhi-client/datetime-mcp"],
        },
      },
      reconnectDelay: 2000,
    });

    console.log("MCP 服务配置:");
    console.log("  接入点 1:");
    console.log("    - calculator: 计算器服务");
    console.log("      提供数学表达式计算功能");
    console.log("  接入点 2:");
    console.log("    - datetime: 日期时间服务");
    console.log("      提供当前日期时间查询功能");
    console.log();
    // 3. 创建 EndpointManager 并添加端点
    const manager = new EndpointManager({
      defaultReconnectDelay: 2000,
    });

    manager.addEndpoint(endpoint1);
    manager.addEndpoint(endpoint2);

    console.log("正在连接到小智接入点...");
    console.log("(首次运行可能需要下载 MCP 服务包，请耐心等待...)");
    console.log();

    // 4. 连接所有端点
    await manager.connect();

    console.log("✅ WebSocket 连接已建立");
    console.log();

    // 5. 获取连接状态
    const connectionStatus = manager.getConnectionStatus();
    console.log("连接状态:");

    for (const status of connectionStatus) {
      const endpointId = status.endpoint.includes("agent_1324149")
        ? "agent_1324149"
        : "agent_1324320";
      console.log(`  接入点 ${endpointId}:`);
      console.log(`    已连接: ${status.connected ? "是" : "否"}`);
      console.log(`    已初始化: ${status.initialized ? "是" : "否"}`);
    }
    console.log();

    // 6. 获取每个接入点的工具列表
    const tools1 = endpoint1.getTools();
    const tools2 = endpoint2.getTools();

    console.log(
      `接入点 1 (${endpointId1}): 发现 ${tools1.length} 个工具（仅 calculator）`
    );
    console.log(
      `接入点 2 (${endpointId2}): 发现 ${tools2.length} 个工具（仅 datetime）`
    );
    console.log();

    // 7. 显示接入点 1 的工具（calculator）
    displayTools(tools1, "接入点 1 - 计算器服务工具");

    // 8. 显示接入点 2 的工具（datetime）
    displayTools(tools2, "接入点 2 - 日期时间服务工具");

    // 9. 验证隔离性
    const hasCalculatorInEndpoint1 = tools1.some((t) =>
      t.name.startsWith("calculator_")
    );
    const hasDatetimeInEndpoint1 = tools1.some((t) =>
      t.name.startsWith("datetime_")
    );
    const hasCalculatorInEndpoint2 = tools2.some((t) =>
      t.name.startsWith("calculator_")
    );
    const hasDatetimeInEndpoint2 = tools2.some((t) =>
      t.name.startsWith("datetime_")
    );

    console.log("🔍 隔离性验证:");
    console.log(
      `  接入点 1 包含 calculator: ${hasCalculatorInEndpoint1 ? "✅" : "❌"}`
    );
    console.log(
      `  接入点 1 包含 datetime: ${hasDatetimeInEndpoint1 ? "❌（不应存在）" : "✅（正确）"}`
    );
    console.log(
      `  接入点 2 包含 calculator: ${hasCalculatorInEndpoint2 ? "❌（不应存在）" : "✅（正确）"}`
    );
    console.log(
      `  接入点 2 包含 datetime: ${hasDatetimeInEndpoint2 ? "✅" : "❌"}`
    );
    console.log();

    // 10. 保持连接供测试使用
    console.log("=".repeat(50));
    console.log("连接已建立，服务正在运行...");
    console.log();
    console.log("💡 测试验证方法:");
    console.log("   使用以下 API 验证工具列表隔离:");
    console.log();
    console.log(`   # 验证接入点 ${endpointId1} 只有 calculator 工具`);
    console.log(
      "   fetch(`https://api.xiaozhi.me/mcp/endpoints/list?endpoint_ids=${endpointId1}`, {"
    );
    console.log("     headers: {");
    console.log('       "authorization": "Bearer YOUR_TOKEN"');
    console.log("     }");
    console.log("   });");
    console.log();
    console.log(`   # 验证接入点 ${endpointId2} 只有 datetime 工具`);
    console.log(
      "   fetch(`https://api.xiaozhi.me/mcp/endpoints/list?endpoint_ids=${endpointId2}`, {"
    );
    console.log("     headers: {");
    console.log('       "authorization": "Bearer YOUR_TOKEN"');
    console.log("     }");
    console.log("   });");
    console.log();
    console.log("   或使用 curl:");
    console.log(
      `   curl "https://api.xiaozhi.me/mcp/endpoints/list?endpoint_ids=${endpointId1}" \\`
    );
    console.log('     -H "authorization: Bearer YOUR_TOKEN"');
    console.log();
    console.log(
      `   curl "https://api.xiaozhi.me/mcp/endpoints/list?endpoint_ids=${endpointId2}" \\`
    );
    console.log('     -H "authorization: Bearer YOUR_TOKEN"');
    console.log();
    console.log("   预期结果：");
    console.log(`   - ${endpointId1} 应只返回 calculator 服务的工具`);
    console.log(`   - ${endpointId2} 应只返回 datetime 服务的工具`);
    console.log("=".repeat(50));
    console.log();
    console.log("按 Ctrl+C 退出...");

    // 保持连接运行
    await new Promise(() => {
      // 无限期保持，直到用户中断
    });
  } catch (error) {
    handleError(error, [endpoint1, endpoint2].filter((e): e is Endpoint => e !== undefined), [`${endpointId1}`, `${endpointId2}`]);
  } finally {
    // 11. 断开连接
    await cleanupConnections([endpoint1, endpoint2]);
  }
}

// 运行主函数
main().catch(handleUncaughtError);
