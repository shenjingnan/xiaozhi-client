/**
 * 配置相关路由处理器
 * 处理配置的获取和更新操作
 */

import type { Hono } from "hono";
import { logger } from "../../Logger.js";
import { configManager } from "../../configManager.js";
import type { AppConfig } from "../../configManager.js";
import type { RouteHandler } from "../../types/WebServerTypes.js";

/**
 * 配置路由处理器
 * 负责处理 /api/config 相关的路由
 */
export class ConfigRoutes implements RouteHandler {
  /**
   * 注册配置相关路由
   * @param app Hono 应用实例
   */
  register(app: Hono): void {
    // GET /api/config - 获取当前配置
    app.get("/api/config", async (c) => {
      try {
        const config = configManager.getConfig();
        logger.debug("获取配置成功");
        return c.json(config);
      } catch (error) {
        logger.error("获取配置失败:", error);
        return c.json(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          500
        );
      }
    });

    // PUT /api/config - 更新配置
    app.put("/api/config", async (c) => {
      try {
        const newConfig: AppConfig = await c.req.json();

        // 验证配置格式
        if (!newConfig || typeof newConfig !== "object") {
          return c.json({ error: "无效的配置格式" }, 400);
        }

        // 更新配置
        this.updateConfig(newConfig);

        // 广播配置更新（需要通过回调或事件机制实现）
        this.broadcastConfigUpdate?.(newConfig);

        logger.info("配置已更新");
        return c.json({ success: true });
      } catch (error) {
        logger.error("更新配置失败:", error);
        return c.json(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          400
        );
      }
    });
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
   * 广播配置更新的回调函数
   * 这个函数需要在路由注册时由外部提供
   */
  private broadcastConfigUpdate?: (config: AppConfig) => void;

  /**
   * 设置配置更新广播回调
   * @param callback 广播回调函数
   */
  setBroadcastCallback(callback: (config: AppConfig) => void): void {
    this.broadcastConfigUpdate = callback;
  }
}
