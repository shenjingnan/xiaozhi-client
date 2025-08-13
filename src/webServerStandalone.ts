#!/usr/bin/env node

/**
 * WebServer 独立启动脚本
 * 用于后台模式启动，替代原有的 adaptiveMCPPipe 启动方式
 */

// 动态导入避免 CLI 代码执行
async function importModules() {
  const webServerModule = await import("./WebServer.js");
  const configModule = await import("./configManager.js");
  const loggerModule = await import("./logger.js");
  return {
    WebServer: webServerModule.WebServer,
    configManager: configModule.configManager,
    Logger: loggerModule.Logger
  };
}

import { spawn } from "node:child_process";

async function main() {
  const args = process.argv.slice(2);
  const openBrowser = args.includes("--open-browser");

  try {
    // 动态导入模块
    const { WebServer, configManager, Logger } = await importModules();

    const logger = new Logger().withTag("WEBSERVER_STANDALONE");

    // 初始化日志
    if (process.env.XIAOZHI_CONFIG_DIR) {
      logger.initLogFile(process.env.XIAOZHI_CONFIG_DIR);
      logger.enableFileLogging(true);
    }

    // 启动 WebServer
    const webServer = new WebServer();
    await webServer.start();

    logger.info("WebServer 启动成功");

    // 自动打开浏览器
    if (openBrowser) {
      const port = configManager.getWebUIPort();
      const url = `http://localhost:${port}`;
      await openBrowserUrl(url);
    }

    // 处理退出信号
    const cleanup = async () => {
      logger.info("正在停止 WebServer...");
      await webServer.stop();
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

  } catch (error) {
    console.error("WebServer 启动失败:", error);
    process.exit(1);
  }
}

/**
 * 打开浏览器URL
 */
async function openBrowserUrl(url: string): Promise<void> {
  try {
    const platform = process.platform;

    let command: string;
    let args: string[];

    if (platform === "darwin") {
      command = "open";
      args = [url];
    } else if (platform === "win32") {
      command = "start";
      args = ["", url];
    } else {
      command = "xdg-open";
      args = [url];
    }

    spawn(command, args, { detached: true, stdio: "ignore" });
    console.log(`已尝试打开浏览器: ${url}`);
  } catch (error) {
    console.warn("自动打开浏览器失败:", error);
  }
}

// 检查是否为直接执行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
