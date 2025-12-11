import { ensureToolJSONSchema, type JSONSchema, type ToolCallResult, type MCPServiceManager } from "@/lib/mcp/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { MCPMessage } from "@root/types/mcp.js";
import { sliceEndpoint } from "@utils/mcpServerUtils.js";
import WebSocket from "ws";

// MCPServiceManager 接口定义
interface IMCPServiceManager {
  getAllTools(): Array<{
    name: string;
    description: string;
    inputSchema: JSONSchema;
    serviceName?: string;
    originalName?: string;
  }>;
  callTool(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<ToolCallResult>;
}

// 扩展的 MCP 消息接口，用于响应消息
interface ExtendedMCPMessage {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
}

// 连接状态枚举
enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  FAILED = "failed",
}

// 工具调用错误码枚举
export enum ToolCallErrorCode {
  INVALID_PARAMS = -32602, // 无效参数
  TOOL_NOT_FOUND = -32601, // 工具不存在
  TOOL_EXECUTION_ERROR = -32000, // 工具执行错误
  SERVICE_UNAVAILABLE = -32001, // 服务不可用
  TIMEOUT = -32002, // 调用超时
}

// 工具调用错误类
export class ToolCallError extends Error {
  constructor(
    public code: ToolCallErrorCode,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ToolCallError";
  }
}

// 服务器状态接口
interface ProxyMCPServerStatus {
  connected: boolean;
  initialized: boolean;
  url: string;
  availableTools: number;
  connectionState: ConnectionState;
  lastError: string | null;
}

export class ProxyMCPServer {
  private endpointUrl: string;
  private ws: WebSocket | null = null;
  private connectionStatus = false;
  private serviceManager: MCPServiceManager | null = null;

  // 连接状态管理
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  // 最后一次错误信息
  private lastError: string | null = null;

  // 连接超时定时器
  private connectionTimeout: NodeJS.Timeout | null = null;

  constructor(endpointUrl: string) {
    this.endpointUrl = endpointUrl;
  }

  /**
   * 设置 MCPServiceManager 实例
   * @param serviceManager MCPServiceManager 实例
   */
  setServiceManager(serviceManager: MCPServiceManager): void {
    this.serviceManager = serviceManager;
    console.info("已设置 MCPServiceManager");
  }

  /**
   * 获取当前所有工具列表
   * @returns 工具数组
   */
  getTools(): Tool[] {
    if (!this.serviceManager) {
      console.debug("MCPServiceManager 未设置，返回空工具列表");
      return [];
    }

    try {
      // 直接从 MCPServiceManager 获取所有工具
      const allTools = this.serviceManager.getAllTools();

      // 转换为 Tool 格式
      return allTools.map((toolInfo) => ({
        name: toolInfo.name,
        description: toolInfo.description,
        inputSchema: ensureToolJSONSchema(toolInfo.inputSchema),
      }));
    } catch (error) {
      console.error(
        `获取工具列表失败: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * 连接小智接入点
   * @returns 连接成功后的 Promise
   */
  public async connect(): Promise<void> {
    // 连接前验证
    if (!this.serviceManager) {
      throw new Error("MCPServiceManager 未设置。请在连接前先设置服务管理器。");
    }

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
   * @returns 连接成功后的 Promise
   */
  private async attemptConnection(): Promise<void> {
    this.connectionState = ConnectionState.CONNECTING;
    console.debug(`正在连接小智接入点: ${sliceEndpoint(this.endpointUrl)}`);

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
          console.error("MCP 消息解析错误:", error);
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

    console.debug("MCP WebSocket 连接已建立");
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

    console.error("MCP WebSocket 错误:", error.message);

    // 清理当前连接
    this.cleanupConnection();
  }

  /**
   * 处理连接关闭
   */
  private handleConnectionClose(code: number, reason: string): void {
    this.connectionStatus = false;
    this.connectionState = ConnectionState.DISCONNECTED;
    console.info(`小智连接已关闭 (代码: ${code}, 原因: ${reason})`);
  }

  /**
   * 清理连接资源
   */
  private cleanupConnection(): void {
    // 清理 WebSocket
    if (this.ws) {
      // 移除所有事件监听器，防止在关闭时触发错误事件
      this.ws.removeAllListeners();

      // 安全关闭 WebSocket
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close(1000, "Cleaning up connection");
        } else if (this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.terminate(); // 强制终止正在连接的 WebSocket
        }
      } catch (error) {
        // 忽略关闭时的错误
        console.debug("WebSocket 关闭时出现错误（已忽略）:", error);
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
  }

  private handleMessage(message: MCPMessage): void {
    console.debug("收到 MCP 消息:", JSON.stringify(message, null, 2));

    if (message.method) {
      this.handleServerRequest(message);
    }
  }

  private handleServerRequest(request: MCPMessage): void {
    switch (request.method) {
      case "initialize":
      case "notifications/initialized":
        this.sendResponse(request.id as string | number, {
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
        console.debug("MCP 服务器初始化完成");
        break;

      case "tools/list": {
        const toolsList = this.getTools();
        this.sendResponse(request.id as string | number, { tools: toolsList });
        console.debug(`MCP 工具列表已发送 (${toolsList.length}个工具)`);
        break;
      }

      case "tools/call": {
        // 异步处理工具调用，避免阻塞其他消息
        this.handleToolCall(request).catch((error) => {
          console.error("处理工具调用时发生未捕获错误:", error);
        });
        break;
      }

      case "ping":
        this.sendResponse(request.id as string | number, {});
        console.debug("回应 MCP ping 消息");
        break;

      default:
        console.warn(`未知的 MCP 请求: ${request.method}`);
    }
  }

  private sendResponse(id: number | string, result: unknown): void {
    console.debug(
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
        console.debug("响应已发送", {
          id,
          responseSize: JSON.stringify(response).length,
        });
      } catch (error) {
        console.error("发送响应失败", {
          id,
          error,
        });
      }
    } else {
      console.error("无法发送响应", {
        id,
        isConnected: this.connectionStatus,
        wsReadyState: this.ws?.readyState,
        wsReadyStateText:
          this.ws?.readyState === WebSocket.OPEN
            ? "OPEN"
            : this.ws?.readyState === WebSocket.CONNECTING
              ? "CONNECTING"
              : this.ws?.readyState === WebSocket.CLOSING
                ? "CLOSING"
                : this.ws?.readyState === WebSocket.CLOSED
                  ? "CLOSED"
                  : "UNKNOWN",
      });
    }
  }

  /**
   * 检查连接状态
   * @returns 是否已连接
   */
  public isConnected(): boolean {
    return this.connectionStatus;
  }

  /**
   * 主动断开 小智连接
   */
  public disconnect(): void {
    console.info("主动断开 小智连接");

    // 清理连接资源
    this.cleanupConnection();

    // 设置状态为已断开
    this.connectionState = ConnectionState.DISCONNECTED;
  }

  /**
   * 处理工具调用请求
   */
  private async handleToolCall(request: MCPMessage): Promise<void> {
    // 确保 request.id 存在且类型正确
    if (request.id === undefined || request.id === null) {
      throw new ToolCallError(
        ToolCallErrorCode.INVALID_PARAMS,
        "请求 ID 不能为空"
      );
    }

    // 保持原始 ID 类型（number | string），不进行类型转换
    const requestId = request.id;
    // 记录开始时间用于计算持续时间
    const startTime = Date.now();

    try {
      // 1. 验证请求格式
      const params = this.validateToolCallParams(request.params);

      console.info("开始处理工具调用", {
        requestId,
        toolName: params.name,
        hasArguments: !!params.arguments,
      });

      // 2. 检查服务管理器是否可用
      if (!this.serviceManager) {
        throw new ToolCallError(
          ToolCallErrorCode.SERVICE_UNAVAILABLE,
          "MCPServiceManager 未设置"
        );
      }

      // 3. 执行工具调用
      const result = await this.executeToolWithTimeout(
        params.name,
        params.arguments || {},
        30000
      );

      // 4. 发送成功响应
      this.sendResponse(requestId, {
        content: result.content || [
          { type: "text", text: JSON.stringify(result) },
        ],
        isError: result.isError || false,
      });

      // 5. 记录调用成功
      console.info("工具调用成功", {
        requestId,
        toolName: params.name,
        duration: `${Date.now() - startTime}ms`,
      });
    } catch (error) {
      // 6. 处理错误并发送错误响应
      this.handleToolCallError(error, requestId, Date.now() - startTime);
    }
  }

  /**
   * 验证工具调用参数
   */
  private validateToolCallParams(params: unknown): {
    name: string;
    arguments?: Record<string, unknown>;
  } {
    if (!params || typeof params !== "object") {
      throw new ToolCallError(
        ToolCallErrorCode.INVALID_PARAMS,
        "请求参数必须是对象"
      );
    }

    const paramsObj = params as Record<string, unknown>;

    if (!paramsObj.name || typeof paramsObj.name !== "string") {
      throw new ToolCallError(
        ToolCallErrorCode.INVALID_PARAMS,
        "工具名称必须是非空字符串"
      );
    }

    if (
      paramsObj.arguments !== undefined &&
      (typeof paramsObj.arguments !== "object" ||
        Array.isArray(paramsObj.arguments))
    ) {
      throw new ToolCallError(
        ToolCallErrorCode.INVALID_PARAMS,
        "工具参数必须是对象"
      );
    }

    return {
      name: paramsObj.name,
      arguments: paramsObj.arguments as Record<string, unknown>,
    };
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
      // 设置超时定时器
      const timeoutId = setTimeout(() => {
        reject(
          new ToolCallError(
            ToolCallErrorCode.TIMEOUT,
            `工具调用超时 (${timeoutMs}ms): ${toolName}`
          )
        );
      }, timeoutMs);

      // 检查 serviceManager 是否可用
      if (!this.serviceManager) {
        clearTimeout(timeoutId);
        reject(
          new ToolCallError(
            ToolCallErrorCode.SERVICE_UNAVAILABLE,
            "MCPServiceManager 未设置"
          )
        );
        return;
      }

      // 执行工具调用
      this.serviceManager
        .callTool(toolName, arguments_)
        .then((result: ToolCallResult) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error: unknown) => {
          clearTimeout(timeoutId);

          // 将内部错误转换为工具调用错误
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          if (errorMessage.includes("未找到工具")) {
            reject(
              new ToolCallError(
                ToolCallErrorCode.TOOL_NOT_FOUND,
                `工具不存在: ${toolName}`
              )
            );
          } else if (
            errorMessage.includes("服务") &&
            errorMessage.includes("不可用")
          ) {
            reject(
              new ToolCallError(
                ToolCallErrorCode.SERVICE_UNAVAILABLE,
                errorMessage
              )
            );
          } else if (errorMessage.includes("暂时不可用")) {
            // 标记为服务不可用错误
            reject(
              new ToolCallError(
                ToolCallErrorCode.SERVICE_UNAVAILABLE,
                errorMessage
              )
            );
          } else if (errorMessage.includes("持续不可用")) {
            // 标记为服务不可用错误
            reject(
              new ToolCallError(
                ToolCallErrorCode.SERVICE_UNAVAILABLE,
                errorMessage
              )
            );
          } else {
            reject(
              new ToolCallError(
                ToolCallErrorCode.TOOL_EXECUTION_ERROR,
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

    if (error instanceof ToolCallError) {
      // 标准工具调用错误
      errorResponse = {
        code: error.code,
        message: error.message,
        data: error.data,
      };
    } else {
      // 未知错误
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      errorResponse = {
        code: ToolCallErrorCode.TOOL_EXECUTION_ERROR,
        message: errorMessage,
        data: { originalError: String(error) || "null" },
      };
    }

    // 发送错误响应
    this.sendErrorResponse(requestId, errorResponse);

    // 记录错误日志
    console.error("工具调用失败", {
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
      console.debug("已发送错误响应:", response);
    }
  }
}
