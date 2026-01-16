/**
 * http MCP 连接示例
 *
 * 功能说明：
 * - 展示如何使用 MCPConnection 连接到 http 类型的 MCP 服务
 * - 展示连接、获取工具列表、调用工具、断开连接的完整流程
 *
 * 运行方式：
 * ```bash
 * pnpm start:http
 * ```
 *
 * 如何修改为自己的 MCP 服务：
 * 只需要修改 serviceName 和 config 变量中的 url 参数即可。
 *
 * 例如，如果要使用自己的 http MCP 服务，可以将配置改为：
 *
 * const serviceName = "my-service";            // 服务名称
 * const config = {
 *   type: "http",    // 传输类型（可选，会根据 URL 自动推断）
 *   url: "https://my-api.com/mcp"              // 服务 URL
 * };
 * const connection = new MCPConnection(serviceName, config);
 *
 * 或者使用 API Key 认证：
 *
 * const serviceName = "my-service";
 * const config = {
 *   url: "https://my-api.com/mcp",
 *   apiKey: "your-api-key"                     // Bearer 认证
 * };
 *
 * 或者使用自定义请求头：
 *
 * const serviceName = "my-service";
 * const config = {
 *   url: "https://my-api.com/mcp",
 *   headers: {                                 // 自定义请求头
 *     "Authorization": "Bearer token",
 *     "X-Custom-Header": "value"
 *   }
 * };
 */

import { MCPConnection } from "@xiaozhi-client/mcp-core";

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== http MCP 连接示例 ===\n");

  // 1. 创建连接实例
  const connection = new MCPConnection("12306-mcp", {
    type: "http",
    url: "https://mcp.api-inference.modelscope.net/7521b0f1413b49/mcp",
  }, {
    // 连接成功回调
    onConnected: (data) => {
      console.log(`✅ 服务 ${data.serviceName} 已连接`);
      console.log(`   发现 ${data.tools.length} 个工具`);
      console.log();
    },

    // 连接失败回调
    onConnectionFailed: (data) => {
      console.error(`❌ 服务 ${data.serviceName} 连接失败`);
      console.error(`   错误: ${data.error.message}`);
    },

    // 断开连接回调
    onDisconnected: (data) => {
      console.log(`👋 服务 ${data.serviceName} 已断开`);
      console.log(`   原因: ${data.reason || "正常关闭"}`);
    },
  });

  try {
    // 3. 建立连接
    console.log("正在连接到服务...");
    console.log();

    await connection.connect();

    // 4. 获取工具列表
    const tools = connection.getTools();
    console.log("可用工具:");
    for (const tool of tools) {
      console.log(`  - ${tool.name}`);
      if (tool.description) {
        console.log(`    描述: ${tool.description}`);
      }
    }
    console.log();

    // 5. 检查连接状态
    console.log("连接状态:");
    console.log(`  是否已连接: ${connection.isConnected()}`);
    const status = connection.getStatus();
    console.log(`  状态: ${status.connectionState}`);
  } catch (error) {
    console.error("执行过程中出错:");
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    }
  } finally {
    // 6. 断开连接
    console.log();
    console.log("正在断开连接...");
    await connection.disconnect();
    console.log();
    console.log("=== 示例结束 ===");
  }
}

// 运行主函数
main().catch((error) => {
  console.error("未捕获的错误:", error);
  process.exit(1);
});
