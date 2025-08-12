#!/usr/bin/env node

/**
 * Streamable HTTP MCP 服务测试文件
 * 用于验证 streamable-http 协议的 MCP 服务配置和启动
 */

import MCPServiceManager from "./services/MCPServiceManager.js";
import { MCPTransportType } from "./services/MCPService.js";

async function testStreamableHttpService(): Promise<void> {
  console.log("=== Streamable HTTP MCP 服务测试开始 ===\n");

  const manager = new MCPServiceManager();

  try {
    // 1. 添加 streamable-http 服务配置
    console.log("1. 添加 streamable-http 服务配置...");
    const amapConfig = {
      name: "amap",
      type: MCPTransportType.STREAMABLE_HTTP,
      url: "https://mcp.amap.com/mcp?key=1ec31da021b2702787841ea4ee822de3",
    };
    
    manager.addServiceConfig("amap", amapConfig);
    console.log("✅ amap 服务配置添加成功\n");

    // 2. 启动所有 MCP 服务
    console.log("2. 启动所有 MCP 服务...");
    await manager.startAllServices();
    console.log("✅ 所有服务启动成功\n");

    // 等待服务完全启动
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 3. 获取服务状态
    console.log("3. 获取服务状态...");
    const status = manager.getStatus();
    console.log("服务状态:", JSON.stringify(status, null, 2));
    console.log("✅ 状态获取成功\n");

    // 4. 获取所有可用工具
    console.log("4. 获取所有可用工具...");
    const tools = manager.getAllTools();
    console.log(`发现 ${tools.length} 个工具:`);
    for (const tool of tools) {
      console.log(
        `  - ${tool.name} (${tool.serviceName}): ${tool.description}`
      );
    }
    console.log("✅ 工具列表获取成功\n");

    // 5. 测试 amap 服务工具（如果有的话）
    if (tools.length > 0) {
      console.log("5. 测试 amap 服务工具...");
      try {
        const firstTool = tools[0];
        console.log(`尝试调用工具: ${firstTool.name}`);
        
        // 根据工具的输入模式构造测试参数
        const testParams = {};
        if (firstTool.inputSchema && firstTool.inputSchema.properties) {
          for (const [key, prop] of Object.entries(firstTool.inputSchema.properties)) {
            if (typeof prop === 'object' && prop !== null && 'type' in prop) {
              switch (prop.type) {
                case 'string':
                  testParams[key] = 'test';
                  break;
                case 'number':
                  testParams[key] = 123;
                  break;
                case 'boolean':
                  testParams[key] = true;
                  break;
                default:
                  testParams[key] = 'test';
              }
            }
          }
        }
        
        const result = await manager.callTool(firstTool.name, testParams);
        console.log("工具调用结果:", result);
        console.log("✅ amap 工具调用成功\n");
      } catch (error) {
        console.error("❌ amap 工具调用失败:", (error as Error).message);
        console.log("这可能是正常的，因为我们使用的是测试参数\n");
      }
    } else {
      console.log("5. 没有发现可用工具，跳过工具测试\n");
    }

    // 6. 最终状态检查
    console.log("6. 最终状态检查...");
    const finalStatus = manager.getStatus();
    console.log("最终状态:", JSON.stringify(finalStatus, null, 2));
    console.log("✅ 最终状态检查完成\n");

    console.log("=== 所有测试完成 ===\n");

  } catch (error) {
    console.error("❌ 测试过程中发生错误:", (error as Error).message);
    console.error("错误堆栈:", (error as Error).stack);
  } finally {
    // 7. 清理资源
    console.log("7. 清理资源...");
    try {
      await manager.stopAllServices();
      console.log("✅ 资源清理完成");
    } catch (error) {
      console.error("❌ 资源清理失败:", (error as Error).message);
    }
  }
}

// 运行测试
testStreamableHttpService().catch((error) => {
  console.error("❌ 测试启动失败:", error);
  process.exit(1);
});
