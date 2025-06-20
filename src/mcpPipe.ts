#!/usr/bin/env node

/**
 * MCP Pipe - JavaScript Implementation
 * Connects to MCP server and pipes input/output to WebSocket endpoint
 * d
 * Version: 0.2.0
 *
 * Usage:
 * export MCP_ENDPOINT=<mcp_endpoint>
 * node mcp_pipe.js <mcp_script>
 */

import { type ChildProcess, spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import WebSocket from "ws";
import { configManager } from "./configManager";

// Load environment variables
config();

// Logger utility
export class Logger {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  info(message: string): void {
    const timestamp = new Date().toISOString();
    console.error(`${timestamp} - ${this.name} - INFO - ${message}`);
  }

  error(message: string): void {
    const timestamp = new Date().toISOString();
    console.error(`${timestamp} - ${this.name} - ERROR - ${message}`);
  }

  warning(message: string): void {
    const timestamp = new Date().toISOString();
    console.error(`${timestamp} - ${this.name} - WARNING - ${message}`);
  }

  debug(message: string): void {
    const timestamp = new Date().toISOString();
    console.error(`${timestamp} - ${this.name} - DEBUG - ${message}`);
  }
}

const logger = new Logger("MCP_PIPE");

// Reconnection settings - 从配置文件读取，有默认值兜底
let reconnectAttempt = 0;

export class MCPPipe {
  private mcpScript: string;
  private endpointUrl: string;
  private process: ChildProcess | null;
  private websocket: WebSocket | null;
  private shouldReconnect: boolean;
  private isConnected: boolean;
  private shutdownResolve?: () => void;
  private heartbeatTimer?: NodeJS.Timeout;
  private heartbeatTimeoutTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private mcpProcessRestartAttempts: number;
  private connectionConfig: {
    heartbeatInterval: number;
    heartbeatTimeout: number;
    reconnectInterval: number;
  };

  constructor(mcpScript: string, endpointUrl: string) {
    this.mcpScript = mcpScript;
    this.endpointUrl = endpointUrl;
    this.process = null;
    this.websocket = null;
    this.shouldReconnect = true;
    this.isConnected = false;
    this.mcpProcessRestartAttempts = 0;
    
    // 获取连接配置，如果配置文件不存在则使用默认值
    try {
      this.connectionConfig = configManager.getConnectionConfig();
      logger.info(
        `连接配置: 心跳间隔=${this.connectionConfig.heartbeatInterval}ms, ` +
        `心跳超时=${this.connectionConfig.heartbeatTimeout}ms, ` +
        `重连间隔=${this.connectionConfig.reconnectInterval}ms`
      );
    } catch (error) {
      // 如果无法获取配置（如配置文件不存在），使用默认值
      this.connectionConfig = {
        heartbeatInterval: 30000,
        heartbeatTimeout: 10000,
        reconnectInterval: 5000,
      };
      logger.warning(
        `无法获取连接配置，使用默认值: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async start() {
    // Start MCP script process
    this.startMCPProcess();

    // Start WebSocket connection
    await this.connectToServer();

    // Keep the process running
    return new Promise<void>((resolve) => {
      // This promise will only resolve when shutdown is called
      this.shutdownResolve = resolve;
    });
  }

  async connectToServer() {
    if (this.isConnected) {
      return;
    }

    logger.info("Connecting to WebSocket server...");

    this.websocket = new WebSocket(this.endpointUrl);

    this.websocket.on("open", () => {
      logger.info("Successfully connected to WebSocket server");
      this.isConnected = true;

      // Reset reconnection counter
      reconnectAttempt = 0;
      this.mcpProcessRestartAttempts = 0;

      // 启动心跳检测
      this.startHeartbeat();
    });

    this.websocket.on("message", (data: WebSocket.Data) => {
      const message = data.toString();
      logger.debug(`<< ${message.substring(0, 120)}...`);

      // Write to process stdin
      if (this.process?.stdin && !this.process.stdin.destroyed) {
        this.process.stdin.write(`${message}\n`);
      }
    });

    this.websocket.on("close", (code: number, reason: Buffer) => {
      logger.error(`WebSocket connection closed: ${code} ${reason}`);
      this.isConnected = false;
      this.websocket = null;

      // 停止心跳检测
      this.stopHeartbeat();

      // Only reconnect if we should and it's not a permanent error
      if (this.shouldReconnect && code !== 4004) {
        this.scheduleReconnect();
      }
    });

    this.websocket.on("error", (error: Error) => {
      logger.error(`WebSocket error: ${error.message}`);
      this.isConnected = false;

      // 网络错误时停止心跳检测
      this.stopHeartbeat();
    });

    // 添加 pong 响应处理
    this.websocket.on("pong", () => {
      // 收到 pong 响应，清除心跳超时定时器
      if (this.heartbeatTimeoutTimer) {
        clearTimeout(this.heartbeatTimeoutTimer);
        this.heartbeatTimeoutTimer = undefined;
      }
    });
  }

  scheduleReconnect() {
    if (!this.shouldReconnect) return;

    // 清除之前的重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    reconnectAttempt++;

    logger.info(
      `Scheduling reconnection attempt ${reconnectAttempt} in ${(this.connectionConfig.reconnectInterval / 1000).toFixed(2)} seconds...`
    );

    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        // 如果MCP进程不存在，先尝试重启
        if (!this.process || this.process.killed) {
          logger.info("MCP process not running, attempting to restart...");
          this.restartMCPProcess();
        }
        this.connectToServer();
      }
    }, this.connectionConfig.reconnectInterval);
  }

  // 心跳检测机制
  private startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        // 发送 ping 并设置超时检测
        this.websocket.ping();

        // 设置心跳超时检测
        this.heartbeatTimeoutTimer = setTimeout(() => {
          logger.warning("Heartbeat timeout, connection may be lost");
          // 心跳超时，主动关闭连接触发重连
          if (this.websocket) {
            this.websocket.terminate();
          }
        }, this.connectionConfig.heartbeatTimeout);
      }
    }, this.connectionConfig.heartbeatInterval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = undefined;
    }
  }

  // MCP进程重启功能
  private restartMCPProcess() {
    if (this.mcpProcessRestartAttempts >= 3) {
      logger.error("MCP process restart attempts exceeded, giving up");
      return;
    }

    this.mcpProcessRestartAttempts++;
    logger.info(
      `Attempting to restart MCP process (attempt ${this.mcpProcessRestartAttempts})`
    );

    // 清理现有进程
    if (this.process) {
      try {
        this.process.kill("SIGTERM");
      } catch (error) {
        logger.warning(`Error killing existing MCP process: ${error}`);
      }
      this.process = null;
    }

    // 重新启动进程
    this.startMCPProcess();
  }

  startMCPProcess() {
    if (this.process) {
      logger.info(`${this.mcpScript} process already running`);
      return;
    }

    logger.info(`Starting ${this.mcpScript} process`);

    this.process = spawn("node", [this.mcpScript], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Handle process stdout - send to WebSocket
    this.process.stdout?.on("data", (data: Buffer) => {
      const message = data.toString();
      logger.debug(`>> ${message.substring(0, 120)}...`);

      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(message);
      }
    });

    // Handle process stderr - print to terminal
    this.process.stderr?.on("data", (data: Buffer) => {
      process.stderr.write(data);
    });

    // Handle process exit
    this.process.on(
      "exit",
      (code: number | null, signal: NodeJS.Signals | null) => {
        logger.warning(
          `${this.mcpScript} process exited with code ${code}, signal ${signal}`
        );
        this.process = null;

        // 如果不是主动关闭且应该重连，则尝试重启MCP进程
        if (
          this.shouldReconnect &&
          signal !== "SIGTERM" &&
          signal !== "SIGKILL"
        ) {
          logger.info(
            "MCP process unexpectedly exited, will attempt restart on next reconnection"
          );
          // 不立即重启，而是在下次重连时处理
        }
      }
    );

    // Handle process error
    this.process.on("error", (error: Error) => {
      logger.error(`Process error: ${error.message}`);
      this.process = null;

      // 进程错误时不停止重连，让重连机制处理
      if (this.shouldReconnect) {
        logger.info(
          "MCP process error occurred, will attempt restart on next reconnection"
        );
      }
    });
  }

  cleanup() {
    // 停止心跳检测
    this.stopHeartbeat();

    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.process) {
      logger.info(`Terminating ${this.mcpScript} process`);
      try {
        this.process.kill("SIGTERM");

        // Force kill after timeout
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill("SIGKILL");
          }
        }, 5000);
      } catch (error) {
        logger.error(
          `Error terminating process: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      this.process = null;
    }

    if (this.websocket) {
      try {
        this.websocket.close();
      } catch (error) {
        logger.warning(`Error closing websocket: ${error}`);
      }
      this.websocket = null;
    }

    this.isConnected = false;
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  shutdown() {
    logger.info("Shutting down MCP Pipe...");
    this.shouldReconnect = false;
    this.cleanup();
    if (this.websocket) {
      this.websocket.close();
    }
    if (this.shutdownResolve) {
      this.shutdownResolve();
    }
    process.exit(0);
  }
}

// Signal handlers
export function setupSignalHandlers(mcpPipe: MCPPipe): void {
  // 检查是否为守护进程模式
  const isDaemon = process.env.XIAOZHI_DAEMON === "true";

  process.on("SIGINT", () => {
    logger.info("Received interrupt signal, shutting down...");
    mcpPipe.shutdown();
  });

  process.on("SIGTERM", () => {
    logger.info("Received terminate signal, shutting down...");
    mcpPipe.shutdown();
  });

  // 守护进程模式下的额外信号处理
  if (isDaemon) {
    // 忽略 SIGHUP 信号（终端关闭）
    process.on("SIGHUP", () => {
      logger.info(
        "Received SIGHUP signal (terminal closed), continuing in daemon mode..."
      );
      // 守护进程不应该因为终端关闭而退出
    });

    // 处理未捕获的异常
    process.on("uncaughtException", (error) => {
      logger.error(`Uncaught exception in daemon mode: ${error.message}`);
      logger.error(error.stack || "No stack trace available");
      // 守护进程遇到未捕获的异常时不退出，而是继续运行
    });

    // 处理未处理的 Promise 拒绝
    process.on("unhandledRejection", (reason, promise) => {
      logger.error(`Unhandled promise rejection in daemon mode: ${reason}`);
      logger.error(`Promise: ${promise}`);
      // 守护进程遇到未处理的 Promise 拒绝时不退出
    });

    logger.info("Daemon mode signal handlers initialized");
  }
}

// Main execution
async function main() {
  // Check command line arguments
  if (process.argv.length < 3) {
    logger.error("Usage: node mcp_pipe.js <mcp_script>");
    process.exit(1);
  }

  const mcpScript = process.argv[2];

  // Get endpoint URL from config file or environment variable (fallback)
  let endpointUrl: string;

  try {
    // 调试信息 - 使用 process.stderr.write 确保能看到
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

    // 首先尝试从配置文件读取
    if (configManager.configExists()) {
      endpointUrl = configManager.getMcpEndpoint();
      logger.info("使用配置文件中的 MCP 端点");
    } else {
      // 如果配置文件不存在，尝试从环境变量读取（向后兼容）
      endpointUrl = process.env.MCP_ENDPOINT || "";
      if (!endpointUrl) {
        logger.error("配置文件不存在且未设置 MCP_ENDPOINT 环境变量");
        logger.error(
          '请运行 "xiaozhi init" 初始化配置，或设置 MCP_ENDPOINT 环境变量'
        );
        process.exit(1);
      }
      logger.info("使用环境变量中的 MCP 端点（建议使用配置文件）");
    }
  } catch (error) {
    logger.error(
      `读取配置失败: ${error instanceof Error ? error.message : String(error)}`
    );

    // 尝试从环境变量读取作为备用方案
    endpointUrl = process.env.MCP_ENDPOINT || "";
    if (!endpointUrl) {
      logger.error(
        '请运行 "xiaozhi init" 初始化配置，或设置 MCP_ENDPOINT 环境变量'
      );
      process.exit(1);
    }
    logger.info("使用环境变量中的 MCP 端点作为备用方案");
  }

  // 验证端点 URL
  if (!endpointUrl || endpointUrl.includes("<请填写")) {
    logger.error("MCP 端点未配置或配置无效");
    logger.error(
      '请运行 "xiaozhi config mcpEndpoint <your-endpoint-url>" 设置端点'
    );
    process.exit(1);
  }

  // Create MCP Pipe instance
  const mcpPipe = new MCPPipe(mcpScript, endpointUrl);

  // Setup signal handlers
  setupSignalHandlers(mcpPipe);

  // Start the MCP pipe
  try {
    await mcpPipe.start();
  } catch (error) {
    logger.error(
      `Program execution error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

// Run if this file is executed directly
// Use fileURLToPath to properly handle Windows paths
const currentFileUrl = import.meta.url;
const scriptPath = fileURLToPath(currentFileUrl);
const argv1Path = process.argv[1];

if (scriptPath === argv1Path) {
  main().catch((error) => {
    logger.error(
      `Unhandled error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
