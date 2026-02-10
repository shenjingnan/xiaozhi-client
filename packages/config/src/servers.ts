/**
 * 配置服务器管理模块
 * 负责 MCP 服务器的增删改查操作
 */

import type { AppConfig, MCPServerConfig } from "./types.js";
import { configStorage } from "./storage.js";
import { configEvents } from "./events.js";

/**
 * 配置服务器管理器
 * 负责 MCP 服务器的管理操作
 */
export class ConfigServers {
  /**
   * 获取 MCP 服务配置
   * @returns MCP 服务配置对象
   */
  public getMcpServers(): Readonly<Record<string, MCPServerConfig>> {
    const config = this.getMutableConfig();
    return config.mcpServers;
  }

  /**
   * 更新 MCP 服务配置
   * @param serverName 服务名称
   * @param serverConfig 服务配置
   */
  public updateMcpServer(
    serverName: string,
    serverConfig: MCPServerConfig
  ): void {
    if (!serverName || typeof serverName !== "string") {
      throw new Error("服务名称必须是非空字符串");
    }

    const config = this.getMutableConfig();
    // 直接修改配置对象以保留注释信息
    config.mcpServers[serverName] = serverConfig;
    configStorage.saveConfig(config);
  }

  /**
   * 删除 MCP 服务配置
   * @param serverName 服务名称
   */
  public removeMcpServer(serverName: string): void {
    if (!serverName || typeof serverName !== "string") {
      throw new Error("服务名称必须是非空字符串");
    }

    const config = this.getMutableConfig();

    // 检查服务是否存在
    if (!config.mcpServers[serverName]) {
      throw new Error(`服务 ${serverName} 不存在`);
    }

    // 1. 清理 mcpServers 字段（现有逻辑）
    delete config.mcpServers[serverName];

    // 2. 清理 mcpServerConfig 字段（复用现有方法）
    if (config.mcpServerConfig?.[serverName]) {
      delete config.mcpServerConfig[serverName];
    }

    // 3. 清理 customMCP 字段中相关的工具定义
    if (config.customMCP?.tools) {
      // 查找与该服务相关的 CustomMCP 工具
      const relatedTools = config.customMCP.tools.filter(
        (tool) =>
          tool.handler?.type === "mcp" &&
          tool.handler.config?.serviceName === serverName
      );

      // 移除相关工具
      for (const tool of relatedTools) {
        const toolIndex = config.customMCP.tools.findIndex(
          (t) => t.name === tool.name
        );
        if (toolIndex !== -1) {
          config.customMCP.tools.splice(toolIndex, 1);
        }
      }

      // 如果没有工具了，可以清理整个 customMCP 对象
      if (config.customMCP.tools.length === 0) {
        config.customMCP = undefined;
      }
    }

    // 4. 保存配置（单次原子性操作）
    configStorage.saveConfig(config);

    // 5. 发射配置更新事件，通知 CustomMCPHandler 重新初始化
    configEvents.emit("config:updated", {
      type: "customMCP",
      timestamp: new Date(),
    });

    // 记录清理结果
    console.log("成功移除 MCP 服务", { serverName });
  }

  /**
   * 获取可修改的配置对象（内部使用）
   * @returns 配置对象
   */
  private getMutableConfig(): AppConfig {
    return configStorage.loadConfig();
  }
}

// 导出单例实例
export const configServers = new ConfigServers();
