#!/usr/bin/env node

/**
 * 简单的 MCP 客户端脚本
 * 专门用于连接和测试 streamableHTTP 类型的 MCP 服务
 *
 * 使用方法：
 * npx tsx scripts/simple-mcp-client.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * 日志级别类型
 */
type LogLevel = "info" | "success" | "error" | "warn" | "debug";

/**
 * MCP 服务配置接口
 */
interface MCPConfig {
  name: string;
  url: string;
  clientInfo: {
    name: string;
    version: string;
  };
}

/**
 * 工具参数 Schema 接口
 */
interface ToolParameterSchema {
  type?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * 工具输入 Schema 接口
 */
interface ToolInputSchema {
  type?: string;
  properties?: Record<string, ToolParameterSchema>;
  required?: string[];
  [key: string]: unknown;
}

/**
 * MCP 工具接口
 */
interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: ToolInputSchema;
}

/**
 * 工具列表响应接口
 */
interface ListToolsResponse {
  tools: MCPTool[];
}

/**
 * MCP 服务配置（硬编码）
 */
const MCP_CONFIG: MCPConfig = {
  name: "xiaozhi-client",
  url: "http://localhost:9999/mcp",
  clientInfo: {
    name: "xiaozhi-simple-client",
    version: "1.0.0",
  },
};

/**
 * 日志工具函数
 */
function log(level: LogLevel, message: string, data: unknown = null): void {
  const timestamp = new Date().toISOString();
  const prefix: Record<LogLevel, string> = {
    info: "📡",
    success: "✅",
    error: "❌",
    warn: "⚠️",
    debug: "🔍",
  };

  console.log(`${prefix[level] || "📝"} [${timestamp}] ${message}`);
  if (data) {
    console.log("   数据:", JSON.stringify(data, null, 2));
  }
}

/**
 * 创建 MCP 客户端
 */
function createMCPClient(): Client {
  log("info", "创建 MCP 客户端...");

  // 创建客户端实例
  const client = new Client(
    {
      name: MCP_CONFIG.clientInfo.name,
      version: MCP_CONFIG.clientInfo.version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  log("success", "客户端创建成功");
  return client;
}

/**
 * 创建 StreamableHTTP 传输层
 */
function createTransport(): StreamableHTTPClientTransport {
  log("info", `创建 StreamableHTTP 传输层: ${MCP_CONFIG.url}`);

  try {
    const url = new URL(MCP_CONFIG.url);
    const transport = new StreamableHTTPClientTransport(url, {
      // 将头部放在 requestInit 中，这是正确的格式
      requestInit: {
        headers: {
          "MCP-Protocol-Version": "2024-11-05",
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
      },
    });

    log("success", "StreamableHTTP 传输层创建成功");
    return transport;
  } catch (error) {
    log("error", "创建传输层失败", { error: (error as Error).message });
    throw error;
  }
}

/**
 * 连接到 MCP 服务
 */
async function connectToMCPService(
  client: Client,
  transport: StreamableHTTPClientTransport
): Promise<boolean> {
  log("info", "正在连接到 MCP 服务...");

  try {
    await client.connect(transport);
    log("success", "成功连接到 MCP 服务");
    return true;
  } catch (error) {
    log("error", "连接 MCP 服务失败", { error: (error as Error).message });
    return false;
  }
}

/**
 * 获取并显示工具列表
 */
async function listTools(client: Client): Promise<MCPTool[]> {
  log("info", "获取工具列表...");

  try {
    const response = (await client.listTools()) as ListToolsResponse;

    if (response?.tools) {
      log("success", `发现 ${response.tools.length} 个工具`);

      console.log("\n🛠️  可用工具列表:");
      console.log("=".repeat(50));

      response.tools.forEach((tool, index) => {
        console.log(`\n${index + 1}. ${tool.name}`);
        console.log(`   描述: ${tool.description || "无描述"}`);

        if (tool.inputSchema?.properties) {
          console.log("   参数:");
          for (const [param, schema] of Object.entries(
            tool.inputSchema.properties
          )) {
            const required = tool.inputSchema.required?.includes(param)
              ? " (必需)"
              : " (可选)";
            const typedSchema = schema as ToolParameterSchema;
            console.log(
              `     - ${param}${required}: ${typedSchema.description || typedSchema.type || "未知类型"}`
            );
          }
        }
      });

      console.log("=".repeat(50));
      return response.tools;
    }
    log("warn", "未找到任何工具");
    return [];
  } catch (error) {
    log("error", "获取工具列表失败", { error: (error as Error).message });
    return [];
  }
}

/**
 * 获取服务器信息
 */
async function getServerInfo(client: Client): Promise<unknown> {
  log("info", "获取服务器信息...");

  try {
    // 尝试获取服务器信息（如果支持的话）
    const serverInfo = (client as any).getServerVersion?.() || null;
    if (serverInfo) {
      log("success", "服务器信息获取成功", serverInfo);
    } else {
      log("info", "服务器未提供版本信息");
    }
    return serverInfo;
  } catch (error) {
    log("warn", "获取服务器信息失败", { error: (error as Error).message });
    return null;
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("🚀 简单 MCP 客户端启动");
  console.log("=".repeat(60));

  log("info", "目标服务配置", {
    name: MCP_CONFIG.name,
    url: MCP_CONFIG.url,
    type: "streamableHTTP",
  });

  let client: Client | null = null;
  let transport: StreamableHTTPClientTransport | null = null;

  try {
    // 1. 创建客户端
    client = createMCPClient();

    // 2. 创建传输层
    transport = createTransport();

    // 3. 连接到服务
    const connected = await connectToMCPService(client, transport);

    if (!connected) {
      log("error", "连接失败，退出程序");
      process.exit(1);
    }

    // 4. 获取服务器信息
    await getServerInfo(client);

    // 5. 获取并显示工具列表
    const tools = await listTools(client);

    // 6. 显示连接摘要
    console.log("\n📊 连接摘要:");
    console.log("=".repeat(30));
    console.log(`✅ 服务名称: ${MCP_CONFIG.name}`);
    console.log("✅ 连接状态: 已连接");
    console.log("✅ 传输类型: streamableHTTP");
    console.log(`✅ 工具数量: ${tools.length}`);
    console.log(`✅ 服务地址: ${MCP_CONFIG.url}`);

    log("success", "MCP 客户端测试完成");
  } catch (error) {
    log("error", "程序执行失败", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    process.exit(1);
  } finally {
    // 清理资源
    if (client) {
      try {
        log("info", "正在断开连接...");
        await client.close();
        log("success", "连接已断开");
      } catch (error) {
        log("warn", "断开连接时出现错误", { error: (error as Error).message });
      }
    }
  }

  console.log("\n👋 程序结束");
}

// 错误处理
process.on("uncaughtException", (error: Error) => {
  log("error", "未捕获的异常", { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on(
  "unhandledRejection",
  (reason: unknown, promise: Promise<unknown>) => {
    log("error", "未处理的 Promise 拒绝", { reason, promise });
    process.exit(1);
  }
);

// 优雅退出处理
process.once("SIGINT", () => {
  log("info", "接收到 SIGINT 信号，正在退出...");
  process.exit(0);
});

process.once("SIGTERM", () => {
  log("info", "接收到 SIGTERM 信号，正在退出...");
  process.exit(0);
});

// 运行主函数
// 检查是否直接运行此脚本
const isMainModule = process.argv[1]?.endsWith("simple-mcp-client.ts") ?? false;
if (isMainModule) {
  main().catch((error: Error) => {
    log("error", "主函数执行失败", { error: error.message });
    process.exit(1);
  });
}

export { main };
