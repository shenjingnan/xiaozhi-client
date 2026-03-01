/**
 * 示例代码共享工具函数
 *
 * 提供跨多个示例文件的通用功能，避免代码重复
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { MCPConnection } from "@xiaozhi-client/mcp-core";

/**
 * 创建标准的事件回调处理器
 *
 * @returns 标准的连接事件回调对象
 */
export function createStandardCallbacks() {
  return {
    /**
     * 连接成功回调
     */
    onConnected: (data: {
      serviceName: string;
      tools: Tool[];
      connectionTime: Date;
    }) => {
      console.log(`✅ 服务 ${data.serviceName} 已连接`);
      console.log(`   发现 ${data.tools.length} 个工具`);
      console.log();
    },

    /**
     * 连接失败回调
     */
    onConnectionFailed: (data: {
      serviceName: string;
      error: Error;
      attempt: number;
    }) => {
      console.error(`❌ 服务 ${data.serviceName} 连接失败`);
      console.error(`   错误: ${data.error.message}`);
    },

    /**
     * 断开连接回调
     */
    onDisconnected: (data: {
      serviceName: string;
      reason?: string;
      disconnectionTime: Date;
    }) => {
      console.log(`👋 服务 ${data.serviceName} 已断开`);
      console.log(`   原因: ${data.reason || "正常关闭"}`);
    },
  };
}

/**
 * 打印工具列表
 *
 * @param tools - 工具列表数组
 */
export function printTools(tools: Tool[]): void {
  console.log("可用工具:");
  for (const tool of tools) {
    console.log(`  - ${tool.name}`);
    if (tool.description) {
      console.log(`    描述: ${tool.description}`);
    }
  }
  console.log();
}

/**
 * 标准错误处理
 *
 * @param error - 错误对象
 */
export function handleStandardError(error: unknown): void {
  console.error("执行过程中出错:");
  if (error instanceof Error) {
    console.error(`  ${error.message}`);
  }
}

/**
 * 打印工具调用结果
 *
 * @param result - 工具调用结果对象
 */
export function printToolResult(result: {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}): void {
  // 检查是否有错误标志
  if (result.isError) {
    console.log("  状态: 错误");
  }

  // 打印所有内容
  if (result.content && result.content.length > 0) {
    for (const item of result.content) {
      console.log(`  类型: ${item.type}`);
      if (item.type === "text" && item.text !== undefined) {
        console.log(`  内容: ${item.text}`);
      } else if (item.type === "image") {
        console.log("  内容: [图片数据]");
      } else {
        console.log(`  内容: ${JSON.stringify(item)}`);
      }
    }
  } else {
    console.log("  内容: [空]");
  }
}

/**
 * 打印连接状态信息
 *
 * @param connection - MCP 连接实例
 */
export function printConnectionStatus(connection: MCPConnection): void {
  console.log("连接状态:");
  console.log(`  是否已连接: ${connection.isConnected()}`);
  const status = connection.getStatus();
  console.log(`  状态: ${status.connectionState}`);
}

/**
 * 未捕获错误的统一处理函数
 *
 * @param error - 捕获的错误对象
 */
export function handleUncaughtError(error: unknown): void {
  console.error("未捕获的错误:", error);
  process.exit(1);
}

/**
 * 执行主函数并处理未捕获的错误
 *
 * @param mainFn - 主函数
 */
export function runMain(mainFn: () => Promise<void>): void {
  mainFn().catch(handleUncaughtError);
}
