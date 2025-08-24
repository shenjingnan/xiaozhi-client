/**
 * 配置相关 WebSocket 消息处理器
 * 处理配置获取、更新和广播相关的 WebSocket 消息
 */

import type { WebSocket } from "ws";
import { logger } from "../../Logger.js";
import { configManager } from "../../configManager.js";
import type { AppConfig } from "../../configManager.js";
import type { MessageHandler } from "../../types/WebServerTypes.js";
import { WebSocketMessageType } from "../types.js";

/**
 * 配置消息处理器
 * 负责处理配置相关的 WebSocket 消息
 */
export class ConfigHandler implements MessageHandler {
  private broadcastCallback?: (message: any) => void;

  /**
   * 判断是否可以处理指定类型的消息
   * @param messageType 消息类型
   * @returns 是否可以处理
   */
  canHandle(messageType: string): boolean {
    return [
      WebSocketMessageType.GET_CONFIG,
      WebSocketMessageType.UPDATE_CONFIG,
    ].includes(messageType as WebSocketMessageType);
  }

  /**
   * 处理 WebSocket 消息
   * @param ws WebSocket 连接实例
   * @param message 消息对象
   */
  async handle(ws: WebSocket, message: any): Promise<void> {
    try {
      switch (message.type) {
        case WebSocketMessageType.GET_CONFIG:
          await this.handleGetConfig(ws);
          break;

        case WebSocketMessageType.UPDATE_CONFIG:
          await this.handleUpdateConfig(ws, message);
          break;

        default:
          logger.warn(`ConfigHandler: 未知消息类型 ${message.type}`);
          this.sendError(ws, `未知消息类型: ${message.type}`);
      }
    } catch (error) {
      logger.error("ConfigHandler: 消息处理错误:", error);
      this.sendError(
        ws,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 处理获取配置消息
   * @param ws WebSocket 连接实例
   */
  private async handleGetConfig(ws: WebSocket): Promise<void> {
    try {
      const config = configManager.getConfig();
      logger.debug("getConfig ws getConfig", config);

      ws.send(
        JSON.stringify({
          type: "config",
          data: config,
        })
      );
    } catch (error) {
      logger.error("获取配置失败:", error);
      this.sendError(ws, "获取配置失败");
    }
  }

  /**
   * 处理更新配置消息
   * @param ws WebSocket 连接实例
   * @param message 消息对象
   */
  private async handleUpdateConfig(ws: WebSocket, message: any): Promise<void> {
    try {
      if (!message.config || typeof message.config !== "object") {
        this.sendError(ws, "无效的配置数据");
        return;
      }

      // 更新配置
      this.updateConfig(message.config);

      // 广播配置更新
      this.broadcastConfigUpdate(message.config);

      logger.info("配置已通过 WebSocket 更新");
    } catch (error) {
      logger.error("更新配置失败:", error);
      this.sendError(ws, "更新配置失败");
    }
  }

  /**
   * 更新配置的内部方法
   * 从 WebServer.ts 迁移的配置更新逻辑
   * @param newConfig 新的配置对象
   */
  private updateConfig(newConfig: AppConfig): void {
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
          configManager.setToolEnabled(serverName, toolName, toolConfig.enable);
          // 注释：configManager 不支持直接设置工具描述，描述作为工具配置的一部分保存
        }
      }
    }
  }

  /**
   * 广播配置更新
   * @param config 配置对象
   */
  private broadcastConfigUpdate(config: AppConfig): void {
    if (this.broadcastCallback) {
      this.broadcastCallback({
        type: WebSocketMessageType.CONFIG_UPDATE,
        data: config,
      });
    }
  }

  /**
   * 发送错误消息
   * @param ws WebSocket 连接实例
   * @param error 错误信息
   */
  private sendError(ws: WebSocket, error: string): void {
    try {
      ws.send(
        JSON.stringify({
          type: WebSocketMessageType.ERROR,
          error,
          timestamp: Date.now(),
        })
      );
    } catch (sendError) {
      logger.error("发送错误消息失败:", sendError);
    }
  }

  /**
   * 设置广播回调函数
   * @param callback 广播回调函数
   */
  setBroadcastCallback(callback: (message: any) => void): void {
    this.broadcastCallback = callback;
  }

  /**
   * 发送初始配置数据
   * @param ws WebSocket 连接实例
   */
  async sendInitialConfig(ws: WebSocket): Promise<void> {
    try {
      const config = configManager.getConfig();
      ws.send(JSON.stringify({ type: "config", data: config }));

      // 延迟发送配置更新，确保 MCP Server Proxy 有足够时间完成工具列表更新
      setTimeout(() => {
        const updatedConfig = configManager.getConfig();
        ws.send(
          JSON.stringify({
            type: WebSocketMessageType.CONFIG_UPDATE,
            data: updatedConfig,
          })
        );
      }, 2000); // 2秒延迟
    } catch (error) {
      logger.error("发送初始配置数据失败:", error);
    }
  }
}
