import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { EventSource } from "eventsource";
import type { SSEMCPServerConfig } from "./configManager";
import { logger as globalLogger } from "./logger";
import type { IMCPClient } from "./mcpServerProxy";

// 全局 polyfill EventSource
(global as any).EventSource = EventSource;

// 为 ModelScope MCP 创建带标签的 logger
const logger = globalLogger.withTag("ModelScopeMCP");

interface Tool {
  name: string;
  description?: string;
  inputSchema?: any;
}

/**
 * ModelScope MCP Client for SSE connections
 */
export class ModelScopeMCPClient implements IMCPClient {
  private name: string;
  private config: SSEMCPServerConfig;
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  public initialized = false;
  public tools: Tool[] = [];
  public originalTools: Tool[] = [];

  constructor(name: string, config: SSEMCPServerConfig) {
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

  async start() {
    logger.info(`正在启动 ModelScope MCP 客户端：${this.name}`);

    try {
      // 从环境变量获取 API Token
      const token = process.env.MODELSCOPE_API_TOKEN;
      if (!token) {
        throw new Error(
          "未设置 MODELSCOPE_API_TOKEN 环境变量。请设置该环境变量后重试。"
        );
      }

      // 创建 SSE 传输层
      const sseOptions = {
        eventSourceInit: {
          fetch: async (url: string | URL | Request, init?: RequestInit) => {
            // 添加认证头
            const headers = {
              ...init?.headers,
              Authorization: `Bearer ${token}`,
            };

            return fetch(url, { ...init, headers });
          },
        },
        requestInit: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      };

      this.transport = new SSEClientTransport(
        new URL(this.config.url),
        sseOptions
      );

      // 创建 MCP 客户端
      this.client = new Client(
        {
          name: "xiaozhi-modelscope-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      // 连接到服务器
      logger.info(`正在连接到 ${this.config.url}`);
      await this.client.connect(this.transport);
      logger.info(`成功连接到 ModelScope MCP 服务器：${this.name}`);

      // 获取工具列表
      await this.refreshTools();

      this.initialized = true;
      logger.info(
        `${this.name} ModelScope 客户端已就绪，共 ${this.tools.length} 个工具`
      );
    } catch (error) {
      logger.error(
        `启动 ModelScope MCP 客户端 ${this.name} 失败：${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  async refreshTools(): Promise<void> {
    try {
      if (!this.client) {
        throw new Error("客户端未初始化");
      }

      const result = await this.client.listTools();
      this.originalTools = result.tools || [];

      // 为每个工具生成带前缀的名称
      this.tools = this.originalTools.map((tool) => ({
        ...tool,
        name: this.generatePrefixedToolName(tool.name),
      }));

      logger.info(
        `${this.name} 加载了 ${this.originalTools.length} 个工具：${this.originalTools
          .map((t) => t.name)
          .join(", ")}`
      );
    } catch (error) {
      logger.error(
        `从 ${this.name} 获取工具失败：${
          error instanceof Error ? error.message : String(error)
        }`
      );
      this.tools = [];
      this.originalTools = [];
    }
  }

  async callTool(prefixedName: string, arguments_: any): Promise<any> {
    try {
      if (!this.client) {
        throw new Error("客户端未初始化");
      }

      // 将前缀名称转换回原始名称
      const originalName = this.getOriginalToolName(prefixedName);
      if (!originalName) {
        throw new Error(`无效的工具名称格式：${prefixedName}`);
      }

      logger.info(
        `调用 ModelScope 工具 ${originalName}，参数：${JSON.stringify(
          arguments_
        )}`
      );

      const result = await this.client.callTool({
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

  async stop(): Promise<void> {
    if (this.client) {
      logger.info(`正在停止 ${this.name} ModelScope 客户端`);
      try {
        await this.client.close();
      } catch (error) {
        logger.error(
          `关闭客户端时出错：${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      this.client = null;
      this.transport = null;
    }
    this.initialized = false;
  }
}
