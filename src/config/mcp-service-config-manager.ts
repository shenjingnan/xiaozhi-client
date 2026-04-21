/**
 * MCP 服务配置管理器
 *
 * 负责 MCP 端点和服务配置的管理。
 * 包括端点的增删改查、服务配置管理、工具启用状态等。
 */

import type {
  AppConfig,
  ConnectionConfig,
  MCPServerConfig,
  MCPServerToolsConfig,
  MCPToolConfig,
} from "./config-types.js";
import { DEFAULT_CONNECTION_CONFIG } from "./config-types.js";
import type { CoreConfigManager } from "./core-config-manager.js";

/**
 * MCP 服务配置管理类
 * 负责 MCP 端点和服务配置的管理
 */
export class MCPServiceConfigManager {
  private coreConfig: CoreConfigManager;

  constructor(coreConfig: CoreConfigManager) {
    this.coreConfig = coreConfig;
  }

  /**
   * 获取 MCP 端点（向后兼容）
   * @deprecated 使用 getMcpEndpoints() 获取所有端点
   */
  public getMcpEndpoint(): string {
    const config = this.coreConfig.getConfig();
    if (Array.isArray(config.mcpEndpoint)) {
      return config.mcpEndpoint[0] || "";
    }
    return config.mcpEndpoint;
  }

  /**
   * 获取所有 MCP 端点
   */
  public getMcpEndpoints(): string[] {
    const config = this.coreConfig.getConfig();
    if (Array.isArray(config.mcpEndpoint)) {
      return [...config.mcpEndpoint];
    }
    return config.mcpEndpoint ? [config.mcpEndpoint] : [];
  }

  /**
   * 获取 MCP 服务配置
   */
  public getMcpServers(): Readonly<Record<string, MCPServerConfig>> {
    const config = this.coreConfig.getConfig();
    return config.mcpServers;
  }

  /**
   * 获取 MCP 服务工具配置
   */
  public getMcpServerConfig(): Readonly<Record<string, MCPServerToolsConfig>> {
    const config = this.coreConfig.getConfig();
    return config.mcpServerConfig || {};
  }

  /**
   * 获取指定服务的工具配置
   */
  public getServerToolsConfig(
    serverName: string
  ): Readonly<Record<string, MCPToolConfig>> {
    const serverConfig = this.getMcpServerConfig();
    return serverConfig[serverName]?.tools || {};
  }

  /**
   * 检查工具是否启用
   */
  public isToolEnabled(serverName: string, toolName: string): boolean {
    const toolsConfig = this.getServerToolsConfig(serverName);
    const toolConfig = toolsConfig[toolName];
    return toolConfig?.enable !== false;
  }

  /**
   * 更新 MCP 端点
   */
  public updateMcpEndpoint(endpoint: string | string[]): void {
    if (Array.isArray(endpoint)) {
      for (const ep of endpoint) {
        if (!ep || typeof ep !== "string") {
          throw new Error("MCP 端点数组中的每个元素必须是非空字符串");
        }
      }
    }

    const config = this.coreConfig.getMutableConfig();
    config.mcpEndpoint = endpoint;
    this.coreConfig.saveConfig(config);

    this.coreConfig.emitEvent("config:updated", {
      type: "endpoint",
      timestamp: new Date(),
    });
  }

  /**
   * 添加 MCP 端点
   */
  public addMcpEndpoint(endpoint: string): void {
    if (!endpoint || typeof endpoint !== "string") {
      throw new Error("MCP 端点必须是非空字符串");
    }

    const config = this.coreConfig.getMutableConfig();
    const currentEndpoints = this.getMcpEndpoints();

    if (currentEndpoints.includes(endpoint)) {
      throw new Error(`MCP 端点 ${endpoint} 已存在`);
    }

    const newEndpoints = [...currentEndpoints, endpoint];
    config.mcpEndpoint = newEndpoints;
    this.coreConfig.saveConfig(config);
  }

  /**
   * 移除 MCP 端点
   */
  public removeMcpEndpoint(endpoint: string): void {
    if (!endpoint || typeof endpoint !== "string") {
      throw new Error("MCP 端点必须是非空字符串");
    }

    const config = this.coreConfig.getMutableConfig();
    const currentEndpoints = this.getMcpEndpoints();

    const index = currentEndpoints.indexOf(endpoint);
    if (index === -1) {
      throw new Error(`MCP 端点 ${endpoint} 不存在`);
    }

    const newEndpoints = currentEndpoints.filter((ep) => ep !== endpoint);
    config.mcpEndpoint = newEndpoints;
    this.coreConfig.saveConfig(config);
  }

  /**
   * 更新 MCP 服务配置
   */
  public updateMcpServer(
    serverName: string,
    serverConfig: MCPServerConfig
  ): void {
    if (!serverName || typeof serverName !== "string") {
      throw new Error("服务名称必须是非空字符串");
    }

    const config = this.coreConfig.getMutableConfig();
    config.mcpServers[serverName] = serverConfig;
    this.coreConfig.saveConfig(config);
  }

  /**
   * 删除 MCP 服务配置
   */
  public removeMcpServer(serverName: string): void {
    if (!serverName || typeof serverName !== "string") {
      throw new Error("服务名称必须是非空字符串");
    }

    const config = this.coreConfig.getMutableConfig();

    if (!config.mcpServers[serverName]) {
      throw new Error(`服务 ${serverName} 不存在`);
    }

    // 清理 mcpServers
    delete config.mcpServers[serverName];

    // 清理 mcpServerConfig
    if (config.mcpServerConfig?.[serverName]) {
      delete config.mcpServerConfig[serverName];
    }

    // 清理 customMCP 相关工具
    if (config.customMCP?.tools) {
      const relatedTools = config.customMCP.tools.filter(
        (tool) =>
          tool.handler?.type === "mcp" &&
          tool.handler.config?.serviceName === serverName
      );

      for (const tool of relatedTools) {
        const toolIndex = config.customMCP.tools.findIndex(
          (t) => t.name === tool.name
        );
        if (toolIndex !== -1) {
          config.customMCP.tools.splice(toolIndex, 1);
        }
      }

      if (config.customMCP.tools.length === 0) {
        config.customMCP = undefined;
      }
    }

    this.coreConfig.saveConfig(config);

    this.coreConfig.emitEvent("config:updated", {
      type: "customMCP",
      timestamp: new Date(),
    });

    console.log("成功移除 MCP 服务", { serverName });
  }

  /**
   * 更新服务工具配置
   */
  public updateServerToolsConfig(
    serverName: string,
    toolsConfig: Record<string, MCPToolConfig>
  ): void {
    const config = this.coreConfig.getMutableConfig();

    if (!config.mcpServerConfig) {
      config.mcpServerConfig = {};
    }

    if (Object.keys(toolsConfig).length === 0) {
      delete config.mcpServerConfig[serverName];
    } else {
      config.mcpServerConfig[serverName] = {
        tools: toolsConfig,
      };
    }

    this.coreConfig.saveConfig(config);

    this.coreConfig.emitEvent("config:updated", {
      type: "serverTools",
      serviceName: serverName,
      timestamp: new Date(),
    });
  }

  /**
   * 删除指定服务器的工具配置
   */
  public removeServerToolsConfig(serverName: string): void {
    const config = this.coreConfig.getConfig();
    const newConfig = { ...config };

    if (newConfig.mcpServerConfig) {
      delete newConfig.mcpServerConfig[serverName];
      this.coreConfig.saveConfig(newConfig);
    }
  }

  /**
   * 清理无效的服务器工具配置
   */
  public cleanupInvalidServerToolsConfig(): void {
    const config = this.coreConfig.getMutableConfig();

    if (!config.mcpServerConfig) {
      return;
    }

    const validServerNames = Object.keys(config.mcpServers);
    const configuredServerNames = Object.keys(config.mcpServerConfig);

    const invalidServerNames = configuredServerNames.filter(
      (serverName) => !validServerNames.includes(serverName)
    );

    if (invalidServerNames.length > 0) {
      for (const serverName of invalidServerNames) {
        delete config.mcpServerConfig[serverName];
      }

      this.coreConfig.saveConfig(config);

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
    serverName: string,
    toolName: string,
    enabled: boolean,
    description?: string
  ): void {
    const config = this.coreConfig.getMutableConfig();

    if (!config.mcpServerConfig) {
      config.mcpServerConfig = {};
    }

    if (!config.mcpServerConfig[serverName]) {
      config.mcpServerConfig[serverName] = { tools: {} };
    }

    config.mcpServerConfig[serverName].tools[toolName] = {
      ...config.mcpServerConfig[serverName].tools[toolName],
      enable: enabled,
      ...(description && { description }),
    };

    this.coreConfig.saveConfig(config);
  }

  /**
   * 获取连接配置
   */
  public getConnectionConfig(): Required<ConnectionConfig> {
    const config = this.coreConfig.getConfig();
    const connectionConfig = config.connection || {};

    return {
      heartbeatInterval:
        connectionConfig.heartbeatInterval ??
        DEFAULT_CONNECTION_CONFIG.heartbeatInterval,
      heartbeatTimeout:
        connectionConfig.heartbeatTimeout ??
        DEFAULT_CONNECTION_CONFIG.heartbeatTimeout,
      reconnectInterval:
        connectionConfig.reconnectInterval ??
        DEFAULT_CONNECTION_CONFIG.reconnectInterval,
    };
  }

  /**
   * 获取心跳检测间隔
   */
  public getHeartbeatInterval(): number {
    return this.getConnectionConfig().heartbeatInterval;
  }

  /**
   * 获取心跳超时时间
   */
  public getHeartbeatTimeout(): number {
    return this.getConnectionConfig().heartbeatTimeout;
  }

  /**
   * 获取重连间隔
   */
  public getReconnectInterval(): number {
    return this.getConnectionConfig().reconnectInterval;
  }

  /**
   * 更新连接配置
   */
  public updateConnectionConfig(
    connectionConfig: Partial<ConnectionConfig>
  ): void {
    const config = this.coreConfig.getMutableConfig();

    if (!config.connection) {
      config.connection = {};
    }

    Object.assign(config.connection, connectionConfig);
    this.coreConfig.saveConfig(config);

    this.coreConfig.emitEvent("config:updated", {
      type: "connection",
      timestamp: new Date(),
    });
  }

  /**
   * 设置心跳检测间隔
   */
  public setHeartbeatInterval(interval: number): void {
    if (interval <= 0) {
      throw new Error("心跳检测间隔必须大于0");
    }
    this.updateConnectionConfig({ heartbeatInterval: interval });
  }

  /**
   * 设置心跳超时时间
   */
  public setHeartbeatTimeout(timeout: number): void {
    if (timeout <= 0) {
      throw new Error("心跳超时时间必须大于0");
    }
    this.updateConnectionConfig({ heartbeatTimeout: timeout });
  }

  /**
   * 设置重连间隔
   */
  public setReconnectInterval(interval: number): void {
    if (interval <= 0) {
      throw new Error("重连间隔必须大于0");
    }
    this.updateConnectionConfig({ reconnectInterval: interval });
  }

  /**
   * 批量更新配置
   */
  public updateConfig(newConfig: Partial<AppConfig>): void {
    const config = this.coreConfig.getMutableConfig();

    if (newConfig.mcpEndpoint !== undefined) {
      config.mcpEndpoint = newConfig.mcpEndpoint;
    }

    if (newConfig.mcpServers) {
      const currentServers = { ...config.mcpServers };
      for (const [name, serverConfig] of Object.entries(newConfig.mcpServers)) {
        config.mcpServers[name] = serverConfig;
      }
      for (const name of Object.keys(currentServers)) {
        if (!(name in newConfig.mcpServers)) {
          delete config.mcpServers[name];
          if (config.mcpServerConfig?.[name]) {
            delete config.mcpServerConfig[name];
          }
        }
      }
    }

    if (newConfig.connection) {
      if (!config.connection) {
        config.connection = {};
      }
      Object.assign(config.connection, newConfig.connection);
    }

    if (newConfig.mcpServerConfig) {
      for (const [serverName, toolsConfig] of Object.entries(
        newConfig.mcpServerConfig
      )) {
        if (config.mcpServerConfig?.[serverName]) {
          config.mcpServerConfig[serverName] = toolsConfig;
        }
      }
    }

    this.coreConfig.saveConfig(config);

    this.coreConfig.emitEvent("config:updated", {
      type: "config",
      timestamp: new Date(),
    });
  }
}
