#!/usr/bin/env node

/**
 * MCPServiceManager 使用示例
 * 演示重构后的 MCPServiceManager 如何使用 MCPService 实例
 */

import { type MCPServiceConfig, MCPTransportType } from "./MCPService.js";
import { MCPServiceManager } from "./MCPServiceManager.js";

async function main() {
  console.log("🚀 MCPServiceManager 重构版本使用示例");

  // 使用默认配置创建管理器
  const manager = new MCPServiceManager();

  try {
    console.log("📡 正在启动所有 MCP 服务...");

    // 启动所有服务
    await manager.startAllServices();
    console.log("✅ 所有服务启动成功！");

    // 获取管理器状态
    const status = manager.getStatus();
    console.log("📊 管理器状态:", {
      totalServices: Object.keys(status.services).length,
      totalTools: status.totalTools,
      services: Object.keys(status.services),
    });

    // 获取所有可用工具
    const tools = manager.getAllTools();
    console.log(
      "🛠️  可用工具:",
      tools.map((tool) => ({
        name: tool.name,
        serviceName: tool.serviceName,
        originalName: tool.originalName,
        description: tool.description,
      }))
    );

    // 调用工具（如果有的话）
    if (tools.length > 0) {
      const firstTool = tools[0];
      console.log(`🔧 调用工具: ${firstTool.name}`);

      try {
        // 根据工具类型调用不同的参数
        let args = {};
        if (firstTool.originalName === "add") {
          args = { a: 10, b: 5 };
        } else if (firstTool.originalName === "multiply") {
          args = { a: 3, b: 7 };
        } else if (firstTool.originalName === "get_current_time") {
          args = {};
        }

        const result = await manager.callTool(firstTool.name, args);
        console.log("📋 工具调用结果:", result);
      } catch (error) {
        console.error("❌ 工具调用失败:", error);
      }
    }

    // 演示单个服务管理
    console.log("🔄 演示单个服务管理...");

    // 停止一个服务
    await manager.stopService("calculator");
    console.log("⏹️  calculator 服务已停止");

    // 重新启动服务
    await manager.startService("calculator");
    console.log("▶️  calculator 服务已重启");

    // 演示配置管理
    console.log("⚙️  演示配置管理...");

    // 添加新的服务配置
    const newConfig: MCPServiceConfig = {
      name: "test-service",
      type: MCPTransportType.STDIO,
      command: "echo",
      args: ["Hello from test service"],
    };

    manager.addServiceConfig("test-service", newConfig);
    console.log("➕ 已添加新的服务配置: test-service");

    // 获取服务实例
    const calculatorService = manager.getService("calculator");
    if (calculatorService) {
      const serviceStatus = calculatorService.getStatus();
      console.log("🔍 Calculator 服务详细状态:", {
        name: serviceStatus.name,
        connected: serviceStatus.connected,
        toolCount: serviceStatus.toolCount,
        connectionState: serviceStatus.connectionState,
      });
    }

    // 演示向后兼容性
    console.log("🔄 验证向后兼容性...");
    const finalStatus = manager.getStatus();
    console.log("📈 最终状态 (向后兼容格式):", {
      services: finalStatus.services,
      totalTools: finalStatus.totalTools,
      availableToolsCount: finalStatus.availableTools.length,
    });
  } catch (error) {
    console.error("❌ 操作失败:", error);
  } finally {
    // 停止所有服务
    console.log("🔌 停止所有服务...");
    await manager.stopAllServices();
    console.log("👋 示例结束");
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };
