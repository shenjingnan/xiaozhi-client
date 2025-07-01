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
import { logger as globalLogger } from "./logger";

// Load environment variables
config();

// 为 MCP_PIPE 创建带标签的 logger
const logger = globalLogger.withTag("MCP_PIPE");

// 如果在守护进程模式下运行，初始化日志文件
if (process.env.XIAOZHI_DAEMON === "true" && process.env.XIAOZHI_CONFIG_DIR) {
  globalLogger.initLogFile(process.env.XIAOZHI_CONFIG_DIR);
  globalLogger.enableFileLogging(true);
}

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
  private stdoutBuffer: string; // 添加缓冲区来处理分片消息
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
    this.stdoutBuffer = ""; // 初始化缓冲区

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
      logger.warn(
        `无法获取连接配置，使用默认值: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async start() {
    // Start MCP script process
    this.startMCPProcess();

    // Start WebSocket connection
    await this.connectToServer();

    // Report status to web UI
    this.reportStatusToWebUI();

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

    logger.info("正在连接 WebSocket 服务器...");

    this.websocket = new WebSocket(this.endpointUrl);

    this.websocket.on("open", () => {
      logger.info("成功连接到 WebSocket 服务器");
      this.isConnected = true;

      // Report status to web UI when connected
      this.reportStatusToWebUI();

      // Reset reconnection counter
      reconnectAttempt = 0;
      this.mcpProcessRestartAttempts = 0;

      // 启动心跳检测
      this.startHeartbeat();
    });

    this.websocket.on("message", (data: WebSocket.Data) => {
      const message = data.toString();
      logger.info(`<< WebSocket收到消息: ${message}`);

      // Write to process stdin
      if (this.process?.stdin && !this.process.stdin.destroyed) {
        this.process.stdin.write(`${message}\n`);
      }
    });

    this.websocket.on("close", (code: number, reason: Buffer) => {
      logger.error(`WebSocket 连接已关闭: ${code} ${reason}`);
      this.isConnected = false;
      this.websocket = null;

      // 停止心跳检测
      this.stopHeartbeat();

      // Report disconnected status to web UI
      this.reportStatusToWebUI();

      // Only reconnect if we should and it's not a permanent error
      if (this.shouldReconnect && code !== 4004) {
        this.scheduleReconnect();
      }
    });

    this.websocket.on("error", (error: Error) => {
      logger.error(`WebSocket 错误: ${error.message}`);
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
      `计划在 ${(this.connectionConfig.reconnectInterval / 1000).toFixed(2)} 秒后进行第 ${reconnectAttempt} 次重连尝试...`
    );

    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        // 如果MCP进程不存在，先尝试重启
        if (!this.process || this.process.killed) {
          logger.info("MCP 进程未运行，正在尝试重启...");
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
          logger.warn("心跳超时，连接可能已断开");
          // 心跳超时，主动关闭连接触发重连
          if (this.websocket) {
            this.websocket.terminate();
          }
        }, this.connectionConfig.heartbeatTimeout);

        // Report status to web UI periodically
        this.reportStatusToWebUI();
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
      logger.error("MCP 进程重启尝试次数超限，放弃重启");
      return;
    }

    this.mcpProcessRestartAttempts++;
    logger.info(
      `正在尝试重启 MCP 进程（第 ${this.mcpProcessRestartAttempts} 次尝试）`
    );

    // 清理现有进程
    if (this.process) {
      try {
        this.process.kill("SIGTERM");
      } catch (error) {
        logger.warn(`终止现有 MCP 进程时出错: ${error}`);
      }
      this.process = null;
    }

    // 重新启动进程
    this.startMCPProcess();
  }

  startMCPProcess() {
    if (this.process) {
      logger.info(`${this.mcpScript} 进程已在运行`);
      return;
    }

    logger.info(`正在启动 ${this.mcpScript} 进程`);

    this.process = spawn("node", [this.mcpScript], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Handle process stdout - send to WebSocket
    this.process.stdout?.on("data", (data: Buffer) => {
      // 将数据添加到缓冲区
      this.stdoutBuffer += data.toString();

      // 按换行符分割消息
      const lines = this.stdoutBuffer.split("\n");
      this.stdoutBuffer = lines.pop() || ""; // 保留最后一个不完整的行

      // 处理每个完整的消息
      for (const line of lines) {
        if (line.trim()) {
          logger.info(`>> mcpServerProxy发送消息长度: ${line.length} 字节`);
          logger.info(
            `>> mcpServerProxy发送消息: ${line.substring(0, 500)}...`
          );

          if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            try {
              // 发送完整的消息行（包含换行符）
              this.websocket.send(`${line}\n`);
              logger.info(">> 成功发送消息到 WebSocket");
            } catch (error) {
              logger.error(`>> 发送消息到 WebSocket 失败: ${error}`);
            }
          }
        }
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
        logger.warn(
          `${this.mcpScript} 进程已退出，退出码: ${code}, 信号: ${signal}`
        );
        this.process = null;

        // 如果不是主动关闭且应该重连，则尝试重启MCP进程
        if (
          this.shouldReconnect &&
          signal !== "SIGTERM" &&
          signal !== "SIGKILL"
        ) {
          logger.info("MCP 进程意外退出，将在下次重连时尝试重启");
          // 不立即重启，而是在下次重连时处理
        }
      }
    );

    // Handle process error
    this.process.on("error", (error: Error) => {
      logger.error(`进程错误: ${error.message}`);
      this.process = null;

      // 进程错误时不停止重连，让重连机制处理
      if (this.shouldReconnect) {
        logger.info("MCP 进程发生错误，将在下次重连时尝试重启");
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

    // 清空缓冲区
    this.stdoutBuffer = "";

    if (this.process) {
      logger.info(`正在终止 ${this.mcpScript} 进程`);
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
          `终止进程时出错: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      this.process = null;
    }

    if (this.websocket) {
      try {
        this.websocket.close();
      } catch (error) {
        logger.warn(`关闭 WebSocket 时出错: ${error}`);
      }
      this.websocket = null;
    }

    this.isConnected = false;
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  shutdown() {
    logger.info("正在关闭 MCP Pipe...");
    this.shouldReconnect = false;
    
    // Report disconnected status before shutting down
    this.isConnected = false;
    this.reportStatusToWebUI();
    
    this.cleanup();
    if (this.websocket) {
      this.websocket.close();
    }
    if (this.shutdownResolve) {
      this.shutdownResolve();
    }
    
    // Give a moment for the status report to be sent
    setTimeout(() => {
      process.exit(0);
    }, 100);
  }

  // Report status to web UI server
  private async reportStatusToWebUI() {
    // Skip in test environment
    if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
      return;
    }
    
    try {
      const statusWs = new WebSocket("ws://localhost:9999");
      
      statusWs.on("open", () => {
        const status = {
          type: "clientStatus",
          data: {
            status: this.isConnected ? "connected" : "disconnected",
            mcpEndpoint: this.endpointUrl,
            activeMCPServers: [], // This will be filled by mcpServerProxy
            lastHeartbeat: Date.now()
          }
        };
        statusWs.send(JSON.stringify(status));
        logger.info("已向 Web UI 报告状态");
        
        // Close connection after sending status
        setTimeout(() => {
          statusWs.close();
        }, 1000);
      });

      statusWs.on("error", (error) => {
        logger.debug(`Web UI 连接失败（可能未运行）: ${error.message}`);
      });
    } catch (error) {
      logger.debug(`向 Web UI 报告状态失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Signal handlers
export function setupSignalHandlers(mcpPipe: MCPPipe): void {
  // 检查是否为守护进程模式
  const isDaemon = process.env.XIAOZHI_DAEMON === "true";

  process.on("SIGINT", () => {
    logger.info("收到中断信号，正在关闭...");
    mcpPipe.shutdown();
  });

  process.on("SIGTERM", () => {
    logger.info("收到终止信号，正在关闭...");
    mcpPipe.shutdown();
  });

  // 守护进程模式下的额外信号处理
  if (isDaemon) {
    // 忽略 SIGHUP 信号（终端关闭）
    process.on("SIGHUP", () => {
      logger.info(
        "收到 SIGHUP 信号（终端已关闭），继续在守护进程模式下运行..."
      );
      // 守护进程不应该因为终端关闭而退出
    });

    // 处理未捕获的异常
    process.on("uncaughtException", (error) => {
      logger.error(`守护进程模式下的未捕获异常: ${error.message}`);
      logger.error(error.stack || "No stack trace available");
      // 守护进程遇到未捕获的异常时不退出，而是继续运行
    });

    // 处理未处理的 Promise 拒绝
    process.on("unhandledRejection", (reason, promise) => {
      logger.error(`守护进程模式下的未处理 Promise 拒绝: ${reason}`);
      logger.error(`Promise: ${promise}`);
      // 守护进程遇到未处理的 Promise 拒绝时不退出
    });

    logger.info("守护进程模式信号处理器已初始化");
  }
}

// Main execution
async function main() {
  // Check command line arguments
  if (process.argv.length < 3) {
    logger.error("用法: node mcp_pipe.js <mcp_script>");
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
      `程序执行错误: ${error instanceof Error ? error.message : String(error)}`
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
      `未处理的错误: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
