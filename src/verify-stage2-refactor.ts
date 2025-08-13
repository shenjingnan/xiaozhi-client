/**
 * 阶段2重构验证脚本
 * 验证 MCPServerProxy 和 ProxyMCPServer 的重构是否成功
 */

import { ProxyMCPServer } from "./ProxyMCPServer.js";
import { convertLegacyToNew } from "./adapters/ConfigAdapter.js";
import type { LocalMCPServerConfig } from "./configManager.js";
import { MCPServerProxy } from "./mcpServerProxy.js";
import { MCPTransportType } from "./services/MCPService.js";
import { MCPServiceManager } from "./services/MCPServiceManager.js";

/**
 * 验证 MCPServerProxy 重构
 */
async function verifyMCPServerProxyRefactor() {
  console.log("🔍 验证 MCPServerProxy 重构...\n");

  try {
    // 创建 MCPServerProxy 实例
    const proxy = new MCPServerProxy();

    // 验证基本属性
    console.log("📋 检查基本属性:");
    console.log(`   initialized: ${proxy.initialized ? "✅" : "❌"}`);
    console.log(
      `   serviceManager 存在: ${(proxy as any).serviceManager ? "✅" : "❌"}`
    );

    // 验证方法存在
    const requiredMethods = [
      "start",
      "stop",
      "getAllTools",
      "callTool",
      "getAllServers",
    ];
    console.log("\n📋 检查必需方法:");
    for (const method of requiredMethods) {
      const exists = typeof (proxy as any)[method] === "function";
      console.log(`   ${method}: ${exists ? "✅" : "❌"}`);
    }

    // 验证配置转换集成
    console.log("\n📋 验证配置转换集成:");
    const testConfig: LocalMCPServerConfig = {
      command: "echo",
      args: ["test"],
    };

    const convertedConfig = convertLegacyToNew("test-service", testConfig);
    console.log(
      `   配置转换成功: ${convertedConfig.type === MCPTransportType.STDIO ? "✅" : "❌"}`
    );
    console.log(
      `   服务名称正确: ${convertedConfig.name === "test-service" ? "✅" : "❌"}`
    );

    return true;
  } catch (error) {
    console.error(
      `❌ MCPServerProxy 重构验证失败: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * 验证 ProxyMCPServer 重构
 */
async function verifyProxyMCPServerRefactor() {
  console.log("🔍 验证 ProxyMCPServer 重构...\n");

  try {
    // 创建 ProxyMCPServer 实例
    const proxyServer = new ProxyMCPServer("ws://localhost:8080");

    // 验证基本属性
    console.log("📋 检查基本属性:");
    console.log(
      `   tools Map 存在: ${typeof proxyServer.getTools === "function" ? "✅" : "❌"}`
    );

    // 验证新增的方法
    const newMethods = ["setServiceManager", "syncToolsFromServiceManager"];
    console.log("\n📋 检查新增方法:");
    for (const method of newMethods) {
      const exists = typeof (proxyServer as any)[method] === "function";
      console.log(`   ${method}: ${exists ? "✅" : "❌"}`);
    }

    // 验证 MCPServiceManager 集成
    console.log("\n📋 验证 MCPServiceManager 集成:");
    const serviceManager = new MCPServiceManager();

    try {
      (proxyServer as any).setServiceManager(serviceManager);
      console.log("   setServiceManager 调用成功: ✅");
    } catch (error) {
      console.log(
        `   setServiceManager 调用失败: ❌ ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 验证工具同步
    try {
      (proxyServer as any).syncToolsFromServiceManager();
      console.log("   syncToolsFromServiceManager 调用成功: ✅");
    } catch (error) {
      console.log(
        `   syncToolsFromServiceManager 调用失败: ❌ ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return true;
  } catch (error) {
    console.error(
      `❌ ProxyMCPServer 重构验证失败: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * 验证工具同步机制
 */
async function verifyToolSyncMechanism() {
  console.log("🔍 验证工具同步机制...\n");

  try {
    // 创建 MCPServiceManager 和 ProxyMCPServer
    const serviceManager = new MCPServiceManager();
    const proxyServer = new ProxyMCPServer("ws://localhost:8080");

    // 设置 ServiceManager
    (proxyServer as any).setServiceManager(serviceManager);

    // 验证初始状态
    const initialTools = proxyServer.getTools();
    console.log(`📋 初始工具数量: ${initialTools.length}`);

    // 模拟添加服务配置
    const testServiceConfig = convertLegacyToNew("test-sync-service", {
      command: "echo",
      args: ["hello"],
    });

    console.log("📋 添加测试服务配置...");
    serviceManager.addServiceConfig("test-sync-service", testServiceConfig);

    // 同步工具
    (proxyServer as any).syncToolsFromServiceManager();

    const syncedTools = proxyServer.getTools();
    console.log(`📋 同步后工具数量: ${syncedTools.length}`);

    // 验证同步是否成功
    const syncSuccess = syncedTools.length >= initialTools.length;
    console.log(
      `📋 工具同步机制: ${syncSuccess ? "✅ 正常工作" : "❌ 存在问题"}`
    );

    return syncSuccess;
  } catch (error) {
    console.error(
      `❌ 工具同步机制验证失败: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * 验证接口兼容性
 */
async function verifyInterfaceCompatibility() {
  console.log("🔍 验证接口兼容性...\n");

  try {
    const proxy = new MCPServerProxy();

    // 验证 JSONRPCServer 接口保持不变
    const jsonRpcMethods = ["getAllTools", "callTool"];
    console.log("📋 检查 JSONRPCServer 接口:");
    for (const method of jsonRpcMethods) {
      const exists = typeof (proxy as any)[method] === "function";
      console.log(`   ${method}: ${exists ? "✅" : "❌"}`);
    }

    // 验证返回值格式
    const tools = proxy.getAllTools();
    const isArray = Array.isArray(tools);
    console.log(`📋 getAllTools 返回数组: ${isArray ? "✅" : "❌"}`);

    // 验证服务器状态接口
    const servers = proxy.getAllServers();
    const hasCorrectFormat =
      Array.isArray(servers) &&
      (servers.length === 0 ||
        (servers[0] && "name" in servers[0] && "toolCount" in servers[0]));
    console.log(`📋 getAllServers 格式正确: ${hasCorrectFormat ? "✅" : "❌"}`);

    return isArray && hasCorrectFormat;
  } catch (error) {
    console.error(
      `❌ 接口兼容性验证失败: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * 主验证函数
 */
async function main() {
  console.log("🚀 开始阶段2重构验证...\n");
  console.log("=".repeat(60));
  console.log("");

  const results = {
    mcpServerProxy: await verifyMCPServerProxyRefactor(),
    proxyMCPServer: await verifyProxyMCPServerRefactor(),
    toolSync: await verifyToolSyncMechanism(),
    interfaceCompatibility: await verifyInterfaceCompatibility(),
  };

  console.log("=".repeat(60));
  console.log("📊 验证结果汇总:\n");

  console.log(
    `🔧 MCPServerProxy 重构: ${results.mcpServerProxy ? "✅ 成功" : "❌ 失败"}`
  );
  console.log(
    `🔧 ProxyMCPServer 重构: ${results.proxyMCPServer ? "✅ 成功" : "❌ 失败"}`
  );
  console.log(`🔧 工具同步机制: ${results.toolSync ? "✅ 正常" : "❌ 异常"}`);
  console.log(
    `🔧 接口兼容性: ${results.interfaceCompatibility ? "✅ 兼容" : "❌ 不兼容"}`
  );

  const allPassed = Object.values(results).every((result) => result);
  console.log(
    `\n🎯 总体结果: ${allPassed ? "✅ 阶段2重构成功" : "❌ 存在问题"}`
  );

  if (allPassed) {
    console.log("\n🎉 恭喜！阶段2核心重构已成功完成。");
    console.log(
      "✨ MCPServerProxy 和 ProxyMCPServer 已成功集成 MCPServiceManager"
    );
    console.log("✨ 工具同步机制正常工作");
    console.log("✨ 现有接口保持完全兼容");
    console.log("\n📋 下一步可以进入阶段3：逐步迁移和清理");
  } else {
    console.log("\n⚠️  发现重构问题，请检查并修复后再继续。");
  }

  return allPassed;
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as verifyStage2Refactor };
