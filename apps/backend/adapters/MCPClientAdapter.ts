/**
 * MCP 客户端适配器
 * 将新的 MCPService 适配到旧的 IMCPClient 接口，确保向后兼容性
 */

import { MCPService } from "@/lib/mcp";
import type { MCPServiceConfig, ToolCallResult } from "@/lib/mcp/types";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { logger as globalLogger } from "@root/Logger.js";
import { TypeFieldNormalizer } from "@utils/TypeFieldNormalizer.js";

/**
 * MCP 客户端接口
 * 定义了 MCP 客户端的标准接口
 */
export interface IMCPClient {
  readonly initialized: boolean;
  readonly tools: Tool[];
  readonly originalTools: Tool[];

  start(): Promise<void>;
  refreshTools(): Promise<void>;
  callTool(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<unknown>;
  stop(): Promise<void>;
  getOriginalToolName(prefixedToolName: string): string | null;
}

// 为适配器创建 logger
const logger = globalLogger;

/**
 * MCP 客户端适配器类
 * 实现 IMCPClient 接口，内部使用 MCPService 提供功能
 */
export class MCPClientAdapter implements IMCPClient {
  private mcpService: MCPService;
  private serviceName: string;
  private _tools: Tool[] = [];
  private _originalTools: Tool[] = [];
  private _initialized = false;

  constructor(serviceName: string, config: MCPServiceConfig) {
    this.serviceName = serviceName;
    // 标准化配置并确保配置中包含服务名称
    const normalizedConfig = TypeFieldNormalizer.normalizeTypeField(
      config
    ) as MCPServiceConfig;
    const serviceConfig = { ...normalizedConfig, name: serviceName };
    this.mcpService = new MCPService(serviceConfig);

    logger.info(`创建 MCPClientAdapter: ${serviceName}`);
  }

  /**
   * 获取初始化状态
   */
  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * 获取工具列表（带前缀）
   */
  get tools(): Tool[] {
    return this._tools;
  }

  /**
   * 获取原始工具列表（不带前缀）
   */
  get originalTools(): Tool[] {
    return this._originalTools;
  }

  /**
   * 启动 MCP 服务
   */
  async start(): Promise<void> {
    try {
      logger.info(`启动 MCP 服务: ${this.serviceName}`);

      // 连接到 MCP 服务
      await this.mcpService.connect();

      // 刷新工具列表
      await this.refreshTools();

      this._initialized = true;
      logger.info(
        `MCP 服务 ${this.serviceName} 启动成功，共 ${this._tools.length} 个工具`
      );
    } catch (error) {
      logger.error(`启动 MCP 服务 ${this.serviceName} 失败:`, error);
      throw error;
    }
  }

  /**
   * 刷新工具列表
   */
  async refreshTools(): Promise<void> {
    try {
      logger.debug(`刷新 ${this.serviceName} 的工具列表`);

      // 从 MCPService 获取工具列表
      const serviceTools = this.mcpService.getTools();

      // 存储原始工具列表
      this._originalTools = [...serviceTools];

      // 生成带前缀的工具列表
      this._tools = serviceTools.map((tool) => ({
        ...tool,
        name: this.generatePrefixedToolName(tool.name),
      }));

      logger.info(
        `${this.serviceName} 工具列表已刷新，共 ${this._tools.length} 个工具`
      );
    } catch (error) {
      logger.error(`刷新 ${this.serviceName} 工具列表失败:`, error);
      throw error;
    }
  }

  /**
   * 调用工具
   */
  async callTool(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<unknown> {
    try {
      // 将前缀工具名转换为原始工具名
      const originalName = this.getOriginalToolName(toolName);
      if (!originalName) {
        throw new Error(`无效的工具名称格式: ${toolName}`);
      }

      logger.info(
        `调用 ${this.serviceName} 的工具 ${originalName}，参数:`,
        JSON.stringify(arguments_)
      );

      // 使用 MCPService 调用工具
      const result: ToolCallResult = await this.mcpService.callTool(
        originalName,
        arguments_
      );

      // 转换结果格式以保持兼容性
      const compatibleResult = this.convertToolCallResult(result);

      logger.info(`工具 ${originalName} 调用成功`);
      return compatibleResult;
    } catch (error) {
      logger.error(`调用工具 ${toolName} 失败:`, error);
      throw error;
    }
  }

  /**
   * 停止 MCP 服务
   */
  async stop(): Promise<void> {
    try {
      logger.info(`停止 MCP 服务: ${this.serviceName}`);
      await this.mcpService.disconnect();
      this._initialized = false;
      this._tools = [];
      this._originalTools = [];
      logger.info(`MCP 服务 ${this.serviceName} 已停止`);
    } catch (error) {
      logger.error(`停止 MCP 服务 ${this.serviceName} 失败:`, error);
      throw error;
    }
  }

  /**
   * 获取原始工具名称（去除前缀）
   */
  getOriginalToolName(prefixedToolName: string): string | null {
    // 工具前缀格式: {serviceName}_xzcli_{originalToolName}
    const normalizedServerName = this.serviceName.replace(/-/g, "_");
    const prefix = `${normalizedServerName}_xzcli_`;

    if (prefixedToolName.startsWith(prefix)) {
      return prefixedToolName.substring(prefix.length);
    }

    return null;
  }

  /**
   * 生成带前缀的工具名称
   */
  private generatePrefixedToolName(originalToolName: string): string {
    const normalizedServerName = this.serviceName.replace(/-/g, "_");
    return `${normalizedServerName}_xzcli_${originalToolName}`;
  }

  /**
   * 转换工具调用结果格式以保持兼容性
   */
  private convertToolCallResult(result: ToolCallResult): unknown {
    // 如果结果是错误，直接抛出异常
    if (result.isError) {
      const errorMessage = result.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");
      throw new Error(errorMessage || "工具调用失败");
    }

    // 对于成功的结果，返回兼容的格式
    // 旧的客户端期望直接返回结果对象，而不是 ToolCallResult 格式
    if (result.content && result.content.length > 0) {
      // 如果只有一个文本内容，直接返回文本
      if (result.content.length === 1 && result.content[0].type === "text") {
        try {
          // 尝试解析为 JSON
          return JSON.parse(result.content[0].text);
        } catch {
          // 如果不是 JSON，返回原始文本
          return result.content[0].text;
        }
      }

      // 如果有多个内容项，返回完整的内容数组
      return result.content;
    }

    // 默认返回空对象
    return {};
  }

  /**
   * 获取服务状态（扩展方法，不在 IMCPClient 接口中）
   */
  getServiceStatus() {
    return this.mcpService.getStatus();
  }

  /**
   * 获取底层 MCPService 实例（用于高级操作）
   */
  getMCPService(): MCPService {
    return this.mcpService;
  }
}
