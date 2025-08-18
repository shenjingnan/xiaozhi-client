#!/usr/bin/env node

/**
 * MCP 服务管理器
 * 使用 MCPService 实例管理多个 MCP 服务
 * 专注于实例管理、工具聚合和路由调用
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { type Logger, logger } from "../Logger.js";
import { configManager } from "../configManager.js";
import {
  MCPService,
  type MCPServiceConfig,
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

  /**
   * 创建 MCPServiceManager 实例
   * @param configs 可选的初始服务配置
   */
  constructor(configs?: Record<string, MCPServiceConfig>) {
    this.logger = logger;
    this.configs = configs || {};
  }

  /**
   * 启动所有 MCP 服务
   */
  async startAllServices(): Promise<void> {
    this.logger.info("[MCPManager] 正在启动所有 MCP 服务...");

    const configEntries = Object.entries(this.configs);
    if (configEntries.length === 0) {
      this.logger.warn(
        "[MCPManager] 没有配置任何 MCP 服务，请使用 addServiceConfig() 添加服务配置"
      );
      return;
    }

    for (const [serviceName] of configEntries) {
      await this.startService(serviceName);
    }

    this.logger.info("[MCPManager] 所有 MCP 服务启动完成");
  }

  /**
   * 启动单个 MCP 服务
   */
  async startService(serviceName: string): Promise<void> {
    this.logger.info(`[MCPManager] 启动 MCP 服务: ${serviceName}`);

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
        `[MCPManager] ${serviceName} 服务启动成功，加载了 ${tools.length} 个工具:`,
        tools.map((t) => t.name).join(", ")
      );
    } catch (error) {
      this.logger.error(
        `[MCPManager] 启动 ${serviceName} 服务失败:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 停止单个服务
   */
  async stopService(serviceName: string): Promise<void> {
    this.logger.info(`[MCPManager] 停止 MCP 服务: ${serviceName}`);

    const service = this.services.get(serviceName);
    if (!service) {
      this.logger.warn(`[MCPManager] 服务 ${serviceName} 不存在或未启动`);
      return;
    }

    try {
      await service.disconnect();
      this.services.delete(serviceName);

      // 更新工具缓存
      await this.refreshToolsCache();

      this.logger.info(`[MCPManager] ${serviceName} 服务已停止`);
    } catch (error) {
      this.logger.error(
        `[MCPManager] 停止 ${serviceName} 服务失败:`,
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
    this.logger.info(`[MCPManager] 调用工具: ${toolName}，参数:`, arguments_);

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

      this.logger.info(`[MCPManager] 工具 ${toolName} 调用成功，结果:`, result);
      return result as ToolCallResult;
    } catch (error) {
      this.logger.error(
        `[MCPManager] 工具 ${toolName} 调用失败:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 停止所有服务
   */
  async stopAllServices(): Promise<void> {
    this.logger.info("[MCPManager] 正在停止所有 MCP 服务...");

    // 停止所有服务实例
    for (const [serviceName, service] of this.services) {
      try {
        await service.disconnect();
        this.logger.info(`[MCPManager] ${serviceName} 服务已停止`);
      } catch (error) {
        this.logger.error(
          `[MCPManager] 停止 ${serviceName} 服务失败:`,
          (error as Error).message
        );
      }
    }

    this.services.clear();
    this.tools.clear();

    this.logger.info("[MCPManager] 所有 MCP 服务已停止");
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
   * 获取所有服务实例
   */
  getAllServices(): Map<string, MCPService> {
    return new Map(this.services);
  }

  /**
   * 增强服务配置
   * 根据服务类型添加必要的全局配置
   */
  private enhanceServiceConfig(config: MCPServiceConfig): MCPServiceConfig {
    const enhancedConfig = { ...config };

    try {
      // 处理 ModelScope SSE 服务
      if (config.type === MCPTransportType.MODELSCOPE_SSE) {
        const modelScopeApiKey = configManager.getModelScopeApiKey();
        if (modelScopeApiKey) {
          enhancedConfig.apiKey = modelScopeApiKey;
          this.logger.info(
            `[MCPManager] 为 ${config.name} 服务添加 ModelScope API Key`
          );
        } else {
          this.logger.warn(
            `[MCPManager] ${config.name} 服务需要 ModelScope API Key，但未在配置中找到`
          );
          throw new Error(
            `ModelScope SSE 服务 ${config.name} 需要 API Key，请在配置文件中设置 modelscope.apiKey`
          );
        }
      }

      return enhancedConfig;
    } catch (error) {
      this.logger.error(`[MCPManager] 配置增强失败: ${config.name}`, error);
      throw error;
    }
  }

  /**
   * 添加服务配置（重载方法以支持两种调用方式）
   */
  addServiceConfig(name: string, config: MCPServiceConfig): void;
  addServiceConfig(config: MCPServiceConfig): void;
  addServiceConfig(
    nameOrConfig: string | MCPServiceConfig,
    config?: MCPServiceConfig
  ): void {
    let finalConfig: MCPServiceConfig;
    let serviceName: string;

    if (typeof nameOrConfig === "string" && config) {
      // 两参数版本
      serviceName = nameOrConfig;
      finalConfig = config;
    } else if (typeof nameOrConfig === "object") {
      // 单参数版本
      serviceName = nameOrConfig.name;
      finalConfig = nameOrConfig;
    } else {
      throw new Error("Invalid arguments for addServiceConfig");
    }

    // 增强配置
    const enhancedConfig = this.enhanceServiceConfig(finalConfig);

    // 存储增强后的配置
    this.configs[serviceName] = enhancedConfig;
    this.logger.info(`[MCPManager] 已添加服务配置: ${serviceName}`);
  }

  /**
   * 更新服务配置
   */
  updateServiceConfig(name: string, config: MCPServiceConfig): void {
    // 增强配置
    const enhancedConfig = this.enhanceServiceConfig(config);

    // 存储增强后的配置
    this.configs[name] = enhancedConfig;
    this.logger.info(`[MCPManager] 已更新并增强服务配置: ${name}`);
  }

  /**
   * 移除服务配置
   */
  removeServiceConfig(name: string): void {
    delete this.configs[name];
    this.logger.info(`[MCPManager] 已移除服务配置: ${name}`);
  }
}

export default MCPServiceManager;
