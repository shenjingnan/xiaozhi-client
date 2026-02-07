import type { AppContext } from "@/types/hono.context.js";
import type { AppConfig } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";
import type { Context } from "hono";
import { BaseHandler } from "./base.handler.js";

/**
 * 配置 API 处理器
 */
export class ConfigApiHandler extends BaseHandler {
  constructor() {
    super();
  }

  /**
   * 获取配置
   * GET /api/config
   */
  async getConfig(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取配置请求");
      const config = configManager.getConfig();
      c.get("logger").debug("获取配置成功");
      return c.success(config);
    } catch (error) {
      return this.handleError(c, error, "获取配置", "CONFIG_READ_ERROR");
    }
  }

  /**
   * 更新配置
   * PUT /api/config
   */
  async updateConfig(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理更新配置请求");
      const newConfig: AppConfig = await c.req.json();

      // 使用 configManager 的验证方法
      configManager.validateConfig(newConfig);

      // 使用 configManager 的批量更新方法
      configManager.updateConfig(newConfig);

      // 更新服务工具配置（单独处理，因为 updateConfig 只更新已存在的配置）
      if (newConfig.mcpServerConfig) {
        for (const [serverName, toolsConfig] of Object.entries(
          newConfig.mcpServerConfig
        )) {
          for (const [toolName, toolConfig] of Object.entries(
            toolsConfig.tools
          )) {
            configManager.setToolEnabled(
              serverName,
              toolName,
              toolConfig.enable
            );
          }
        }
      }

      c.get("logger").info("配置更新成功");
      return c.success(undefined, "配置更新成功");
    } catch (error) {
      return this.handleError(c, error, "配置更新", "CONFIG_UPDATE_ERROR");
    }
  }

  /**
   * 获取 MCP 端点
   * GET /api/config/mcp-endpoint
   */
  async getMcpEndpoint(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取 MCP 端点请求");
      const endpoint = configManager.getMcpEndpoint();
      c.get("logger").debug("获取 MCP 端点成功");
      return c.success({ endpoint });
    } catch (error) {
      return this.handleError(
        c,
        error,
        "获取 MCP 端点",
        "MCP_ENDPOINT_READ_ERROR"
      );
    }
  }

  /**
   * 获取 MCP 端点列表
   * GET /api/config/mcp-endpoints
   */
  async getMcpEndpoints(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取 MCP 端点列表请求");
      const endpoints = configManager.getMcpEndpoints();
      c.get("logger").debug("获取 MCP 端点列表成功");
      return c.success({ endpoints });
    } catch (error) {
      return this.handleError(
        c,
        error,
        "获取 MCP 端点列表",
        "MCP_ENDPOINTS_READ_ERROR"
      );
    }
  }

  /**
   * 获取 MCP 服务配置
   * GET /api/config/mcp-servers
   */
  async getMcpServers(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取 MCP 服务配置请求");
      const servers = configManager.getMcpServers();
      c.get("logger").debug("获取 MCP 服务配置成功");
      return c.success({ servers });
    } catch (error) {
      return this.handleError(
        c,
        error,
        "获取 MCP 服务配置",
        "MCP_SERVERS_READ_ERROR"
      );
    }
  }

  /**
   * 获取连接配置
   * GET /api/config/connection
   */
  async getConnectionConfig(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取连接配置请求");
      const connection = configManager.getConnectionConfig();
      c.get("logger").debug("获取连接配置成功");
      return c.success({ connection });
    } catch (error) {
      return this.handleError(
        c,
        error,
        "获取连接配置",
        "CONNECTION_CONFIG_READ_ERROR"
      );
    }
  }

  /**
   * 重新加载配置
   * POST /api/config/reload
   */
  async reloadConfig(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理重新加载配置请求");
      configManager.reloadConfig();
      const config = configManager.getConfig();
      c.get("logger").info("重新加载配置成功");
      return c.success(config, "配置重新加载成功");
    } catch (error) {
      return this.handleError(c, error, "重新加载配置", "CONFIG_RELOAD_ERROR");
    }
  }

  /**
   * 获取配置文件路径
   * GET /api/config/path
   */
  async getConfigPath(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取配置文件路径请求");
      const path = configManager.getConfigPath();
      c.get("logger").debug("获取配置文件路径成功");
      return c.success({ path });
    } catch (error) {
      return this.handleError(
        c,
        error,
        "获取配置文件路径",
        "CONFIG_PATH_READ_ERROR"
      );
    }
  }

  /**
   * 检查配置是否存在
   * GET /api/config/exists
   */
  async checkConfigExists(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理检查配置是否存在请求");
      const exists = configManager.configExists();
      c.get("logger").debug(`配置存在检查结果: ${exists}`);
      return c.success({ exists });
    } catch (error) {
      return this.handleError(
        c,
        error,
        "检查配置是否存在",
        "CONFIG_EXISTS_CHECK_ERROR"
      );
    }
  }
}
