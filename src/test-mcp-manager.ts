#!/usr/bin/env node

/**
 * MCPServiceManager 测试文件 - TypeScript 版本
 * 用于验证 MCP 服务管理器的核心功能
 */

import MCPServiceManager from "./services/MCPServiceManager.js";

async function testMCPServiceManager(): Promise<void> {
  console.log("=== MCP 服务管理器测试开始 ===\n");

  const manager = new MCPServiceManager();

  try {
    // 1. 启动所有 MCP 服务
    console.log("1. 启动所有 MCP 服务...");
    await manager.startAllServices();
    console.log("✅ 所有服务启动成功\n");

    // 等待服务完全启动
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 2. 获取服务状态
    console.log("2. 获取服务状态...");
    const status = manager.getStatus();
    console.log("服务状态:", JSON.stringify(status, null, 2));
    console.log("✅ 状态获取成功\n");

    // 3. 获取所有可用工具
    console.log("3. 获取所有可用工具...");
    const tools = manager.getAllTools();
    console.log(`发现 ${tools.length} 个工具:`);
    for (const tool of tools) {
      console.log(
        `  - ${tool.name} (${tool.serviceName}): ${tool.description}`
      );
    }
    console.log("✅ 工具列表获取成功\n");

    // 4. 测试 calculator 服务工具
    console.log("4. 测试 calculator 服务...");
    try {
      const calcResult = await manager.callTool("calculator__calculator", {
        javascript_expression: "2 + 3 * 4",
      });
      console.log("计算结果:", calcResult);
      console.log("✅ calculator 工具调用成功\n");
    } catch (error) {
      console.error("❌ calculator 工具调用失败:", (error as Error).message);
    }

    // 5. 测试 datetime 服务工具
    console.log("5. 测试 datetime 服务...");

    // 测试获取当前时间
    try {
      const timeResult = await manager.callTool("datetime__get_current_time", {
        format: "iso",
      });
      console.log("当前时间结果:", timeResult);
      console.log("✅ get_current_time 工具调用成功");
    } catch (error) {
      console.error(
        "❌ get_current_time 工具调用失败:",
        (error as Error).message
      );
    }

    // 测试获取当前日期
    try {
      const dateResult = await manager.callTool("datetime__get_current_date", {
        format: "yyyy-mm-dd",
      });
      console.log("当前日期结果:", dateResult);
      console.log("✅ get_current_date 工具调用成功");
    } catch (error) {
      console.error(
        "❌ get_current_date 工具调用失败:",
        (error as Error).message
      );
    }

    // 测试时间格式化
    try {
      const formatResult = await manager.callTool("datetime__format_datetime", {
        datetime: "2024-01-01T12:00:00Z",
        format: "locale",
      });
      console.log("时间格式化结果:", formatResult);
      console.log("✅ format_datetime 工具调用成功");
    } catch (error) {
      console.error(
        "❌ format_datetime 工具调用失败:",
        (error as Error).message
      );
    }

    // 测试时间加减
    try {
      const addTimeResult = await manager.callTool("datetime__add_time", {
        datetime: "2024-01-01T12:00:00Z",
        amount: 7,
        unit: "days",
      });
      console.log("时间加减结果:", addTimeResult);
      console.log("✅ add_time 工具调用成功\n");
    } catch (error) {
      console.error("❌ add_time 工具调用失败:", (error as Error).message);
    }

    // 6. 再次获取状态确认服务正常
    console.log("6. 最终状态检查...");
    const finalStatus = manager.getStatus();
    console.log("最终状态:", JSON.stringify(finalStatus, null, 2));
    console.log("✅ 最终状态检查完成\n");

    console.log("=== 所有测试完成 ===");
  } catch (error) {
    console.error("❌ 测试过程中发生错误:", (error as Error).message);
    console.error("错误堆栈:", (error as Error).stack);
  } finally {
    // 7. 清理资源
    console.log("\n7. 清理资源...");
    await manager.stopAllServices();
    console.log("✅ 资源清理完成");
  }
}

// 运行测试
testMCPServiceManager().catch((error: Error) => {
  console.error("测试失败:", error);
  process.exit(1);
});
