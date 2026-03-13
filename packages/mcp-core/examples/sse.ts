/**
 * SSE MCP 连接示例
 *
 * 功能说明：
 * - 展示如何使用 MCPConnection 连接到 SSE（Server-Sent Events）类型的 MCP 服务
 * - 展示连接、获取工具列表、调用工具、断开连接的完整流程
 *
 * 运行方式：
 * ```bash
 * pnpm start:sse
 * ```
 *
 * 如何修改为自己的 MCP 服务：
 * 只需要修改 serviceName 和 config 变量中的 url 参数即可。
 *
 * 例如，如果要使用自己的 SSE MCP 服务，可以将配置改为：
 *
 * const serviceName = "my-service";            // 服务名称
 * const config = {
 *   type: "sse",                // 传输类型（可选，会根据 URL 自动推断）
 *   url: "https://my-api.com/sse"              // 服务 URL
 * };
 * const connection = new MCPConnection(serviceName, config);
 *
 * 或者使用 API Key 认证：
 *
 * const serviceName = "my-service";
 * const config = {
 *   url: "https://my-api.com/sse",
 *   apiKey: "your-api-key"                     // Bearer 认证
 * };
 *
 * 或者使用自定义请求头：
 *
 * const serviceName = "my-service";
 * const config = {
 *   url: "https://my-api.com/sse",
 *   headers: {                                 // 自定义请求头
 *     "Authorization": "Bearer token",
 *     "X-Custom-Header": "value"
 *   }
 * };
 */

import { MCPConnection } from "@xiaozhi-client/mcp-core";
import {
  createStandardCallbacks,
  handleStandardError,
  printConnectionStatus,
  printTools,
  runMain,
} from "./shared.js";

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== SSE MCP 连接示例 ===\n");

  // 1. 创建连接实例
  const connection = new MCPConnection(
    "12306-mcp",
    {
      type: "sse",
      url: "https://mcp.api-inference.modelscope.net/ed2b195cc8f94d/sse",
    },
    createStandardCallbacks()
  );

  try {
    // 3. 建立连接
    console.log("正在连接到服务...");
    console.log();

    await connection.connect();

    // 4. 获取工具列表
    const tools = connection.getTools();
    printTools(tools);

    // 5. 检查连接状态
    printConnectionStatus(connection);
  } catch (error) {
    handleStandardError(error);
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
runMain(main);
