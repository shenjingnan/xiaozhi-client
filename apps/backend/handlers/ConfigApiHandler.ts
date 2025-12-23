import type { AppConfig } from "@/lib/config/manager.js";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@middlewares/index.js";
import { ConfigService } from "@services/ConfigService.js";
import type { Context } from "hono";
import { AbstractApiHandler } from "./AbstractApiHandler.js";

/**
 * 配置 API 处理器
 */
export class ConfigApiHandler extends AbstractApiHandler {
  private configService: ConfigService;

  constructor() {
    super();
    this.configService = new ConfigService();
  }

  /**
   * 获取配置
   * GET /api/config
   */
  async getConfig(c: Context): Promise<Response> {
    const logger = this.getLogger(c);
    try {
      logger.debug("处理获取配置请求");
      const config = await this.configService.getConfig();
      logger.info("获取配置成功");
      return c.json(createSuccessResponse(config));
    } catch (error) {
      logger.error("获取配置失败:", error);
      const errorResponse = createErrorResponse(
        "CONFIG_READ_ERROR",
        error instanceof Error ? error.message : "获取配置失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 更新配置
   * PUT /api/config
   */
  async updateConfig(c: Context): Promise<Response> {
    const logger = this.getLogger(c);
    try {
      logger.debug("处理更新配置请求");
      const newConfig: AppConfig = await c.req.json();

      // 验证请求体
      if (!newConfig || typeof newConfig !== "object") {
        const errorResponse = createErrorResponse(
          "INVALID_REQUEST_BODY",
          "请求体必须是有效的配置对象"
        );
        return c.json(errorResponse, 400);
      }

      await this.configService.updateConfig(newConfig, "http-api");
      logger.info("配置更新成功");

      return c.json(createSuccessResponse(null, "配置更新成功"));
    } catch (error) {
      logger.error("配置更新失败:", error);
      const errorResponse = createErrorResponse(
        "CONFIG_UPDATE_ERROR",
        error instanceof Error ? error.message : "配置更新失败"
      );
      return c.json(errorResponse, 400);
    }
  }

  /**
   * 获取 MCP 端点
   * GET /api/config/mcp-endpoint
   */
  async getMcpEndpoint(c: Context): Promise<Response> {
    const logger = this.getLogger(c);
    try {
      logger.debug("处理获取 MCP 端点请求");
      const endpoint = this.configService.getMcpEndpoint();
      logger.debug("获取 MCP 端点成功");
      return c.json(createSuccessResponse({ endpoint }));
    } catch (error) {
      logger.error("获取 MCP 端点失败:", error);
      const errorResponse = createErrorResponse(
        "MCP_ENDPOINT_READ_ERROR",
        error instanceof Error ? error.message : "获取 MCP 端点失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取 MCP 端点列表
   * GET /api/config/mcp-endpoints
   */
  async getMcpEndpoints(c: Context): Promise<Response> {
    const logger = this.getLogger(c);
    try {
      logger.debug("处理获取 MCP 端点列表请求");
      const endpoints = this.configService.getMcpEndpoints();
      logger.debug("获取 MCP 端点列表成功");
      return c.json(createSuccessResponse({ endpoints }));
    } catch (error) {
      logger.error("获取 MCP 端点列表失败:", error);
      const errorResponse = createErrorResponse(
        "MCP_ENDPOINTS_READ_ERROR",
        error instanceof Error ? error.message : "获取 MCP 端点列表失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取 MCP 服务配置
   * GET /api/config/mcp-servers
   */
  async getMcpServers(c: Context): Promise<Response> {
    const logger = this.getLogger(c);
    try {
      logger.debug("处理获取 MCP 服务配置请求");
      const servers = this.configService.getMcpServers();
      logger.debug("获取 MCP 服务配置成功");
      return c.json(createSuccessResponse({ servers }));
    } catch (error) {
      logger.error("获取 MCP 服务配置失败:", error);
      const errorResponse = createErrorResponse(
        "MCP_SERVERS_READ_ERROR",
        error instanceof Error ? error.message : "获取 MCP 服务配置失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取连接配置
   * GET /api/config/connection
   */
  async getConnectionConfig(c: Context): Promise<Response> {
    const logger = this.getLogger(c);
    try {
      logger.debug("处理获取连接配置请求");
      const connection = this.configService.getConnectionConfig();
      logger.debug("获取连接配置成功");
      return c.json(createSuccessResponse({ connection }));
    } catch (error) {
      logger.error("获取连接配置失败:", error);
      const errorResponse = createErrorResponse(
        "CONNECTION_CONFIG_READ_ERROR",
        error instanceof Error ? error.message : "获取连接配置失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 重新加载配置
   * POST /api/config/reload
   */
  async reloadConfig(c: Context): Promise<Response> {
    const logger = this.getLogger(c);
    try {
      logger.info("处理重新加载配置请求");
      const config = await this.configService.reloadConfig();
      logger.info("重新加载配置成功");
      return c.json(createSuccessResponse(config, "配置重新加载成功"));
    } catch (error) {
      logger.error("重新加载配置失败:", error);
      const errorResponse = createErrorResponse(
        "CONFIG_RELOAD_ERROR",
        error instanceof Error ? error.message : "重新加载配置失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取配置文件路径
   * GET /api/config/path
   */
  async getConfigPath(c: Context): Promise<Response> {
    const logger = this.getLogger(c);
    try {
      logger.debug("处理获取配置文件路径请求");
      const path = this.configService.getConfigPath();
      logger.debug("获取配置文件路径成功");
      return c.json(createSuccessResponse({ path }));
    } catch (error) {
      logger.error("获取配置文件路径失败:", error);
      const errorResponse = createErrorResponse(
        "CONFIG_PATH_READ_ERROR",
        error instanceof Error ? error.message : "获取配置文件路径失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 检查配置是否存在
   * GET /api/config/exists
   */
  async checkConfigExists(c: Context): Promise<Response> {
    const logger = this.getLogger(c);
    try {
      logger.debug("处理检查配置是否存在请求");
      const exists = this.configService.configExists();
      logger.debug(`配置存在检查结果: ${exists}`);
      return c.json(createSuccessResponse({ exists }));
    } catch (error) {
      logger.error("检查配置是否存在失败:", error);
      const errorResponse = createErrorResponse(
        "CONFIG_EXISTS_CHECK_ERROR",
        error instanceof Error ? error.message : "检查配置是否存在失败"
      );
      return c.json(errorResponse, 500);
    }
  }
}
