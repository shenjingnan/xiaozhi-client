/**
 * 内部 MCP 服务管理器适配器
 * 将 mcpServers 配置转换为 IMCPServiceManager 接口
 * 使用 @xiaozhi-client/mcp-core 的 MCPManager 实现真实的 MCP 功能
 */

import { MCPManager } from "@xiaozhi-client/mcp-core";
import type { MCPServiceConfig } from "@xiaozhi-client/mcp-core";
import type { EnhancedToolInfo, ToolCallResult } from "./types.js";
import type { IMCPServiceManager } from "./types.js";
import type { EndpointConfig, MCPServerConfig } from "./types.js";
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
      const mcpConfig = this.convertToMCPServiceConfig(serviceName, serverConfig);
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
    return this.mcpManager.callTool(serviceName, actualToolName, arguments_);
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
      const enhancedTool: EnhancedToolInfo = {
        name: `${mcpTool.serverName}__${mcpTool.name}`,
        description: mcpTool.description,
        inputSchema: mcpTool.inputSchema as any,
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

  /**
   * 将 MCPServerConfig 转换为 MCPServiceConfig
   * 使用统一的配置适配器，确保路径解析逻辑一致
   */
  private convertToMCPServiceConfig(
    serviceName: string,
    config: MCPServerConfig
  ): MCPServiceConfig {
    // 使用统一的转换函数，自动处理相对路径解析
    // normalizeServiceConfig 会：
    // 1. 解析 command 中的相对路径（相对于配置文件目录）
    // 2. 解析 args 中的相对路径
    // 3. 返回带有 name 字段的完整配置
    const converted = normalizeServiceConfig(serviceName, config);

    // 移除 name 字段（因为 InternalMCPManagerAdapter 不需要）
    const { name, ...rest } = converted;

    return rest;
  }
}
