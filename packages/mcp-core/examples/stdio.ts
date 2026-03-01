/**
 * stdio MCP 连接示例
 *
 * 功能说明：
 * - 展示如何使用 MCPConnection 连接到 stdio 类型的 MCP 服务
 * - 展示连接、获取工具列表、调用工具、断开连接的完整流程
 *
 * 运行方式：
 * ```bash
 * pnpm start
 * ```
 *
 * 如何修改为自己的 MCP 服务：
 * 只需要修改 serviceName 和 config 变量即可。
 * 例如，如果要使用自己的 MCP 服务，可以将配置改为：
 *
 * const serviceName = "my-service";    // 服务名称
 * const config = {
 *   type: "stdio",      // 传输类型，stdio 表示通过标准输入输出通信
 *   command: "node",                   // 执行命令
 *   args: ["./my-mcp-server.js"]       // 命令参数
 * };
 * const connection = new MCPConnection(serviceName, config);
 *
 * 或者使用 npx 安装远程 MCP 服务：
 *
 * const serviceName = "my-service";
 * const config = {
 *   type: "stdio",
 *   command: "npx",
 *   args: ["-y", "@xiaozhi-client/my-mcp@1.0.0"]  // -y 表示自动确认安装
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
  console.log("=== stdio MCP 连接示例 ===\n");

  // 2. 创建连接实例
  const connection = new MCPConnection(
    "calculator",
    {
      type: "stdio",
      command: "npx",
      args: ["-y", "@xiaozhi-client/calculator-mcp"],
    },
    createStandardCallbacks()
  );

  try {
    // 3. 建立连接
    console.log("正在连接到服务...");
    console.log("(首次运行可能需要下载 MCP 服务包，请耐心等待...)");
    console.log();

    await connection.connect();

    // 4. 获取工具列表
    const tools = connection.getTools();
    printTools(tools);

    // 5. 调用工具
    console.log("调用工具: calculator");
    console.log("参数: { expression: '1 + 1' }");

    const result = await connection.callTool("calculator", {
      expression: "1 + 1",
    });

    console.log();
    console.log("结果:");
    // 工具调用结果是一个包含 content 数组的对象
    // content[0].text 包含实际的结果文本
    if (result.content && result.content.length > 0) {
      const firstItem = result.content[0];
      if (firstItem.type === "text" && firstItem.text) {
        console.log(`  ${firstItem.text}`);
      }
    }
    console.log();

    // 6. 再调用一次，展示更多计算
    console.log("再调用一次: calculator");
    console.log("参数: { expression: '2 * 3 + 4' }");

    const result2 = await connection.callTool("calculator", {
      expression: "2 * 3 + 4",
    });

    console.log();
    console.log("结果:");
    if (result2.content && result2.content.length > 0) {
      const firstItem = result2.content[0];
      if (firstItem.type === "text" && firstItem.text) {
        console.log(`  ${firstItem.text}`);
      }
    }
    console.log();

    // 7. 检查连接状态
    printConnectionStatus(connection);
  } catch (error) {
    handleStandardError(error);
  } finally {
    // 8. 断开连接
    console.log();
    console.log("正在断开连接...");
    await connection.disconnect();
    console.log();
    console.log("=== 示例结束 ===");
  }
}

// 运行主函数
runMain(main);
