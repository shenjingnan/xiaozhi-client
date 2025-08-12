#!/usr/bin/env node

/**
 * MCP Service Ping功能演示
 * 展示如何使用ping监控功能
 */

import {
  MCPService,
  type MCPServiceConfig,
  MCPTransportType,
} from "./MCPService.js";

async function demonstratePingFeature() {
  console.log("🏓 MCP Service Ping功能演示\n");

  // 1. 创建带ping配置的服务
  const config: MCPServiceConfig = {
    name: "ping-demo-service",
    type: MCPTransportType.STDIO,
    command: "node",
    args: ["./templates/hello-world/mcpServers/datetime.js"],
    // 启用ping监控
    ping: {
      enabled: true,
      interval: 10000, // 10秒ping一次
      timeout: 3000, // 3秒超时
      maxFailures: 2, // 最大失败2次
      startDelay: 2000, // 连接成功后2秒开始ping
    },
  };

  const service = new MCPService(config);

  try {
    console.log("1. 创建MCP服务（启用ping监控）");
    console.log("   配置:", service.getPingOptions());
    console.log();

    console.log("2. 连接到MCP服务...");
    await service.connect();
    console.log("   ✅ 连接成功");
    console.log();

    console.log("3. 检查服务状态（包含ping信息）");
    let status = service.getStatus();
    console.log("   服务状态:", {
      connected: status.connected,
      pingEnabled: status.pingEnabled,
      pingFailureCount: status.pingFailureCount,
      isPinging: status.isPinging,
      lastPingTime: status.lastPingTime,
    });
    console.log();

    console.log("4. 等待ping监控启动...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    status = service.getStatus();
    console.log("   更新后的状态:", {
      connected: status.connected,
      pingEnabled: status.pingEnabled,
      pingFailureCount: status.pingFailureCount,
      isPinging: status.isPinging,
      lastPingTime: status.lastPingTime,
    });
    console.log();

    console.log("5. 演示ping配置管理");

    // 更新ping配置
    console.log("   更新ping间隔为5秒...");
    service.updatePingOptions({ interval: 5000 });
    console.log("   新配置:", service.getPingOptions());
    console.log();

    // 暂时禁用ping
    console.log("   暂时禁用ping监控...");
    service.disablePing();
    status = service.getStatus();
    console.log("   状态:", { pingEnabled: status.pingEnabled });
    console.log();

    // 重新启用ping
    console.log("   重新启用ping监控...");
    service.enablePing();
    status = service.getStatus();
    console.log("   状态:", { pingEnabled: status.pingEnabled });
    console.log();

    console.log("6. 等待几个ping周期...");
    await new Promise((resolve) => setTimeout(resolve, 12000));

    status = service.getStatus();
    console.log("   最终状态:", {
      connected: status.connected,
      pingEnabled: status.pingEnabled,
      pingFailureCount: status.pingFailureCount,
      lastPingTime: status.lastPingTime,
    });
    console.log();

    console.log("7. 断开连接...");
    await service.disconnect();
    console.log("   ✅ 已断开连接");

    status = service.getStatus();
    console.log("   断开后状态:", {
      connected: status.connected,
      pingEnabled: status.pingEnabled,
    });
  } catch (error) {
    console.error("❌ 演示过程中发生错误:", error);
  }

  console.log("\n🎉 Ping功能演示完成！");
}

async function demonstrateDefaultBehavior() {
  console.log("\n📋 默认行为演示（ping禁用）\n");

  // 创建默认配置的服务（ping禁用）
  const defaultConfig: MCPServiceConfig = {
    name: "default-service",
    type: MCPTransportType.STDIO,
    command: "node",
    args: ["./templates/hello-world/mcpServers/datetime.js"],
    // 不配置ping，使用默认值（禁用）
  };

  const service = new MCPService(defaultConfig);

  try {
    console.log("1. 创建默认配置的MCP服务");
    const pingOptions = service.getPingOptions();
    console.log("   默认ping配置:", pingOptions);
    console.log("   注意：ping默认是禁用的，保持向后兼容性");
    console.log();

    console.log("2. 连接服务...");
    await service.connect();
    console.log("   ✅ 连接成功");
    console.log();

    console.log("3. 检查状态（ping应该是禁用的）");
    const status = service.getStatus();
    console.log("   状态:", {
      connected: status.connected,
      pingEnabled: status.pingEnabled,
    });
    console.log();

    console.log("4. 运行时启用ping...");
    service.enablePing();
    console.log("   ✅ ping已启用");
    console.log();

    console.log("5. 等待ping开始工作...");
    await new Promise((resolve) => setTimeout(resolve, 8000));

    const finalStatus = service.getStatus();
    console.log("   最终状态:", {
      connected: finalStatus.connected,
      pingEnabled: finalStatus.pingEnabled,
      lastPingTime: finalStatus.lastPingTime,
    });
    console.log();

    await service.disconnect();
    console.log("   ✅ 已断开连接");
  } catch (error) {
    console.error("❌ 默认行为演示中发生错误:", error);
  }

  console.log("\n✨ 默认行为演示完成！");
}

// 运行演示
async function main() {
  console.log("🚀 开始MCP Service Ping功能演示\n");

  try {
    await demonstratePingFeature();
    await demonstrateDefaultBehavior();
  } catch (error) {
    console.error("❌ 演示失败:", error);
    process.exit(1);
  }

  console.log("\n🎊 所有演示完成！");
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { demonstratePingFeature, demonstrateDefaultBehavior };
