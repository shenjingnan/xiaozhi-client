import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Context } from "hono";
import { type Logger, logger } from "../Logger.js";
import type { ConfigManager } from "../configManager.js";
import type { MCPServerConfig } from "../configManager.js";
import { getEventBus } from "../services/EventBus.js";
import type { MCPServiceManager } from "../services/MCPServiceManager.js";

/**
 * MCP 服务添加请求接口
 */
export interface MCPServerAddRequest {
  name: string;
  config: MCPServerConfig;
}

/**
 * MCP 服务状态接口
 */
export interface MCPServerStatus {
  name: string;
  status: "connected" | "disconnected" | "connecting" | "error";
  connected: boolean;
  tools: string[];
  lastUpdated?: string;
  config: MCPServerConfig;
}

/**
 * MCP 服务列表响应接口
 */
export interface MCPServerListResponse {
  servers: MCPServerStatus[];
  total: number;
}

/**
 * 统一响应格式接口
 */
export interface ApiErrorResponse {
  error: {
    code: MCPErrorCode;
    message: string;
    details?: {
      serverName?: string;
      config?: any;
      tools?: string[];
      timestamp: string;
    };
  };
}

export interface ApiSuccessResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * MCP 错误代码枚举
 */
export enum MCPErrorCode {
  // 配置错误
  SERVER_ALREADY_EXISTS = "SERVER_ALREADY_EXISTS",
  SERVER_NOT_FOUND = "SERVER_NOT_FOUND",
  INVALID_CONFIG = "INVALID_CONFIG",
  INVALID_SERVICE_NAME = "INVALID_SERVICE_NAME",

  // 连接错误
  CONNECTION_FAILED = "CONNECTION_FAILED",
  CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

  // 操作错误
  OPERATION_FAILED = "OPERATION_FAILED",
  REMOVE_FAILED = "REMOVE_FAILED",
  SYNC_FAILED = "SYNC_FAILED",

  // 系统错误
  INTERNAL_ERROR = "INTERNAL_ERROR",
  CONFIG_UPDATE_FAILED = "CONFIG_UPDATE_FAILED",
}

/**
 * 配置验证结果接口
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * MCP 服务 API 处理器
 */
export class MCPServerApiHandler {
  protected logger: Logger;
  private mcpServiceManager: MCPServiceManager;
  private configManager: ConfigManager;

  constructor(
    mcpServiceManager: MCPServiceManager,
    configManager: ConfigManager
  ) {
    this.logger = logger.withTag("MCPServerApiHandler");
    this.mcpServiceManager = mcpServiceManager;
    this.configManager = configManager;
  }

  /**
   * 创建统一的错误响应
   */
  protected createErrorResponse(
    code: MCPErrorCode,
    message: string,
    serverName?: string,
    details?: any
  ): ApiErrorResponse {
    return {
      error: {
        code,
        message,
        details: serverName ? { serverName, ...details } : details,
      },
    };
  }

  /**
   * 创建统一的成功响应
   */
  protected createSuccessResponse<T>(
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
   * 添加 MCP 服务
   * POST /api/mcp-servers
   */
  async addMCPServer(c: Context): Promise<Response> {
    try {
      // 1. 解析和验证请求数据
      const requestData = await c.req.json();
      const { name, config } = requestData;

      // 2. 验证服务名称
      const nameValidation = MCPServerConfigValidator.validateServiceName(name);
      if (!nameValidation.isValid) {
        const errorResponse = this.createErrorResponse(
          MCPErrorCode.INVALID_SERVICE_NAME,
          nameValidation.errors.join(", "),
          name
        );
        return c.json(errorResponse, 400);
      }

      // 3. 检查服务是否已存在
      if (
        MCPServerConfigValidator.checkServiceExists(name, this.configManager)
      ) {
        const errorResponse = this.createErrorResponse(
          MCPErrorCode.SERVER_ALREADY_EXISTS,
          "MCP 服务已存在",
          name
        );
        return c.json(errorResponse, 409);
      }

      // 4. 验证服务配置
      const configValidation = MCPServerConfigValidator.validateConfig(config);
      if (!configValidation.isValid) {
        const errorResponse = this.createErrorResponse(
          MCPErrorCode.INVALID_CONFIG,
          configValidation.errors.join(", "),
          name,
          { config }
        );
        return c.json(errorResponse, 400);
      }

      // 5. 添加服务到配置管理器
      this.configManager.updateMcpServer(name, config);

      // 6. 添加服务到 MCPServiceManager 并启动服务
      this.mcpServiceManager.addServiceConfig(name, config);
      await this.mcpServiceManager.startService(name);

      // 7. 获取服务状态和工具列表
      const serviceStatus = this.getServiceStatus(name);
      const tools = this.getServiceTools(name);

      // 8. 发送事件通知
      getEventBus().emitEvent("mcp:server:added", {
        serverName: name,
        config,
        tools: tools.map((tool) => tool.name),
        timestamp: new Date(),
      });

      // 9. 返回成功响应
      const successResponse = this.createSuccessResponse(
        {
          name,
          status: serviceStatus.status,
          connected: serviceStatus.connected,
          tools: tools.map((tool) => tool.name),
          config,
        },
        "MCP 服务添加成功"
      );
      return c.json(successResponse, 201);
    } catch (error) {
      this.logger.error("添加 MCP 服务失败:", error);

      // 处理不同类型的错误
      if (error instanceof Error) {
        if (error.message.includes("服务配置验证失败")) {
          const errorResponse = this.createErrorResponse(
            MCPErrorCode.INVALID_CONFIG,
            error.message
          );
          return c.json(errorResponse, 400);
        }

        if (error.message.includes("启动") || error.message.includes("连接")) {
          const errorResponse = this.createErrorResponse(
            MCPErrorCode.CONNECTION_FAILED,
            `服务连接失败: ${error.message}`
          );
          return c.json(errorResponse, 500);
        }
      }

      // 其他未知错误
      const errorResponse = this.createErrorResponse(
        MCPErrorCode.INTERNAL_ERROR,
        "添加 MCP 服务时发生内部错误",
        undefined,
        { error: error instanceof Error ? error.message : String(error) }
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取服务状态信息
   */
  private getServiceStatus(serverName: string): MCPServerStatus {
    const config = this.configManager.getConfig();
    const serverConfig = config.mcpServers[serverName];

    if (!serverConfig) {
      return {
        name: serverName,
        status: "disconnected",
        connected: false,
        tools: [],
        config: {} as MCPServerConfig,
      };
    }

    // 尝试从 MCPServiceManager 获取实际状态
    try {
      const services = (this.mcpServiceManager as any).services;
      const service = services.get(serverName);

      if (service?.isConnected?.()) {
        return {
          name: serverName,
          status: "connected",
          connected: true,
          tools: service.getTools().map((tool: Tool) => tool.name),
          lastUpdated: new Date().toISOString(),
          config: serverConfig,
        };
      }
    } catch (error) {
      this.logger.debug(`获取服务 ${serverName} 状态时出错:`, error);
    }

    return {
      name: serverName,
      status: "disconnected",
      connected: false,
      tools: [],
      config: serverConfig,
    };
  }

  /**
   * 获取服务工具列表
   */
  private getServiceTools(serverName: string): Tool[] {
    try {
      const services = (this.mcpServiceManager as any).services;
      const service = services.get(serverName);

      if (service?.getTools) {
        return service.getTools();
      }
    } catch (error) {
      this.logger.debug(`获取服务 ${serverName} 工具列表时出错:`, error);
    }

    return [];
  }

  /**
   * 移除 MCP 服务
   * DELETE /api/mcp-servers/:serverName
   */
  async removeMCPServer(c: Context): Promise<Response> {
    // 基础框架，在里程碑三中实现完整功能
    this.logger.info("移除 MCP 服务功能待实现");
    const errorResponse = this.createErrorResponse(
      MCPErrorCode.INTERNAL_ERROR,
      "移除 MCP 服务功能待实现"
    );
    return c.json(errorResponse, 501);
  }

  /**
   * 获取 MCP 服务状态
   * GET /api/mcp-servers/:serverName/status
   */
  async getMCPServerStatus(c: Context): Promise<Response> {
    // 基础框架，在里程碑四中实现完整功能
    this.logger.info("获取 MCP 服务状态功能待实现");
    const errorResponse = this.createErrorResponse(
      MCPErrorCode.INTERNAL_ERROR,
      "获取 MCP 服务状态功能待实现"
    );
    return c.json(errorResponse, 501);
  }

  /**
   * 列出所有 MCP 服务
   * GET /api/mcp-servers
   */
  async listMCPServers(c: Context): Promise<Response> {
    // 基础框架，在里程碑四中实现完整功能
    this.logger.info("列出 MCP 服务功能待实现");
    const errorResponse = this.createErrorResponse(
      MCPErrorCode.INTERNAL_ERROR,
      "列出 MCP 服务功能待实现"
    );
    return c.json(errorResponse, 501);
  }
}

/**
 * MCP 服务配置验证工具类
 */
export class MCPServerConfigValidator {
  /**
   * 验证服务配置
   */
  static validateConfig(config: MCPServerConfig): ValidationResult {
    const errors: string[] = [];

    // 验证配置基本结构
    if (!config || typeof config !== "object") {
      errors.push("配置必须是一个对象");
      return { isValid: false, errors };
    }

    // 根据类型验证配置
    if ("command" in config) {
      // LocalMCPServerConfig
      if (!config.command || typeof config.command !== "string") {
        errors.push("本地服务必须提供有效的命令");
      }
      if (config.args && !Array.isArray(config.args)) {
        errors.push("参数必须是数组");
      }
      if (config.env && typeof config.env !== "object") {
        errors.push("环境变量必须是对象");
      }
    } else if ("url" in config) {
      // SSEMCPServerConfig 或 StreamableHTTPMCPServerConfig
      if (!config.url || typeof config.url !== "string") {
        errors.push("远程服务必须提供有效的 URL");
      }
      try {
        new URL(config.url);
      } catch {
        errors.push("URL 格式无效");
      }
    } else {
      errors.push("配置必须包含 command 或 url 字段");
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * 验证服务名称
   */
  static validateServiceName(name: string): ValidationResult {
    const errors: string[] = [];

    if (!name || typeof name !== "string") {
      errors.push("服务名称必须是非空字符串");
      return { isValid: false, errors };
    }

    if (name.length < 1 || name.length > 50) {
      errors.push("服务名称长度必须在 1-50 个字符之间");
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      errors.push("服务名称只能包含字母、数字、下划线和连字符");
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * 检查服务是否已存在
   */
  static checkServiceExists(
    name: string,
    configManager: ConfigManager
  ): boolean {
    const config = configManager.getConfig();
    return config.mcpServers && name in config.mcpServers;
  }
}
