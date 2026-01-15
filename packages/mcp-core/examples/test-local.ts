/**
 * 本地测试脚本 - 使用本地 MCP 服务路径
 */

import { MCPConnection } from "@xiaozhi-client/mcp-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取项目根目录
const projectRoot = join(__dirname, "../../../");

async function main(): Promise<void> {
  console.log("=== 本地 MCP 服务测试 ===\n");

  // 使用本地 MCP 服务路径
  const calculatorPath = join(projectRoot, "mcps/calculator-mcp/run.js");
  const datetimePath = join(projectRoot, "mcps/datetime-mcp/run.js");

  console.log("Calculator MCP 路径:", calculatorPath);
  console.log("DateTime MCP 路径:", datetimePath);
  console.log();

  // 测试 calculator-mcp
  console.log("测试 calculator-mcp...\n");

  const calculatorConfig = {
    name: "calculator",
    type: "stdio" as const,
    command: "node",
    args: [calculatorPath],
  };

  const connection = new MCPConnection(calculatorConfig, {
    onConnected: (data) => {
      console.log(`✅ 已连接到 ${data.serviceName}`);
      console.log(`   工具数量: ${data.tools.length}\n`);
    },
  });

  try {
    await connection.connect();

    const tools = connection.getTools();
    console.log("可用工具:");
    tools.forEach((t) => console.log(`  - ${t.name}: ${t.description}`));
    console.log();

    const result = await connection.callTool("calculator", {
      expression: "2 + 2",
    });
    console.log("2 + 2 =", result.content[0].text);

    await connection.disconnect();
  } catch (error) {
    console.error("错误:", error);
  }

  console.log("\n=== 测试完成 ===");
}

main().catch(console.error);
