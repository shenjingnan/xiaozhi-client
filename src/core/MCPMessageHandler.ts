/**
 * 统一的 MCP 消息处理器
 * 负责处理所有 MCP 协议消息，包括 initialize、tools/list、tools/call、resources/list、prompts/list 等
 * 这是阶段一重构的核心组件，用于消除双层代理架构
 */

import { type Logger, logger } from "../Logger.js";
import type { MCPServiceManager } from "../services/MCPServiceManager.js";

// MCP 消息接口
interface MCPMessage {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id?: string | number;
}

// MCP 响应接口
interface MCPResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: MCPError;
  id: string | number;
}

// MCP 错误接口
interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// 初始化参数接口
interface InitializeParams {
  protocolVersion: string;
  capabilities: any;
  clientInfo: {
    name: string;
    version: string;
  };
}

// 工具调用参数接口
interface ToolCallParams {
  name: string;
  arguments?: any;
}

// MCP 资源接口
interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// MCP 提示接口
interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export class MCPMessageHandler {
  private logger: Logger;
  private serviceManager: MCPServiceManager;

  constructor(serviceManager: MCPServiceManager) {
    this.serviceManager = serviceManager;
    this.logger = logger;
  }

  /**
   * 处理 MCP 消息的统一入口
   * @param message MCP 消息
   * @returns MCP 响应（对于通知消息返回 null）
   */
  async handleMessage(message: MCPMessage): Promise<MCPResponse | null> {
    this.logger.debug(`处理 MCP 消息: ${message.method}`, message);

    try {
      // 检查是否为通知消息（没有 id 字段）
      const isNotification = message.id === undefined;

      switch (message.method) {
        case "initialize":
          return await this.handleInitialize(message.params, message.id);
        case "notifications/initialized":
          return await this.handleInitializedNotification(message.params);
        case "tools/list":
          return await this.handleToolsList(message.id);
        case "tools/call":
          return await this.handleToolCall(message.params, message.id);
        case "resources/list":
          return await this.handleResourcesList(message.id);
        case "prompts/list":
          return await this.handlePromptsList(message.id);
        case "ping":
          return await this.handlePing(message.id);
        default:
          if (isNotification) {
            // 对于未知的通知消息，记录警告但不抛出错误
            this.logger.warn(`收到未知的通知消息: ${message.method}`, message);
            return null;
          }
          throw new Error(`未知的方法: ${message.method}`);
      }
    } catch (error) {
      this.logger.error(`处理消息时出错: ${message.method}`, error);
      // 通知消息不需要错误响应
      if (message.id === undefined) {
        return null;
      }
      return this.createErrorResponse(error as Error, message.id);
    }
  }

  /**
   * 处理 initialize 请求
   * @param params 初始化参数
   * @param id 消息ID
   * @returns 初始化响应
   */
  private async handleInitialize(
    params: InitializeParams,
    id?: string | number
  ): Promise<MCPResponse> {
    this.logger.debug("处理 initialize 请求", params);

    // 支持多个协议版本，优先使用客户端请求的版本
    const supportedVersions = ["2024-11-05", "2025-06-18"];
    const clientVersion = params.protocolVersion;
    const responseVersion = supportedVersions.includes(clientVersion)
      ? clientVersion
      : "2024-11-05";

    this.logger.debug(
      `协议版本协商: 客户端=${clientVersion}, 服务器响应=${responseVersion}`
    );

    return {
      jsonrpc: "2.0",
      result: {
        serverInfo: {
          name: "xiaozhi-mcp-server",
          version: "1.0.0",
        },
        capabilities: {
          tools: {},
          logging: {},
        },
        protocolVersion: responseVersion,
      },
      id: id !== undefined ? id : 1,
    };
  }

  /**
   * 处理 notifications/initialized 通知
   * @param params 通知参数
   * @returns null（通知消息不需要响应）
   */
  private async handleInitializedNotification(params?: any): Promise<null> {
    this.logger.debug("收到 initialized 通知，客户端初始化完成", params);

    // 可以在这里执行一些初始化完成后的逻辑
    // 例如：记录客户端连接状态、触发事件等

    return null;
  }

  /**
   * 处理 tools/list 请求
   * @param id 消息ID
   * @returns 工具列表响应
   */
  private async handleToolsList(id?: string | number): Promise<MCPResponse> {
    this.logger.debug("处理 tools/list 请求");

    try {
      const tools = this.serviceManager.getAllTools();

      // 转换为 MCP 标准格式
      const mcpTools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return {
        jsonrpc: "2.0",
        result: {
          tools: mcpTools,
        },
        id: id !== undefined ? id : 1,
      };
    } catch (error) {
      this.logger.error("获取工具列表失败", error);
      throw error;
    }
  }

  /**
   * 处理 tools/call 请求
   * @param params 工具调用参数
   * @param id 消息ID
   * @returns 工具调用响应
   */
  private async handleToolCall(
    params: ToolCallParams,
    id?: string | number
  ): Promise<MCPResponse> {
    try {
      if (!params.name) {
        throw new Error("工具名称不能为空");
      }

      const result = await this.serviceManager.callTool(
        params.name,
        params.arguments || {}
      );

      return {
        jsonrpc: "2.0",
        result: {
          content: result.content,
          isError: result.isError || false,
        },
        id: id !== undefined ? id : 1,
      };
    } catch (error) {
      this.logger.error(`工具调用失败: ${params.name}`, error);
      throw error;
    }
  }

  /**
   * 处理 ping 请求
   * @param id 消息ID
   * @returns ping 响应
   */
  private async handlePing(id?: string | number): Promise<MCPResponse> {
    this.logger.debug("处理 ping 请求");

    return {
      jsonrpc: "2.0",
      result: {
        status: "ok",
        timestamp: new Date().toISOString(),
      },
      id: id !== undefined ? id : 1,
    };
  }

  /**
   * 处理 resources/list 请求
   * @param id 消息ID
   * @returns 资源列表响应
   */
  private async handleResourcesList(
    id?: string | number
  ): Promise<MCPResponse> {
    this.logger.debug("处理 resources/list 请求");

    // 目前返回空的资源列表
    // 如果将来需要提供资源功能，可以在这里扩展
    const resources: MCPResource[] = [];

    this.logger.debug(`返回 ${resources.length} 个资源`);

    return {
      jsonrpc: "2.0",
      result: {
        resources: resources,
      },
      id: id !== undefined ? id : 1,
    };
  }

  /**
   * 处理 prompts/list 请求
   * @param id 消息ID
   * @returns 提示列表响应
   */
  private async handlePromptsList(id?: string | number): Promise<MCPResponse> {
    this.logger.debug("处理 prompts/list 请求");

    // 目前返回空的提示列表
    // 如果将来需要提供提示模板功能，可以在这里扩展
    const prompts: MCPPrompt[] = [];

    this.logger.debug(`返回 ${prompts.length} 个提示模板`);

    return {
      jsonrpc: "2.0",
      result: {
        prompts: prompts,
      },
      id: id !== undefined ? id : 1,
    };
  }

  /**
   * 创建错误响应
   * @param error 错误对象
   * @param id 消息ID
   * @returns 错误响应
   */
  private createErrorResponse(error: Error, id?: string | number): MCPResponse {
    // 根据错误类型确定错误代码
    let errorCode = -32603; // Internal error

    if (
      error.message.includes("未找到工具") ||
      error.message.includes("未知的方法")
    ) {
      errorCode = -32601; // Method not found
    } else if (
      error.message.includes("参数") ||
      error.message.includes("不能为空")
    ) {
      errorCode = -32602; // Invalid params
    }

    return {
      jsonrpc: "2.0",
      error: {
        code: errorCode,
        message: error.message,
        data: {
          stack: error.stack,
        },
      },
      id: id !== undefined ? id : 1,
    };
  }

  /**
   * 获取服务管理器实例
   * @returns MCPServiceManager 实例
   */
  getServiceManager(): MCPServiceManager {
    return this.serviceManager;
  }
}
