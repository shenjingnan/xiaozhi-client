#!/usr/bin/env node

/**
 * Adaptive MCP Pipe - 自适应选择单端点或多端点模式
 * 根据配置自动选择使用 MCPPipe 或 MultiEndpointMCPPipe
 */

import process from "node:process";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { configManager } from "./configManager.js";
import { logger as globalLogger } from "./logger.js";
import {
  MultiEndpointMCPPipe,
  setupSignalHandlers,
} from "./multiEndpointMCPPipe.js";

// Load environment variables
config();

// 为 Adaptive MCP Pipe 创建带标签的 logger
const logger = globalLogger.withTag("ADAPTIVE_MCP_PIPE");

// 如果在守护进程模式下运行，初始化日志文件
if (process.env.XIAOZHI_DAEMON === "true" && process.env.XIAOZHI_CONFIG_DIR) {
  globalLogger.initLogFile(process.env.XIAOZHI_CONFIG_DIR);
  globalLogger.enableFileLogging(true);
}

// Main function
export async function main() {
  if (process.argv.length < 3) {
    logger.error("用法: node adaptiveMCPPipe.js <mcp_script>");
    process.exit(1);
  }

  const mcpScript = process.argv[2];

  // 获取端点配置
  let endpoints: string[];

  try {
    // 调试信息 - 只在非守护进程模式下输出
    if (process.env.XIAOZHI_DAEMON !== "true") {
      try {
        process.stderr.write(
          `[DEBUG] XIAOZHI_CONFIG_DIR: ${process.env.XIAOZHI_CONFIG_DIR}\n`
        );
        process.stderr.write(`[DEBUG] process.cwd(): ${process.cwd()}\n`);
        process.stderr.write(
          `[DEBUG] configManager.getConfigPath(): ${configManager.getConfigPath()}\n`
        );
        process.stderr.write(
          `[DEBUG] configManager.configExists(): ${configManager.configExists()}\n`
        );
      } catch (error) {
        // 忽略写入错误
      }
    }

    // 首先尝试从配置文件读取
    if (configManager.configExists()) {
      endpoints = configManager.getMcpEndpoints();
      logger.info(`使用配置文件中的 MCP 端点（${endpoints.length} 个）`);
    } else {
      // 如果配置文件不存在，尝试从环境变量读取（向后兼容）
      const envEndpoint = process.env.MCP_ENDPOINT;
      if (!envEndpoint) {
        logger.error("配置文件不存在且未设置 MCP_ENDPOINT 环境变量");
        logger.error(
          '请运行 "xiaozhi init" 初始化配置，或设置 MCP_ENDPOINT 环境变量'
        );
        process.exit(1);
      }
      endpoints = [envEndpoint];
      logger.info("使用环境变量中的 MCP 端点（建议使用配置文件）");
    }
  } catch (error) {
    logger.error(
      `读取配置失败: ${error instanceof Error ? error.message : String(error)}`
    );

    // 尝试从环境变量读取作为备用方案
    const envEndpoint = process.env.MCP_ENDPOINT;
    if (!envEndpoint) {
      logger.error(
        '请运行 "xiaozhi init" 初始化配置，或设置 MCP_ENDPOINT 环境变量'
      );
      process.exit(1);
    }
    endpoints = [envEndpoint];
    logger.info("使用环境变量中的 MCP 端点作为备用方案");
  }

  // 验证端点
  if (endpoints.length === 0) {
    logger.error("没有配置任何 MCP 端点");
    process.exit(1);
  }

  // 过滤无效端点
  const validEndpoints = endpoints.filter((endpoint) => {
    if (!endpoint || endpoint.includes("<请填写")) {
      logger.warn(`跳过无效端点: ${endpoint}`);
      return false;
    }
    return true;
  });

  if (validEndpoints.length === 0) {
    logger.error("没有有效的 MCP 端点");
    logger.error(
      '请运行 "xiaozhi config mcpEndpoint <your-endpoint-url>" 设置端点'
    );
    process.exit(1);
  }

  // 统一使用 MultiEndpointMCPPipe 处理所有情况
  // 无论是单端点还是多端点，都作为数组处理，简化架构
  logger.info(
    validEndpoints.length === 1
      ? "启动单端点连接"
      : `启动多端点连接（${validEndpoints.length} 个端点）`
  );

  const mcpPipe = new MultiEndpointMCPPipe(mcpScript, validEndpoints);
  setupSignalHandlers(mcpPipe);

  try {
    await mcpPipe.start();
  } catch (error) {
    logger.error(
      `程序执行错误: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

// Run if this file is executed directly
const currentFileUrl = import.meta.url;
const scriptPath = fileURLToPath(currentFileUrl);
const argv1Path = process.argv[1];

if (scriptPath === argv1Path) {
  main().catch((error) => {
    logger.error(
      `未处理的错误: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
