/**
 * 连接配置管理器
 *
 * 负责连接相关配置的管理：
 * - 心跳配置管理
 * - 重连配置管理
 * - 连接配置更新
 */

import type { ConnectionConfig } from "../types.js";
import { ConfigStore } from "./ConfigStore.js";

// 默认连接配置
const DEFAULT_CONNECTION_CONFIG: Required<ConnectionConfig> = {
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
  reconnectInterval: 5000,
};

/**
 * 连接配置管理器
 */
export class ConnectionConfigManager {
  constructor(private readonly store: ConfigStore) {}

  /**
   * 获取连接配置（包含默认值）
   */
  public getConnectionConfig(): Required<ConnectionConfig> {
    const config = this.store.getConfig();
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
   */
  public getHeartbeatInterval(): number {
    return this.getConnectionConfig().heartbeatInterval;
  }

  /**
   * 获取心跳超时时间（毫秒）
   */
  public getHeartbeatTimeout(): number {
    return this.getConnectionConfig().heartbeatTimeout;
  }

  /**
   * 获取重连间隔（毫秒）
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
    const config = this.getMutableConfig();

    if (!config.connection) {
      config.connection = {};
    }

    Object.assign(config.connection, connectionConfig);
    this.store.saveConfig(config);

    this.emitConfigUpdate({ type: "connection", timestamp: new Date() });
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

  private getMutableConfig(): any {
    return (this.store as any).getMutableConfig();
  }

  private emitConfigUpdate(data: { type: string; timestamp: Date }): void {
    (this.store as any).emitEvent("config:updated", data);
  }
}
