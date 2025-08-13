#!/usr/bin/env node

/**
 * @deprecated 此文件已废弃，请使用新的 WebServer 统一启动方式
 *
 * Adaptive MCP Pipe - 自适应选择单端点或多端点模式
 * 根据配置自动选择使用 MCPPipe 或 MultiEndpointMCPPipe
 *
 * ⚠️  警告：此模块已在架构重构中被废弃
 * 新的启动方式：
 * - 前台模式：直接使用 WebServer
 * - 后台模式：使用 webServerStandalone.js
 *
 * 此文件仅作为备用方案保留，不应在正常流程中使用
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
  // 废弃警告
  logger.warn("⚠️  警告：adaptiveMCPPipe 已废弃，建议使用新的 WebServer 启动方式");
  logger.warn("新的启动方式：xiaozhi start 或 xiaozhi start --ui");
  logger.warn("此模块仅作为备用方案运行，可能在未来版本中移除");

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

  // 过滤无效端点
  const validEndpoints = endpoints.filter((endpoint) => {
    if (!endpoint || endpoint.includes("<请填写")) {
      logger.warn(`跳过无效端点: ${endpoint}`);
      return false;
    }
    return true;
  });

  if (validEndpoints.length === 0) {
    logger.warn("没有有效的 MCP 端点，将跳过小智服务端连接");
    logger.info("MCP 服务器功能仍然可用，可通过 Web 界面配置端点后重启服务");
    logger.info(
      '提示: 请运行 "xiaozhi config mcpEndpoint <your-endpoint-url>" 设置端点'
    );

    // 即使没有端点，也要启动 MCP 服务器代理
    await startMCPServerProxyOnly(mcpScript);
    return;
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

/**
 * 仅启动 MCP 服务器代理（不连接小智服务端）
 */
async function startMCPServerProxyOnly(mcpScript: string): Promise<void> {
  logger.info("启动 MCP 服务器代理（无小智服务端连接）");

  const { spawn } = await import("node:child_process");

  // 启动 MCP 服务器代理进程
  const mcpProcess = spawn("node", [mcpScript], {
    stdio: ["pipe", "inherit", "inherit"],
    env: {
      ...process.env,
      XIAOZHI_CONFIG_DIR: process.env.XIAOZHI_CONFIG_DIR || process.cwd(),
    },
  });

  // 设置信号处理器
  const cleanup = () => {
    logger.info("正在关闭 MCP 服务器代理...");
    if (mcpProcess && !mcpProcess.killed) {
      mcpProcess.kill("SIGTERM");
      setTimeout(() => {
        if (!mcpProcess.killed) {
          mcpProcess.kill("SIGKILL");
        }
      }, 5000);
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // 处理进程退出
  mcpProcess.on("exit", (code, signal) => {
    logger.warn(`MCP 服务器代理已退出，退出码: ${code}, 信号: ${signal}`);
    if (signal !== "SIGTERM" && signal !== "SIGKILL") {
      logger.error("MCP 服务器代理意外退出");
      process.exit(1);
    }
  });

  mcpProcess.on("error", (error) => {
    logger.error(`MCP 服务器代理错误: ${error.message}`);
    process.exit(1);
  });

  logger.info("MCP 服务器代理已启动，等待连接...");

  // 保持进程运行
  return new Promise<void>(() => {
    // 这个 Promise 永远不会 resolve，保持进程运行
  });
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
