#!/usr/bin/env node

/**
 * WebServer 测试文件
 * 用于验证 WebServer 的启动和 MCP 服务配置
 */

import { WebServer } from "./webServer.js";

async function testWebServer(): Promise<void> {
  console.log("=== WebServer 测试开始 ===\n");

  try {
    console.log("1. 创建 WebServer 实例...");
    const webServer = new WebServer();
    console.log("✅ WebServer 实例创建成功\n");

    console.log("2. 启动 WebServer...");
    await webServer.start();
    console.log("✅ WebServer 启动成功\n");

    console.log("3. 等待 5 秒钟让服务完全启动...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("4. 停止 WebServer...");
    await webServer.stop();
    console.log("✅ WebServer 停止成功\n");

    console.log("=== 所有测试完成 ===");

  } catch (error) {
    console.error("❌ 测试过程中发生错误:", (error as Error).message);
    console.error("错误堆栈:", (error as Error).stack);
  }
}

// 运行测试
testWebServer().catch((error) => {
  console.error("❌ 测试启动失败:", error);
  process.exit(1);
});
