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
 *   type: MCPTransportType.STDIO,      // 传输类型，stdio 表示通过标准输入输出通信
 *   command: "node",                   // 执行命令
 *   args: ["./my-mcp-server.js"]       // 命令参数
 * };
 * const connection = new MCPConnection(serviceName, config);
 *
 * 或者使用 npx 安装远程 MCP 服务：
 *
 * const serviceName = "my-service";
 * const config = {
 *   type: MCPTransportType.STDIO,
 *   command: "npx",
 *   args: ["-y", "@xiaozhi-client/my-mcp@1.0.0"]  // -y 表示自动确认安装
 * };
 */

import { MCPConnection, MCPTransportType } from "@xiaozhi-client/mcp-core";

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== stdio MCP 连接示例 ===\n");

  // 1. 创建服务配置
  // 这里使用 calculator-mcp 作为示例服务
  const serviceName = "calculator";
  const config = {
    type: MCPTransportType.STDIO,
    command: "npx",
    args: ["-y", "@xiaozhi-client/calculator-mcp"],
  };

  console.log("配置信息:");
  console.log(`  服务名: ${serviceName}`);
  console.log(`  传输类型: ${config.type}`);
  console.log(`  命令: ${config.command}`);
  console.log(`  参数: ${config.args.join(" ")}`);
  console.log();

  // 2. 创建连接实例
  const connection = new MCPConnection(serviceName, config, {
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
    console.log("(首次运行可能需要下载 MCP 服务包，请耐心等待...)");
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
      console.log(`  ${result.content[0].text}`);
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
      console.log(`  ${result2.content[0].text}`);
    }
    console.log();

    // 7. 检查连接状态
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
    // 8. 断开连接
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
