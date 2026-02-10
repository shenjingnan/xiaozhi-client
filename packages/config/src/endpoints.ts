/**
 * 配置端点管理模块
 * 负责 MCP 端点的增删改查操作
 */

import type { AppConfig } from "./types.js";
import { configStorage } from "./storage.js";
import { configEvents } from "./events.js";

/**
 * 配置端点管理器
 * 负责 MCP 端点的管理操作
 */
export class ConfigEndpoints {
  /**
   * 获取 MCP 端点（向后兼容）
   * @deprecated 使用 getMcpEndpoints() 获取所有端点
   */
  public getMcpEndpoint(): string {
    const config = this.getMutableConfig();
    if (Array.isArray(config.mcpEndpoint)) {
      return config.mcpEndpoint[0] || "";
    }
    return config.mcpEndpoint;
  }

  /**
   * 获取所有 MCP 端点
   * @returns MCP 端点数组
   */
  public getMcpEndpoints(): string[] {
    const config = this.getMutableConfig();
    if (Array.isArray(config.mcpEndpoint)) {
      return [...config.mcpEndpoint];
    }
    return config.mcpEndpoint ? [config.mcpEndpoint] : [];
  }

  /**
   * 更新 MCP 端点（支持字符串或数组）
   * @param endpoint 端点字符串或端点数组
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
    configStorage.saveConfig(config);

    // 发射配置更新事件
    configEvents.emit("config:updated", {
      type: "endpoint",
      timestamp: new Date(),
    });
  }

  /**
   * 添加 MCP 端点
   * @param endpoint 要添加的端点
   */
  public addMcpEndpoint(endpoint: string): void {
    if (!endpoint || typeof endpoint !== "string") {
      throw new Error("MCP 端点必须是非空字符串");
    }

    const config = this.getMutableConfig();
    const currentEndpoints = this.getMcpEndpoints();

    // 检查是否已存在
    if (currentEndpoints.includes(endpoint)) {
      throw new Error(`MCP 端点 ${endpoint} 已存在`);
    }

    const newEndpoints = [...currentEndpoints, endpoint];
    config.mcpEndpoint = newEndpoints;
    configStorage.saveConfig(config);
  }

  /**
   * 移除 MCP 端点
   * @param endpoint 要移除的端点
   */
  public removeMcpEndpoint(endpoint: string): void {
    if (!endpoint || typeof endpoint !== "string") {
      throw new Error("MCP 端点必须是非空字符串");
    }

    const config = this.getMutableConfig();
    const currentEndpoints = this.getMcpEndpoints();

    // 检查是否存在
    const index = currentEndpoints.indexOf(endpoint);
    if (index === -1) {
      throw new Error(`MCP 端点 ${endpoint} 不存在`);
    }

    const newEndpoints = currentEndpoints.filter((ep) => ep !== endpoint);
    config.mcpEndpoint = newEndpoints;
    configStorage.saveConfig(config);
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
export const configEndpoints = new ConfigEndpoints();
