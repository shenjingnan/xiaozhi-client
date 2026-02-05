import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import type { MCPServiceManager } from "@/lib/mcp";
import type { AppContext } from "@/types/hono.context.js";
import type { ConfigManager } from "@xiaozhi-client/config";
import type { Context } from "hono";

import { MCPServerAddHandler } from "./mcp-server-add.handler.js";
import { MCPServerRemoveHandler } from "./mcp-server-remove.handler.js";
import { MCPServerStatusHandler } from "./mcp-server-status.handler.js";

/**
 * MCP 服务添加请求接口（单服务格式）
 */
export type { MCPServerAddRequest } from "./mcp-server-add.handler.js";

/**
 * MCP 服务批量添加请求接口（mcpServers 格式）
 */
export type { MCPServerBatchAddRequest } from "./mcp-server-add.handler.js";

/**
 * MCP 服务添加操作结果
 */
export type { MCPServerAddResult } from "./mcp-server-add.handler.js";

/**
 * MCP 服务批量添加响应
 */
export type { MCPServerBatchAddResponse } from "./mcp-server-add.handler.js";

/**
 * MCP 服务状态接口
 */
export type { MCPServerStatus } from "./mcp-server.handler.js";

/**
 * MCP 服务列表响应接口
 */
export type { MCPServerListResponse } from "./mcp-server-status.handler.js";

/**
 * 统一响应格式接口
 * 从 @middlewares/index.js 导入，保持类型一致性
 */
export type {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "@/middlewares/index.js";

/**
 * 配置验证结果接口
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * MCP 服务 API 处理器
 * 提供统一的 MCP 服务器管理接口，向后兼容旧的 MCPHandler 类
 */
export class MCPHandler {
  protected logger: Logger;
  private addHandler: MCPServerAddHandler;
  private removeHandler: MCPServerRemoveHandler;
  private statusHandler: MCPServerStatusHandler;

  constructor(
    mcpServiceManager: MCPServiceManager,
    configManager: ConfigManager
  ) {
    this.logger = logger;
    this.addHandler = new MCPServerAddHandler(mcpServiceManager, configManager);
    this.removeHandler = new MCPServerRemoveHandler(
      mcpServiceManager,
      configManager
    );
    this.statusHandler = new MCPServerStatusHandler(
      mcpServiceManager,
      configManager
    );
  }

  /**
   * 处理错误并返回MCPError
   * 向后兼容方法，委托给 addHandler 的 handleError 方法
   */
  protected handleError(
    error: unknown,
    operation: string,
    context?: Record<string, unknown>
  ): Error {
    // 使用 addHandler 的 handleError 方法
    return (this.addHandler as any).handleError(error, operation, context);
  }

  /**
   * 添加 MCP 服务
   * POST /api/mcp-servers
   * 支持两种格式：
   * 1. 单服务格式：{ name: string, config: MCPServerConfig }
   * 2. 批量格式：{ mcpServers: Record<string, MCPServerConfig> }
   */
  async addMCPServer(c: Context<AppContext>): Promise<Response> {
    return this.addHandler.handle(c);
  }

  /**
   * 移除 MCP 服务
   * DELETE /api/mcp-servers/:serverName
   */
  async removeMCPServer(c: Context<AppContext>): Promise<Response> {
    return this.removeHandler.handle(c);
  }

  /**
   * 获取 MCP 服务状态
   * GET /api/mcp-servers/:serverName/status
   */
  async getMCPServerStatus(c: Context<AppContext>): Promise<Response> {
    return this.statusHandler.handleStatus(c);
  }

  /**
   * 列出所有 MCP 服务
   * GET /api/mcp-servers
   */
  async listMCPServers(c: Context<AppContext>): Promise<Response> {
    return this.statusHandler.handleList(c);
  }
}

/**
 * 重新导出 MCPServerConfigValidator 以保持向后兼容
 */
export { MCPServerConfigValidator } from "./validators/mcp-server-config.validator.js";
