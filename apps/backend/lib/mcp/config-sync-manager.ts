/**
 * MCP 配置同步管理器
 * 负责配置同步、ModelScope 认证和服务配置增强
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import type { MCPServiceConfig } from "@/lib/mcp/types";
import type { MCPToolConfig } from "@xiaozhi-client/config";
import { isModelScopeURL } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * 服务工具获取器接口
 */
interface ServiceToolsGetter {
  (serviceName: string): Tool[];
}

/**
 * 配置同步管理器
 * 专注于配置同步和认证处理
 */
export class MCPConfigSyncManager {
  private logger: Logger;

  constructor() {
    this.logger = logger;
  }

  /**
   * 检查是否为 ModelScope 服务
   * 统一使用 ConfigAdapter 的 isModelScopeURL 函数
   */
  isModelScopeService(config: MCPServiceConfig): boolean {
    return config.url ? isModelScopeURL(config.url) : false;
  }

  /**
   * 处理 ModelScope 服务认证
   * 智能检查现有认证信息，按优先级处理
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
      this.logger.info(
        `[ConfigSync] 服务 ${serviceName} 使用已有的 Authorization header`
      );
      return;
    }

    // 2. 检查全局 ModelScope API Key
    const modelScopeApiKey = configManager.getModelScopeApiKey();

    if (modelScopeApiKey) {
      // 注入全局 API Key
      enhancedConfig.apiKey = modelScopeApiKey;
      this.logger.info(
        `[ConfigSync] 为 ${serviceName} 服务添加 ModelScope API Key`
      );
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
   * 根据服务类型添加必要的全局配置，智能处理认证信息
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
      this.logger.error(`[ConfigSync] 配置增强失败: ${serviceName}`, error);
      throw error;
    }
  }

  /**
   * 同步工具配置到配置文件
   * 实现自动同步 MCP 服务工具配置到 xiaozhi.config.json
   */
  async syncToolsConfigToFile(
    serviceNames: string[],
    getServiceTools: ServiceToolsGetter
  ): Promise<void> {
    try {
      this.logger.debug("[ConfigSync] 开始同步工具配置到配置文件");

      // 获取当前配置文件中的 mcpServerConfig
      const currentServerConfigs = configManager.getMcpServerConfig();

      // 遍历所有已连接的服务
      for (const serviceName of serviceNames) {
        const tools = getServiceTools(serviceName);
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
            `[ConfigSync] 检测到服务 ${serviceName} 移除了 ${
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
          configManager.updateServerToolsConfig(serviceName, newToolsConfig);

          const addedTools = Object.keys(newToolsConfig).filter(
            (name) => !currentToolsConfig[name]
          );
          const updatedTools = Object.keys(newToolsConfig).filter((name) => {
            const current = currentToolsConfig[name];
            const updated = newToolsConfig[name];
            return current && current.description !== updated.description;
          });

          this.logger.debug(`[ConfigSync] 已同步服务 ${serviceName} 的工具配置:`);
          if (addedTools.length > 0) {
            this.logger.debug(`  - 新增工具: ${addedTools.join(", ")}`);
          }
          if (updatedTools.length > 0) {
            this.logger.debug(`  - 更新工具: ${updatedTools.join(", ")}`);
          }
          if (removedTools.length > 0) {
            this.logger.debug(`  - 移除工具: ${removedTools.join(", ")}`);
          }
        }
      }

      this.logger.debug("[ConfigSync] 工具配置同步完成");
    } catch (error) {
      this.logger.error("[ConfigSync] 同步工具配置到配置文件失败:", error);
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
