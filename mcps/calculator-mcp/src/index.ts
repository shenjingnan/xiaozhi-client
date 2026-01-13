/**
 * MCP Calculator Server
 * 提供数学计算功能的 MCP 服务
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { evaluate } from "mathjs";
import { z } from "zod";

// 日志工具
const logger = {
  info: (message: string) => {
    const timestamp = new Date().toISOString();
    console.error(`${timestamp} - Calculator - INFO - ${message}`);
  },
  error: (message: string) => {
    const timestamp = new Date().toISOString();
    console.error(`${timestamp} - Calculator - ERROR - ${message}`);
  },
};

// 安全获取错误信息
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// 创建 MCP 服务器实例
const server = new McpServer({
  name: "@xiaozhi-client/calculator-mcp",
  version: "1.0.0",
});

// 注册计算器工具
server.tool(
  "calculator",
  "用于数学计算，计算 JavaScript 表达式的结果",
  {
    expression: z.string().describe("要计算的数学表达式"),
  },
  async ({ expression }) => {
    try {
      // 计算表达式
      const result = evaluate(expression);
      logger.info(`计算表达式: ${expression}, 结果: ${result}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              result,
            }),
          },
        ],
      };
    } catch (error) {
      logger.error(`计算错误: ${getErrorMessage(error)}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: getErrorMessage(error),
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Calculator MCP 服务已启动");
}

main().catch((error) => {
  logger.error(`启动服务失败: ${getErrorMessage(error)}`);
  process.exit(1);
});

export default server;
