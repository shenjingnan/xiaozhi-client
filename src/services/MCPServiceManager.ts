#!/usr/bin/env node

/**
 * MCP 服务管理器 - 重构版本
 * 使用 MCPService 实例管理多个 MCP 服务
 * 专注于实例管理、工具聚合和路由调用
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { LocalMCPServerConfig } from "../configManager.js";
import { Logger } from "../logger.js";
import {
  MCPService,
  type MCPServiceConfig,
  type MCPServiceStatus,
  MCPTransportType,
} from "./MCPService.js";

// 工具信息接口（保持向后兼容）
interface ToolInfo {
  serviceName: string;
  originalName: string;
  tool: Tool;
}

// 服务状态接口（保持向后兼容）
interface ServiceStatus {
  connected: boolean;
  clientName: string;
}

// 管理器状态接口（保持向后兼容）
interface ManagerStatus {
  services: Record<string, ServiceStatus>;
  totalTools: number;
  availableTools: string[];
}

// 工具调用结果接口（保持向后兼容）
interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export class MCPServiceManager {
  private services: Map<string, MCPService> = new Map();
  private configs: Record<string, MCPServiceConfig> = {};
  private logger: Logger;
  private tools: Map<string, ToolInfo> = new Map(); // 缓存工具信息，保持向后兼容

  constructor() {
    this.logger = new Logger().withTag("MCPManager");
  }

  /**
   * 启动所有 MCP 服务
   */
  async startAllServices(): Promise<void> {
    this.logger.info("正在启动所有 MCP 服务...");

    for (const [serviceName, config] of Object.entries(this.configs)) {
      await this.startService(serviceName);
    }

    this.logger.info("所有 MCP 服务启动完成");
  }

  /**
   * 启动单个 MCP 服务
   */
  async startService(serviceName: string): Promise<void> {
    this.logger.info(`启动 MCP 服务: ${serviceName}`);

    const config = this.configs[serviceName];
    if (!config) {
      throw new Error(`未找到服务配置: ${serviceName}`);
    }

    try {
      // 如果服务已存在，先停止它
      if (this.services.has(serviceName)) {
        await this.stopService(serviceName);
      }

      // 创建 MCPService 实例
      const service = new MCPService(config);

      // 连接到服务
      await service.connect();

      // 存储服务实例
      this.services.set(serviceName, service);

      // 更新工具缓存
      await this.refreshToolsCache();

      const tools = service.getTools();
      this.logger.info(
        `${serviceName} 服务启动成功，加载了 ${tools.length} 个工具:`,
        tools.map((t) => t.name).join(", ")
      );
    } catch (error) {
      this.logger.error(
        `启动 ${serviceName} 服务失败:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 停止单个服务
   */
  async stopService(serviceName: string): Promise<void> {
    this.logger.info(`停止 MCP 服务: ${serviceName}`);

    const service = this.services.get(serviceName);
    if (!service) {
      this.logger.warn(`服务 ${serviceName} 不存在或未启动`);
      return;
    }

    try {
      await service.disconnect();
      this.services.delete(serviceName);

      // 更新工具缓存
      await this.refreshToolsCache();

      this.logger.info(`${serviceName} 服务已停止`);
    } catch (error) {
      this.logger.error(
        `停止 ${serviceName} 服务失败:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 刷新工具缓存
   */
  private async refreshToolsCache(): Promise<void> {
    this.tools.clear();

    for (const [serviceName, service] of this.services) {
      if (service.isConnected()) {
        const tools = service.getTools();
        for (const tool of tools) {
          const toolKey = `${serviceName}__${tool.name}`;
          this.tools.set(toolKey, {
            serviceName,
            originalName: tool.name,
            tool,
          });
        }
      }
    }
  }

  /**
   * 获取所有可用工具
   */
  getAllTools(): Array<{
    name: string;
    description: string;
    inputSchema: any;
    serviceName: string;
    originalName: string;
  }> {
    const allTools: Array<{
      name: string;
      description: string;
      inputSchema: any;
      serviceName: string;
      originalName: string;
    }> = [];

    for (const [toolKey, toolInfo] of this.tools) {
      allTools.push({
        name: toolKey,
        description: toolInfo.tool.description || "",
        inputSchema: toolInfo.tool.inputSchema,
        serviceName: toolInfo.serviceName,
        originalName: toolInfo.originalName,
      });
    }
    return allTools;
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(toolName: string, arguments_: any): Promise<ToolCallResult> {
    this.logger.info(`调用工具: ${toolName}，参数:`, arguments_);

    const toolInfo = this.tools.get(toolName);
    if (!toolInfo) {
      throw new Error(`未找到工具: ${toolName}`);
    }

    const service = this.services.get(toolInfo.serviceName);
    if (!service) {
      throw new Error(`服务 ${toolInfo.serviceName} 不可用`);
    }

    if (!service.isConnected()) {
      throw new Error(`服务 ${toolInfo.serviceName} 未连接`);
    }

    try {
      const result = await service.callTool(
        toolInfo.originalName,
        arguments_ || {}
      );

      this.logger.info(`工具 ${toolName} 调用成功，结果:`, result);
      return result as ToolCallResult;
    } catch (error) {
      this.logger.error(`工具 ${toolName} 调用失败:`, (error as Error).message);
      throw error;
    }
  }

  /**
   * 停止所有服务
   */
  async stopAllServices(): Promise<void> {
    this.logger.info("正在停止所有 MCP 服务...");

    // 停止所有服务实例
    for (const [serviceName, service] of this.services) {
      try {
        await service.disconnect();
        this.logger.info(`${serviceName} 服务已停止`);
      } catch (error) {
        this.logger.error(
          `停止 ${serviceName} 服务失败:`,
          (error as Error).message
        );
      }
    }

    this.services.clear();
    this.tools.clear();

    this.logger.info("所有 MCP 服务已停止");
  }

  /**
   * 获取服务状态
   */
  getStatus(): ManagerStatus {
    const status: ManagerStatus = {
      services: {},
      totalTools: this.tools.size,
      availableTools: Array.from(this.tools.keys()),
    };

    for (const [serviceName, service] of this.services) {
      const serviceStatus = service.getStatus();
      status.services[serviceName] = {
        connected: serviceStatus.connected,
        clientName: `xiaozhi-${serviceName}-client`,
      };
    }

    return status;
  }

  /**
   * 获取指定服务实例
   */
  getService(name: string): MCPService | undefined {
    return this.services.get(name);
  }

  /**
   * 添加服务配置
   */
  addServiceConfig(name: string, config: MCPServiceConfig): void {
    this.configs[name] = config;
    this.logger.info(`已添加服务配置: ${name}`);
  }

  /**
   * 移除服务配置
   */
  removeServiceConfig(name: string): void {
    delete this.configs[name];
    this.logger.info(`已移除服务配置: ${name}`);
  }
}

export default MCPServiceManager;
