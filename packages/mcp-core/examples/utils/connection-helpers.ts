/**
 * 示例文件共享辅助模块
 *
 * 功能说明：
 * - 提供通用的连接回调函数
 * - 提供工具列表打印函数
 * - 提供连接状态打印函数
 * - 提供示例运行框架函数
 *
 * 目的：
 * - 减少示例文件之间的重复代码
 * - 统一示例代码风格
 * - 降低维护成本
 */

import type { MCPServiceEventCallbacks, Tool } from "@xiaozhi-client/mcp-core";
import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { MCPConnection } from "../connection";
import type { MCPManager } from "../manager";

/**
 * 创建默认连接回调函数
 *
 * 提供标准的连接成功、失败、断开回调输出格式
 *
 * @returns MCPServiceEventCallbacks 回调对象
 */
export function createDefaultCallbacks(): MCPServiceEventCallbacks {
  return {
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
  };
}

/**
 * 打印工具列表
 *
 * 以统一格式输出工具名称和描述
 *
 * @param tools - 工具列表
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
 * 打印工具详细信息（包含参数结构）
 *
 * 以详细格式输出工具名称、描述和参数结构
 *
 * @param tools - 工具列表
 */
export function printToolsWithSchema(tools: Tool[]): void {
  console.log("可用工具:");
  for (const tool of tools) {
    console.log(`  - ${tool.name}`);
    if (tool.description) {
      console.log(`    描述: ${tool.description}`);
    }

    // 展示工具的输入参数结构
    if (tool.inputSchema) {
      console.log("    参数结构:");
      const schema = tool.inputSchema as {
        type: string;
        properties?: Record<string, { description?: string; type: string }>;
        required?: string[];
      };
      if (schema.properties) {
        for (const [paramName, paramInfo] of Object.entries(
          schema.properties,
        )) {
          const required = schema.required?.includes(paramName)
            ? "必填"
            : "可选";
          console.log(`      - ${paramName} (${required}, ${paramInfo.type})`);
          if (paramInfo.description) {
            console.log(`        ${paramInfo.description}`);
          }
        }
      }
    }
  }
  console.log();
}

/**
 * 打印连接状态
 *
 * 输出当前连接的状态信息
 *
 * @param connection - MCPConnection 实例
 */
export function printConnectionStatus(connection: MCPConnection): void {
  console.log("连接状态:");
  console.log(`  是否已连接: ${connection.isConnected()}`);
  const status = connection.getStatus();
  console.log(`  状态: ${status.connectionState}`);
  console.log();
}

/**
 * 打印工具调用结果
 *
 * 以统一格式输出工具调用的返回内容
 *
 * @param result - 工具调用结果
 */
export function printToolResult(
  result: CompatibilityCallToolResult,
): void {
  // 检查是否有错误标志
  if (result.isError) {
    console.log("  状态: 错误");
  }

  // 打印所有内容
  if (result.content && result.content.length > 0) {
    for (const item of result.content) {
      console.log(`  类型: ${item.type}`);
      if (item.type === "text") {
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
 * 运行 MCPConnection 示例的通用框架
 *
 * 提供标准的 try/catch/finally 模式处理连接和清理
 *
 * @param connection - MCPConnection 实例
 * @param operations - 可选的自定义操作函数
 */
export async function runExample(
  connection: MCPConnection,
  operations?: () => Promise<void>,
): Promise<void> {
  try {
    console.log("正在连接到服务...");
    console.log("(首次运行可能需要下载 MCP 服务包，请耐心等待...)");
    console.log();

    await connection.connect();

    printTools(connection.getTools());

    if (operations) {
      await operations();
    }

    printConnectionStatus(connection);
  } catch (error) {
    console.error("执行过程中出错:");
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    }
  } finally {
    console.log("正在断开连接...");
    await connection.disconnect();
    console.log();
    console.log("=== 示例结束 ===");
  }
}

/**
 * 运行 MCPManager 示例的通用框架
 *
 * 提供标准的 try/catch/finally 模式处理管理器连接和清理
 *
 * @param manager - MCPManager 实例
 * @param operations - 可选的自定义操作函数
 */
export async function runManagerExample(
  manager: MCPManager,
  operations?: () => Promise<void>,
): Promise<void> {
  try {
    console.log("正在连接到服务...");
    console.log("(首次运行可能需要下载 MCP 服务包，请耐心等待...)");
    console.log();

    await manager.connect();

    // 获取所有已连接的服务
    const connectedServers = manager.getConnectedServerNames();
    console.log("已连接的服务:");
    for (const serverName of connectedServers) {
      console.log(`  - ${serverName}`);
    }
    console.log();

    if (operations) {
      await operations();
    }

    // 查询服务状态
    console.log("服务状态:");
    const allStatus = manager.getAllServerStatus();
    for (const [serverName, status] of Object.entries(allStatus)) {
      console.log(`  【${serverName}】`);
      console.log(`    已连接: ${status.connected ? "是" : "否"}`);
      console.log(`    工具数: ${status.toolCount}`);
    }
    console.log();
  } catch (error) {
    console.error("执行过程中出错:");
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    }
  } finally {
    console.log("正在断开所有连接...");
    await manager.disconnect();
    console.log();
    console.log("=== 示例结束 ===");
  }
}

/**
 * 创建 MCPManager 的默认事件监听器
 *
 * 提供标准的 connect、connected、error、disconnected 事件输出格式
 *
 * @param manager - MCPManager 实例
 */
export function setupManagerEventListeners(manager: MCPManager): void {
  manager.on("connect", () => {
    console.log("🔄 开始连接所有服务...");
  });

  manager.on("connected", ({ serverName, tools }) => {
    console.log(`✅ 服务 ${serverName} 已连接`);
    console.log(`   发现 ${tools.length} 个工具`);
    console.log();
  });

  manager.on("error", ({ serverName, error }) => {
    console.error(`❌ 服务 ${serverName} 出错: ${error.message}`);
  });

  manager.on("disconnected", ({ serverName, reason }) => {
    console.log(`👋 服务 ${serverName} 已断开`);
    console.log(`   原因: ${reason || "正常关闭"}`);
  });

  manager.on("disconnect", () => {
    console.log("🔄 所有服务已断开");
  });
}

/**
 * 打印按服务分组的工具列表
 *
 * 以服务为分组输出工具列表，适用于 MCPManager 多服务场景
 *
 * @param allTools - 所有工具列表（包含 serverName 字段）
 */
export function printToolsByServer(
  allTools: Array<{ name: string; description?: string; serverName: string }>,
): void {
  console.log("各服务的工具列表:");
  console.log();

  // 按服务分组工具
  const toolsByServer: Record<string, typeof allTools> = {};
  for (const tool of allTools) {
    if (!toolsByServer[tool.serverName]) {
      toolsByServer[tool.serverName] = [];
    }
    toolsByServer[tool.serverName].push(tool);
  }

  // 打印每个服务的工具
  for (const [serverName, tools] of Object.entries(toolsByServer)) {
    console.log(`【${serverName}】`);
    console.log(`  工具数量: ${tools.length}`);
    console.log("  工具列表:");
    for (const tool of tools) {
      console.log(`    - ${tool.name}`);
      if (tool.description) {
        console.log(`      描述: ${tool.description}`);
      }
    }
    console.log();
  }
}

/**
 * 打印所有可用工具（跨服务）
 *
 * 以简单的列表形式输出所有工具，格式为 serverName/toolName
 *
 * @param allTools - 所有工具列表（包含 serverName 字段）
 */
export function printAllTools(
  allTools: Array<{ name: string; serverName: string }>,
): void {
  console.log("所有可用工具（跨服务）:");
  for (const tool of allTools) {
    console.log(`  ${tool.serverName}/${tool.name}`);
  }
  console.log();
}