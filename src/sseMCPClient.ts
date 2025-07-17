import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { EventSource } from "eventsource";
import {
  type MCPToolConfig,
  type SSEMCPServerConfig,
  configManager,
} from "./configManager";
import { logger as globalLogger } from "./logger";
import type { IMCPClient } from "./mcpServerProxy";

// 全局 polyfill EventSource
(global as any).EventSource = EventSource;

// 为通用 SSE MCP 创建带标签的 logger
const logger = globalLogger.withTag("SSEMCP");

interface Tool {
  name: string;
  description?: string;
  inputSchema?: any;
}

/**
 * 通用 SSE MCP Client
 * 用于连接基于 SSE 的 MCP 服务，支持不需要特殊认证的服务
 */
export class SSEMCPClient implements IMCPClient {
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
   * 过滤启用的工具
   */
  private filterEnabledTools(allTools: Tool[]): Tool[] {
    return allTools.filter((tool) => {
      // 从前缀名称中提取原始名称
      const originalName = this.getOriginalToolName(tool.name);
      if (!originalName) return false;

      return configManager.isToolEnabled(this.name, originalName);
    });
  }

  /**
   * 更新配置文件中的工具列表
   */
  private async updateToolsConfig(): Promise<void> {
    try {
      const currentConfig = configManager.getServerToolsConfig(this.name);
      const newToolsConfig: Record<string, MCPToolConfig> = {};

      // 为每个工具创建配置项（如果不存在）
      for (const tool of this.originalTools) {
        const existingConfig = currentConfig[tool.name];
        newToolsConfig[tool.name] = {
          description: tool.description || existingConfig?.description || "",
          enable: existingConfig?.enable !== false, // 默认启用
        };
      }

      // 保留现有工具的配置
      for (const [toolName, toolConfig] of Object.entries(currentConfig)) {
        if (!newToolsConfig[toolName]) {
          newToolsConfig[toolName] = toolConfig;
        }
      }

      configManager.updateServerToolsConfig(this.name, newToolsConfig);
    } catch (error) {
      logger.debug(
        `更新 ${this.name} 工具配置失败：${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async start(): Promise<void> {
    logger.info(`正在启动 SSE MCP 客户端：${this.name}`);

    try {
      // 创建 SSE 传输层（不需要特殊认证）
      this.transport = new SSEClientTransport(new URL(this.config.url));

      // 创建 MCP 客户端
      this.client = new Client(
        {
          name: "xiaozhi-sse-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      // 连接到服务器
      logger.info(`正在连接到 ${this.config.url}`);
      await this.client.connect(this.transport);
      logger.info(`成功连接到 SSE MCP 服务器：${this.name}`);

      // 获取工具列表
      await this.refreshTools();

      this.initialized = true;
      logger.info(
        `${this.name} SSE 客户端已就绪，共 ${this.tools.length} 个工具`
      );
    } catch (error) {
      logger.error(
        `启动 SSE MCP 客户端 ${this.name} 失败：${
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
      const allPrefixedTools = this.originalTools.map((tool) => ({
        ...tool,
        name: this.generatePrefixedToolName(tool.name),
      }));

      // 根据配置过滤工具
      this.tools = this.filterEnabledTools(allPrefixedTools);

      // 更新配置文件中的工具列表（如果需要）
      await this.updateToolsConfig();

      logger.info(
        `${this.name} 加载了 ${
          this.originalTools.length
        } 个工具：${this.originalTools.map((t) => t.name).join(", ")}`
      );
      logger.info(
        `${this.name} 启用了 ${this.tools.length} 个工具：${this.tools
          .map((t) => t.name)
          .join(", ")}`
      );
    } catch (error) {
      logger.error(
        `刷新 ${this.name} 工具列表失败：${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * 从带前缀的工具名称中提取原始工具名称
   */
  getOriginalToolName(prefixedName: string): string | null {
    const normalizedServerName = this.name.replace(/-/g, "_");
    const prefix = `${normalizedServerName}_xzcli_`;

    if (prefixedName.startsWith(prefix)) {
      return prefixedName.substring(prefix.length);
    }

    return null;
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
        `调用 SSE 工具 ${originalName}，参数：${JSON.stringify(arguments_)}`
      );

      const result = await this.client.callTool({
        name: originalName,
        arguments: arguments_,
      });

      logger.info(
        `SSE 工具调用返回: ${JSON.stringify(result).substring(0, 500)}...`
      );

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
    logger.info(`正在停止 SSE MCP 客户端：${this.name}`);

    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }

      if (this.transport) {
        this.transport = null;
      }

      logger.info(`SSE MCP 客户端 ${this.name} 已停止`);
    } catch (error) {
      logger.error(
        `停止 SSE MCP 客户端 ${this.name} 失败：${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      // 无论是否出错，都要将状态设置为未初始化
      this.initialized = false;
    }
  }
}
