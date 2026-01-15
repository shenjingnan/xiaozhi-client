/**
 * 示例 03：日期时间服务完整示例
 *
 * 功能说明：
 * - 连接到 datetime-mcp 服务
 * - 展示所有日期时间相关工具
 * - 执行时间格式化、日期计算等操作
 *
 * 运行方式：
 * ```bash
 * pnpm run example:03
 * ```
 *
 * 依赖：
 * - @xiaozhi-client/datetime-mcp（通过 npx 自动安装）
 */

import { MCPConnection } from "@xiaozhi-client/mcp-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== 日期时间服务完整示例 ===\n");

  // 1. 创建服务配置
  const useLocal = process.env.USE_LOCAL_MCP === "true";
  const config = useLocal
    ? {
        name: "datetime",
        type: "stdio" as const,
        command: "node",
        args: [join(__dirname, "../../../mcps/datetime-mcp/run.js")],
        timeout: 30000,
      }
    : {
        name: "datetime",
        type: "stdio" as const,
        command: "npx",
        args: ["-y", "@xiaozhi-client/datetime-mcp"],
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
    console.log("正在连接到日期时间服务...");
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

    // 5. 获取当前时间（不同格式）
    console.log("获取当前时间（不同格式）:\n");

    const timeFormats = ["iso", "timestamp", "locale", "time-only"];
    for (const format of timeFormats) {
      process.stdout.write(`  ${format.padEnd(12)} `);
      try {
        const result = await connection.callTool("get_current_time", {
          format,
        });
        if (result.content && result.content.length > 0) {
          console.log(result.content[0].text);
        }
      } catch (error) {
        console.log("错误:", error instanceof Error ? error.message : String(error));
      }
    }

    console.log();

    // 6. 获取当前日期（不同格式）
    console.log("获取当前日期（不同格式）:\n");

    const dateFormats = ["iso", "locale", "date-only", "yyyy-mm-dd"];
    for (const format of dateFormats) {
      process.stdout.write(`  ${format.padEnd(12)} `);
      try {
        const result = await connection.callTool("get_current_date", {
          format,
        });
        if (result.content && result.content.length > 0) {
          console.log(result.content[0].text);
        }
      } catch (error) {
        console.log("错误:", error instanceof Error ? error.message : String(error));
      }
    }

    console.log();

    // 7. 日期计算 - 增加时间
    console.log("日期计算（增加时间）:\n");

    const timeAdditions = [
      { amount: 7, unit: "days", description: "7天后" },
      { amount: -7, unit: "days", description: "7天前" },
      { amount: 1, unit: "months", description: "1个月后" },
      { amount: 1, unit: "years", description: "1年后" },
      { amount: 12, unit: "hours", description: "12小时后" },
    ];

    for (const addition of timeAdditions) {
      process.stdout.write(`  ${addition.description.padEnd(15)} `);
      try {
        const result = await connection.callTool("add_time", {
          datetime: new Date().toISOString(),
          amount: addition.amount,
          unit: addition.unit,
        });
        if (result.content && result.content.length > 0) {
          console.log(result.content[0].text);
        }
      } catch (error) {
        console.log("错误:", error instanceof Error ? error.message : String(error));
      }
    }

    console.log();

    // 8. 格式化日期时间
    console.log("格式化日期时间:\n");

    const now = new Date().toISOString();
    const formatTests = [
      { format: "iso", description: "ISO 格式" },
      { format: "locale", description: "本地化格式" },
      { format: "timestamp", description: "Unix 时间戳" },
      { format: "yyyy-mm-dd", description: "YYYY-MM-DD 格式" },
    ];

    for (const test of formatTests) {
      process.stdout.write(`  ${test.description.padEnd(20)} `);
      try {
        const result = await connection.callTool("format_datetime", {
          datetime: now,
          format: test.format,
        });
        if (result.content && result.content.length > 0) {
          console.log(result.content[0].text);
        }
      } catch (error) {
        console.log("错误:", error instanceof Error ? error.message : String(error));
      }
    }

    console.log();

    // 9. 提示信息
    console.log("💡 提示：");
    console.log("   datetime-mcp 提供了丰富的日期时间处理功能");
    console.log("   支持多种时间格式和日期计算\n");

    // 10. 检查状态
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
    // 11. 断开连接
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
