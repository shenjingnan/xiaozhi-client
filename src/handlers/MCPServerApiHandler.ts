import type { Context } from "hono";
import { type Logger, logger } from "../Logger.js";
import type { ConfigManager } from "../configManager.js";
import type { MCPServerConfig } from "../configManager.js";
import { type EventBus, getEventBus } from "../services/EventBus.js";
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
  private eventBus: EventBus;

  constructor(
    mcpServiceManager: MCPServiceManager,
    configManager: ConfigManager
  ) {
    this.logger = logger.withTag("MCPServerApiHandler");
    this.mcpServiceManager = mcpServiceManager;
    this.configManager = configManager;
    this.eventBus = getEventBus();
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
    // 基础框架，在里程碑二中实现完整功能
    this.logger.info("添加 MCP 服务功能待实现");
    const errorResponse = this.createErrorResponse(
      MCPErrorCode.INTERNAL_ERROR,
      "添加 MCP 服务功能待实现"
    );
    return c.json(errorResponse, 501);
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
