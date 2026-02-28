/**
 * MCP 配置管理
 *
 * 负责 MCP 端点、服务器和工具配置的管理
 */
import type {
  AppConfig,
  MCPServerConfig,
  MCPServerToolsConfig,
  MCPToolConfig,
} from "./types.js";

/**
 * MCP 配置管理类
 */
export class MCPConfigManager {
  /**
   * 获取所有 MCP 端点
   */
  public getMcpEndpoints(config: AppConfig): string[] {
    if (Array.isArray(config.mcpEndpoint)) {
      return [...config.mcpEndpoint];
    }
    return config.mcpEndpoint ? [config.mcpEndpoint] : [];
  }

  /**
   * 获取 MCP 端点（向后兼容）
   * @deprecated 使用 getMcpEndpoints() 获取所有端点
   */
  public getMcpEndpoint(config: AppConfig): string {
    if (Array.isArray(config.mcpEndpoint)) {
      return config.mcpEndpoint[0] || "";
    }
    return config.mcpEndpoint;
  }

  /**
   * 获取 MCP 服务配置
   */
  public getMcpServers(
    config: AppConfig
  ): Readonly<Record<string, MCPServerConfig>> {
    return config.mcpServers;
  }

  /**
   * 获取 MCP 服务工具配置
   */
  public getMcpServerConfig(
    config: AppConfig
  ): Readonly<Record<string, MCPServerToolsConfig>> {
    return config.mcpServerConfig || {};
  }

  /**
   * 获取指定服务的工具配置
   */
  public getServerToolsConfig(
    config: AppConfig,
    serverName: string
  ): Readonly<Record<string, MCPToolConfig>> {
    const serverConfig = this.getMcpServerConfig(config);
    return serverConfig[serverName]?.tools || {};
  }

  /**
   * 检查工具是否启用
   */
  public isToolEnabled(
    config: AppConfig,
    serverName: string,
    toolName: string
  ): boolean {
    const toolsConfig = this.getServerToolsConfig(config, serverName);
    const toolConfig = toolsConfig[toolName];
    return toolConfig?.enable !== false; // 默认启用
  }

  /**
   * 更新 MCP 端点（支持字符串或数组）
   */
  public updateMcpEndpoint(
    config: AppConfig,
    endpoint: string | string[]
  ): void {
    if (Array.isArray(endpoint)) {
      for (const ep of endpoint) {
        if (!ep || typeof ep !== "string") {
          throw new Error("MCP 端点数组中的每个元素必须是非空字符串");
        }
      }
    }

    config.mcpEndpoint = endpoint;
  }

  /**
   * 添加 MCP 端点
   */
  public addMcpEndpoint(config: AppConfig, endpoint: string): void {
    if (!endpoint || typeof endpoint !== "string") {
      throw new Error("MCP 端点必须是非空字符串");
    }

    const currentEndpoints = this.getMcpEndpoints(config);

    // 检查是否已存在
    if (currentEndpoints.includes(endpoint)) {
      throw new Error(`MCP 端点 ${endpoint} 已存在`);
    }

    const newEndpoints = [...currentEndpoints, endpoint];
    config.mcpEndpoint = newEndpoints;
  }

  /**
   * 移除 MCP 端点
   */
  public removeMcpEndpoint(config: AppConfig, endpoint: string): void {
    if (!endpoint || typeof endpoint !== "string") {
      throw new Error("MCP 端点必须是非空字符串");
    }

    const currentEndpoints = this.getMcpEndpoints(config);

    // 检查是否存在
    const index = currentEndpoints.indexOf(endpoint);
    if (index === -1) {
      throw new Error(`MCP 端点 ${endpoint} 不存在`);
    }

    const newEndpoints = currentEndpoints.filter((ep) => ep !== endpoint);
    config.mcpEndpoint = newEndpoints;
  }

  /**
   * 更新 MCP 服务配置
   */
  public updateMcpServer(
    config: AppConfig,
    serverName: string,
    serverConfig: MCPServerConfig
  ): void {
    if (!serverName || typeof serverName !== "string") {
      throw new Error("服务名称必须是非空字符串");
    }

    config.mcpServers[serverName] = serverConfig;
  }

  /**
   * 删除 MCP 服务配置
   */
  public removeMcpServer(config: AppConfig, serverName: string): void {
    if (!serverName || typeof serverName !== "string") {
      throw new Error("服务名称必须是非空字符串");
    }

    // 检查服务是否存在
    if (!config.mcpServers[serverName]) {
      throw new Error(`服务 ${serverName} 不存在`);
    }

    // 清理 mcpServers 字段
    delete config.mcpServers[serverName];

    // 清理 mcpServerConfig 字段
    if (config.mcpServerConfig?.[serverName]) {
      delete config.mcpServerConfig[serverName];
    }
  }

  /**
   * 获取 CustomMCP 中与指定服务相关的工具
   */
  public getRelatedCustomMCPTools(
    config: AppConfig,
    serverName: string
  ): string[] {
    if (!config.customMCP?.tools) {
      return [];
    }

    return config.customMCP.tools
      .filter(
        (tool) =>
          tool.handler?.type === "mcp" &&
          tool.handler.config?.serviceName === serverName
      )
      .map((tool) => tool.name);
  }

  /**
   * 更新服务工具配置
   */
  public updateServerToolsConfig(
    config: AppConfig,
    serverName: string,
    toolsConfig: Record<string, MCPToolConfig>
  ): void {
    // 确保 mcpServerConfig 存在
    if (!config.mcpServerConfig) {
      config.mcpServerConfig = {};
    }

    // 如果 toolsConfig 为空对象，则删除该服务的配置
    if (Object.keys(toolsConfig).length === 0) {
      delete config.mcpServerConfig[serverName];
    } else {
      // 更新指定服务的工具配置
      config.mcpServerConfig[serverName] = {
        tools: toolsConfig,
      };
    }
  }

  /**
   * 删除指定服务器的工具配置
   */
  public removeServerToolsConfig(config: AppConfig, serverName: string): void {
    if (config.mcpServerConfig) {
      delete config.mcpServerConfig[serverName];
    }
  }

  /**
   * 清理无效的服务器工具配置
   * 删除在 mcpServerConfig 中存在但在 mcpServers 中不存在的服务配置
   */
  public cleanupInvalidServerToolsConfig(config: AppConfig): void {
    // 如果没有 mcpServerConfig，无需清理
    if (!config.mcpServerConfig) {
      return;
    }

    const validServerNames = Object.keys(config.mcpServers);
    const configuredServerNames = Object.keys(config.mcpServerConfig);

    // 找出需要清理的服务名称
    const invalidServerNames = configuredServerNames.filter(
      (serverName) => !validServerNames.includes(serverName)
    );

    if (invalidServerNames.length > 0) {
      // 删除无效的服务配置
      for (const serverName of invalidServerNames) {
        delete config.mcpServerConfig[serverName];
      }

      console.log("已清理无效的服务工具配置", {
        count: invalidServerNames.length,
        serverNames: invalidServerNames,
      });
    }
  }

  /**
   * 设置工具启用状态
   */
  public setToolEnabled(
    config: AppConfig,
    serverName: string,
    toolName: string,
    enabled: boolean,
    description?: string
  ): void {
    // 确保 mcpServerConfig 存在
    if (!config.mcpServerConfig) {
      config.mcpServerConfig = {};
    }

    // 确保服务配置存在
    if (!config.mcpServerConfig[serverName]) {
      config.mcpServerConfig[serverName] = { tools: {} };
    }

    // 更新工具配置
    config.mcpServerConfig[serverName].tools[toolName] = {
      ...config.mcpServerConfig[serverName].tools[toolName],
      enable: enabled,
      ...(description && { description }),
    };
  }

  /**
   * 批量更新配置（由 Handler 调用）
   */
  public updateConfig(config: AppConfig, newConfig: Partial<AppConfig>): void {
    // 更新 MCP 端点
    if (newConfig.mcpEndpoint !== undefined) {
      config.mcpEndpoint = newConfig.mcpEndpoint;
    }

    // 更新 MCP 服务
    if (newConfig.mcpServers) {
      const currentServers = { ...config.mcpServers };
      for (const [name, serverConfig] of Object.entries(newConfig.mcpServers)) {
        config.mcpServers[name] = serverConfig;
      }
      // 删除不存在的服务
      for (const name of Object.keys(currentServers)) {
        if (!(name in newConfig.mcpServers)) {
          delete config.mcpServers[name];
          // 同时清理工具配置
          if (config.mcpServerConfig?.[name]) {
            delete config.mcpServerConfig[name];
          }
        }
      }
    }

    // 更新服务工具配置
    if (newConfig.mcpServerConfig) {
      for (const [serverName, toolsConfig] of Object.entries(
        newConfig.mcpServerConfig
      )) {
        if (config.mcpServerConfig?.[serverName]) {
          config.mcpServerConfig[serverName] = toolsConfig;
        }
      }
    }
  }
}
