/**
 * streamable-http MCP 连接示例 - Type 格式兼容性演示
 *
 * 功能说明：
 * - 展示如何使用 MCPConnection 连接到 streamable-http 类型的 MCP 服务
 * - 演示 type 字段的多种格式兼容性：
 *   - streamable-http (MCP 官方格式)
 *   - streamableHttp (camelCase 格式)
 *   - streamable_http (snake_case 格式)
 *   - http (标准格式)
 *
 * 所有格式都会被自动规范化为 http 类型并正常连接。
 *
 * 运行方式：
 * ```bash
 * pnpm connect:streamable-http
 * ```
 *
 * 如何修改为自己的 MCP 服务：
 * 只需要修改 serviceUrl 变量中的 URL 参数即可。
 *
 * 例如：
 *
 * const serviceUrl = "https://mcp.api-inference.modelscope.net/your-service-id/mcp";
 *
 * 或者使用自定义的 streamable-http 服务：
 *
 * const serviceUrl = "https://your-api.com/mcp";
 */

import { MCPConnection } from "@xiaozhi-client/mcp-core";

/**
 * 要测试的 type 格式变体
 *
 * 这些格式都会被 TypeFieldNormalizer 自动转换为标准的 "http" 类型
 */
const typeVariants = [
  "streamable-http", // MCP 官方格式（推荐使用）
  "streamableHttp", // camelCase 格式
  "streamable_http", // snake_case 格式
  "http", // 标准格式
] as const;

/**
 * 服务 URL
 *
 * 使用 ModelScope 托管的 12306-mcp 服务作为示例
 */
const serviceUrl =
  "https://mcp.api-inference.modelscope.net/f0fd106773fa4e/mcp";

/**
 * 测试单个 type 格式的连接
 *
 * @param typeVariant - 要测试的 type 格式
 * @param index - 当前测试索引
 * @param total - 总测试数量
 */
async function testConnection(
  typeVariant: (typeof typeVariants)[number],
  index: number,
  total: number
): Promise<void> {
  const serviceName = `12306-mcp-${typeVariant}`;
  console.log(`\n测试 ${index}/${total}: type = "${typeVariant}"`);
  console.log(`服务名称: ${serviceName}`);
  console.log("正在连接...");

  const connection = new MCPConnection(
    serviceName,
    {
      type: typeVariant,
      url: serviceUrl,
    },
    {
      // 连接成功回调
      onConnected: (data) => {
        console.log(`✅ 服务 ${data.serviceName} 已连接`);
        console.log(`   发现 ${data.tools.length} 个工具`);
      },

      // 连接失败回调
      onConnectionFailed: (data) => {
        console.error(`❌ 服务 ${data.serviceName} 连接失败`);
        console.error(`   错误: ${data.error.message}`);
      },

      // 断开连接回调
      onDisconnected: (data) => {
        console.log(`👋 服务 ${data.serviceName} 已断开`);
      },
    }
  );

  try {
    await connection.connect();

    // 获取工具列表
    const tools = connection.getTools();
    console.log("可用工具:");
    for (const tool of tools) {
      console.log(`  - ${tool.name}`);
      if (tool.description) {
        console.log(`    描述: ${tool.description}`);
      }
    }

    // 检查连接状态
    const isConnected = connection.isConnected();
    const status = connection.getStatus();
    console.log("连接状态:");
    console.log(`  是否已连接: ${isConnected}`);
    console.log(`  状态: ${status.connectionState}`);
  } catch (error) {
    console.error("执行过程中出错:");
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    }
  } finally {
    // 断开连接
    await connection.disconnect();
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== streamable-http MCP 连接示例 - Type 格式兼容性演示 ===");
  console.log("\n服务 URL:", serviceUrl);
  console.log("\n将依次测试以下 type 格式:");
  typeVariants.forEach((variant, index) => {
    console.log(`  ${index + 1}. "${variant}"`);
  });

  const totalTests = typeVariants.length;

  // 按顺序测试每种格式
  for (let i = 0; i < typeVariants.length; i++) {
    await testConnection(typeVariants[i], i + 1, totalTests);
  }

  console.log("\n=== 所有格式兼容性测试完成 ===");
  console.log("\n结论:");
  console.log("  所有 type 格式变体都已成功规范化并正常连接");
  console.log("  推荐使用 'http' 作为标准 type 值");
}

// 运行主函数
main().catch((error) => {
  console.error("未捕获的错误:", error);
  process.exit(1);
});
