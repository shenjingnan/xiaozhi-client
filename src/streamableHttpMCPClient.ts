import { type StreamableHTTPMCPServerConfig, configManager } from "./configManager";
import { logger as globalLogger } from "./logger";
import type { IMCPClient } from "./mcpServerProxy";

// 为 StreamableHTTP MCP 创建带标签的 logger
const logger = globalLogger.withTag("StreamableHTTPMCP");

interface Tool {
  name: string;
  description?: string;
  inputSchema?: any;
}

interface JSONRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id: number | string;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: number | string;
}

/**
 * Streamable HTTP MCP Client
 * 用于连接基于 HTTP 的 MCP 服务，如高德地图 MCP
 */
export class StreamableHTTPMCPClient implements IMCPClient {
  private name: string;
  private config: StreamableHTTPMCPServerConfig;
  private requestId = 1;
  public initialized = false;
  public tools: Tool[] = [];
  public originalTools: Tool[] = [];

  constructor(name: string, config: StreamableHTTPMCPServerConfig) {
    this.name = name;
    this.config = config;
  }

  /**
   * 生成带前缀的工具名称
   */
  private generatePrefixedToolName(originalToolName: string): string {
    const normalizedServerName = this.name.replace(/-/g, "_");
    return `${normalizedServerName}_xzcli_${originalToolName}`;
  }

  /**
   * 根据前缀工具名称获取原始工具名称
   */
  getOriginalToolName(prefixedToolName: string): string | null {
    const normalizedServerName = this.name.replace(/-/g, "_");
    const prefix = `${normalizedServerName}_xzcli_`;

    if (prefixedToolName.startsWith(prefix)) {
      return prefixedToolName.substring(prefix.length);
    }

    return null;
  }

  /**
   * 发送 JSON-RPC 请求到 HTTP 端点
   */
  private async sendRequest(method: string, params?: any): Promise<any> {
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      method,
      params,
      id: this.requestId++,
    };

    logger.debug(`发送请求到 ${this.name}: ${JSON.stringify(request)}`);

    try {
      // 动态导入 node-fetch
      const fetch = (await import("node-fetch")).default;
      
      const response = await fetch(this.config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as JSONRPCResponse;

      if (result.error) {
        throw new Error(
          `JSON-RPC error: ${result.error.message} (code: ${result.error.code})`
        );
      }

      return result.result;
    } catch (error) {
      logger.error(
        `请求失败 (${method}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  async start() {
    logger.info(`正在启动 Streamable HTTP MCP 客户端：${this.name}`);

    try {
      // 初始化连接
      await this.sendRequest("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: "xiaozhi-streamable-http-client",
          version: "1.0.0",
        },
      });

      // 通知初始化完成（某些服务可能不支持此方法）
      try {
        await this.sendRequest("notifications/initialized");
      } catch (error) {
        // 忽略此错误，因为某些服务（如高德地图）不支持此通知
        logger.debug(`${this.name} 不支持 notifications/initialized: ${error}`);
      }

      // 获取工具列表
      const listToolsResult = await this.sendRequest("tools/list");
      
      if (listToolsResult && listToolsResult.tools) {
        this.originalTools = listToolsResult.tools;
        
        // 生成带前缀的工具名称
        this.tools = this.originalTools
          .filter((tool) => configManager.isToolEnabled(this.name, tool.name))
          .map((tool) => ({
            ...tool,
            name: this.generatePrefixedToolName(tool.name),
          }));
        
        logger.info(
          `Streamable HTTP MCP 客户端 ${this.name} 已初始化，包含 ${this.tools.length}/${this.originalTools.length} 个已启用的工具`
        );
      }

      this.initialized = true;
    } catch (error) {
      logger.error(
        `启动 Streamable HTTP MCP 客户端 ${this.name} 失败：${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  async refreshTools() {
    try {
      const listToolsResult = await this.sendRequest("tools/list");
      
      if (listToolsResult && listToolsResult.tools) {
        this.originalTools = listToolsResult.tools;
        
        // 重新生成带前缀的工具名称
        this.tools = this.originalTools
          .filter((tool) => configManager.isToolEnabled(this.name, tool.name))
          .map((tool) => ({
            ...tool,
            name: this.generatePrefixedToolName(tool.name),
          }));
        
        logger.info(
          `已刷新 ${this.name} 的工具列表，包含 ${this.tools.length}/${this.originalTools.length} 个已启用的工具`
        );
      }
    } catch (error) {
      logger.error(
        `刷新 ${this.name} 的工具列表失败：${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async callTool(prefixedName: string, arguments_: any): Promise<any> {
    try {
      // 将前缀名称转换回原始名称
      const originalName = this.getOriginalToolName(prefixedName);
      if (!originalName) {
        throw new Error(`无效的工具名称格式：${prefixedName}`);
      }

      const result = await this.sendRequest("tools/call", {
        name: originalName,
        arguments: arguments_,
      });

      return result;
    } catch (error) {
      logger.error(
        `在 ${this.name} 上调用工具 ${prefixedName} 失败：${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  async stop() {
    logger.info(`正在停止 ${this.name} 客户端`);
    this.initialized = false;
  }
}