/**
 * MCP 配置管理器
 * 负责 MCP 服务的配置管理和 ModelScope 集成
 *
 * @remarks
 * 该类从 MCPServiceManager 中分离出来，专门负责服务配置管理。
 * 包括配置增强、ModelScope 认证处理、工具配置同步等功能。
 *
 * @example
 * ```typescript
 * const configManager = new MCPConfigManager();
 * configManager.addServiceConfig(name, config);
 * const enhanced = configManager.enhanceServiceConfig(name, config);
 * ```
 */

import { logger } from "@/Logger.js";
import { isModelScopeURL } from "@xiaozhi-client/config";
import type { configManager as ConfigManagerType } from "@xiaozhi-client/config";
import type { MCPToolConfig } from "@xiaozhi-client/config";
import type { MCPServiceConfig } from "@/lib/mcp/types.js";

/**
 * 配置管理器依赖接口
 */
export interface ConfigManagerDependencies {
  /** 配置管理器实例 */
  configManager: typeof ConfigManagerType;
}

/**
 * MCP 配置管理器
 *
 * @remarks
 * 负责管理 MCP 服务的配置，包括：
 * - 配置增强（如 ModelScope 认证）
 * - 配置的添加、更新、删除
 * - 工具配置同步到配置文件
 */
export class MCPConfigManager {
  private configs: Record<string, MCPServiceConfig>;
  private dependencies: ConfigManagerDependencies;

  /**
   * 创建配置管理器实例
   *
   * @param configs 服务配置对象的引用
   * @param dependencies 配置管理器依赖
   */
  constructor(
    configs: Record<string, MCPServiceConfig>,
    dependencies: ConfigManagerDependencies
  ) {
    this.configs = configs;
    this.dependencies = dependencies;
  }

  /**
   * 检查是否为 ModelScope 服务
   *
   * @param config MCP 服务配置
   * @returns 如果是 ModelScope 服务返回 true
   */
  isModelScopeService(config: MCPServiceConfig): boolean {
    return config.url ? isModelScopeURL(config.url) : false;
  }

  /**
   * 处理 ModelScope 服务认证
   *
   * @remarks
   * 智能检查现有认证信息，按优先级处理：
   * 1. 检查是否已有 Authorization header
   * 2. 检查全局 ModelScope API Key
   * 3. 无法获取认证信息时抛出详细错误
   *
   * @param serviceName 服务名称
   * @param originalConfig 原始配置
   * @param enhancedConfig 增强后的配置（将被修改）
   * @throws {Error} 如果无法获取认证信息
   */
  handleModelScopeAuth(
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
    const modelScopeApiKey = this.dependencies.configManager.getModelScopeApiKey();

    if (modelScopeApiKey) {
      // 注入全局 API Key
      enhancedConfig.apiKey = modelScopeApiKey;
      logger.info(`[ConfigManager] 为 ${serviceName} 服务添加 ModelScope API Key`);
      return;
    }

    // 3. 无法获取认证信息，提供详细错误信息
    const serviceUrl = originalConfig.url || "未知";

    throw new Error(
      `ModelScope 服务 "${serviceName}" 需要认证信息，但未找到有效的认证配置。服务 URL: ${serviceUrl}请选择以下任一方式配置认证：1. 在服务配置中添加 headers.Authorization2. 或者在全局配置中设置 modelscope.apiKey3. 或者设置环境变量 MODELSCOPE_API_TOKEN获取 ModelScope API Key: https://modelscope.cn/my?myInfo=true`
    );
  }

  /**
   * 增强服务配置
   *
   * @remarks
   * 根据服务类型添加必要的全局配置，智能处理认证信息。
   * 对于 ModelScope 服务，会自动处理认证信息。
   *
   * @param serviceName 服务名称
   * @param config 原始配置
   * @returns 增强后的配置
   */
  enhanceServiceConfig(
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
      logger.error(`[ConfigManager] 配置增强失败: ${serviceName}`, { error });
      throw error;
    }
  }

  /**
   * 添加服务配置
   *
   * @remarks
   * 支持两种调用方式：
   * - 两参数版本：`addServiceConfig(name, config)`
   * - 单参数版本：`addServiceConfig({ name, ...config })`
   *
   * @param nameOrConfig 服务名称或内部配置对象
   * @param config 可选的服务配置
   */
  addServiceConfig(
    nameOrConfig: string | (MCPServiceConfig & { name: string }),
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
      const internalConfig = nameOrConfig;
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
   *
   * @param name 服务名称
   * @param config 新的配置
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
   *
   * @param name 服务名称
   */
  removeServiceConfig(name: string): void {
    delete this.configs[name];
    logger.debug(`[ConfigManager] 已移除服务配置: ${name}`);
  }

  /**
   * 获取服务配置
   *
   * @param name 服务名称
   * @returns 服务配置或 undefined
   */
  getServiceConfig(name: string): MCPServiceConfig | undefined {
    return this.configs[name];
  }

  /**
   * 获取所有服务配置
   *
   * @returns 服务配置对象
   */
  getAllConfigs(): Record<string, MCPServiceConfig> {
    return { ...this.configs };
  }

  /**
   * 检查工具配置是否有变化
   *
   * @param currentConfig 当前配置
   * @param newConfig 新配置
   * @returns 如果有变化返回 true
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

  /**
   * 同步工具配置到配置文件
   *
   * @remarks
   * 实现自动同步 MCP 服务工具配置到 xiaozhi.config.json。
   * 保留用户设置的 enable 状态，但更新描述信息。
   *
   * @param services 服务实例映射
   */
  async syncToolsConfigToFile(
    services: Map<
      string,
      {
        isConnected(): boolean;
        getTools(): Array<{ name: string; description?: string }>;
      }
    >
  ): Promise<void> {
    try {
      logger.debug("[ConfigManager] 开始同步工具配置到配置文件");

      // 获取当前配置文件中的 mcpServerConfig
      const currentServerConfigs =
        this.dependencies.configManager.getMcpServerConfig();

      // 遍历所有已连接的服务
      for (const [serviceName, service] of services) {
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
          logger.info(
            `[ConfigManager] 检测到服务 ${serviceName} 移除了 ${
              removedTools.length
            } 个工具: ${removedTools.join(", ")}`
          );
        }

        // 检查配置是否有变化
        const hasChanges = this.hasToolsConfigChanged(
          currentToolsConfig,
          newToolsConfig
        );

        if (hasChanges) {
          // 更新配置文件
          this.dependencies.configManager.updateServerToolsConfig(
            serviceName,
            newToolsConfig
          );

          const addedTools = Object.keys(newToolsConfig).filter(
            (name) => !currentToolsConfig[name]
          );
          const updatedTools = Object.keys(newToolsConfig).filter((name) => {
            const current = currentToolsConfig[name];
            const updated = newToolsConfig[name];
            return current && current.description !== updated.description;
          });

          logger.debug(`[ConfigManager] 已同步服务 ${serviceName} 的工具配置:`);
          if (addedTools.length > 0) {
            logger.debug(`  - 新增工具: ${addedTools.join(", ")}`);
          }
          if (updatedTools.length > 0) {
            logger.debug(`  - 更新工具: ${updatedTools.join(", ")}`);
          }
          if (removedTools.length > 0) {
            logger.debug(`  - 移除工具: ${removedTools.join(", ")}`);
          }
        }
      }

      logger.debug("[ConfigManager] 工具配置同步完成");
    } catch (error) {
      logger.error("[ConfigManager] 同步工具配置到配置文件失败", { error });
      // 不抛出错误，避免影响服务正常运行
    }
  }
}
