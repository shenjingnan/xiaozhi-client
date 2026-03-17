/**
 * MCP 配置管理器
 *
 * 负责 MCP 端点和服务器配置的管理：
 * - MCP 端点的增删改查
 * - MCP 服务器的增删改查
 * - MCP 服务器工具配置管理
 */

import type {
  AppConfig,
  MCPServerConfig,
  MCPServerToolsConfig,
  MCPToolConfig,
} from "../types.js";
import { ConfigStore } from "./ConfigStore.js";

/**
 * MCP 配置管理器
 */
export class MCPConfigManager {
  constructor(private readonly store: ConfigStore) {}

  /**
   * 获取 MCP 端点（向后兼容）
   * @deprecated 使用 getMcpEndpoints() 获取所有端点
   */
  public getMcpEndpoint(): string {
    const config = this.store.getConfig();
    if (Array.isArray(config.mcpEndpoint)) {
      return config.mcpEndpoint[0] || "";
    }
    return config.mcpEndpoint;
  }

  /**
   * 获取所有 MCP 端点
   */
  public getMcpEndpoints(): string[] {
    const config = this.store.getConfig();
    if (Array.isArray(config.mcpEndpoint)) {
      return [...config.mcpEndpoint];
    }
    return config.mcpEndpoint ? [config.mcpEndpoint] : [];
  }

  /**
   * 更新 MCP 端点（支持字符串或数组）
   */
  public updateMcpEndpoint(endpoint: string | string[]): void {
    if (Array.isArray(endpoint)) {
      for (const ep of endpoint) {
        if (!ep || typeof ep !== "string") {
          throw new Error("MCP 端点数组中的每个元素必须是非空字符串");
        }
      }
    }

    const config = this.getMutableConfig();
    config.mcpEndpoint = endpoint;
    this.store.saveConfig(config);

    this.emitConfigUpdate({ type: "endpoint", timestamp: new Date() });
  }

  /**
   * 添加 MCP 端点
   */
  public addMcpEndpoint(endpoint: string): void {
    if (!endpoint || typeof endpoint !== "string") {
      throw new Error("MCP 端点必须是非空字符串");
    }

    const config = this.getMutableConfig();
    const currentEndpoints = this.getMcpEndpoints();

    if (currentEndpoints.includes(endpoint)) {
      throw new Error(`MCP 端点 ${endpoint} 已存在`);
    }

    const newEndpoints = [...currentEndpoints, endpoint];
    config.mcpEndpoint = newEndpoints;
    this.store.saveConfig(config);
  }

  /**
   * 移除 MCP 端点
   */
  public removeMcpEndpoint(endpoint: string): void {
    if (!endpoint || typeof endpoint !== "string") {
      throw new Error("MCP 端点必须是非空字符串");
    }

    const config = this.getMutableConfig();
    const currentEndpoints = this.getMcpEndpoints();

    const index = currentEndpoints.indexOf(endpoint);
    if (index === -1) {
      throw new Error(`MCP 端点 ${endpoint} 不存在`);
    }

    const newEndpoints = currentEndpoints.filter((ep) => ep !== endpoint);
    config.mcpEndpoint = newEndpoints;
    this.store.saveConfig(config);
  }

  /**
   * 获取 MCP 服务配置
   */
  public getMcpServers(): Readonly<Record<string, MCPServerConfig>> {
    const config = this.store.getConfig();
    return config.mcpServers;
  }

  /**
   * 获取 MCP 服务工具配置
   */
  public getMcpServerConfig(): Readonly<Record<string, MCPServerToolsConfig>> {
    const config = this.store.getConfig();
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
   * 更新 MCP 服务配置
   */
  public updateMcpServer(
    serverName: string,
    serverConfig: MCPServerConfig
  ): void {
    if (!serverName || typeof serverName !== "string") {
      throw new Error("服务名称必须是非空字符串");
    }

    const config = this.getMutableConfig();
    config.mcpServers[serverName] = serverConfig;
    this.store.saveConfig(config);
  }

  /**
   * 删除 MCP 服务配置
   */
  public removeMcpServer(serverName: string): void {
    if (!serverName || typeof serverName !== "string") {
      throw new Error("服务名称必须是非空字符串");
    }

    const config = this.getMutableConfig();

    if (!config.mcpServers[serverName]) {
      throw new Error(`服务 ${serverName} 不存在`);
    }

    // 清理 mcpServers 字段
    delete config.mcpServers[serverName];

    // 清理 mcpServerConfig 字段
    if (config.mcpServerConfig?.[serverName]) {
      delete config.mcpServerConfig[serverName];
    }

    // 清理 customMCP 字段中相关的工具定义
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

    this.store.saveConfig(config);

    this.emitConfigUpdate({ type: "customMCP", timestamp: new Date() });

    console.log("成功移除 MCP 服务", { serverName });
  }

  /**
   * 更新服务工具配置
   */
  public updateServerToolsConfig(
    serverName: string,
    toolsConfig: Record<string, MCPToolConfig>
  ): void {
    const config = this.getMutableConfig();

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

    this.store.saveConfig(config);

    this.emitConfigUpdate({
      type: "serverTools",
      serviceName: serverName,
      timestamp: new Date(),
    });
  }

  /**
   * 删除指定服务器的工具配置
   */
  public removeServerToolsConfig(serverName: string): void {
    const config = this.store.getConfig();
    const newConfig = { ...config };

    if (newConfig.mcpServerConfig) {
      delete newConfig.mcpServerConfig[serverName];
      this.store.saveConfig(newConfig);
    }
  }

  /**
   * 清理无效的服务器工具配置
   */
  public cleanupInvalidServerToolsConfig(): void {
    const config = this.getMutableConfig();

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

      this.store.saveConfig(config);

      console.log("已清理无效的服务工具配置", {
        count: invalidServerNames.length,
        serverNames: invalidServerNames,
      });
    }
  }

  private getMutableConfig(): AppConfig {
    return (this.store as any).getMutableConfig();
  }

  private emitConfigUpdate(data: { type: string; timestamp: Date; serviceName?: string }): void {
    (this.store as any).emitEvent("config:updated", data);
  }
}
