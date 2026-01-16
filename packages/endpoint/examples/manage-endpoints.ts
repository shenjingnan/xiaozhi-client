/**
 * 双接入点共享相同 MCP 服务示例
 *
 * 功能说明：
 * - 展示如何使用 EndpointManager 管理两个独立的接入点
 * - 展示每个接入点连接相同的 MCP 服务集合
 * - 展示两个接入点都能获取相同的工具列表
 * - 验证接入点之间的工具一致性
 *
 * 与 endpoint-isolation.ts 的区别：
 * - endpoint-isolation.ts: 两个接入点各自连接不同的 MCP 服务
 * - dual-endpoint-shared-mcp.ts: 两个接入点连接相同的 MCP 服务
 *
 * 运行方式：
 * ```bash
 * cd packages/endpoint
 * pnpm start:example dual-endpoint-shared-mcp
 * ```
 *
 * 测试验证：
 * 示例启动后，两个接入点应该都能获取到 calculator 和 datetime 的工具列表
 *
 * 如何修改为自己的服务：
 * 1. 替换 `endpointUrl1` 和 `endpointUrl2` 为你的小智接入点地址
 * 2. 在 `sharedMcpServers` 中添加或修改你的 MCP 服务配置
 */

import { Endpoint, EndpointManager } from "@xiaozhi-client/endpoint";

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== 双接入点共享相同 MCP 服务示例 ===\n");

  // 1. 定义共享的 MCP 服务配置
  // 这个配置会被两个接入点共同使用
  const sharedMcpServers = {
    calculator: {
      command: "npx",
      args: ["-y", "@xiaozhi-client/calculator-mcp@1.9.7-beta.16"],
    },
    datetime: {
      command: "npx",
      args: ["-y", "@xiaozhi-client/datetime-mcp@1.9.7-beta.16"],
    },
  };

  // 2. 配置两个小智接入点 URL
  // 接入点 1
  const endpointUrl1 =
    "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwMjcyMCwiYWdlbnRJZCI6MTMyNDE0OSwiZW5kcG9pbnRJZCI6ImFnZW50XzEzMjQxNDkiLCJwdXJwb3NlIjoibWNwLWVuZHBvaW50IiwiaWF0IjoxNzY4NDgwOTMwLCJleHAiOjE4MDAwMzg1MzB9.Oqd2JtoS0dszKdMdCNW67KawYTOgkI7kjqtlJ87dqKxYfZFFRbnyWKsk4S2x2vZAu8p7dBnpIZt8XzXepX2Ncw";

  // 接入点 2
  const endpointUrl2 =
    "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwMjcyMCwiYWdlbnRJZCI6MTMyNDMyMCwiZW5kcG9pbnRJZCI6ImFnZW50XzEzMjQzMjAiLCJwdXJwb3NlIjoibWNwLWVuZHBvaW50IiwiaWF0IjoxNzY4NDgyMjYxLCJleHAiOjE4MDAwMzk4NjF9.mujQObddRTRXHmK8T_zX26J_oNI9NjzbH627c9UHW0_dKIaHjoHsYtI6awaFa0IHncYeJM50dMRP2I_Oy122IQ";

  // 提取 endpoint ID 用于显示
  const endpointId1 = "agent_1324149";
  const endpointId2 = "agent_1324320";

  console.log("接入点配置:");
  console.log(`  接入点 1: ${endpointId1} → calculator + datetime`);
  console.log(`    URL: ${endpointUrl1.slice(0, 60)}...`);
  console.log(`  接入点 2: ${endpointId2} → calculator + datetime`);
  console.log(`    URL: ${endpointUrl2.slice(0, 60)}...`);
  console.log();

  console.log("MCP 服务配置（两个接入点共享）:");
  console.log("  - calculator: 计算器服务");
  console.log("    提供数学表达式计算功能");
  console.log("  - datetime: 日期时间服务");
  console.log("    提供当前日期时间查询功能");
  console.log();

  try {
    // 3. 创建两个独立的 Endpoint 实例
    // 关键点：两个接入点使用相同的 mcpServers 配置
    const endpoint1 = new Endpoint(endpointUrl1, {
      mcpServers: sharedMcpServers,
      reconnectDelay: 2000,
    });

    const endpoint2 = new Endpoint(endpointUrl2, {
      mcpServers: sharedMcpServers,
      reconnectDelay: 2000,
    });

    // 4. 创建 EndpointManager 并添加端点
    const manager = new EndpointManager({
      defaultReconnectDelay: 2000,
    });

    manager.addEndpoint(endpoint1);
    manager.addEndpoint(endpoint2);

    console.log("正在连接到小智接入点...");
    console.log("(首次运行可能需要下载 MCP 服务包，请耐心等待...)");
    console.log();

    // 5. 连接所有端点
    await manager.connect();

    console.log("✅ WebSocket 连接已建立");
    console.log();

    // 6. 获取连接状态
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

    // 7. 获取每个接入点的工具列表
    const tools1 = endpoint1.getTools();
    const tools2 = endpoint2.getTools();

    console.log(`接入点 1 (${endpointId1}): 发现 ${tools1.length} 个工具`);
    console.log(`接入点 2 (${endpointId2}): 发现 ${tools2.length} 个工具`);
    console.log();

    // 8. 显示接入点 1 的工具
    console.log("📦 接入点 1 - 工具列表:");
    for (const tool of tools1) {
      console.log(`  - ${tool.name}`);
      if (tool.description) {
        console.log(`    描述: ${tool.description}`);
      }
    }
    console.log();

    // 9. 显示接入点 2 的工具
    console.log("📦 接入点 2 - 工具列表:");
    for (const tool of tools2) {
      console.log(`  - ${tool.name}`);
      if (tool.description) {
        console.log(`    描述: ${tool.description}`);
      }
    }
    console.log();

    // 10. 验证一致性
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

    console.log("🔍 一致性验证:");
    console.log(
      `  工具数量相同: ${tools1.length === tools2.length ? "✅" : "❌"} (${tools1.length} vs ${tools2.length})`
    );
    console.log(
      `  接入点 1 包含 calculator: ${hasCalculatorInEndpoint1 ? "✅" : "❌"}`
    );
    console.log(
      `  接入点 1 包含 datetime: ${hasDatetimeInEndpoint1 ? "✅" : "❌"}`
    );
    console.log(
      `  接入点 2 包含 calculator: ${hasCalculatorInEndpoint2 ? "✅" : "❌"}`
    );
    console.log(
      `  接入点 2 包含 datetime: ${hasDatetimeInEndpoint2 ? "✅" : "❌"}`
    );
    console.log();

    // 11. 验证工具名称完全一致
    const toolNames1 = new Set(tools1.map((t) => t.name));
    const toolNames2 = new Set(tools2.map((t) => t.name));
    const allToolsMatch =
      toolNames1.size === toolNames2.size &&
      [...toolNames1].every((name) => toolNames2.has(name));

    console.log(`  工具名称完全匹配: ${allToolsMatch ? "✅" : "❌"}`);
    console.log();

    // 12. 保持连接供测试使用
    console.log("=".repeat(50));
    console.log("连接已建立，服务正在运行...");
    console.log();
    console.log("💡 说明:");
    console.log("   - 两个接入点已成功连接到相同的 MCP 服务");
    console.log("   - 每个接入点都能独立访问 calculator 和 datetime 工具");
    console.log("   - 接入点之间的工具列表完全一致");
    console.log();
    console.log("按 Ctrl+C 退出...");

    // 保持连接运行
    await new Promise(() => {
      // 无限期保持，直到用户中断
    });
  } catch (error) {
    console.error();
    console.error("❌ 执行过程中出错:");
    if (error instanceof Error) {
      console.error(`   错误信息: ${error.message}`);
      if (error.stack) {
        console.error(
          `   堆栈: ${error.stack.split("\n").slice(1, 3).join("\n")}`
        );
      }
    }
    console.error();
  } finally {
    // 13. 断开连接
    console.log();
    console.log("正在断开连接...");
    console.log();
    console.log("=== 示例结束 ===");
  }
}

// 运行主函数
main().catch((error) => {
  console.error("未捕获的错误:", error);
  process.exit(1);
});
