/**
 * MCP 服务管理 API 处理器
 *
 * 负责处理 MCP 服务的动态管理操作，包括：
 * - 服务的添加和删除（若需更新服务配置，请先删除后重新添加）
 * - 服务的停止和资源清理
 * - 服务状态查询
 * - 服务工具信息查询
 * - 配置验证和持久化
 *
 * 该处理器通过 MCPServiceManager 管理多个 MCP 服务实例，
 * 并通过 EventBus 发布（发射）服务状态变化事件。
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { ErrorCategory, MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { MCPServiceManager } from "@/lib/mcp/index.js";
import type { MCPService } from "@/lib/mcp/index.js";
import { getEventBus } from "@/services/event-bus.service.js";
import type { AppContext } from "@/types/hono.context.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ConfigManager, MCPServerConfig } from "@xiaozhi-client/config";
import { normalizeServiceConfig } from "@xiaozhi-client/config";
import { TypeFieldNormalizer } from "@xiaozhi-client/mcp-core";
import type { Context } from "hono";

/**
 * MCPServiceManager 扩展接口，用于访问私有属性
 * 这个接口定义了我们需要访问但实际上是私有的属性
 */
interface MCPServiceManagerAccess {
  services: Map<string, MCPService>;
}

/**
 * 配置详情接口，包含时间戳
 */
interface ConfigDetails {
  serverName?: string;
  config?: MCPServerConfig;
  tools?: string[];
  timestamp?: string;
  [key: string]: unknown; // 允许额外的属性
}

/**
 * MCP 服务添加请求接口（单服务格式）
 */
export interface MCPServerAddRequest {
  name: string;
  config: MCPServerConfig;
}

/**
 * MCP 服务批量添加请求接口（mcpServers 格式）
 */
export interface MCPServerBatchAddRequest {
  mcpServers: Record<string, MCPServerConfig>;
}

/**
 * MCP 服务添加操作结果
 */
export interface MCPServerAddResult {
  name: string;
  success: boolean;
  error?: string;
  config?: MCPServerConfig;
  tools?: string[];
  status?: string;
}

/**
 * MCP 服务批量添加响应
 */
export interface MCPServerBatchAddResponse {
  success: boolean;
  message: string;
  results: MCPServerAddResult[];
  addedCount: number;
  failedCount: number;
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
 */
export class MCPHandler {
  protected logger: Logger;
  private mcpServiceManager: MCPServiceManager;
  private configManager: ConfigManager;
  private statusCache: Map<string, MCPServerStatus>;

  constructor(
    mcpServiceManager: MCPServiceManager,
    configManager: ConfigManager
  ) {
    this.logger = logger;
    this.mcpServiceManager = mcpServiceManager;
    this.configManager = configManager;
    this.statusCache = new Map();
  }

  /**
   * 处理错误并返回MCPError
   */
  protected handleError(
    error: unknown,
    operation: string,
    context?: Record<string, unknown>
  ): MCPError {
    if (error instanceof MCPError) {
      this.logger.error("MCPError", { error, operation, context });
      return error;
    }

    if (error instanceof Error) {
      let mcpError: MCPError;

      // 根据错误消息和操作类型确定错误类型
      if (
        error.message.includes("服务不存在") ||
        error.message.includes("not found")
      ) {
        mcpError = MCPError.configError(
          MCPErrorCode.SERVER_NOT_FOUND,
          error.message,
          { operation, context }
        );
      } else if (
        error.message.includes("已存在") ||
        error.message.includes("already exists")
      ) {
        mcpError = MCPError.configError(
          MCPErrorCode.SERVER_ALREADY_EXISTS,
          error.message,
          { operation, context }
        );
      } else if (
        error.message.includes("配置") ||
        error.message.includes("config")
      ) {
        mcpError = MCPError.configError(
          MCPErrorCode.INVALID_CONFIG,
          error.message,
          { operation, context }
        );
      } else if (
        error.message.includes("连接") ||
        error.message.includes("connection")
      ) {
        mcpError = MCPError.connectionError(
          MCPErrorCode.CONNECTION_FAILED,
          error.message,
          { operation, context }
        );
      } else {
        mcpError = MCPError.systemError(
          MCPErrorCode.INTERNAL_ERROR,
          error.message,
          { operation, context, stack: error.stack }
        );
      }

      this.logger.error("MCPError", { error: mcpError, operation, context });
      return mcpError;
    }

    // 处理未知错误类型
    const mcpError = MCPError.systemError(
      MCPErrorCode.INTERNAL_ERROR,
      String(error),
      { operation, context }
    );
    this.logger.error("MCPError", { error: mcpError, operation, context });
    return mcpError;
  }

  /**
   * 添加 MCP 服务
   * POST /api/mcp-servers
   * 支持两种格式：
   * 1. 单服务格式：{ name: string, config: MCPServerConfig }
   * 2. 批量格式：{ mcpServers: Record<string, MCPServerConfig> }
   */
  async addMCPServer(c: Context<AppContext>): Promise<Response> {
    const startTime = Date.now();
    const requestData = await c.req.json();

    this.logger.info("addMCPServer", {
      requestData,
      method: "POST",
      path: "/api/mcp-servers",
    });

    try {
      // 检测请求格式
      if ("mcpServers" in requestData) {
        // 批量格式
        const batchRequest = requestData as MCPServerBatchAddRequest;
        const result = await this.addMCPServersBatch(batchRequest);

        const duration = Date.now() - startTime;
        this.logger.info("addMCPServer", {
          batch: true,
          addedCount: result.addedCount,
          failedCount: result.failedCount,
          duration,
        });

        return c.success(result, result.message, 201);
      }
      // 单服务格式
      const singleRequest = requestData as MCPServerAddRequest;
      const { name, config } = singleRequest;

      const result = await this.addMCPServerSingle(name, config);

      const duration = Date.now() - startTime;
      this.logger.info("addMCPServer", {
        serverName: name,
        toolsCount: result.tools?.length || 0,
        duration,
        status: result.status,
      });

      return c.success(result, "MCP 服务添加成功", 201);
    } catch (error) {
      const mcpError = this.handleError(error, "addMCPServer", {
        requestData,
      });

      // 根据错误类型确定HTTP状态码
      let statusCode = 500;
      if (mcpError.category === ErrorCategory.VALIDATION) {
        statusCode = 400;
      } else if (mcpError.category === ErrorCategory.CONFIGURATION) {
        if (mcpError.code === MCPErrorCode.SERVER_ALREADY_EXISTS) {
          statusCode = 409;
        } else {
          statusCode = 400;
        }
      } else if (mcpError.category === ErrorCategory.CONNECTION) {
        statusCode = 500; // 测试期望连接失败返回500而不是503
      }

      return c.fail(
        mcpError.code,
        mcpError.message,
        { error: mcpError.details },
        statusCode
      );
    }
  }

  /**
   * 处理单个 MCP 服务添加
   */
  private async addMCPServerSingle(
    name: string,
    config: MCPServerConfig
  ): Promise<MCPServerStatus> {
    this.logger.info("addMCPServerSingle", {
      serverName: name,
    });

    // 标准化type字段格式（在try块外声明，确保catch块中可以访问）
    const normalizedConfig = TypeFieldNormalizer.normalizeTypeField(
      config
    ) as MCPServerConfig;

    try {
      // 1. 验证服务名称
      const nameValidation = MCPServerConfigValidator.validateServiceName(name);
      if (!nameValidation.isValid) {
        const validationError = MCPError.validationError(
          MCPErrorCode.INVALID_SERVICE_NAME,
          nameValidation.errors.join(", "),
          { serverName: name, errors: nameValidation.errors }
        );
        this.logger.error("addMCPServerSingle", {
          validationError,
          serverName: name,
          phase: "name_validation",
        });
        throw validationError;
      }

      // 2. 检查服务是否已存在
      if (
        MCPServerConfigValidator.checkServiceExists(name, this.configManager)
      ) {
        const existsError = MCPError.configError(
          MCPErrorCode.SERVER_ALREADY_EXISTS,
          "MCP 服务已存在",
          { serverName: name }
        );
        this.logger.error("addMCPServerSingle", {
          existsError,
          serverName: name,
          phase: "existence_check",
        });
        throw existsError;
      }

      // 3. 验证服务配置
      const configValidation =
        MCPServerConfigValidator.validateConfig(normalizedConfig);
      if (!configValidation.isValid) {
        const configError = MCPError.configError(
          MCPErrorCode.INVALID_CONFIG,
          configValidation.errors.join(", "),
          {
            serverName: name,
            config: normalizedConfig,
            errors: configValidation.errors,
          }
        );
        this.logger.error("addMCPServerSingle", {
          configError,
          serverName: name,
          phase: "config_validation",
        });
        throw configError;
      }

      // 5. 添加服务到配置管理器
      this.configManager.updateMcpServer(name, normalizedConfig);
      this.logger.debug("服务配置已添加到配置管理器", { serverName: name });

      // 6. 添加服务到 MCPServiceManager 并启动服务
      const mcpServiceConfig = normalizeServiceConfig(normalizedConfig);
      // 使用两参数形式传递 name 和 config
      this.mcpServiceManager.addServiceConfig(name, mcpServiceConfig);
      await this.mcpServiceManager.startService(name);
      this.logger.debug("服务已启动", { serverName: name });

      // 6. 获取服务状态和工具列表
      const serviceStatus = this.getServiceStatus(name);
      const tools = this.getServiceTools(name);
      const toolNames = tools.map((tool) => tool.name);

      // 7. 发送事件通知
      getEventBus().emitEvent("mcp:server:added", {
        serverName: name,
        config: normalizedConfig,
        tools: toolNames,
        timestamp: new Date(),
      });

      return {
        ...serviceStatus,
        tools: toolNames,
      };
    } catch (error) {
      const mcpError = this.handleError(error, "addMCPServerSingle", {
        serverName: name,
        config: normalizedConfig,
      });
      this.logger.error("addMCPServerSingle", {
        mcpError,
        serverName: name,
      });
      throw mcpError;
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
      const managerAccess = this
        .mcpServiceManager as unknown as MCPServiceManagerAccess;
      const service = managerAccess.services.get(serverName);

      if (service?.isConnected?.()) {
        const currentTools = service.getTools().map((tool: Tool) => tool.name);
        const status = {
          name: serverName,
          status: "connected" as const,
          connected: true,
          tools: currentTools,
          lastUpdated: new Date().toISOString(),
          config: serverConfig,
        };

        // 检查状态变化并发出事件
        this.checkAndEmitStatusChange(serverName, status);
        return status;
      }
    } catch (error) {
      this.logger.debug(`获取服务 ${serverName} 状态时出错:`, error);
    }

    const status = {
      name: serverName,
      status: "disconnected" as const,
      connected: false,
      tools: [],
      config: serverConfig,
    };

    // 检查状态变化并发出事件
    this.checkAndEmitStatusChange(serverName, status);
    return status;
  }

  /**
   * 检查状态变化并发出事件
   */
  private checkAndEmitStatusChange(
    serverName: string,
    newStatus: MCPServerStatus
  ): void {
    // 获取之前的状态（简单的内存缓存）
    const previousStatus = this.getPreviousStatus(serverName);

    if (previousStatus && previousStatus.status !== newStatus.status) {
      this.logger.info(
        `服务 ${serverName} 状态变化: ${previousStatus.status} -> ${newStatus.status}`
      );

      // 发射状态变化事件
      getEventBus().emitEvent("mcp:server:status_changed", {
        serverName,
        oldStatus: previousStatus.status,
        newStatus: newStatus.status,
        timestamp: new Date(),
        reason:
          newStatus.status === "connected"
            ? "connection_established"
            : "connection_lost",
      });

      // 如果工具列表发生变化，发出工具更新事件
      if (previousStatus.tools !== newStatus.tools) {
        const addedTools = newStatus.tools.filter(
          (tool) => !previousStatus.tools.includes(tool)
        );
        const removedTools = previousStatus.tools.filter(
          (tool) => !newStatus.tools.includes(tool)
        );

        if (addedTools.length > 0 || removedTools.length > 0) {
          getEventBus().emitEvent("mcp:server:tools:updated", {
            serverName,
            tools: newStatus.tools,
            addedTools,
            removedTools,
            timestamp: new Date(),
          });
        }
      }
    }

    // 更新状态缓存
    this.updateStatusCache(serverName, newStatus);
  }

  /**
   * 获取之前的状态（简化实现）
   */
  private getPreviousStatus(serverName: string): MCPServerStatus | null {
    // 这里使用一个简单的Map来缓存状态
    // 在实际生产环境中，可能需要更持久化的缓存方案
    return this.statusCache.get(serverName) || null;
  }

  /**
   * 更新状态缓存
   */
  private updateStatusCache(serverName: string, status: MCPServerStatus): void {
    this.statusCache.set(serverName, status);
  }

  /**
   * 获取服务工具列表
   */
  private getServiceTools(serverName: string): Tool[] {
    try {
      const managerAccess = this
        .mcpServiceManager as unknown as MCPServiceManagerAccess;
      const service = managerAccess.services.get(serverName);

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
  async removeMCPServer(c: Context<AppContext>): Promise<Response> {
    try {
      // 1. 从路径参数获取服务名称
      const serverName = c.req.param("serverName");

      // 2. 验证服务名称
      const nameValidation =
        MCPServerConfigValidator.validateServiceName(serverName);
      if (!nameValidation.isValid) {
        return c.fail(
          MCPErrorCode.INVALID_SERVICE_NAME,
          nameValidation.errors.join(", "),
          { serverName },
          400
        );
      }

      // 3. 检查服务是否存在
      if (
        !MCPServerConfigValidator.checkServiceExists(
          serverName,
          this.configManager
        )
      ) {
        return c.fail(
          MCPErrorCode.SERVER_NOT_FOUND,
          "MCP 服务不存在",
          { serverName },
          404
        );
      }

      // 4. 获取服务当前的工具列表（用于事件通知）
      const currentTools = this.getServiceTools(serverName).map(
        (tool) => tool.name
      );

      // 5. 停止服务并清理资源
      try {
        await this.mcpServiceManager.stopService(serverName);
      } catch (error) {
        this.logger.warn(`停止服务 ${serverName} 失败:`, error);
        // 即使停止失败，也继续执行配置移除
      }

      // 6. 移除服务配置
      this.mcpServiceManager.removeServiceConfig(serverName);
      this.configManager.removeMcpServer(serverName);

      // 7. 发送事件通知
      getEventBus().emitEvent("mcp:server:removed", {
        serverName,
        affectedTools: currentTools,
        timestamp: new Date(),
      });

      // 8. 返回成功响应
      return c.success(
        {
          name: serverName,
          operation: "removed",
          affectedTools: currentTools,
        },
        "MCP 服务移除成功"
      );
    } catch (error) {
      this.logger.error("移除 MCP 服务失败:", error);

      // 处理不同类型的错误
      if (error instanceof Error) {
        if (error.message.includes("服务不存在")) {
          return c.fail(
            MCPErrorCode.SERVER_NOT_FOUND,
            error.message,
            undefined,
            404
          );
        }

        if (error.message.includes("配置更新")) {
          return c.fail(
            MCPErrorCode.CONFIG_UPDATE_FAILED,
            error.message,
            undefined,
            500
          );
        }
      }

      // 其他未知错误
      return c.fail(
        MCPErrorCode.REMOVE_FAILED,
        "移除 MCP 服务时发生错误",
        { error: error instanceof Error ? error.message : String(error) },
        500
      );
    }
  }

  /**
   * 获取 MCP 服务状态
   * GET /api/mcp-servers/:serverName/status
   */
  async getMCPServerStatus(c: Context<AppContext>): Promise<Response> {
    try {
      // 1. 从路径参数获取服务名称
      const serverName = c.req.param("serverName");

      // 2. 验证服务名称
      const nameValidation =
        MCPServerConfigValidator.validateServiceName(serverName);
      if (!nameValidation.isValid) {
        return c.fail(
          MCPErrorCode.INVALID_SERVICE_NAME,
          nameValidation.errors.join(", "),
          { serverName },
          400
        );
      }

      // 3. 检查服务是否存在
      if (
        !MCPServerConfigValidator.checkServiceExists(
          serverName,
          this.configManager
        )
      ) {
        return c.fail(
          MCPErrorCode.SERVER_NOT_FOUND,
          "MCP 服务不存在",
          { serverName },
          404
        );
      }

      // 4. 获取服务状态
      const serviceStatus = this.getServiceStatus(serverName);

      // 5. 返回成功响应
      return c.success(serviceStatus, "MCP 服务状态获取成功");
    } catch (error) {
      this.logger.error("获取 MCP 服务状态失败:", error);

      // 处理不同类型的错误
      if (error instanceof Error) {
        if (error.message.includes("服务不存在")) {
          return c.fail(
            MCPErrorCode.SERVER_NOT_FOUND,
            error.message,
            undefined,
            404
          );
        }
      }

      // 其他未知错误
      return c.fail(
        MCPErrorCode.INTERNAL_ERROR,
        "获取 MCP 服务状态时发生内部错误",
        { error: error instanceof Error ? error.message : String(error) },
        500
      );
    }
  }

  /**
   * 列出所有 MCP 服务
   * GET /api/mcp-servers
   */
  async listMCPServers(c: Context<AppContext>): Promise<Response> {
    try {
      // 1. 获取所有配置的 MCP 服务
      const config = this.configManager.getConfig();
      const mcpServers = config.mcpServers || {};

      // 2. 构建服务列表
      const servers: MCPServerStatus[] = [];

      for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
        const serviceStatus = this.getServiceStatus(serverName);
        servers.push(serviceStatus);
      }

      // 3. 构建响应数据
      const listResponse: MCPServerListResponse = {
        servers,
        total: servers.length,
      };

      // 4. 返回成功响应
      return c.success(listResponse, "MCP 服务列表获取成功");
    } catch (error) {
      this.logger.error("列出 MCP 服务失败:", error);

      // 其他未知错误
      return c.fail(
        MCPErrorCode.INTERNAL_ERROR,
        "列出 MCP 服务时发生内部错误",
        { error: error instanceof Error ? error.message : String(error) },
        500
      );
    }
  }

  /**
   * 处理批量 MCP 服务添加
   */
  private async addMCPServersBatch(
    batchRequest: MCPServerBatchAddRequest
  ): Promise<MCPServerBatchAddResponse> {
    const { mcpServers } = batchRequest;
    const serverNames = Object.keys(mcpServers);

    this.logger.info("addMCPServersBatch", {
      serverCount: serverNames.length,
      serverNames,
    });

    if (serverNames.length === 0) {
      throw MCPError.validationError(
        MCPErrorCode.INVALID_CONFIG,
        "批量添加请求中的服务列表为空"
      );
    }

    const results: MCPServerAddResult[] = [];
    const successfullyAddedServers: string[] = [];

    // 第一阶段：验证所有服务配置
    const validationResult = this.validateBatchServers(mcpServers);
    if (!validationResult.isValid) {
      throw MCPError.validationError(
        MCPErrorCode.INVALID_CONFIG,
        validationResult.errors.join(", ")
      );
    }

    try {
      // 第二阶段：逐个添加服务，记录成功和失败
      for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
        // 标准化type字段格式（在try块外声明，确保catch块中可以访问）
        const normalizedServerConfig = TypeFieldNormalizer.normalizeTypeField(
          serverConfig
        ) as MCPServerConfig;

        try {
          const result = await this.addMCPServerSingle(
            serverName,
            normalizedServerConfig
          );

          results.push({
            name: serverName,
            success: true,
            config: normalizedServerConfig,
            tools: result.tools,
            status: result.status,
          });

          successfullyAddedServers.push(serverName);

          this.logger.debug("批量添加：服务添加成功", {
            serverName,
            toolsCount: result.tools?.length || 0,
          });
        } catch (error) {
          const mcpError = this.handleError(error, "addMCPServersBatch", {
            serverName,
            serverConfig: normalizedServerConfig,
          });

          results.push({
            name: serverName,
            success: false,
            error: mcpError.message,
            config: normalizedServerConfig,
          });

          this.logger.warn("批量添加：服务添加失败", {
            serverName,
            error: mcpError.message,
          });
        }
      }

      // 第三阶段：统计结果
      const addedCount = successfullyAddedServers.length;
      const failedCount = serverNames.length - addedCount;

      // 第四阶段：如果完全失败，抛出异常；部分成功则返回结果
      if (addedCount === 0) {
        throw MCPError.configError(
          MCPErrorCode.ADD_FAILED,
          "批量添加失败：所有服务都无法添加"
        );
      }

      // 发送批量添加事件
      getEventBus().emitEvent("mcp:server:batch_added", {
        totalServers: serverNames.length,
        addedCount,
        failedCount,
        successfullyAddedServers,
        results,
        timestamp: new Date(),
      });

      const response: MCPServerBatchAddResponse = {
        success: addedCount > 0,
        message:
          addedCount === serverNames.length
            ? `批量添加成功：已添加 ${addedCount} 个服务`
            : `批量添加部分成功：成功添加 ${addedCount} 个服务，失败 ${failedCount} 个服务`,
        results,
        addedCount,
        failedCount,
      };

      this.logger.info("addMCPServersBatch", {
        totalServers: serverNames.length,
        addedCount,
        failedCount,
      });

      return response;
    } catch (error) {
      // 如果发生未处理的错误，尝试回滚已成功添加的服务
      if (successfullyAddedServers.length > 0) {
        await this.rollbackBatchAdd(successfullyAddedServers);
      }

      if (error instanceof MCPError) {
        throw error;
      }
      throw MCPError.systemError(
        MCPErrorCode.INTERNAL_ERROR,
        `批量添加过程中发生错误: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 验证批量服务配置
   */
  private validateBatchServers(
    mcpServers: Record<string, MCPServerConfig>
  ): ValidationResult {
    const errors: string[] = [];

    if (!mcpServers || typeof mcpServers !== "object") {
      errors.push("mcpServers 必须是一个对象");
      return { isValid: false, errors };
    }

    const serverNames = Object.keys(mcpServers);
    if (serverNames.length === 0) {
      errors.push("mcpServers 对象不能为空");
      return { isValid: false, errors };
    }

    if (serverNames.length > 50) {
      errors.push("批量添加的服务数量不能超过 50 个");
      return { isValid: false, errors };
    }

    // 验证每个服务
    for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
      // 验证服务名称
      const nameValidation =
        MCPServerConfigValidator.validateServiceName(serverName);
      if (!nameValidation.isValid) {
        errors.push(
          `服务 "${serverName}" 名称无效: ${nameValidation.errors.join(", ")}`
        );
        continue;
      }

      // 检查是否已存在
      if (
        MCPServerConfigValidator.checkServiceExists(
          serverName,
          this.configManager
        )
      ) {
        errors.push(`服务 "${serverName}" 已存在`);
        continue;
      }

      // 标准化type字段格式
      const normalizedServerConfig = TypeFieldNormalizer.normalizeTypeField(
        serverConfig
      ) as MCPServerConfig;

      // 验证配置
      const configValidation = MCPServerConfigValidator.validateConfig(
        normalizedServerConfig
      );
      if (!configValidation.isValid) {
        errors.push(
          `服务 "${serverName}" 配置无效: ${configValidation.errors.join(", ")}`
        );
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * 回滚批量添加的服务
   */
  private async rollbackBatchAdd(serverNames: string[]): Promise<void> {
    this.logger.info("开始回滚批量添加的服务", { serverNames });

    const rollbackResults: string[] = [];
    const rollbackFailures: string[] = [];

    for (const serverName of serverNames) {
      try {
        // 停止服务
        try {
          await this.mcpServiceManager.stopService(serverName);
        } catch (error) {
          this.logger.warn(`回滚时停止服务 ${serverName} 失败:`, error);
        }

        // 移除服务配置
        this.mcpServiceManager.removeServiceConfig(serverName);
        this.configManager.removeMcpServer(serverName);

        rollbackResults.push(serverName);

        // 发送回滚事件
        getEventBus().emitEvent("mcp:server:rollback", {
          serverName,
          timestamp: new Date(),
        });
      } catch (error) {
        const mcpError = this.handleError(error, "rollbackBatchAdd", {
          serverName,
        });
        rollbackFailures.push(serverName);

        this.logger.error(`回滚服务 ${serverName} 失败:`, mcpError.message);
      }
    }

    if (rollbackFailures.length > 0) {
      this.logger.warn("批量添加回滚部分失败", {
        totalServers: serverNames.length,
        rollbackedCount: rollbackResults.length,
        failedCount: rollbackFailures.length,
        failedServers: rollbackFailures,
      });
    } else {
      this.logger.info("批量添加回滚成功", {
        totalServers: serverNames.length,
        rollbackedCount: rollbackResults.length,
      });
    }
  }
}

/**
 * MCP 服务配置验证工具命名空间
 */
export namespace MCPServerConfigValidator {
  /**
   * 验证服务配置
   */
  export function validateConfig(config: MCPServerConfig): ValidationResult {
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
  export function validateServiceName(name: string): ValidationResult {
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
  export function checkServiceExists(
    name: string,
    configManager: ConfigManager
  ): boolean {
    const config = configManager.getConfig();
    return config.mcpServers && name in config.mcpServers;
  }
}
