/**
 * 配置连接管理模块
 * 负责连接配置的管理操作
 */

import type { AppConfig, ConnectionConfig } from "./types.js";
import { DEFAULT_CONNECTION_CONFIG } from "./types.js";
import { configStorage } from "./storage.js";
import { configEvents } from "./events.js";

/**
 * 必需的连接配置类型
 */
export type RequiredConnectionConfig = Required<ConnectionConfig>;

/**
 * 配置连接管理器
 * 负责连接配置的管理操作
 */
export class ConfigConnection {
  /**
   * 获取连接配置（包含默认值）
   * @returns 连接配置对象
   */
  public getConnectionConfig(): RequiredConnectionConfig {
    const config = this.getMutableConfig();
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
   * 获取心跳检测间隔（毫秒）
   * @returns 心跳检测间隔
   */
  public getHeartbeatInterval(): number {
    return this.getConnectionConfig().heartbeatInterval;
  }

  /**
   * 获取心跳超时时间（毫秒）
   * @returns 心跳超时时间
   */
  public getHeartbeatTimeout(): number {
    return this.getConnectionConfig().heartbeatTimeout;
  }

  /**
   * 获取重连间隔（毫秒）
   * @returns 重连间隔
   */
  public getReconnectInterval(): number {
    return this.getConnectionConfig().reconnectInterval;
  }

  /**
   * 更新连接配置
   * @param connectionConfig 连接配置
   */
  public updateConnectionConfig(
    connectionConfig: Partial<ConnectionConfig>
  ): void {
    const config = this.getMutableConfig();

    // 确保 connection 对象存在
    if (!config.connection) {
      config.connection = {};
    }

    // 直接修改现有的 connection 对象以保留注释
    Object.assign(config.connection, connectionConfig);
    configStorage.saveConfig(config);

    // 发射配置更新事件
    configEvents.emit("config:updated", {
      type: "connection",
      timestamp: new Date(),
    });
  }

  /**
   * 设置心跳检测间隔
   * @param interval 心跳检测间隔（毫秒）
   */
  public setHeartbeatInterval(interval: number): void {
    if (interval <= 0) {
      throw new Error("心跳检测间隔必须大于0");
    }
    this.updateConnectionConfig({ heartbeatInterval: interval });
  }

  /**
   * 设置心跳超时时间
   * @param timeout 心跳超时时间（毫秒）
   */
  public setHeartbeatTimeout(timeout: number): void {
    if (timeout <= 0) {
      throw new Error("心跳超时时间必须大于0");
    }
    this.updateConnectionConfig({ heartbeatTimeout: timeout });
  }

  /**
   * 设置重连间隔
   * @param interval 重连间隔（毫秒）
   */
  public setReconnectInterval(interval: number): void {
    if (interval <= 0) {
      throw new Error("重连间隔必须大于0");
    }
    this.updateConnectionConfig({ reconnectInterval: interval });
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
export const configConnection = new ConfigConnection();
