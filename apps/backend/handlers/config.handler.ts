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
    const logger = c.get("logger");
    try {
      logger.debug("处理获取配置请求");
      const config = configManager.getConfig();
      logger.info("获取配置成功");
      return c.success(config);
    } catch (error) {
      logger.error("获取配置失败:", error);
      return c.fail(
        "CONFIG_READ_ERROR",
        error instanceof Error ? error.message : "获取配置失败",
        undefined,
        500
      );
    }
  }

  /**
   * 更新配置
   * PUT /api/config
   */
  async updateConfig(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");
    try {
      logger.debug("处理更新配置请求");
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

      logger.info("配置更新成功");
      return c.success(undefined, "配置更新成功");
    } catch (error) {
      logger.error("配置更新失败:", error);
      return c.fail(
        "CONFIG_UPDATE_ERROR",
        error instanceof Error ? error.message : "配置更新失败"
      );
    }
  }

  /**
   * 获取 MCP 端点
   * GET /api/config/mcp-endpoint
   */
  async getMcpEndpoint(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");
    try {
      logger.debug("处理获取 MCP 端点请求");
      const endpoint = configManager.getMcpEndpoint();
      logger.debug("获取 MCP 端点成功");
      return c.success({ endpoint });
    } catch (error) {
      logger.error("获取 MCP 端点失败:", error);
      return c.fail(
        "MCP_ENDPOINT_READ_ERROR",
        error instanceof Error ? error.message : "获取 MCP 端点失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取 MCP 端点列表
   * GET /api/config/mcp-endpoints
   */
  async getMcpEndpoints(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");
    try {
      logger.debug("处理获取 MCP 端点列表请求");
      c.get("logger").debug("处理获取 MCP 端点列表请求");
      const endpoints = configManager.getMcpEndpoints();
      logger.debug("获取 MCP 端点列表成功");
      return c.success({ endpoints });
    } catch (error) {
      logger.error("获取 MCP 端点列表失败:", error);
      return c.fail(
        "MCP_ENDPOINTS_READ_ERROR",
        error instanceof Error ? error.message : "获取 MCP 端点列表失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取 MCP 服务配置
   * GET /api/config/mcp-servers
   */
  async getMcpServers(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");
    try {
      logger.debug("处理获取 MCP 服务配置请求");
      const servers = configManager.getMcpServers();
      logger.debug("获取 MCP 服务配置成功");
      return c.success({ servers });
    } catch (error) {
      logger.error("获取 MCP 服务配置失败:", error);
      return c.fail(
        "MCP_SERVERS_READ_ERROR",
        error instanceof Error ? error.message : "获取 MCP 服务配置失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取连接配置
   * GET /api/config/connection
   */
  async getConnectionConfig(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");
    try {
      logger.debug("处理获取连接配置请求");
      c.get("logger").debug("处理获取连接配置请求");
      const connection = configManager.getConnectionConfig();
      logger.debug("获取连接配置成功");
      return c.success({ connection });
    } catch (error) {
      logger.error("获取连接配置失败:", error);
      return c.fail(
        "CONNECTION_CONFIG_READ_ERROR",
        error instanceof Error ? error.message : "获取连接配置失败",
        undefined,
        500
      );
    }
  }

  /**
   * 重新加载配置
   * POST /api/config/reload
   */
  async reloadConfig(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");
    try {
      logger.info("处理重新加载配置请求");
      configManager.reloadConfig();
      const config = configManager.getConfig();
      logger.info("重新加载配置成功");
      return c.success(config, "配置重新加载成功");
    } catch (error) {
      logger.error("重新加载配置失败:", error);
      return c.fail(
        "CONFIG_RELOAD_ERROR",
        error instanceof Error ? error.message : "重新加载配置失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取配置文件路径
   * GET /api/config/path
   */
  async getConfigPath(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");
    try {
      logger.debug("处理获取配置文件路径请求");
      const path = configManager.getConfigPath();
      logger.debug("获取配置文件路径成功");
      return c.success({ path });
    } catch (error) {
      logger.error("获取配置文件路径失败:", error);
      return c.fail(
        "CONFIG_PATH_READ_ERROR",
        error instanceof Error ? error.message : "获取配置文件路径失败",
        undefined,
        500
      );
    }
  }

  /**
   * 检查配置是否存在
   * GET /api/config/exists
   */
  async checkConfigExists(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");
    try {
      logger.debug("处理检查配置是否存在请求");
      const exists = configManager.configExists();
      logger.debug(`配置存在检查结果: ${exists}`);
      return c.success({ exists });
    } catch (error) {
      logger.error("检查配置是否存在失败:", error);
      return c.fail(
        "CONFIG_EXISTS_CHECK_ERROR",
        error instanceof Error ? error.message : "检查配置是否存在失败",
        undefined,
        500
      );
    }
  }
}
