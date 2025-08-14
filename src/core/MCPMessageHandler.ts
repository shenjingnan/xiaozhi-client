/**
 * 统一的 MCP 消息处理器
 * 负责处理所有 MCP 协议消息，包括 initialize、tools/list、tools/call 等
 * 这是阶段一重构的核心组件，用于消除双层代理架构
 */

import { Logger } from "../logger.js";
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
  id: string | number | null;
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

export class MCPMessageHandler {
  private logger: Logger;
  private serviceManager: MCPServiceManager;

  constructor(serviceManager: MCPServiceManager) {
    this.serviceManager = serviceManager;
    this.logger = new Logger().withTag("MCPMessageHandler");
  }

  /**
   * 处理 MCP 消息的统一入口
   * @param message MCP 消息
   * @returns MCP 响应
   */
  async handleMessage(message: MCPMessage): Promise<MCPResponse> {
    this.logger.debug(`处理 MCP 消息: ${message.method}`, message);

    try {
      switch (message.method) {
        case "initialize":
          return await this.handleInitialize(message.params, message.id);
        case "tools/list":
          return await this.handleToolsList(message.id);
        case "tools/call":
          return await this.handleToolCall(message.params, message.id);
        case "ping":
          return await this.handlePing(message.id);
        default:
          throw new Error(`未知的方法: ${message.method}`);
      }
    } catch (error) {
      this.logger.error(`处理消息时出错: ${message.method}`, error);
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
    this.logger.info("处理 initialize 请求", params);

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
        protocolVersion: "2024-11-05",
      },
      id: id || null,
    };
  }

  /**
   * 处理 tools/list 请求
   * @param id 消息ID
   * @returns 工具列表响应
   */
  private async handleToolsList(id?: string | number): Promise<MCPResponse> {
    this.logger.info("处理 tools/list 请求");

    try {
      const tools = this.serviceManager.getAllTools();

      // 转换为 MCP 标准格式
      const mcpTools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      this.logger.info(`返回 ${mcpTools.length} 个工具`);

      return {
        jsonrpc: "2.0",
        result: {
          tools: mcpTools,
        },
        id: id || null,
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
    this.logger.info(`处理 tools/call 请求: ${params.name}`, params);

    try {
      if (!params.name) {
        throw new Error("工具名称不能为空");
      }

      const result = await this.serviceManager.callTool(
        params.name,
        params.arguments || {}
      );

      this.logger.info(`工具 ${params.name} 调用成功`);

      return {
        jsonrpc: "2.0",
        result: {
          content: result.content,
          isError: result.isError || false,
        },
        id: id || null,
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
      id: id || null,
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
      id: id || null,
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
