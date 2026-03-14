/**
 * WebUI 和工具调用日志配置管理器
 *
 * 负责 WebUI 和工具调用日志相关配置的管理：
 * - WebUI 配置管理
 * - 工具调用日志配置管理
 */

import type { WebUIConfig, ToolCallLogConfig } from "../types.js";
import { ConfigStore } from "./ConfigStore.js";

/**
 * WebUI 和工具调用日志配置管理器
 */
export class WebUIConfigManager {
  constructor(private readonly store: ConfigStore) {}

  // ==================== WebUI 配置 ====================

  /**
   * 获取 Web UI 配置
   */
  public getWebUIConfig(): Readonly<WebUIConfig> {
    const config = this.store.getConfig();
    return config.webUI || {};
  }

  /**
   * 获取 Web UI 端口号
   */
  public getWebUIPort(): number {
    const webUIConfig = this.getWebUIConfig();
    return webUIConfig.port ?? 9999;
  }

  /**
   * 更新 Web UI 配置
   */
  public updateWebUIConfig(webUIConfig: Partial<WebUIConfig>): void {
    const config = this.getMutableConfig();

    if (!config.webUI) {
      config.webUI = {};
    }

    Object.assign(config.webUI, webUIConfig);
    this.store.saveConfig(config);

    this.emitConfigUpdate({ type: "webui", timestamp: new Date() });
  }

  /**
   * 设置 Web UI 端口号
   */
  public setWebUIPort(port: number): void {
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error("端口号必须是 1-65535 之间的整数");
    }
    this.updateWebUIConfig({ port });
  }

  // ==================== 工具调用日志配置 ====================

  /**
   * 获取工具调用日志配置
   */
  public getToolCallLogConfig(): Readonly<ToolCallLogConfig> {
    const config = this.store.getConfig();
    return config.toolCallLog || {};
  }

  /**
   * 更新工具调用日志配置
   */
  public updateToolCallLogConfig(
    toolCallLogConfig: Partial<ToolCallLogConfig>
  ): void {
    const config = this.getMutableConfig();

    if (!config.toolCallLog) {
      config.toolCallLog = {};
    }

    Object.assign(config.toolCallLog, toolCallLogConfig);
    this.store.saveConfig(config);
  }

  private getMutableConfig(): any {
    return (this.store as any).getMutableConfig();
  }

  private emitConfigUpdate(data: { type: string; timestamp: Date }): void {
    (this.store as any).emitEvent("config:updated", data);
  }
}
