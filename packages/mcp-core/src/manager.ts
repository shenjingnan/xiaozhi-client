/**
 * 简化版 MCP 服务管理器
 * 专门为 endpoint 包设计，提供核心 MCP 服务管理功能
 */

import { EventEmitter } from "node:events";
import type {
  EnhancedToolInfo,
  MCPServiceConfig,
  ManagerStatus,
  ToolCallResult,
  ToolStatusFilter,
} from "./types.js";
import { ToolCallError, ToolCallErrorCode } from "./types.js";

/**
 * 简化版 MCP 服务管理器
 * 提供 MCP 服务的核心管理功能
 */
export class MCPServiceManager extends EventEmitter {
  private configs: Record<string, MCPServiceConfig> = {};
  private tools: Map<string, EnhancedToolInfo> = new Map();
  private isInitialized = false;

  constructor(configs?: Record<string, MCPServiceConfig>) {
    super();
    if (configs) {
      this.configs = configs;
    }
  }

  /**
   * 添加服务配置
   */
  addServiceConfig(name: string, config: MCPServiceConfig): void {
    this.configs[name] = { ...config, name };
  }

  /**
   * 更新服务配置
   */
  updateServiceConfig(name: string, config: MCPServiceConfig): void {
    if (!this.configs[name]) {
      throw new Error(`服务不存在: ${name}`);
    }
    this.configs[name] = { ...config, name };
  }

  /**
   * 移除服务配置
   */
  removeServiceConfig(name: string): void {
    delete this.configs[name];
  }

  /**
   * 获取所有服务配置
   */
  getServiceConfigs(): Record<string, MCPServiceConfig> {
    return { ...this.configs };
  }

  /**
   * 启动所有服务
   */
  async startAllServices(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // 这里应该创建实际的 MCP 服务连接
    // 由于 endpoint 包需要独立发布，我们暂时提供一个基础实现
    this.isInitialized = true;

    this.emit("initialized");
  }

  /**
   * 启动单个服务
   */
  async startService(serviceName: string): Promise<void> {
    if (!this.configs[serviceName]) {
      throw new Error(`服务配置不存在: ${serviceName}`);
    }

    // 这里应该创建实际的 MCP 服务连接
    this.emit("serviceStarted", serviceName);
  }

  /**
   * 获取所有工具列表
   */
  getAllTools(status: ToolStatusFilter = "all"): EnhancedToolInfo[] {
    const allTools = Array.from(this.tools.values());

    if (status === "all") {
      return allTools;
    }

    return allTools.filter((tool) =>
      status === "enabled" ? tool.enabled : !tool.enabled
    );
  }

  /**
   * 调用工具
   */
  async callTool(
    toolName: string,
    _arguments_: Record<string, unknown>,
    _options?: { timeout?: number }
  ): Promise<ToolCallResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      throw new ToolCallError(
        ToolCallErrorCode.TOOL_NOT_FOUND,
        `工具不存在: ${toolName}`
      );
    }

    if (!tool.enabled) {
      throw new ToolCallError(
        ToolCallErrorCode.SERVICE_UNAVAILABLE,
        `工具已禁用: ${toolName}`
      );
    }

    // 这里应该调用实际的 MCP 工具
    // 由于这是一个简化实现，我们返回一个占位结果
    return {
      content: [
        {
          type: "text",
          text: `工具 ${toolName} 需要通过实际的 MCP 连接调用`,
        },
      ],
      isError: false,
    };
  }

  /**
   * 添加工具（用于测试或自定义工具）
   */
  addTool(tool: EnhancedToolInfo): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 移除工具
   */
  removeTool(toolName: string): void {
    this.tools.delete(toolName);
  }

  /**
   * 获取管理器状态
   */
  getStatus(): ManagerStatus {
    const availableTools = this.getAllTools("enabled").map((t) => t.name);

    return {
      services: {},
      totalTools: this.tools.size,
      availableTools,
    };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.tools.clear();
    this.isInitialized = false;
  }
}
