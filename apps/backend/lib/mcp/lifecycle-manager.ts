/**
 * MCP 服务生命周期管理器
 * 负责服务的启动、停止和生命周期管理
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { MCPService } from "@/lib/mcp/connection.js";
import type { InternalMCPServiceConfig, MCPServiceConfig } from "@/lib/mcp/types";
import type { CustomMCPHandler } from "./custom.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * 服务生命周期管理器
 * 专注于 MCP 服务的启动和停止操作
 */
export class MCPServiceLifecycleManager {
  private logger: Logger;
  private services: Map<string, MCPService> = new Map();
  private configs: Record<string, MCPServiceConfig> = {};
  private customMCPHandler?: CustomMCPHandler;
  private onToolsRefresh?: () => Promise<void>;

  constructor(customMCPHandler?: CustomMCPHandler) {
    this.logger = logger;
    this.customMCPHandler = customMCPHandler;
  }

  /**
   * 设置工具刷新回调
   */
  setToolsRefreshCallback(callback: () => Promise<void>): void {
    this.onToolsRefresh = callback;
  }

  /**
   * 设置 CustomMCP 处理器
   */
  setCustomMCPHandler(handler: CustomMCPHandler): void {
    this.customMCPHandler = handler;
  }

  /**
   * 添加服务配置
   */
  addServiceConfig(name: string, config: MCPServiceConfig): void {
    this.configs[name] = config;
  }

  /**
   * 更新服务配置
   */
  updateServiceConfig(name: string, config: MCPServiceConfig): void {
    this.configs[name] = config;
  }

  /**
   * 移除服务配置
   */
  removeServiceConfig(name: string): void {
    delete this.configs[name];
  }

  /**
   * 获取服务配置
   */
  getServiceConfig(name: string): MCPServiceConfig | undefined {
    return this.configs[name];
  }

  /**
   * 获取所有服务配置
   */
  getAllServiceConfigs(): Record<string, MCPServiceConfig> {
    return { ...this.configs };
  }

  /**
   * 启动所有 MCP 服务
   */
  async startAllServices(): Promise<string[]> {
    this.logger.debug("[LifecycleManager] 正在启动所有 MCP 服务...");

    // 初始化 CustomMCP 处理器
    if (this.customMCPHandler) {
      try {
        this.customMCPHandler.initialize();
        this.logger.debug("[LifecycleManager] CustomMCP 处理器初始化完成");
      } catch (error) {
        this.logger.error("[LifecycleManager] CustomMCP 处理器初始化失败:", error);
        // CustomMCP 初始化失败不应该阻止标准 MCP 服务启动
      }
    }

    const configEntries = Object.entries(this.configs);
    if (configEntries.length === 0) {
      this.logger.warn(
        "[LifecycleManager] 没有配置任何 MCP 服务，请使用 addServiceConfig() 添加服务配置"
      );
      return [];
    }

    // 记录启动开始
    this.logger.info(
      `[LifecycleManager] 开始并行启动 ${configEntries.length} 个 MCP 服务`
    );

    // 并行启动所有服务，实现服务隔离
    const startPromises = configEntries.map(async ([serviceName]) => {
      try {
        await this.startService(serviceName);
        return { serviceName, success: true, error: null };
      } catch (error) {
        return {
          serviceName,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // 等待所有服务启动完成
    const results = await Promise.allSettled(startPromises);

    // 统计启动结果
    let successCount = 0;
    let failureCount = 0;
    const failedServices: string[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.success) {
          successCount++;
        } else {
          failureCount++;
          failedServices.push(result.value.serviceName);
        }
      } else {
        failureCount++;
      }
    }

    // 记录启动完成统计
    this.logger.info(
      `[LifecycleManager] 服务启动完成 - 成功: ${successCount}, 失败: ${failureCount}`
    );

    // 记录失败的服务列表
    if (failedServices.length > 0) {
      this.logger.warn(
        `[LifecycleManager] 以下服务启动失败: ${failedServices.join(", ")}`
      );

      // 如果所有服务都失败了，发出警告但系统继续运行以便重试
      if (failureCount === configEntries.length) {
        this.logger.warn(
          "[LifecycleManager] 所有 MCP 服务启动失败，但系统将继续运行以便重试"
        );
      }
    }

    return failedServices;
  }

  /**
   * 启动单个 MCP 服务
   */
  async startService(serviceName: string): Promise<void> {
    const config = this.configs[serviceName];
    if (!config) {
      throw new Error(`未找到服务配置: ${serviceName}`);
    }

    try {
      // 如果服务已存在，先停止它
      if (this.services.has(serviceName)) {
        await this.stopService(serviceName);
      }

      // 创建 MCPService 实例（使用 InternalMCPServiceConfig）
      const serviceConfig: InternalMCPServiceConfig = {
        name: serviceName,
        ...config,
      };
      const service = new MCPService(serviceConfig);

      // 连接到服务
      await service.connect();

      // 存储服务实例
      this.services.set(serviceName, service);

      // 触发工具缓存刷新
      if (this.onToolsRefresh) {
        await this.onToolsRefresh();
      }

      const tools = service.getTools();
      this.logger.debug(
        `[LifecycleManager] ${serviceName} 服务启动成功，加载了 ${tools.length} 个工具:`,
        tools.map((t) => t.name).join(", ")
      );
    } catch (error) {
      this.logger.error(
        `[LifecycleManager] 启动 ${serviceName} 服务失败:`,
        (error as Error).message
      );
      // 清理可能的部分状态
      this.services.delete(serviceName);
      throw error;
    }
  }

  /**
   * 停止单个服务
   */
  async stopService(serviceName: string): Promise<void> {
    this.logger.info(`[LifecycleManager] 停止 MCP 服务: ${serviceName}`);

    const service = this.services.get(serviceName);
    if (!service) {
      this.logger.warn(`[LifecycleManager] 服务 ${serviceName} 不存在或未启动`);
      return;
    }

    try {
      await service.disconnect();
      this.services.delete(serviceName);

      // 触发工具缓存刷新
      if (this.onToolsRefresh) {
        await this.onToolsRefresh();
      }

      this.logger.info(`[LifecycleManager] ${serviceName} 服务已停止`);
    } catch (error) {
      this.logger.error(
        `[LifecycleManager] 停止 ${serviceName} 服务失败:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 停止所有服务
   */
  async stopAllServices(): Promise<void> {
    this.logger.info("[LifecycleManager] 正在停止所有 MCP 服务...");

    // 停止所有服务实例
    for (const [serviceName, service] of this.services) {
      try {
        await service.disconnect();
        this.logger.info(`[LifecycleManager] ${serviceName} 服务已停止`);
      } catch (error) {
        this.logger.error(
          `[LifecycleManager] 停止 ${serviceName} 服务失败:`,
          (error as Error).message
        );
      }
    }

    // 清理 CustomMCP 处理器
    if (this.customMCPHandler) {
      try {
        this.customMCPHandler.cleanup();
        this.logger.info("[LifecycleManager] CustomMCP 处理器已清理");
      } catch (error) {
        this.logger.error("[LifecycleManager] CustomMCP 处理器清理失败:", error);
      }
    }

    this.services.clear();

    this.logger.info("[LifecycleManager] 所有 MCP 服务已停止");
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
   * 获取所有已连接的服务名称
   */
  getConnectedServices(): string[] {
    const connectedServices: string[] = [];
    for (const [serviceName, service] of this.services) {
      if (service.isConnected()) {
        connectedServices.push(serviceName);
      }
    }
    return connectedServices;
  }

  /**
   * 获取服务的工具列表
   */
  getServiceTools(serviceName: string): Tool[] {
    const service = this.services.get(serviceName);
    if (!service || !service.isConnected()) {
      return [];
    }
    return service.getTools();
  }

  /**
   * 检查服务是否已连接
   */
  isServiceConnected(serviceName: string): boolean {
    const service = this.services.get(serviceName);
    return service ? service.isConnected() : false;
  }

  /**
   * 获取所有服务的工具映射
   */
  getAllToolsMap(): Map<string, { serviceName: string; originalName: string; tool: Tool }> {
    const toolsMap = new Map<
      string,
      { serviceName: string; originalName: string; tool: Tool }
    >();

    for (const [serviceName, service] of this.services) {
      if (service.isConnected()) {
        const tools = service.getTools();
        for (const tool of tools) {
          const toolKey = `${serviceName}__${tool.name}`;
          toolsMap.set(toolKey, {
            serviceName,
            originalName: tool.name,
            tool,
          });
        }
      }
    }

    return toolsMap;
  }
}
