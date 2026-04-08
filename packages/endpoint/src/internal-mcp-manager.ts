/**
 * 内部 MCP 服务管理器适配器
 * 将 mcpServers 配置转换为 IMCPServiceManager 接口
 * 使用 @xiaozhi-client/mcp-core 的 MCPManager 实现真实的 MCP 功能
 */

import { MCPManager } from "@xiaozhi-client/mcp-core";
import type { EnhancedToolInfo, ToolCallResult } from "./types.js";
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

  /**
   * 处理 MCP 服务连接事件
   */
  private connectedHandler = (data: unknown) => {
    console.info(
      `MCP 服务 ${(data as { serverName: string; tools: unknown[] }).serverName} 已连接，工具数: ${(data as { serverName: string; tools: unknown[] }).tools.length}`
    );
  };

  /**
   * 处理 MCP 服务错误事件
   */
  private errorHandler = (data: unknown) => {
    console.error(
      `MCP 服务 ${(data as { serverName: string; error: Error }).serverName} 出错:`,
      (data as { serverName: string; error: Error }).error
    );
  };

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
    this.mcpManager.on("connected", this.connectedHandler);
    this.mcpManager.on("error", this.errorHandler);
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
    // 移除事件监听器，防止内存泄漏
    this.mcpManager.removeListener("connected", this.connectedHandler);
    this.mcpManager.removeListener("error", this.errorHandler);

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
}
