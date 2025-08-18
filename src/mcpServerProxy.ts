#!/usr/bin/env node

/**
 * MCP Server Proxy - 重构版
 * 现在基于 UnifiedMCPServer 和传输层抽象实现
 * 提供 Stdio 模式的 MCP 服务器，主要用于 Cursor 等客户端
 */

import { dirname } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { logger } from "./Logger";
import { configManager } from "./configManager";
import { ServerMode, createServer } from "./core/ServerFactory";

// ESM 兼容的 __dirname
const __dirname = dirname(fileURLToPath(import.meta.url));

// 使用全局 logger 实例

// 初始化日志文件
const logDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();
logger.initLogFile(logDir);
logger.enableFileLogging(true);
logger.info(`日志文件已初始化: ${logDir}/xiaozhi.log`);

/**
 * 主函数：启动 MCP 服务器代理
 */
async function main(): Promise<void> {
  try {
    logger.info("启动 MCP 服务器代理");

    // 加载配置
    await loadConfiguration();

    // 创建 Stdio 模式的统一服务器
    const server = await createServer({
      mode: ServerMode.STDIO,
      stdioConfig: {
        name: "mcp-proxy",
        encoding: "utf8",
      },
    });

    // 启动服务器
    await server.start();

    logger.info("MCP 服务器代理启动成功");

    // 处理进程退出信号
    process.on("SIGINT", async () => {
      logger.info("收到 SIGINT 信号，正在关闭服务器");
      await server.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      logger.info("收到 SIGTERM 信号，正在关闭服务器");
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error("启动 MCP 服务器代理失败:", error);
    process.exit(1);
  }
}

/**
 * 加载配置
 */
async function loadConfiguration(): Promise<void> {
  try {
    logger.info("加载 MCP 服务器配置");

    // 检查配置文件是否存在
    if (!configManager.configExists()) {
      logger.warn("配置文件不存在，将使用默认配置");
      return;
    }

    // 读取配置
    const config = configManager.getConfig();
    logger.info(
      `已加载配置，包含 ${Object.keys(config.mcpServers || {}).length} 个 MCP 服务器`
    );
  } catch (error) {
    logger.error("加载配置失败:", error);
    throw error;
  }
}

// 如果直接运行此脚本，则启动服务器
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error("MCP 服务器代理启动失败:", error);
    process.exit(1);
  });
}

// 导出主函数供其他模块使用
export { main };
