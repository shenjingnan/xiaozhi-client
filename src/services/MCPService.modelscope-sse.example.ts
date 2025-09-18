#!/usr/bin/env node

/**
 * MCPService 使用示例
 * 演示如何使用新的 MCPService 类
 */

import {
  MCPService,
  type MCPServiceConfig,
  MCPTransportType,
} from "./MCPService.js";

async function main() {
  console.log("🚀 MCPService 使用示例");

  // 配置 MCP 服务
  const config: MCPServiceConfig = {
    name: "modelscope-test",
    type: MCPTransportType.SSE,
    url: "https://mcp.api-inference.modelscope.net/xxx/sse",
    apiKey: "<请填写apiKey>",
  };

  // 创建 MCPService 实例
  const service = new MCPService(config);

  try {
    console.log("📡 正在连接到 MCP 服务...");

    // 连接到服务
    await service.connect();
    console.log("✅ 连接成功！");

    // 获取服务状态
    const status = service.getStatus();
    console.log("📊 服务状态:", {
      name: status.name,
      connected: status.connected,
      initialized: status.initialized,
      toolCount: status.toolCount,
      connectionState: status.connectionState,
    });

    // 获取可用工具
    const tools = service.getTools();
    console.log(
      "🛠️  可用工具:",
      tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      }))
    );

    // 演示重连配置管理
    console.log("⚙️  当前重连配置:", service.getReconnectOptions());

    // 更新重连配置
    service.updateReconnectOptions({
      maxAttempts: 8,
      initialInterval: 1500,
    });
    console.log("🔄 更新后的重连配置:", service.getReconnectOptions());

    // 测试工具调用
    if (tools.length > 0) {
      console.log("🧪 测试工具调用...");
      try {
        const result = await service.callTool("getChineseCalendar", {
          date: "2025-08-12",
        });
        console.log("✅ 工具调用成功:", JSON.stringify(result, null, 2));
      } catch (error) {
        console.error("❌ 工具调用失败:", error);
      }
    }
  } catch (error) {
    console.error("❌ 连接失败:", error);
  } finally {
    // 断开连接
    console.log("🔌 断开连接...");
    await service.disconnect();
    console.log("👋 示例结束");
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };
