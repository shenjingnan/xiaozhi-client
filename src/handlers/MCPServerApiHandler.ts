#!/usr/bin/env node

/**
 * MCP 服务 API 处理器
 * 处理动态 MCP 服务的添加、移除、测试和管理
 */

import type { Context } from "hono";
import { type Logger, logger } from "../Logger.js";
import { configManager } from "../configManager.js";
import type { MCPServerConfig } from "../configManager.js";
import { getEventBus } from "../services/EventBus.js";
import type { MCPServiceConfig } from "../services/MCPService.js";
import { MCPTransportType } from "../services/MCPService.js";
import { MCPServiceManagerSingleton } from "../services/MCPServiceManagerSingleton.js";
import { ToolSyncManager } from "../services/ToolSyncManager.js";

/**
 * 服务添加请求
 */
export interface AddMCPServerRequest {
  serviceName: string;
  config: MCPServerConfig;
  autoStart?: boolean;
  syncTools?: boolean;
}

/**
 * 服务移除请求
 */
export interface RemoveMCPServerRequest {
  serviceName: string;
  graceful?: boolean;
  cleanupConfig?: boolean;
}

/**
 * 连接测试结果
 */
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  responseTime?: number;
  error?: string;
}

/**
 * 服务状态响应
 */
export interface MCPServerStatus {
  serviceName: string;
  status: "running" | "stopped" | "error" | "connecting" | "unknown";
  uptime?: number;
  lastError?: string;
  toolsCount?: number;
  memoryUsage?: number;
  lastConnected?: string;
}

/**
 * MCP 服务 API 处理器
 */
export class MCPServerApiHandler {
  private logger: Logger;
  private toolSyncManager: ToolSyncManager;
  private eventBus = getEventBus();

  constructor() {
    this.logger = logger.withTag("MCPServerApiHandler");
    this.toolSyncManager = new ToolSyncManager(configManager, this.logger);
  }

  /**
   * 将 MCPServerConfig 转换为 MCPServiceConfig
   */
  private convertToServiceConfig(
    serverConfig: MCPServerConfig,
    serviceName: string
  ): MCPServiceConfig {
    const baseConfig = {
      name: serviceName,
    };

    // 检查是否为 SSE 类型
    if ("type" in serverConfig && serverConfig.type === "sse") {
      return {
        ...baseConfig,
        type: MCPTransportType.SSE,
        url: serverConfig.url,
      };
    }

    // 检查是否为 streamable-http 类型
    if (
      "type" in serverConfig &&
      (serverConfig.type === "streamable-http" ||
        serverConfig.type === undefined)
    ) {
      return {
        ...baseConfig,
        type: MCPTransportType.STREAMABLE_HTTP,
        url: serverConfig.url,
      };
    }

    // 默认为 stdio 类型
    if ("command" in serverConfig) {
      return {
        ...baseConfig,
        type: MCPTransportType.STDIO,
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
      };
    }

    // 理论上不应该到达这里
    throw new Error(`无法识别的服务配置类型: ${JSON.stringify(serverConfig)}`);
  }

  /**
   * 创建统一的错误响应
   */
  private createErrorResponse(code: string, message: string, details?: any) {
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
  private createSuccessResponse<T>(data?: T, message?: string) {
    return {
      success: true,
      data,
      message,
    };
  }

  /**
   * 添加 MCP 服务
   * POST /api/mcp-servers/add
   */
  async addMCPServer(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理添加 MCP 服务请求");
      const request: AddMCPServerRequest = await c.req.json();

      // 验证请求体
      if (!request || typeof request !== "object") {
        const errorResponse = this.createErrorResponse(
          "INVALID_REQUEST_BODY",
          "请求体必须是有效的对象"
        );
        return c.json(errorResponse, 400);
      }

      const {
        serviceName,
        config,
        autoStart = true,
        syncTools = true,
      } = request;

      // 验证必要参数
      if (!serviceName || typeof serviceName !== "string") {
        const errorResponse = this.createErrorResponse(
          "INVALID_SERVICE_NAME",
          "服务名称必须是有效的字符串"
        );
        return c.json(errorResponse, 400);
      }

      if (!config || typeof config !== "object") {
        const errorResponse = this.createErrorResponse(
          "INVALID_SERVICE_CONFIG",
          "服务配置必须是有效的对象"
        );
        return c.json(errorResponse, 400);
      }

      // 检查服务是否已存在
      const serviceManager = await MCPServiceManagerSingleton.getInstance();
      const existingConfig = serviceManager.getServiceConfig(serviceName);
      if (existingConfig) {
        const errorResponse = this.createErrorResponse(
          "SERVICE_ALREADY_EXISTS",
          `服务 ${serviceName} 已存在`
        );
        return c.json(errorResponse, 409);
      }

      // 将 MCPServerConfig 转换为 MCPServiceConfig
      const serviceConfig = this.convertToServiceConfig(config, serviceName);

      // 添加服务配置
      serviceManager.addServiceConfig(serviceName, serviceConfig);

      // 如果需要自动启动
      if (autoStart) {
        try {
          await serviceManager.addAndStartService(serviceName, serviceConfig);

          // 如果需要同步工具
          if (syncTools) {
            await this.toolSyncManager.syncToolsAfterServiceAdded(serviceName);
          }
        } catch (error) {
          // 启动失败，移除已添加的配置
          serviceManager.removeServiceConfig(serviceName);
          throw error;
        }
      }

      this.logger.info(`MCP 服务 ${serviceName} 添加成功`);
      return c.json(
        this.createSuccessResponse(
          {
            serviceName,
            autoStarted: autoStart,
            toolsSynced: syncTools && autoStart,
          },
          `服务 ${serviceName} 添加成功`
        )
      );
    } catch (error) {
      this.logger.error("添加 MCP 服务失败:", error);
      const errorResponse = this.createErrorResponse(
        "ADD_SERVICE_ERROR",
        error instanceof Error ? error.message : "添加服务失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 移除 MCP 服务
   * POST /api/mcp-servers/remove
   */
  async removeMCPServer(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理移除 MCP 服务请求");
      const request: RemoveMCPServerRequest = await c.req.json();

      // 验证请求体
      if (!request || typeof request !== "object") {
        const errorResponse = this.createErrorResponse(
          "INVALID_REQUEST_BODY",
          "请求体必须是有效的对象"
        );
        return c.json(errorResponse, 400);
      }

      const { serviceName, graceful = true, cleanupConfig = true } = request;

      // 验证必要参数
      if (!serviceName || typeof serviceName !== "string") {
        const errorResponse = this.createErrorResponse(
          "INVALID_SERVICE_NAME",
          "服务名称必须是有效的字符串"
        );
        return c.json(errorResponse, 400);
      }

      const serviceManager = await MCPServiceManagerSingleton.getInstance();

      // 检查服务是否存在
      const existingConfig = serviceManager.getServiceConfig(serviceName);
      if (!existingConfig) {
        const errorResponse = this.createErrorResponse(
          "SERVICE_NOT_FOUND",
          `服务 ${serviceName} 不存在`
        );
        return c.json(errorResponse, 404);
      }

      // 移除服务
      await serviceManager.removeService(serviceName, graceful, cleanupConfig);

      this.logger.info(`MCP 服务 ${serviceName} 移除成功`);
      return c.json(
        this.createSuccessResponse(
          {
            serviceName,
            gracefulShutdown: graceful,
            configCleaned: cleanupConfig,
          },
          `服务 ${serviceName} 移除成功`
        )
      );
    } catch (error) {
      this.logger.error("移除 MCP 服务失败:", error);
      const errorResponse = this.createErrorResponse(
        "REMOVE_SERVICE_ERROR",
        error instanceof Error ? error.message : "移除服务失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 测试服务连接
   * POST /api/mcp-servers/test-connection
   */
  async testConnection(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理测试服务连接请求");
      const config: MCPServerConfig = await c.req.json();

      // 验证请求体
      if (!config || typeof config !== "object") {
        const errorResponse = this.createErrorResponse(
          "INVALID_REQUEST_BODY",
          "请求体必须是有效的服务配置对象"
        );
        return c.json(errorResponse, 400);
      }

      // 将 MCPServerConfig 转换为 MCPServiceConfig（测试连接使用临时名称）
      const serviceConfig = this.convertToServiceConfig(
        config,
        "test-connection"
      );

      const serviceManager = await MCPServiceManagerSingleton.getInstance();
      const result: ConnectionTestResult =
        await serviceManager.testServiceConnection(serviceConfig);

      this.logger.debug(
        `服务连接测试结果: ${result.success ? "成功" : "失败"}`
      );
      return c.json(this.createSuccessResponse(result));
    } catch (error) {
      this.logger.error("测试服务连接失败:", error);
      const errorResponse = this.createErrorResponse(
        "TEST_CONNECTION_ERROR",
        error instanceof Error ? error.message : "测试连接失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取服务状态
   * GET /api/mcp-servers/:serviceName/status
   */
  async getServiceStatus(c: Context): Promise<Response> {
    try {
      const serviceName = c.req.param("serviceName");

      if (!serviceName) {
        const errorResponse = this.createErrorResponse(
          "MISSING_SERVICE_NAME",
          "缺少服务名称参数"
        );
        return c.json(errorResponse, 400);
      }

      const serviceManager = await MCPServiceManagerSingleton.getInstance();
      const status: MCPServerStatus =
        await serviceManager.getServiceStatus(serviceName);

      return c.json(this.createSuccessResponse(status));
    } catch (error) {
      this.logger.error("获取服务状态失败:", error);
      const errorResponse = this.createErrorResponse(
        "GET_SERVICE_STATUS_ERROR",
        error instanceof Error ? error.message : "获取服务状态失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取服务工具列表
   * GET /api/mcp-servers/:serviceName/tools
   */
  async getServiceTools(c: Context): Promise<Response> {
    try {
      const serviceName = c.req.param("serviceName");

      if (!serviceName) {
        const errorResponse = this.createErrorResponse(
          "MISSING_SERVICE_NAME",
          "缺少服务名称参数"
        );
        return c.json(errorResponse, 400);
      }

      const serviceManager = await MCPServiceManagerSingleton.getInstance();
      const tools = await serviceManager.getServiceTools(serviceName);

      return c.json(
        this.createSuccessResponse({
          serviceName,
          tools,
          count: tools.length,
        })
      );
    } catch (error) {
      this.logger.error("获取服务工具列表失败:", error);
      const errorResponse = this.createErrorResponse(
        "GET_SERVICE_TOOLS_ERROR",
        error instanceof Error ? error.message : "获取服务工具列表失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 更新服务配置
   * PUT /api/mcp-servers/:serviceName/config
   */
  async updateServiceConfig(c: Context): Promise<Response> {
    try {
      const serviceName = c.req.param("serviceName");
      const newConfig: MCPServerConfig = await c.req.json();

      if (!serviceName) {
        const errorResponse = this.createErrorResponse(
          "MISSING_SERVICE_NAME",
          "缺少服务名称参数"
        );
        return c.json(errorResponse, 400);
      }

      if (!newConfig || typeof newConfig !== "object") {
        const errorResponse = this.createErrorResponse(
          "INVALID_REQUEST_BODY",
          "请求体必须是有效的服务配置对象"
        );
        return c.json(errorResponse, 400);
      }

      // 将 MCPServerConfig 转换为 MCPServiceConfig
      const serviceConfig = this.convertToServiceConfig(newConfig, serviceName);

      const serviceManager = await MCPServiceManagerSingleton.getInstance();
      await serviceManager.updateServiceConfig(serviceName, serviceConfig);

      this.logger.info(`服务 ${serviceName} 配置更新成功`);
      return c.json(
        this.createSuccessResponse(
          { serviceName },
          `服务 ${serviceName} 配置更新成功`
        )
      );
    } catch (error) {
      this.logger.error("更新服务配置失败:", error);
      const errorResponse = this.createErrorResponse(
        "UPDATE_SERVICE_CONFIG_ERROR",
        error instanceof Error ? error.message : "更新服务配置失败"
      );
      return c.json(errorResponse, 500);
    }
  }
}
