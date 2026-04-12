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
import {
  createDefaultCallbacks,
  runExample,
} from "./utils/connection-helpers";

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== http MCP 连接示例 ===\n");

  // 创建连接实例
  const connection = new MCPConnection(
    "12306-mcp",
    {
      type: "http",
      url: "https://mcp.api-inference.modelscope.net/7521b0f1413b49/mcp",
    },
    createDefaultCallbacks(),
  );

  // 使用通用框架运行示例
  await runExample(connection);
}

// 运行主函数
main().catch((error) => {
  console.error("未捕获的错误:", error);
  process.exit(1);
});