/**
 * 小智接入点连接示例
 *
 * 功能说明：
 * - 展示如何使用 Endpoint 连接到小智接入点
 * - 展示如何配置多个 MCP 服务器聚合
 * - 展示连接、获取工具列表、断开连接的完整流程
 *
 * 运行方式：
 * ```bash
 * cd packages/endpoint
 * pnpm start
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
 *    myService: {
 *      command: "npx",
 *      args: ["-y", "@your-org/your-mcp@version"]
 *    }
 *    ```
 */

import { Endpoint } from "@xiaozhi-client/endpoint";

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== 小智接入点连接示例 ===\n");

  // 1. 配置小智接入点 URL
  // 注意：请将此处的 URL 替换为你自己的接入点地址
  const endpointUrl =
    "wss://api.xiaozhi.me/mcp/?token=<token>";

  console.log("接入点配置:");
  console.log(`  URL: ${endpointUrl.slice(0, 50)}...`);
  console.log();

  // 2. 创建 Endpoint 实例
  // 配置要聚合的 MCP 服务器
  const endpoint = new Endpoint(endpointUrl, {
    // MCP 服务器配置
    mcpServers: {
      // 计算器 MCP 服务（stdio 类型）
      calculator: {
        command: "npx",
        args: [
          "-y",
          "@xiaozhi-client/calculator-mcp",
        ],
      },
    },
    // 可选：重连延迟（毫秒），默认 2000
    reconnectDelay: 2000,
  });

  console.log("MCP 服务配置:");
  console.log("  - calculator: 计算器服务");
  console.log("    提供数学表达式计算功能");
  console.log();

  try {
    // 3. 连接到小智接入点
    console.log("正在连接到小智接入点...");
    console.log("(首次运行可能需要下载 MCP 服务包，请耐心等待...)");
    console.log();

    await endpoint.connect();

    console.log("✅ WebSocket 连接已建立");
    console.log();

    // 4. 获取连接状态
    const status = endpoint.getStatus();
    console.log("连接状态:");
    console.log(`  已连接: ${status.connected ? "是" : "否"}`);
    console.log(`  已初始化: ${status.initialized ? "是" : "否"}`);
    console.log(`  连接状态: ${status.connectionState}`);
    console.log(`  可用工具数: ${status.availableTools}`);
    console.log();

    // 5. 获取工具列表
    const tools = endpoint.getTools();
    console.log(`发现 ${tools.length} 个工具:`);
    console.log();

    for (const tool of tools) {
      console.log(`  📦 ${tool.name}`);
      if (tool.description) {
        console.log(`     描述: ${tool.description}`);
      }
      // 显示输入参数 schema（如果有的话）
      if (tool.inputSchema && Object.keys(tool.inputSchema).length > 0) {
        const properties = (tool.inputSchema as { properties?: Record<string, unknown> }).properties;
        if (properties && Object.keys(properties).length > 0) {
          console.log(`     参数: ${Object.keys(properties).join(", ")}`);
        }
      }
    }
    console.log();

    // 6. 保持连接供测试使用
    console.log("=".repeat(50));
    console.log("连接已建立，服务正在运行...");
    console.log();
    console.log("💡 测试验证方法:");
    console.log("   使用以下 API 验证工具列表:");
    console.log();
    console.log("   fetch(\"https://api.xiaozhi.me/mcp/endpoints/list?endpoint_ids=agent_1324149\", {");
    console.log("     headers: {");
    console.log("       \"authorization\": \"Bearer YOUR_TOKEN\"");
    console.log("     }");
    console.log("   });");
    console.log();
    console.log("   或使用 curl:");
    console.log(`   curl "https://api.xiaozhi.me/mcp/endpoints/list?endpoint_ids=agent_1324149" \\`);
    console.log(`     -H "authorization: Bearer YOUR_TOKEN"`);
    console.log();
    console.log("   预期结果：返回的工具列表应包含 calculator 工具");
    console.log("=".repeat(50));
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
        console.error(`   堆栈: ${error.stack.split("\n").slice(1, 3).join("\n")}`);
      }
    }
    console.error();

    // 显示连接状态（如果可能）
    try {
      const status = endpoint.getStatus();
      console.error("当前连接状态:");
      console.error(`  已连接: ${status.connected ? "是" : "否"}`);
      console.error(`  连接状态: ${status.connectionState}`);
      if (status.lastError) {
        console.error(`  最后错误: ${status.lastError}`);
      }
    } catch {
      // 忽略获取状态的错误
    }
  } finally {
    // 7. 断开连接
    console.log();
    console.log("正在断开连接...");
    await endpoint.disconnect();
    console.log("✅ 连接已断开");
    console.log();
    console.log("=== 示例结束 ===");
  }
}

// 运行主函数
main().catch((error) => {
  console.error("未捕获的错误:", error);
  process.exit(1);
});
