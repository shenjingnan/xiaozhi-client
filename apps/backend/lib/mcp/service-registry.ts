/**
 * MCP 服务注册表
 * 负责 MCP 服务实例的存储、查找和管理
 */

import { logger } from "@/Logger.js";
import { MCPService } from "@/lib/mcp";
import type {
  InternalMCPServiceConfig,
  MCPServiceConfig,
} from "@/lib/mcp/types";

/**
 * 服务注册表类
 * 管理多个 MCP 服务实例和配置
 */
export class ServiceRegistry {
  private services: Map<string, MCPService> = new Map();
  private configs: Record<string, MCPServiceConfig> = {};

  /**
   * 添加服务配置
   * @param serviceName 服务名称
   * @param config 服务配置
   */
  addConfig(serviceName: string, config: MCPServiceConfig): void {
    this.configs[serviceName] = config;
    logger.debug(`[ServiceRegistry] 已添加服务配置: ${serviceName}`);
  }

  /**
   * 更新服务配置
   * @param serviceName 服务名称
   * @param config 服务配置
   */
  updateConfig(serviceName: string, config: MCPServiceConfig): void {
    this.configs[serviceName] = config;
    logger.debug(`[ServiceRegistry] 已更新服务配置: ${serviceName}`);
  }

  /**
   * 移除服务配置
   * @param serviceName 服务名称
   */
  removeConfig(serviceName: string): void {
    delete this.configs[serviceName];
    logger.debug(`[ServiceRegistry] 已移除服务配置: ${serviceName}`);
  }

  /**
   * 获取服务配置
   * @param serviceName 服务名称
   * @returns 服务配置或 undefined
   */
  getConfig(serviceName: string): MCPServiceConfig | undefined {
    return this.configs[serviceName];
  }

  /**
   * 获取所有服务配置
   * @returns 所有服务配置
   */
  getAllConfigs(): Record<string, MCPServiceConfig> {
    return { ...this.configs };
  }

  /**
   * 检查服务配置是否存在
   * @param serviceName 服务名称
   * @returns 是否存在
   */
  hasConfig(serviceName: string): boolean {
    return serviceName in this.configs;
  }

  /**
   * 获取配置数量
   * @returns 配置数量
   */
  getConfigCount(): number {
    return Object.keys(this.configs).length;
  }

  /**
   * 注册服务实例
   * @param serviceName 服务名称
   * @param service 服务实例
   */
  register(serviceName: string, service: MCPService): void {
    this.services.set(serviceName, service);
    logger.debug(`[ServiceRegistry] 已注册服务实例: ${serviceName}`);
  }

  /**
   * 获取服务实例
   * @param serviceName 服务名称
   * @returns 服务实例或 undefined
   */
  get(serviceName: string): MCPService | undefined {
    return this.services.get(serviceName);
  }

  /**
   * 移除服务实例
   * @param serviceName 服务名称
   */
  unregister(serviceName: string): void {
    this.services.delete(serviceName);
    logger.debug(`[ServiceRegistry] 已移除服务实例: ${serviceName}`);
  }

  /**
   * 检查服务实例是否存在
   * @param serviceName 服务名称
   * @returns 是否存在
   */
  has(serviceName: string): boolean {
    return this.services.has(serviceName);
  }

  /**
   * 获取所有服务实例
   * @returns 所有服务实例的副本
   */
  getAllServices(): Map<string, MCPService> {
    return new Map(this.services);
  }

  /**
   * 获取所有已连接的服务名称
   * @returns 已连接的服务名称数组
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
   * 获取服务实例数量
   * @returns 服务实例数量
   */
  size(): number {
    return this.services.size;
  }

  /**
   * 清空所有服务实例和配置
   */
  clear(): void {
    this.services.clear();
    this.configs = {};
    logger.debug("[ServiceRegistry] 已清空所有服务实例和配置");
  }

  /**
   * 获取所有配置的服务名称
   * @returns 服务名称数组
   */
  getConfigNames(): string[] {
    return Object.keys(this.configs);
  }

  /**
   * 获取所有注册的服务名称
   * @returns 服务名称数组
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }
}
