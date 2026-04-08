/**
 * MCP 工具调用示例
 *
 * 功能说明：
 * - 展示如何连接到 MCP 服务并调用工具
 * - 展示如何获取工具列表和查看工具的参数结构
 * - 展示如何传递不同类型的参数（简单参数、复杂参数）
 * - 展示如何处理工具调用的返回结果
 * - 展示如何处理各种错误情况
 *
 * 运行方式：
 * ```bash
 * pnpm connect:call-tool
 * ```
 *
 * 如何修改为自己的 MCP 服务：
 * 只需要修改 serviceName 和 config 变量即可。
 *
 * 例如，如果要使用自己的 MCP 服务，可以将配置改为：
 *
 * const serviceName = "my-service";            // 服务名称
 * const config = {
 *   type: "http",                              // 传输类型
 *   url: "https://my-api.com/mcp"              // 服务 URL
 * };
 */

import { MCPConnection } from "@xiaozhi-client/mcp-core";
import {
  createDefaultCallbacks,
  printToolsWithSchema,
  printToolResult,
} from "./utils/connection-helpers";

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== MCP 工具调用示例 ===\n");

  // 创建连接实例
  const serviceName = "calculator";
  const connection = new MCPConnection(
    serviceName,
    {
      type: "stdio",
      command: "npx",
      args: ["-y", "@xiaozhi-client/calculator-mcp"],
    },
    createDefaultCallbacks(),
  );

  try {
    // 建立连接
    console.log("正在连接到服务...");
    console.log("(首次运行可能需要下载 MCP 服务包，请耐心等待...)");
    console.log();

    await connection.connect();

    // 获取工具列表（包含详细参数结构）
    printToolsWithSchema(connection.getTools());

    // 调用工具 - 简单参数
    console.log("--- 调用工具 1：简单参数 ---");
    console.log("工具: calculator");
    console.log("参数: { expression: '1 + 1' }");

    const result1 = await connection.callTool("calculator", {
      expression: "1 + 1",
    });

    console.log("结果:");
    printToolResult(result1);
    console.log();

    // 调用工具 - 复杂表达式
    console.log("--- 调用工具 2：复杂表达式 ---");
    console.log("工具: calculator");
    console.log("参数: { expression: '12 * 3 + 4' }");

    const result2 = await connection.callTool("calculator", {
      expression: "12 * 3 + 4",
    });

    console.log("结果:");
    printToolResult(result2);
    console.log();

    // 调用工具 - 多次调用同一个工具
    console.log("--- 调用工具 3：多次调用 ---");
    console.log("连续调用 3 次，计算不同的表达式:");

    const expressions = ["2 ** 8", "Math.sqrt(144)", "100 / 4 + 5"];
    for (const expr of expressions) {
      const result = await connection.callTool("calculator", {
        expression: expr,
      });
      console.log(`  ${expr} = ${result.content[0]?.text || "计算失败"}`);
    }
    console.log();

    // 错误处理示例 - 无效的参数
    console.log("--- 错误处理示例 1：无效参数 ---");
    console.log("尝试传递无效参数:");
    console.log("参数: { expression: 'invalid syntax ###' }");

    try {
      const errorResult = await connection.callTool("calculator", {
        expression: "invalid syntax ###",
      });
      console.log("结果:");
      printToolResult(errorResult);
    } catch (error) {
      console.error("捕获到错误:");
      if (error instanceof Error) {
        console.error(`  ${error.message}`);
      }
    }
    console.log();

    // 错误处理示例 - 不存在的工具
    console.log("--- 错误处理示例 2：不存在的工具 ---");
    console.log("尝试调用不存在的工具:");
    console.log("工具: non_existent_tool");

    try {
      await connection.callTool("non_existent_tool", {});
    } catch (error) {
      console.error("捕获到错误:");
      if (error instanceof Error) {
        console.error(`  ${error.message}`);
      }
    }
    console.log();
  } catch (error) {
    console.error("执行过程中出错:");
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    }
  } finally {
    // 断开连接
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