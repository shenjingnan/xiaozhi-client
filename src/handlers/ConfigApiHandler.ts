import type { Context } from "hono";
import type { Logger } from "../Logger.js";
import { logger } from "../Logger.js";
import type { AppConfig } from "../configManager.js";
import { ConfigService } from "../services/ConfigService.js";

/**
 * 统一响应格式接口
 */
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

interface ApiSuccessResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * 配置 API 处理器
 */
export class ConfigApiHandler {
  private logger: Logger;
  private configService: ConfigService;

  constructor() {
    this.logger = logger.withTag("ConfigApiHandler");
    this.configService = new ConfigService();
  }

  /**
   * 创建统一的错误响应
   */
  private createErrorResponse(
    code: string,
    message: string,
    details?: any
  ): ApiErrorResponse {
    return {
      error: {
        code,
        message,
        details,
      },
    };
  }

  /**
   * 创建统一的成功响应
   */
  private createSuccessResponse<T>(
    data?: T,
    message?: string
  ): ApiSuccessResponse<T> {
    return {
      success: true,
      data,
      message,
    };
  }

  /**
   * 获取配置
   * GET /api/config
   */
  async getConfig(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理获取配置请求");
      const config = await this.configService.getConfig();
      this.logger.info("获取配置成功");
      return c.json(this.createSuccessResponse(config));
    } catch (error) {
      this.logger.error("获取配置失败:", error);
      const errorResponse = this.createErrorResponse(
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
    try {
      this.logger.debug("处理更新配置请求");
      const newConfig: AppConfig = await c.req.json();

      // 验证请求体
      if (!newConfig || typeof newConfig !== "object") {
        const errorResponse = this.createErrorResponse(
          "INVALID_REQUEST_BODY",
          "请求体必须是有效的配置对象"
        );
        return c.json(errorResponse, 400);
      }

      await this.configService.updateConfig(newConfig, "http-api");
      this.logger.info("配置更新成功");

      return c.json(this.createSuccessResponse(null, "配置更新成功"));
    } catch (error) {
      this.logger.error("配置更新失败:", error);
      const errorResponse = this.createErrorResponse(
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
    try {
      this.logger.debug("处理获取 MCP 端点请求");
      const endpoint = this.configService.getMcpEndpoint();
      this.logger.debug("获取 MCP 端点成功");
      return c.json(this.createSuccessResponse({ endpoint }));
    } catch (error) {
      this.logger.error("获取 MCP 端点失败:", error);
      const errorResponse = this.createErrorResponse(
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
    try {
      this.logger.debug("处理获取 MCP 端点列表请求");
      const endpoints = this.configService.getMcpEndpoints();
      this.logger.debug("获取 MCP 端点列表成功");
      return c.json(this.createSuccessResponse({ endpoints }));
    } catch (error) {
      this.logger.error("获取 MCP 端点列表失败:", error);
      const errorResponse = this.createErrorResponse(
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
    try {
      this.logger.debug("处理获取 MCP 服务配置请求");
      const servers = this.configService.getMcpServers();
      this.logger.debug("获取 MCP 服务配置成功");
      return c.json(this.createSuccessResponse({ servers }));
    } catch (error) {
      this.logger.error("获取 MCP 服务配置失败:", error);
      const errorResponse = this.createErrorResponse(
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
    try {
      this.logger.debug("处理获取连接配置请求");
      const connection = this.configService.getConnectionConfig();
      this.logger.debug("获取连接配置成功");
      return c.json(this.createSuccessResponse({ connection }));
    } catch (error) {
      this.logger.error("获取连接配置失败:", error);
      const errorResponse = this.createErrorResponse(
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
    try {
      this.logger.info("处理重新加载配置请求");
      const config = await this.configService.reloadConfig();
      this.logger.info("重新加载配置成功");
      return c.json(this.createSuccessResponse(config, "配置重新加载成功"));
    } catch (error) {
      this.logger.error("重新加载配置失败:", error);
      const errorResponse = this.createErrorResponse(
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
    try {
      this.logger.debug("处理获取配置文件路径请求");
      const path = this.configService.getConfigPath();
      this.logger.debug("获取配置文件路径成功");
      return c.json(this.createSuccessResponse({ path }));
    } catch (error) {
      this.logger.error("获取配置文件路径失败:", error);
      const errorResponse = this.createErrorResponse(
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
    try {
      this.logger.debug("处理检查配置是否存在请求");
      const exists = this.configService.configExists();
      this.logger.debug(`配置存在检查结果: ${exists}`);
      return c.json(this.createSuccessResponse({ exists }));
    } catch (error) {
      this.logger.error("检查配置是否存在失败:", error);
      const errorResponse = this.createErrorResponse(
        "CONFIG_EXISTS_CHECK_ERROR",
        error instanceof Error ? error.message : "检查配置是否存在失败"
      );
      return c.json(errorResponse, 500);
    }
  }
}
