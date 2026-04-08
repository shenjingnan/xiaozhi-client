/**
 * 内部 MCP 服务管理器适配器
 * 将 mcpServers 配置转换为 IMCPServiceManager 接口
 * 使用 @xiaozhi-client/mcp-core 的 MCPManager 实现真实的 MCP 功能
 */

import { MCPManager } from "@xiaozhi-client/mcp-core";
import type { EnhancedToolInfo, ToolCallResult, JSONSchema } from "./types.js";
import type { IMCPServiceManager } from "./types.js";
import type { EndpointConfig } from "./types.js";
import { normalizeServiceConfig } from "@xiaozhi-client/config";

/**
 * 内部 MCP 服务管理器适配器
 * 实现 IMCPServiceManager 接口，使用真正的 MCPManager
 */
export class InternalMCPManagerAdapter implements IMCPServiceManager {
  private mcpManager: MCPManager;
  private tools: Map<string, EnhancedToolInfo> = new Map();
  private isInitialized = false;

  constructor(private config: EndpointConfig) {
    this.mcpManager = new MCPManager();

    // 转换配置并添加到 MCPManager
    for (const [serviceName, serverConfig] of Object.entries(
      config.mcpServers
    )) {
      const mcpConfig = normalizeServiceConfig(serverConfig);
      this.mcpManager.addServer(serviceName, mcpConfig);
    }

    // 设置事件监听
    this.mcpManager.on("connected", (data) => {
      console.info(
        `MCP 服务 ${data.serverName} 已连接，工具数: ${data.tools.length}`
      );
    });

    this.mcpManager.on("error", (data) => {
      console.error(`MCP 服务 ${data.serverName} 出错:`, data.error);
    });
  }

  /**
   * 初始化并启动所有 MCP 服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // 连接所有 MCP 服务
    await this.mcpManager.connect();

    // 刷新工具列表
    await this.refreshTools();

    this.isInitialized = true;
  }

  /**
   * 获取所有工具列表
   */
  getAllTools(): EnhancedToolInfo[] {
    return Array.from(this.tools.values());
  }

  /**
   * 调用工具（真实实现）
   */
  async callTool(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<ToolCallResult> {
    // 解析工具名称：serviceName__toolName
    const [serviceName, actualToolName] = this.parseToolName(toolName);

    // 调用真实的 MCP 工具
    return (await this.mcpManager.callTool(
      serviceName,
      actualToolName,
      arguments_
    )) as ToolCallResult;
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.mcpManager.disconnect();
    this.tools.clear();
    this.isInitialized = false;
  }

  /**
   * 刷新工具列表
   */
  private async refreshTools(): Promise<void> {
    this.tools.clear();

    const mcpTools = this.mcpManager.listTools();

    for (const mcpTool of mcpTools) {
      // 验证并规范化 inputSchema，确保类型安全
      const inputSchema = this.validateAndNormalizeSchema(mcpTool.inputSchema);

      const enhancedTool: EnhancedToolInfo = {
        name: `${mcpTool.serverName}__${mcpTool.name}`,
        description: mcpTool.description,
        inputSchema,
        serviceName: mcpTool.serverName,
        originalName: mcpTool.name,
        enabled: true,
        usageCount: 0,
        lastUsedTime: new Date().toISOString(),
      };
      this.tools.set(enhancedTool.name, enhancedTool);
    }
  }

  /**
   * 验证并规范化 JSON Schema
   * 如果 schema 无效，返回默认的空对象 schema
   */
  private validateAndNormalizeSchema(schema: unknown): JSONSchema {
    if (this.isValidJSONSchema(schema)) {
      return schema;
    }

    // 返回默认的空对象 schema
    return {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: true,
    };
  }

  /**
   * 类型守卫：检查对象是否为有效的 JSON Schema
   */
  private isValidJSONSchema(obj: unknown): obj is JSONSchema {
    return (
      typeof obj === "object" &&
      obj !== null &&
      "type" in obj &&
      typeof (obj as { type: unknown }).type === "string"
    );
  }

  /**
   * 解析工具名称
   */
  private parseToolName(toolName: string): [string, string] {
    const parts = toolName.split("__");
    if (parts.length < 2) {
      throw new Error(`无效的工具名称格式: ${toolName}`);
    }
    const serviceName = parts[0];
    const actualToolName = parts.slice(1).join("__"); // 支持工具名中包含 __
    return [serviceName, actualToolName];
  }
}
