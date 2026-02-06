/**
 * Endpoint 类
 * 管理单个小智接入点的 WebSocket 连接
 * 实现 MCP (Model Context Protocol) 协议通信
 *
 * 使用方式：
 * ```typescript
 * const mcpManager = new SharedMCPAdapter(globalMCPManager);
 * const endpoint = new Endpoint("ws://...", mcpManager);
 * await endpoint.connect();
 * ```
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import WebSocket from "ws";
import type { ExtendedMCPMessage, MCPMessage } from "./mcp.js";
import type {
  IMCPServiceManager,
  EndpointConnectionStatus,
  ToolCallResult,
} from "./types.js";
import {
  ConnectionState,
  ToolCallError as ToolCallErrorClass,
  ToolCallErrorCode as ToolCallErrorCodeEnum,
  ensureToolJSONSchema as ensureToolJSONSchemaFn,
} from "./types.js";
import { validateToolCallParams } from "./utils.js";
import { sliceEndpoint } from "./utils.js";
import { createLogger, type Logger } from "./logger.js";

// 导出错误类型供外部使用
export {
  ToolCallErrorCodeEnum as ToolCallErrorCode,
  ToolCallErrorClass as ToolCallError,
};

/**
 * Endpoint 类
 * 负责管理单个小智接入点的 WebSocket 连接
 * 使用新的配置方式：直接在构造函数中传入 mcpServers 配置
 */
export class Endpoint {
  private endpointUrl: string;
  private ws: WebSocket | null = null;
  private connectionStatus = false;
  private serverInitialized = false;
  private mcpAdapter: IMCPServiceManager;
  private logger: Logger;

  // 连接状态管理
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  // 最后一次错误信息
  private lastError: string | null = null;

  // 连接超时定时器
  private connectionTimeout: NodeJS.Timeout | null = null;

  // 工具调用超时配置
  private toolCallTimeout = 30000;
  private reconnectDelay: number; // 重连延迟（毫秒）

  /**
   * 构造函数
   *
   * @param endpointUrl - 小智接入点 URL
   * @param mcpManager - MCP 服务管理器（依赖注入）
   * @param reconnectDelay - 可选的重连延迟（毫秒）
   */
  constructor(
    endpointUrl: string,
    mcpManager: IMCPServiceManager,
    reconnectDelay?: number
  ) {
    this.endpointUrl = endpointUrl;
    this.reconnectDelay = reconnectDelay ?? 2000;

    // 使用注入的 MCP 管理器
    this.mcpAdapter = mcpManager;

    // 初始化 Logger
    this.logger = createLogger("Endpoint");
  }

  /**
   * 获取 Endpoint URL
   */
  getUrl(): string {
    return this.endpointUrl;
  }

  /**
   * 获取当前所有工具列表
   */
  getTools(): Tool[] {
    try {
      const allTools = this.mcpAdapter.getAllTools();

      return allTools.map((toolInfo) => ({
        name: toolInfo.name,
        description: toolInfo.description,
        inputSchema: ensureToolJSONSchemaFn(toolInfo.inputSchema),
      }));
    } catch (error) {
      this.logger.error(
        `获取工具列表失败: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * 连接小智接入点
   */
  public async connect(): Promise<void> {
    // 初始化 MCP 适配器
    await this.mcpAdapter.initialize();

    // 如果正在连接中，等待当前连接完成
    if (this.connectionState === ConnectionState.CONNECTING) {
      throw new Error("连接正在进行中，请等待连接完成");
    }

    // 清理之前的连接
    this.cleanupConnection();

    return this.attemptConnection();
  }

  /**
   * 尝试建立连接
   */
  private async attemptConnection(): Promise<void> {
    this.connectionState = ConnectionState.CONNECTING;
    this.logger.debug(`正在连接小智接入点: ${sliceEndpoint(this.endpointUrl)}`);

    return new Promise((resolve, reject) => {
      // 设置连接超时
      this.connectionTimeout = setTimeout(() => {
        const error = new Error("连接超时 (10000ms)");
        this.handleConnectionError(error);
        reject(error);
      }, 10000);

      this.ws = new WebSocket(this.endpointUrl);

      this.ws.on("open", () => {
        this.handleConnectionSuccess();
        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const message: MCPMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          this.logger.error("MCP 消息解析错误:", error);
        }
      });

      this.ws.on("close", (code, reason) => {
        this.handleConnectionClose(code, reason.toString());
      });

      this.ws.on("error", (error) => {
        this.handleConnectionError(error);
        reject(error);
      });
    });
  }

  /**
   * 处理连接成功
   */
  private handleConnectionSuccess(): void {
    // 清理连接超时定时器
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.connectionStatus = true;
    this.connectionState = ConnectionState.CONNECTED;

    this.logger.debug("MCP WebSocket 连接已建立");
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(error: Error): void {
    // 记录最后一次错误信息
    this.lastError = error.message;

    // 清理连接超时定时器
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.logger.error("MCP WebSocket 错误:", error.message);

    // 清理当前连接
    this.cleanupConnection();
  }

  /**
   * 处理连接关闭
   */
  private handleConnectionClose(code: number, reason: string): void {
    this.connectionStatus = false;
    this.serverInitialized = false;
    this.connectionState = ConnectionState.DISCONNECTED;
    this.logger.info(`小智连接已关闭 (代码: ${code}, 原因: ${reason})`);
  }

  /**
   * 清理连接资源
   */
  private cleanupConnection(): void {
    // 清理 WebSocket
    if (this.ws) {
      this.ws.removeAllListeners();

      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close(1000, "Cleaning up connection");
        } else if (this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.terminate();
        }
      } catch (error) {
        this.logger.debug("WebSocket 关闭时出现错误（已忽略）:", error);
      }

      this.ws = null;
    }

    // 清理连接超时定时器
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // 重置连接状态
    this.connectionStatus = false;
    this.serverInitialized = false;

    // 重置连接状态为已断开
    this.connectionState = ConnectionState.DISCONNECTED;
  }

  /**
   * 处理 MCP 消息
   */
  private handleMessage(message: MCPMessage): void {
    this.logger.debug("收到 MCP 消息:", JSON.stringify(message, null, 2));

    if (!message.method) {
      this.logger.debug("收到没有 method 字段的消息，忽略");
      return;
    }

    switch (message.method) {
      case "initialize":
      case "notifications/initialized":
        this.sendResponse(message.id, {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: true },
            logging: {},
          },
          serverInfo: {
            name: "xiaozhi-mcp-server",
            version: "1.0.0",
          },
        });
        this.serverInitialized = true;
        this.logger.debug("MCP 服务器初始化完成");
        break;

      case "tools/list": {
        const toolsList = this.getTools();
        this.sendResponse(message.id, { tools: toolsList });
        this.logger.debug(`MCP 工具列表已发送 (${toolsList.length}个工具)`);
        break;
      }

      case "tools/call": {
        this.handleToolCall(message).catch((error) => {
          this.logger.error("处理工具调用时发生未捕获错误:", error);
        });
        break;
      }

      case "ping":
        this.sendResponse(message.id, {});
        this.logger.debug("回应 MCP ping 消息");
        break;

      default:
        this.logger.warn(`未知的 MCP 请求: ${message.method}`);
    }
  }

  /**
   * 发送响应消息
   */
  private sendResponse(id: number | string, result: unknown): void {
    this.logger.debug(
      `尝试发送响应: id=${id}, isConnected=${this.connectionStatus}, wsReadyState=${this.ws?.readyState}`
    );

    if (this.connectionStatus && this.ws?.readyState === WebSocket.OPEN) {
      const response: ExtendedMCPMessage = {
        jsonrpc: "2.0",
        id,
        result,
      };

      try {
        this.ws.send(JSON.stringify(response));
        this.logger.debug("响应已发送", {
          id,
          responseSize: JSON.stringify(response).length,
        });
      } catch (error) {
        this.logger.error("发送响应失败", {
          id,
          error,
        });
      }
    } else {
      this.logger.error("无法发送响应", {
        id,
        isConnected: this.connectionStatus,
        wsReadyState: this.ws?.readyState,
      });
    }
  }

  /**
   * 获取服务器状态
   */
  public getStatus(): EndpointConnectionStatus {
    const availableTools = this.mcpAdapter.getAllTools().length;

    return {
      connected: this.connectionStatus,
      initialized: this.serverInitialized,
      url: this.endpointUrl,
      availableTools,
      connectionState: this.connectionState,
      lastError: this.lastError,
    };
  }

  /**
   * 检查连接状态
   */
  public isConnected(): boolean {
    return this.connectionStatus;
  }

  /**
   * 主动断开小智连接
   */
  public async disconnect(): Promise<void> {
    this.logger.info("主动断开小智连接");

    // 清理 MCP 适配器
    await this.mcpAdapter.cleanup();

    // 清理 WebSocket 连接
    this.cleanupConnection();
  }

  /**
   * 重连小智接入点
   */
  public async reconnect(): Promise<void> {
    this.logger.info(`重连小智接入点: ${sliceEndpoint(this.endpointUrl)}`);

    // 先断开连接
    this.disconnect();

    // 等待可配置的时间确保连接完全断开
    await new Promise((resolve) => setTimeout(resolve, this.reconnectDelay));

    // 重新连接
    await this.connect();
  }

  /**
   * 处理工具调用请求
   */
  private async handleToolCall(request: MCPMessage): Promise<void> {
    if (request.id === undefined || request.id === null) {
      throw new ToolCallErrorClass(
        ToolCallErrorCodeEnum.INVALID_PARAMS,
        "请求 ID 不能为空"
      );
    }

    const requestId = request.id;
    const startTime = Date.now();

    try {
      const params = validateToolCallParams(request.params);

      this.logger.info("开始处理工具调用", {
        requestId,
        toolName: params.name,
        hasArguments: !!params.arguments,
      });

      const result = await this.executeToolWithTimeout(
        params.name,
        params.arguments || {},
        this.toolCallTimeout
      );

      this.sendResponse(requestId, {
        content: result.content || [
          { type: "text", text: JSON.stringify(result) },
        ],
        isError: result.isError || false,
      });

      this.logger.info("工具调用成功", {
        requestId,
        toolName: params.name,
        duration: `${Date.now() - startTime}ms`,
      });
    } catch (error) {
      this.handleToolCallError(error, requestId, Date.now() - startTime);
    }
  }

  /**
   * 带超时控制的工具执行
   */
  private async executeToolWithTimeout(
    toolName: string,
    arguments_: Record<string, unknown>,
    timeoutMs = 30000
  ): Promise<ToolCallResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new ToolCallErrorClass(
            ToolCallErrorCodeEnum.TIMEOUT,
            `工具调用超时 (${timeoutMs}ms): ${toolName}`
          )
        );
      }, timeoutMs);

      this.mcpAdapter
        .callTool(toolName, arguments_)
        .then((result: ToolCallResult) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error: unknown) => {
          clearTimeout(timeoutId);

          const errorMessage =
            error instanceof Error ? error.message : String(error);

          if (errorMessage.includes("未找到工具")) {
            reject(
              new ToolCallErrorClass(
                ToolCallErrorCodeEnum.TOOL_NOT_FOUND,
                `工具不存在: ${toolName}`
              )
            );
          } else {
            reject(
              new ToolCallErrorClass(
                ToolCallErrorCodeEnum.TOOL_EXECUTION_ERROR,
                `工具执行失败: ${errorMessage}`
              )
            );
          }
        });
    });
  }

  /**
   * 处理工具调用错误
   */
  private handleToolCallError(
    error: unknown,
    requestId: string | number | undefined,
    duration: number
  ): void {
    let errorResponse: {
      code: number;
      message: string;
      data?: unknown;
    };

    if (error instanceof ToolCallErrorClass) {
      errorResponse = {
        code: error.code,
        message: error.message,
        data: error.data,
      };
    } else {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      errorResponse = {
        code: ToolCallErrorCodeEnum.TOOL_EXECUTION_ERROR,
        message: errorMessage,
        data: { originalError: String(error) || "null" },
      };
    }

    this.sendErrorResponse(requestId, errorResponse);

    this.logger.error("工具调用失败", {
      requestId,
      duration: `${duration}ms`,
      error: errorResponse,
    });
  }

  /**
   * 发送错误响应
   */
  private sendErrorResponse(
    id: string | number | undefined,
    error: { code: number; message: string; data?: unknown }
  ): void {
    if (this.connectionStatus && this.ws?.readyState === WebSocket.OPEN) {
      const response = {
        jsonrpc: "2.0",
        id,
        error,
      };
      this.ws.send(JSON.stringify(response));
      this.logger.debug("已发送错误响应:", response);
    }
  }
}
