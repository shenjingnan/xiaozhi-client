/**
 * 内部 MCP 服务管理器适配器
 * 将 mcpServers 配置转换为 IMCPServiceManager 接口
 */

import type { EnhancedToolInfo, ToolCallResult } from "./types.js";
import type { IMCPServiceManager } from "./types.js";
import type { EndpointConfig, MCPServerConfig } from "./types.js";

/**
 * 内部 MCP 服务管理器适配器
 * 实现 IMCPServiceManager 接口，简化配置流程
 */
export class InternalMCPManagerAdapter implements IMCPServiceManager {
  private tools: Map<string, EnhancedToolInfo> = new Map();
  private isInitialized = false;

  constructor(private config: EndpointConfig) {
    // 构造函数中暂不启动服务，等待 connect() 时启动
  }

  /**
   * 初始化并启动所有 MCP 服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // 将 mcpServers 配置转换为工具列表
    for (const [serviceName, serverConfig] of Object.entries(
      this.config.mcpServers
    )) {
      await this._loadServiceTools(serviceName, serverConfig);
    }

    this.isInitialized = true;
  }

  /**
   * 获取所有工具列表
   */
  getAllTools(): EnhancedToolInfo[] {
    return Array.from(this.tools.values());
  }

  /**
   * 调用工具
   */
  async callTool(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<ToolCallResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        content: [
          {
            type: "text",
            text: `工具不存在: ${toolName}`,
          },
        ],
        isError: true,
      };
    }

    // 这里应该调用实际的 MCP 工具
    // 由于这是简化实现，返回占位结果
    return {
      content: [
        {
          type: "text",
          text: `工具 ${toolName} 调用成功（占位实现）`,
        },
      ],
      isError: false,
    };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.tools.clear();
    this.isInitialized = false;
  }

  /**
   * 加载服务的工具列表
   * 这是一个简化实现，实际应该连接到 MCP 服务获取工具列表
   */
  private async _loadServiceTools(
    serviceName: string,
    serverConfig: MCPServerConfig
  ): Promise<void> {
    // 简化实现：为每个服务创建一个占位工具
    // 实际实现应该连接到 MCP 服务并获取真实的工具列表

    const toolName = `${serviceName}__tool`;
    this.tools.set(toolName, {
      name: toolName,
      description: `来自 ${serviceName} 的工具`,
      inputSchema: {
        type: "object",
        properties: {},
      },
      serviceName,
      originalName: "tool",
      enabled: true,
      usageCount: 0,
      lastUsedTime: new Date().toISOString(),
    });
  }
}
