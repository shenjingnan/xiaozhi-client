#!/usr/bin/env node

/**
 * Multi-Endpoint MCP Pipe - 支持多个 MCP 接入点
 * 管理多个 WebSocket 连接，并正确路由消息到对应的接入点
 */

import { type ChildProcess, spawn } from "node:child_process";
import process from "node:process";
import WebSocket from "ws";
import { configManager } from "./configManager.js";
import { logger as globalLogger } from "./logger.js";

// 为 MultiEndpointMCPPipe 创建带标签的 logger
const logger = globalLogger.withTag("MULTI_MCP_PIPE");

// 如果在守护进程模式下运行，初始化日志文件
if (process.env.XIAOZHI_DAEMON === "true" && process.env.XIAOZHI_CONFIG_DIR) {
  globalLogger.initLogFile(process.env.XIAOZHI_CONFIG_DIR);
  globalLogger.enableFileLogging(true);
}

interface EndpointConnection {
  url: string;
  websocket: WebSocket | null;
  isConnected: boolean;
  reconnectAttempt: number;
  reconnectTimer?: NodeJS.Timeout;
  heartbeatTimer?: NodeJS.Timeout;
  heartbeatTimeoutTimer?: NodeJS.Timeout;
  process: ChildProcess | null; // 每个端点独立的 MCP 进程
  stdoutBuffer: string; // 每个端点独立的输出缓冲区
}

export class MultiEndpointMCPPipe {
  private mcpScript: string;
  private endpoints: Map<string, EndpointConnection>;
  private shouldReconnect: boolean;
  private shutdownResolve?: () => void;
  private connectionConfig: {
    heartbeatInterval: number;
    heartbeatTimeout: number;
    reconnectInterval: number;
  };

  constructor(mcpScript: string, endpointUrls: string[]) {
    this.mcpScript = mcpScript;
    this.endpoints = new Map();
    this.shouldReconnect = true;

    // 初始化所有端点
    for (const url of endpointUrls) {
      this.endpoints.set(url, {
        url,
        websocket: null,
        isConnected: false,
        reconnectAttempt: 0,
        process: null,
        stdoutBuffer: "",
      });
    }

    // 获取连接配置
    try {
      this.connectionConfig = configManager.getConnectionConfig();
      logger.info(
        `连接配置: 心跳间隔=${this.connectionConfig.heartbeatInterval}ms, ` +
          `心跳超时=${this.connectionConfig.heartbeatTimeout}ms, ` +
          `重连间隔=${this.connectionConfig.reconnectInterval}ms`
      );
    } catch (error) {
      this.connectionConfig = {
        heartbeatInterval: 30000,
        heartbeatTimeout: 10000,
        reconnectInterval: 5000,
      };
      logger.warn(
        `无法获取连接配置，使用默认值: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async start() {
    // 连接到所有端点（每个端点会启动自己的 MCP 进程）
    await this.connectToAllEndpoints();

    // 报告状态到 Web UI
    this.reportStatusToWebUI();

    // 保持进程运行
    return new Promise<void>((resolve) => {
      this.shutdownResolve = resolve;
    });
  }

  async connectToAllEndpoints() {
    const connectionPromises: Promise<void>[] = [];

    for (const [url, endpoint] of this.endpoints) {
      connectionPromises.push(this.connectToEndpoint(url));
    }

    await Promise.allSettled(connectionPromises);
  }

  async connectToEndpoint(endpointUrl: string) {
    const endpoint = this.endpoints.get(endpointUrl);
    if (!endpoint || endpoint.isConnected) {
      return;
    }

    // 先为该端点启动 MCP 进程
    this.startMCPProcessForEndpoint(endpointUrl);

    logger.info(`正在连接到 WebSocket 服务器: ${endpointUrl}`);

    const ws = new WebSocket(endpointUrl);
    endpoint.websocket = ws;

    ws.on("open", () => {
      logger.info(`成功连接到 WebSocket 服务器: ${endpointUrl}`);
      endpoint.isConnected = true;
      endpoint.reconnectAttempt = 0;

      // 报告状态
      this.reportStatusToWebUI();

      // 启动心跳检测
      this.startHeartbeat(endpointUrl);
    });

    ws.on("message", (data: WebSocket.Data) => {
      const message = data.toString();
      logger.info(`<< [${endpointUrl}] WebSocket收到消息: ${message}`);

      // 将消息写入对应端点的进程标准输入
      if (endpoint.process?.stdin && !endpoint.process.stdin.destroyed) {
        endpoint.process.stdin.write(`${message}\n`);
      }
    });

    ws.on("close", (code: number, reason: Buffer) => {
      logger.error(`[${endpointUrl}] WebSocket 连接已关闭: ${code} ${reason}`);
      endpoint.isConnected = false;
      endpoint.websocket = null;

      // 停止心跳检测
      this.stopHeartbeat(endpointUrl);

      // 报告断开状态
      this.reportStatusToWebUI();

      // 如果应该重连且不是永久错误
      if (this.shouldReconnect && code !== 4004) {
        this.scheduleReconnect(endpointUrl);
      }
    });

    ws.on("error", (error: Error) => {
      logger.error(`[${endpointUrl}] WebSocket 错误: ${error.message}`);
      endpoint.isConnected = false;

      // 停止心跳检测
      this.stopHeartbeat(endpointUrl);
    });

    // 处理 pong 响应
    ws.on("pong", () => {
      // 收到 pong 响应，清除心跳超时定时器
      if (endpoint.heartbeatTimeoutTimer) {
        clearTimeout(endpoint.heartbeatTimeoutTimer);
        endpoint.heartbeatTimeoutTimer = undefined;
      }
    });
  }

  scheduleReconnect(endpointUrl: string) {
    const endpoint = this.endpoints.get(endpointUrl);
    if (!endpoint || !this.shouldReconnect) return;

    // 清除之前的重连定时器
    if (endpoint.reconnectTimer) {
      clearTimeout(endpoint.reconnectTimer);
    }

    endpoint.reconnectAttempt++;

    logger.info(
      `[${endpointUrl}] 计划在 ${(
        this.connectionConfig.reconnectInterval / 1000
      ).toFixed(2)} 秒后进行第 ${endpoint.reconnectAttempt} 次重连尝试...`
    );

    endpoint.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        // 如果MCP进程不存在，先尝试重启
        if (!endpoint.process || endpoint.process.killed) {
          logger.info(`[${endpointUrl}] MCP 进程未运行，将在重连时启动...`);
        }
        this.connectToEndpoint(endpointUrl);
      }
    }, this.connectionConfig.reconnectInterval);
  }

  startMCPProcessForEndpoint(endpointUrl: string) {
    const endpoint = this.endpoints.get(endpointUrl);
    if (!endpoint) {
      logger.error(`端点不存在: ${endpointUrl}`);
      return;
    }

    if (endpoint.process) {
      logger.info(`[${endpointUrl}] MCP 进程已在运行`);
      return;
    }

    logger.info(`[${endpointUrl}] 正在启动 MCP 进程`);

    endpoint.process = spawn("node", [this.mcpScript], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // 处理进程标准输出 - 发送到对应的 WebSocket
    endpoint.process.stdout?.on("data", (data: Buffer) => {
      // 将数据添加到缓冲区
      endpoint.stdoutBuffer += data.toString();

      // 按换行符分割消息
      const lines = endpoint.stdoutBuffer.split("\n");
      endpoint.stdoutBuffer = lines.pop() || ""; // 保留最后一个不完整的行

      // 处理每个完整的消息
      for (const line of lines) {
        if (line.trim()) {
          this.handleMCPMessage(endpointUrl, line);
        }
      }
    });

    // 处理进程标准错误
    endpoint.process.stderr?.on("data", (data: Buffer) => {
      if (process.env.XIAOZHI_DAEMON !== "true") {
        try {
          process.stderr.write(data);
        } catch (error) {
          // 忽略 EPIPE 错误
        }
      }
    });

    // 处理进程退出
    endpoint.process.on(
      "exit",
      (code: number | null, signal: NodeJS.Signals | null) => {
        logger.warn(
          `[${endpointUrl}] MCP 进程已退出，退出码: ${code}, 信号: ${signal}`
        );
        endpoint.process = null;

        if (
          this.shouldReconnect &&
          signal !== "SIGTERM" &&
          signal !== "SIGKILL"
        ) {
          logger.info(`[${endpointUrl}] MCP 进程意外退出，将在下次重连时尝试重启`);
        }
      }
    );

    // 处理进程错误
    endpoint.process.on("error", (error: Error) => {
      logger.error(`[${endpointUrl}] 进程错误: ${error.message}`);
      endpoint.process = null;

      if (this.shouldReconnect) {
        logger.info(`[${endpointUrl}] MCP 进程发生错误，将在下次重连时尝试重启`);
      }
    });
  }


  handleMCPMessage(endpointUrl: string, line: string) {
    logger.info(`>> [${endpointUrl}] mcpServerProxy发送消息长度: ${line.length} 字节`);
    logger.info(`>> [${endpointUrl}] mcpServerProxy发送消息: ${line.substring(0, 500)}...`);

    // 直接发送回对应的端点
    this.sendToEndpoint(endpointUrl, line);
  }

  sendToEndpoint(endpointUrl: string, message: string) {
    const endpoint = this.endpoints.get(endpointUrl);
    if (
      !endpoint ||
      !endpoint.websocket ||
      endpoint.websocket.readyState !== WebSocket.OPEN
    ) {
      logger.warn(`[${endpointUrl}] 端点不可用，消息无法发送`);
      return;
    }

    try {
      endpoint.websocket.send(`${message}\n`);
      logger.info(`>> [${endpointUrl}] 成功发送消息到 WebSocket`);
    } catch (error) {
      logger.error(`>> [${endpointUrl}] 发送消息到 WebSocket 失败: ${error}`);
    }
  }


  startHeartbeat(endpointUrl: string) {
    const endpoint = this.endpoints.get(endpointUrl);
    if (!endpoint) return;

    // 清除之前的心跳定时器
    this.stopHeartbeat(endpointUrl);

    // 设置心跳定时器
    endpoint.heartbeatTimer = setInterval(() => {
      if (
        endpoint.websocket &&
        endpoint.websocket.readyState === WebSocket.OPEN
      ) {
        // 发送 ping
        endpoint.websocket.ping();

        // 设置心跳超时定时器
        endpoint.heartbeatTimeoutTimer = setTimeout(() => {
          logger.warn(`[${endpointUrl}] 心跳超时，断开连接`);
          endpoint.websocket?.close();
        }, this.connectionConfig.heartbeatTimeout);
      }
    }, this.connectionConfig.heartbeatInterval);
  }

  stopHeartbeat(endpointUrl: string) {
    const endpoint = this.endpoints.get(endpointUrl);
    if (!endpoint) return;

    if (endpoint.heartbeatTimer) {
      clearInterval(endpoint.heartbeatTimer);
      endpoint.heartbeatTimer = undefined;
    }

    if (endpoint.heartbeatTimeoutTimer) {
      clearTimeout(endpoint.heartbeatTimeoutTimer);
      endpoint.heartbeatTimeoutTimer = undefined;
    }
  }

  cleanup() {
    // 停止所有心跳检测
    for (const url of this.endpoints.keys()) {
      this.stopHeartbeat(url);
    }

    // 清除所有重连定时器，清理进程和缓冲区
    for (const [url, endpoint] of this.endpoints) {
      if (endpoint.reconnectTimer) {
        clearTimeout(endpoint.reconnectTimer);
        endpoint.reconnectTimer = undefined;
      }

      // 清空每个端点的缓冲区
      endpoint.stdoutBuffer = "";

      // 终止每个端点的进程
      if (endpoint.process) {
        logger.info(`[${url}] 正在终止 MCP 进程`);
        try {
          endpoint.process.kill("SIGTERM");

          // 强制终止
          setTimeout(() => {
            if (endpoint.process && !endpoint.process.killed) {
              endpoint.process.kill("SIGKILL");
            }
          }, 5000);
        } catch (error) {
          logger.error(
            `[${url}] 终止进程时出错: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
        endpoint.process = null;
      }

      // 关闭 WebSocket 连接
      if (endpoint.websocket) {
        try {
          endpoint.websocket.close();
        } catch (error) {
          logger.warn(`[${url}] 关闭 WebSocket 时出错: ${error}`);
        }
        endpoint.websocket = null;
      }
    }

  }

  shutdown() {
    logger.info("正在关闭 Multi-Endpoint MCP Pipe...");
    this.shouldReconnect = false;

    // 报告断开状态
    for (const endpoint of this.endpoints.values()) {
      endpoint.isConnected = false;
    }
    this.reportStatusToWebUI();

    this.cleanup();

    if (this.shutdownResolve) {
      this.shutdownResolve();
    }

    // 给状态报告一点时间
    setTimeout(() => {
      process.exit(0);
    }, 100);
  }

  // 报告状态到 Web UI 服务器
  private async reportStatusToWebUI() {
    // 在测试环境中跳过
    if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
      return;
    }

    try {
      // 从配置获取 WebUI 端口
      const port = configManager.getWebUIPort();
      const statusWs = new WebSocket(`ws://localhost:${port}`);

      statusWs.on("open", () => {
        // 收集所有端点的状态
        const endpointStatuses: { url: string; connected: boolean }[] = [];
        for (const [url, endpoint] of this.endpoints) {
          endpointStatuses.push({
            url,
            connected: endpoint.isConnected,
          });
        }

        const status = {
          type: "clientStatus",
          data: {
            status: this.hasAnyConnection() ? "connected" : "disconnected",
            mcpEndpoints: endpointStatuses,
            activeMCPServers: [], // 由 mcpServerProxy 填充
            lastHeartbeat: Date.now(),
          },
        };
        statusWs.send(JSON.stringify(status));
        logger.debug("已向 Web UI 报告状态");

        // 发送状态后关闭连接
        setTimeout(() => {
          statusWs.close();
        }, 1000);
      });

      statusWs.on("error", (error) => {
        logger.debug(`Web UI 连接失败（可能未运行）: ${error.message}`);
      });
    } catch (error) {
      logger.debug(
        `向 Web UI 报告状态失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  hasAnyConnection(): boolean {
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.isConnected) {
        return true;
      }
    }
    return false;
  }
}

// 信号处理器
export function setupSignalHandlers(mcpPipe: MultiEndpointMCPPipe): void {
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
    process.on("SIGHUP", () => {
      logger.info(
        "收到 SIGHUP 信号（终端已关闭），继续在守护进程模式下运行..."
      );
    });

    process.on("uncaughtException", (error) => {
      if (error.message?.includes("EPIPE")) {
        return;
      }
      logger.error(
        `未捕获的异常: ${error.message || error}\n${error.stack || ""}`
      );
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error(
        `未处理的 Promise 拒绝: ${
          reason instanceof Error ? reason.message : String(reason)
        }`
      );
    });
  }
}

