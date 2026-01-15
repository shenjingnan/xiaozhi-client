/**
 * 示例 02：计算器服务完整示例
 *
 * 功能说明：
 * - 连接到 calculator-mcp 服务
 * - 展示所有可用的计算工具
 * - 执行多个计算示例（加减乘除、幂运算、三角函数等）
 * - 展示结果解析和格式化
 *
 * 运行方式：
 * ```bash
 * pnpm run example:02
 * ```
 *
 * 依赖：
 * - @xiaozhi-client/calculator-mcp（通过 npx 自动安装）
 */

import { MCPConnection } from "@xiaozhi-client/mcp-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 计算测试用例
 */
interface CalculationTest {
  expression: string;
  description: string;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== 计算器服务完整示例 ===\n");

  // 1. 创建服务配置
  const useLocal = process.env.USE_LOCAL_MCP === "true";
  const config = useLocal
    ? {
        name: "calculator",
        type: "stdio" as const,
        command: "node",
        args: [join(__dirname, "../../../mcps/calculator-mcp/run.js")],
        timeout: 30000,
      }
    : {
        name: "calculator",
        type: "stdio" as const,
        command: "npx",
        args: ["-y", "@xiaozhi-client/calculator-mcp"],
        timeout: 30000,
      };

  // 2. 创建连接实例
  const connection = new MCPConnection(config, {
    onConnected: (data) => {
      console.log(`✅ 已连接到 ${data.serviceName} 服务`);
      console.log(`   发现 ${data.tools.length} 个工具\n`);
    },
    onConnectionFailed: (data) => {
      console.error(`❌ 连接失败: ${data.error.message}`);
    },
    onDisconnected: (data) => {
      console.log(`👋 服务 ${data.serviceName} 已断开`);
    },
  });

  try {
    // 3. 建立连接
    console.log("正在连接到计算器服务...");
    console.log("(首次运行可能需要下载 MCP 服务包，请耐心等待...)\n");

    await connection.connect();

    // 4. 获取工具列表
    const tools = connection.getTools();
    console.log("可用工具:");
    tools.forEach((tool) => {
      console.log(`  📦 ${tool.name}`);
      console.log(`     ${tool.description}`);
    });
    console.log();

    // 5. 定义测试计算
    const calculations: CalculationTest[] = [
      { expression: "1 + 1", description: "基础加法" },
      { expression: "10 - 3", description: "基础减法" },
      { expression: "6 * 7", description: "基础乘法" },
      { expression: "100 / 4", description: "基础除法" },
      { expression: "2 ^ 10", description: "幂运算" },
      { expression: "sqrt(16)", description: "平方根" },
      { expression: "abs(-5)", description: "绝对值" },
      { expression: "sin(45 deg)", description: "正弦函数（45度）" },
      { expression: "cos(60 deg)", description: "余弦函数（60度）" },
      { expression: "tan(45 deg)", description: "正切函数（45度）" },
      { expression: "log(100)", description: "对数" },
      { expression: "pi", description: "圆周率" },
      { expression: "e", description: "自然常数" },
      {
        expression: "(1 + 2) * 3 - 4 / 2",
        description: "复杂表达式（括号优先级）",
      },
      { expression: "10 % 3", description: "取模运算" },
      { expression: "factorial(5)", description: "阶乘" },
    ];

    // 6. 执行计算
    console.log("执行计算测试:\n");

    for (const test of calculations) {
      process.stdout.write(`  ${test.description.padEnd(25)} `);
      process.stdout.write(`[${test.expression}] `);
      process.stdout.write(`= `);

      try {
        const result = await connection.callTool("calculator", {
          expression: test.expression,
        });

        if (result.content && result.content.length > 0) {
          console.log(result.content[0].text);
        }
      } catch (error) {
        console.log("错误:", error instanceof Error ? error.message : String(error));
      }
    }

    console.log();

    // 7. 交互式计算提示
    console.log("💡 提示：");
    console.log("   calculator-mcp 使用 mathjs 库进行计算");
    console.log("   支持常见的数学函数和表达式");
    console.log("   详细信息：https://mathjs.org/\n");

    // 8. 检查状态
    console.log("服务状态:");
    console.log(`  是否已连接: ${connection.isConnected()}`);
    const status = connection.getStatus();
    console.log(`  连接状态: ${status.connectionState}`);
    console.log();
  } catch (error) {
    console.error("执行过程中出错:");
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    }
  } finally {
    // 9. 断开连接
    console.log("正在断开连接...");
    await connection.disconnect();
    console.log("\n=== 示例结束 ===");
  }
}

// 运行主函数
main().catch((error) => {
  console.error("未捕获的错误:", error);
  process.exit(1);
});
