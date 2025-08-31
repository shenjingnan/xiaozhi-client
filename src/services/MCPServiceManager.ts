#!/usr/bin/env node

/**
 * MCP 服务管理器
 * 使用 MCPService 实例管理多个 MCP 服务
 * 专注于实例管理、工具聚合和路由调用
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { type Logger, logger } from "../Logger.js";
import { type MCPToolConfig, configManager } from "../configManager.js";
import { CustomMCPHandler } from "./CustomMCPHandler.js";
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
  private customMCPHandler: CustomMCPHandler; // CustomMCP 工具处理器

  /**
   * 创建 MCPServiceManager 实例
   * @param configs 可选的初始服务配置
   */
  constructor(configs?: Record<string, MCPServiceConfig>) {
    this.logger = logger;
    this.configs = configs || {};
    this.customMCPHandler = new CustomMCPHandler();
  }

  /**
   * 启动所有 MCP 服务
   */
  async startAllServices(): Promise<void> {
    this.logger.info("[MCPManager] 正在启动所有 MCP 服务...");

    // 初始化 CustomMCP 处理器
    try {
      this.customMCPHandler.initialize();
      this.logger.info("[MCPManager] CustomMCP 处理器初始化完成");
    } catch (error) {
      this.logger.error("[MCPManager] CustomMCP 处理器初始化失败:", error);
      // CustomMCP 初始化失败不应该阻止标准 MCP 服务启动
    }

    const configEntries = Object.entries(this.configs);
    if (configEntries.length === 0) {
      this.logger.warn(
        "[MCPManager] 没有配置任何 MCP 服务，请使用 addServiceConfig() 添加服务配置"
      );
      // 即使没有标准 MCP 服务，也可能有 CustomMCP 工具
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

    // 同步工具配置到配置文件
    await this.syncToolsConfigToFile();
  }

  /**
   * 获取所有可用工具（已启用的工具，包括 customMCP 工具）
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

    // 添加标准 MCP 工具
    for (const [toolKey, toolInfo] of this.tools) {
      // 检查工具是否启用
      const isEnabled = configManager.isToolEnabled(
        toolInfo.serviceName,
        toolInfo.originalName
      );

      // 只返回启用的工具
      if (isEnabled) {
        allTools.push({
          name: toolKey,
          description: toolInfo.tool.description || "",
          inputSchema: toolInfo.tool.inputSchema,
          serviceName: toolInfo.serviceName,
          originalName: toolInfo.originalName,
        });
      }
    }

    // 添加 CustomMCP 工具
    try {
      const customTools = this.customMCPHandler.getTools();
      for (const tool of customTools) {
        allTools.push({
          name: tool.name,
          description: tool.description || "",
          inputSchema: tool.inputSchema,
          serviceName: "customMCP", // 使用特殊的服务名标识
          originalName: tool.name,
        });
      }
    } catch (error) {
      this.logger.error("[MCPManager] 获取 CustomMCP 工具失败:", error);
    }

    return allTools;
  }

  /**
   * 调用 MCP 工具（支持标准 MCP 工具和 customMCP 工具）
   */
  async callTool(toolName: string, arguments_: any): Promise<ToolCallResult> {
    this.logger.info(`[MCPManager] 调用工具: ${toolName}，参数:`, arguments_);

    // 首先检查是否是 customMCP 工具
    if (this.customMCPHandler.hasTool(toolName)) {
      try {
        const result = await this.customMCPHandler.callTool(
          toolName,
          arguments_
        );
        this.logger.info(`[MCPManager] CustomMCP 工具 ${toolName} 调用成功`);
        return result;
      } catch (error) {
        this.logger.error(
          `[MCPManager] CustomMCP 工具 ${toolName} 调用失败:`,
          (error as Error).message
        );
        throw error;
      }
    }

    // 如果不是 customMCP 工具，则查找标准 MCP 工具
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
   * 检查是否存在指定工具（包括标准 MCP 工具和 customMCP 工具）
   */
  hasTool(toolName: string): boolean {
    // 检查是否是 customMCP 工具
    if (this.customMCPHandler.hasTool(toolName)) {
      return true;
    }

    // 检查是否是标准 MCP 工具
    return this.tools.has(toolName);
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

    // 清理 CustomMCP 处理器
    try {
      this.customMCPHandler.cleanup();
      this.logger.info("[MCPManager] CustomMCP 处理器已清理");
    } catch (error) {
      this.logger.error("[MCPManager] CustomMCP 处理器清理失败:", error);
    }

    this.services.clear();
    this.tools.clear();

    this.logger.info("[MCPManager] 所有 MCP 服务已停止");
  }

  /**
   * 获取服务状态
   */
  getStatus(): ManagerStatus {
    // 计算总工具数量（包括 customMCP 工具）
    const customMCPToolCount = this.customMCPHandler.getToolCount();
    const totalTools = this.tools.size + customMCPToolCount;

    // 获取所有可用工具名称
    const standardToolNames = Array.from(this.tools.keys());
    const customToolNames = this.customMCPHandler.getToolNames();
    const availableTools = [...standardToolNames, ...customToolNames];

    const status: ManagerStatus = {
      services: {},
      totalTools,
      availableTools,
    };

    // 添加标准 MCP 服务状态
    for (const [serviceName, service] of this.services) {
      const serviceStatus = service.getStatus();
      status.services[serviceName] = {
        connected: serviceStatus.connected,
        clientName: `xiaozhi-${serviceName}-client`,
      };
    }

    // 添加 CustomMCP 服务状态
    if (customMCPToolCount > 0) {
      status.services.customMCP = {
        connected: true, // CustomMCP 工具总是可用的
        clientName: "xiaozhi-customMCP-handler",
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
   * 获取 CustomMCP 处理器实例
   */
  getCustomMCPHandler(): CustomMCPHandler {
    return this.customMCPHandler;
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

  /**
   * 同步工具配置到配置文件
   * 实现自动同步 MCP 服务工具配置到 xiaozhi.config.json
   */
  private async syncToolsConfigToFile(): Promise<void> {
    try {
      this.logger.debug("[MCPManager] 开始同步工具配置到配置文件");

      // 获取当前配置文件中的 mcpServerConfig
      const currentServerConfigs = configManager.getMcpServerConfig();

      // 遍历所有已连接的服务
      for (const [serviceName, service] of this.services) {
        if (!service.isConnected()) {
          continue;
        }

        const tools = service.getTools();
        if (tools.length === 0) {
          continue;
        }

        // 获取当前服务在配置文件中的工具配置
        const currentToolsConfig =
          currentServerConfigs[serviceName]?.tools || {};

        // 构建新的工具配置
        const newToolsConfig: Record<string, MCPToolConfig> = {};

        for (const tool of tools) {
          const currentToolConfig = currentToolsConfig[tool.name];

          // 如果工具已存在，保留用户设置的 enable 状态，但更新描述
          if (currentToolConfig) {
            newToolsConfig[tool.name] = {
              ...currentToolConfig,
              description:
                tool.description || currentToolConfig.description || "",
            };
          } else {
            // 新工具，默认启用
            newToolsConfig[tool.name] = {
              description: tool.description || "",
              enable: true,
            };
          }
        }

        // 检查是否有工具被移除（在配置文件中存在但在当前工具列表中不存在）
        const currentToolNames = tools.map((t) => t.name);
        const configToolNames = Object.keys(currentToolsConfig);
        const removedTools = configToolNames.filter(
          (name) => !currentToolNames.includes(name)
        );

        if (removedTools.length > 0) {
          this.logger.info(
            `[MCPManager] 检测到服务 ${serviceName} 移除了 ${removedTools.length} 个工具: ${removedTools.join(", ")}`
          );
        }

        // 检查配置是否有变化
        const hasChanges = this.hasToolsConfigChanged(
          currentToolsConfig,
          newToolsConfig
        );

        if (hasChanges) {
          // 更新配置文件
          configManager.updateServerToolsConfig(serviceName, newToolsConfig);

          const addedTools = Object.keys(newToolsConfig).filter(
            (name) => !currentToolsConfig[name]
          );
          const updatedTools = Object.keys(newToolsConfig).filter((name) => {
            const current = currentToolsConfig[name];
            const updated = newToolsConfig[name];
            return current && current.description !== updated.description;
          });

          this.logger.info(
            `[MCPManager] 已同步服务 ${serviceName} 的工具配置:`
          );
          if (addedTools.length > 0) {
            this.logger.info(`  - 新增工具: ${addedTools.join(", ")}`);
          }
          if (updatedTools.length > 0) {
            this.logger.info(`  - 更新工具: ${updatedTools.join(", ")}`);
          }
          if (removedTools.length > 0) {
            this.logger.info(`  - 移除工具: ${removedTools.join(", ")}`);
          }
        }
      }

      this.logger.debug("[MCPManager] 工具配置同步完成");
    } catch (error) {
      this.logger.error("[MCPManager] 同步工具配置到配置文件失败:", error);
      // 不抛出错误，避免影响服务正常运行
    }
  }

  /**
   * 检查工具配置是否有变化
   */
  private hasToolsConfigChanged(
    currentConfig: Record<string, MCPToolConfig>,
    newConfig: Record<string, MCPToolConfig>
  ): boolean {
    const currentKeys = Object.keys(currentConfig);
    const newKeys = Object.keys(newConfig);

    // 检查工具数量是否变化
    if (currentKeys.length !== newKeys.length) {
      return true;
    }

    // 检查是否有新增或删除的工具
    const addedTools = newKeys.filter((key) => !currentKeys.includes(key));
    const removedTools = currentKeys.filter((key) => !newKeys.includes(key));

    if (addedTools.length > 0 || removedTools.length > 0) {
      return true;
    }

    // 检查现有工具的描述是否有变化
    for (const toolName of currentKeys) {
      const currentTool = currentConfig[toolName];
      const newTool = newConfig[toolName];

      if (currentTool.description !== newTool.description) {
        return true;
      }
    }

    return false;
  }
}

export default MCPServiceManager;
