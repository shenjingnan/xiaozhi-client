import { logger } from "@/Logger.js";
import type { MCPServiceConfig } from "@/lib/mcp/types.js";
import { isModelScopeURL } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";

/**
 * MCP 配置管理器
 * 负责管理服务配置的增强、验证和 ModelScope 认证处理
 */
export class MCPConfigManager {
  private configs: Record<string, MCPServiceConfig> = {};

  constructor(configs: Record<string, MCPServiceConfig> = {}) {
    this.configs = configs;
  }

  /**
   * 检查是否为 ModelScope 服务
   * 统一使用 ConfigAdapter 的 isModelScopeURL 函数
   * @param config 服务配置
   * @returns 是否为 ModelScope 服务
   */
  private isModelScopeService(config: MCPServiceConfig): boolean {
    return config.url ? isModelScopeURL(config.url) : false;
  }

  /**
   * 处理 ModelScope 服务认证
   * 智能检查现有认证信息，按优先级处理
   * @param serviceName 服务名称
   * @param originalConfig 原始配置
   * @param enhancedConfig 增强后的配置（将被修改）
   */
  private handleModelScopeAuth(
    serviceName: string,
    originalConfig: MCPServiceConfig,
    enhancedConfig: MCPServiceConfig
  ): void {
    // 1. 检查是否已有 Authorization header
    const existingAuthHeader = originalConfig.headers?.Authorization;

    if (existingAuthHeader) {
      // 已有认证信息，直接使用
      logger.info(
        `[ConfigManager] 服务 ${serviceName} 使用已有的 Authorization header`
      );
      return;
    }

    // 2. 检查全局 ModelScope API Key
    const modelScopeApiKey = configManager.getModelScopeApiKey();

    if (modelScopeApiKey) {
      // 注入全局 API Key
      enhancedConfig.apiKey = modelScopeApiKey;
      logger.info(
        `[ConfigManager] 为 ${serviceName} 服务添加 ModelScope API Key`
      );
      return;
    }

    // 3. 无法获取认证信息，提供详细错误信息
    const serviceUrl = originalConfig.url || "未知";

    throw new Error(
      `ModelScope 服务 "${serviceName}" 需要认证信息，但未找到有效的认证配置。服务 URL: ${serviceUrl}。请选择以下任一方式配置认证：\n1. 在服务配置中添加 headers.Authorization\n2. 或者在全局配置中设置 modelscope.apiKey\n3. 或者设置环境变量 MODELSCOPE_API_TOKEN\n\n获取 ModelScope API Key: https://modelscope.cn/my?myInfo=true`
    );
  }

  /**
   * 增强服务配置
   * 根据服务类型添加必要的全局配置，智能处理认证信息
   * @param serviceName 服务名称
   * @param config 服务配置
   * @returns 增强后的服务配置
   */
  private enhanceServiceConfig(
    serviceName: string,
    config: MCPServiceConfig
  ): MCPServiceConfig {
    const enhancedConfig = { ...config };

    try {
      // 处理 ModelScope 服务（智能认证检查）
      if (this.isModelScopeService(config)) {
        this.handleModelScopeAuth(serviceName, config, enhancedConfig);
      }

      return enhancedConfig;
    } catch (error) {
      logger.error(`[ConfigManager] 配置增强失败: ${serviceName}`, error);
      throw error;
    }
  }

  /**
   * 添加服务配置（重载方法以支持两种调用方式）
   * @param nameOrConfig 服务名称或配置对象
   * @param config 服务配置（可选）
   */
  addServiceConfig(
    nameOrConfig:
      | string
      | MCPServiceConfig
      | ({ name: string } & MCPServiceConfig),
    config?: MCPServiceConfig
  ): void {
    let finalConfig: MCPServiceConfig;
    let serviceName: string;

    if (typeof nameOrConfig === "string" && config) {
      // 两参数版本
      serviceName = nameOrConfig;
      finalConfig = config;
    } else if (typeof nameOrConfig === "object") {
      // 单参数版本（使用包含 name 的配置对象）
      const internalConfig = nameOrConfig as {
        name: string;
      } & MCPServiceConfig;
      serviceName = internalConfig.name;
      finalConfig = internalConfig;
    } else {
      throw new Error("Invalid arguments for addServiceConfig");
    }

    // 增强配置
    const enhancedConfig = this.enhanceServiceConfig(serviceName, finalConfig);

    // 存储增强后的配置
    this.configs[serviceName] = enhancedConfig;
    logger.debug(`[ConfigManager] 已添加服务配置: ${serviceName}`);
  }

  /**
   * 更新服务配置
   * @param name 服务名称
   * @param config 服务配置
   */
  updateServiceConfig(name: string, config: MCPServiceConfig): void {
    // 增强配置
    const enhancedConfig = this.enhanceServiceConfig(name, config);

    // 存储增强后的配置
    this.configs[name] = enhancedConfig;
    logger.debug(`[ConfigManager] 已更新并增强服务配置: ${name}`);
  }

  /**
   * 移除服务配置
   * @param name 服务名称
   */
  removeServiceConfig(name: string): void {
    delete this.configs[name];
    logger.debug(`[ConfigManager] 已移除服务配置: ${name}`);
  }

  /**
   * 获取服务配置
   * @param name 服务名称
   * @returns 服务配置或 undefined
   */
  getServiceConfig(name: string): MCPServiceConfig | undefined {
    return this.configs[name];
  }

  /**
   * 获取所有服务配置
   * @returns 所有服务配置的副本
   */
  getAllServiceConfigs(): Record<string, MCPServiceConfig> {
    return { ...this.configs };
  }

  /**
   * 批量设置服务配置
   * @param configs 服务配置对象
   */
  setServiceConfigs(configs: Record<string, MCPServiceConfig>): void {
    for (const [name, config] of Object.entries(configs)) {
      // 使用 addServiceConfig 以确保配置增强
      this.addServiceConfig(name, config);
    }
  }

  /**
   * 检查服务配置是否存在
   * @param name 服务名称
   * @returns 是否存在
   */
  hasServiceConfig(name: string): boolean {
    return name in this.configs;
  }

  /**
   * 获取服务名称列表
   * @returns 服务名称数组
   */
  getServiceNames(): string[] {
    return Object.keys(this.configs);
  }

  /**
   * 获取服务数量
   * @returns 服务数量
   */
  getServiceCount(): number {
    return Object.keys(this.configs).length;
  }

  /**
   * 清空所有服务配置
   */
  clearAllConfigs(): void {
    this.configs = {};
    logger.debug("[ConfigManager] 已清空所有服务配置");
  }
}
