import type { AppConfig } from "@/lib/config/configManager.js";
import { configManager } from "@/lib/config/configManager.js";
import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import type { EventBus } from "@services/EventBus.js";
import { getEventBus } from "@services/EventBus.js";

/**
 * 配置服务 - 统一的配置管理服务
 */
export class ConfigService {
  private logger: Logger;
  private eventBus: EventBus;

  constructor() {
    this.logger = logger.withTag("ConfigService");
    this.eventBus = getEventBus();
  }

  /**
   * 获取完整配置
   */
  async getConfig(): Promise<AppConfig> {
    try {
      const config = configManager.getConfig();
      this.logger.debug("获取配置成功");
      return config;
    } catch (error) {
      this.logger.error("获取配置失败:", error);
      this.eventBus.emitEvent("config:error", {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "getConfig",
      });
      throw error;
    }
  }

  /**
   * 更新配置
   */
  async updateConfig(newConfig: AppConfig, source = "unknown"): Promise<void> {
    try {
      this.logger.info(`开始更新配置，来源: ${source}`);

      // 验证配置
      this.validateConfig(newConfig);

      // 更新 MCP 端点
      if (newConfig.mcpEndpoint !== configManager.getMcpEndpoint()) {
        configManager.updateMcpEndpoint(newConfig.mcpEndpoint);
      }

      // 更新 MCP 服务
      const currentServers = configManager.getMcpServers();
      for (const [name, config] of Object.entries(newConfig.mcpServers)) {
        if (JSON.stringify(currentServers[name]) !== JSON.stringify(config)) {
          configManager.updateMcpServer(name, config);
        }
      }

      // 删除不存在的服务
      for (const name of Object.keys(currentServers)) {
        if (!(name in newConfig.mcpServers)) {
          configManager.removeMcpServer(name);
          // 同时清理该服务在 mcpServerConfig 中的工具配置
          configManager.removeServerToolsConfig(name);
        }
      }

      // 更新连接配置
      if (newConfig.connection) {
        configManager.updateConnectionConfig(newConfig.connection);
      }

      // 更新 ModelScope 配置
      if (newConfig.modelscope) {
        configManager.updateModelScopeConfig(newConfig.modelscope);
      }

      // 更新 Web UI 配置
      if (newConfig.webUI) {
        configManager.updateWebUIConfig(newConfig.webUI);
      }

      // 更新服务工具配置
      if (newConfig.mcpServerConfig) {
        for (const [serverName, toolsConfig] of Object.entries(
          newConfig.mcpServerConfig
        )) {
          for (const [toolName, toolConfig] of Object.entries(
            toolsConfig.tools
          )) {
            configManager.setToolEnabled(
              serverName,
              toolName,
              toolConfig.enable
            );
          }
        }
      }

      if (newConfig?.platforms) {
        for (const [platformName, platformConfig] of Object.entries(
          newConfig.platforms
        )) {
          configManager.updatePlatformConfig(platformName, platformConfig);
        }
      }

      this.logger.info("配置更新成功");

      // 发射配置更新事件
      this.eventBus.emitEvent("config:updated", {
        type: "config",
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error("配置更新失败:", error);
      this.eventBus.emitEvent("config:error", {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "updateConfig",
      });
      throw error;
    }
  }

  /**
   * 获取 MCP 端点
   */
  getMcpEndpoint(): string {
    try {
      return configManager.getMcpEndpoint();
    } catch (error) {
      this.logger.error("获取 MCP 端点失败:", error);
      throw error;
    }
  }

  /**
   * 获取 MCP 端点列表
   */
  getMcpEndpoints(): string[] {
    try {
      return configManager.getMcpEndpoints();
    } catch (error) {
      this.logger.error("获取 MCP 端点列表失败:", error);
      throw error;
    }
  }

  /**
   * 获取 MCP 服务配置
   */
  getMcpServers(): Record<string, any> {
    try {
      return configManager.getMcpServers();
    } catch (error) {
      this.logger.error("获取 MCP 服务配置失败:", error);
      throw error;
    }
  }

  /**
   * 获取连接配置
   */
  getConnectionConfig(): any {
    try {
      return configManager.getConnectionConfig();
    } catch (error) {
      this.logger.error("获取连接配置失败:", error);
      throw error;
    }
  }

  /**
   * 获取 Web UI 端口
   */
  getWebUIPort(): number {
    try {
      return configManager.getWebUIPort() || 9999;
    } catch (error) {
      this.logger.error("获取 Web UI 端口失败:", error);
      return 9999;
    }
  }

  /**
   * 验证配置
   */
  private validateConfig(config: AppConfig): void {
    if (!config || typeof config !== "object") {
      throw new Error("配置必须是有效的对象");
    }

    if (!config.mcpEndpoint && config.mcpEndpoint !== "") {
      throw new Error("配置必须包含 mcpEndpoint");
    }

    if (!config.mcpServers || typeof config.mcpServers !== "object") {
      throw new Error("配置必须包含有效的 mcpServers");
    }
  }

  /**
   * 检查配置是否存在
   */
  configExists(): boolean {
    return configManager.configExists();
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(): Promise<AppConfig> {
    try {
      this.logger.info("重新加载配置");
      configManager.reloadConfig();
      const config = await this.getConfig();

      this.eventBus.emitEvent("config:updated", {
        type: "config",
        timestamp: new Date(),
      });

      return config;
    } catch (error) {
      this.logger.error("重新加载配置失败:", error);
      this.eventBus.emitEvent("config:error", {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "reloadConfig",
      });
      throw error;
    }
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return configManager.getConfigPath();
  }
}
