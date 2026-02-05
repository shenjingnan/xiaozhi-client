import { ErrorCategory, MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { MCPServiceManager } from "@/lib/mcp";
import { getEventBus } from "@/services/event-bus.service.js";
import type { AppContext } from "@/types/hono.context.js";
import type { ConfigManager, MCPServerConfig } from "@xiaozhi-client/config";
import { normalizeServiceConfig } from "@xiaozhi-client/config";
import { TypeFieldNormalizer } from "@xiaozhi-client/mcp-core";
import type { Context } from "hono";

import {
  BaseMCPServerHandler,
  type MCPServerStatus,
} from "./mcp-server.handler.js";
import { MCPServerConfigValidator } from "./validators/mcp-server-config.validator.js";

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
 * MCP 服务添加处理器
 * 负责添加单个和批量添加 MCP 服务器
 */
export class MCPServerAddHandler extends BaseMCPServerHandler {
  constructor(
    mcpServiceManager: MCPServiceManager,
    configManager: ConfigManager
  ) {
    super(mcpServiceManager, configManager);
  }

  /**
   * 处理添加 MCP 服务请求
   * 支持两种格式：
   * 1. 单服务格式：{ name: string, config: MCPServerConfig }
   * 2. 批量格式：{ mcpServers: Record<string, MCPServerConfig> }
   */
  async handle(c: Context<AppContext>): Promise<Response> {
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
        const result = await this.handleBatch(batchRequest);

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

      const result = await this.addSingle(name, config);

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
  private async addSingle(
    name: string,
    config: MCPServerConfig
  ): Promise<MCPServerStatus> {
    this.logger.info("addSingle", {
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
        this.logger.error("addSingle", {
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
        this.logger.error("addSingle", {
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
        this.logger.error("addSingle", {
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

      // 7. 发送事件通知
      getEventBus().emitEvent("mcp:server:added", {
        serverName: name,
        config: normalizedConfig,
        tools: tools.map((tool) => tool.name),
        timestamp: new Date(),
      });

      return {
        ...serviceStatus,
        tools: tools.map((tool) => tool.name),
      };
    } catch (error) {
      const mcpError = this.handleError(error, "addSingle", {
        serverName: name,
        config: normalizedConfig,
      });
      this.logger.error("addSingle", {
        mcpError,
        serverName: name,
      });
      throw mcpError;
    }
  }

  /**
   * 处理批量 MCP 服务添加
   */
  private async handleBatch(
    batchRequest: MCPServerBatchAddRequest
  ): Promise<MCPServerBatchAddResponse> {
    const { mcpServers } = batchRequest;
    const serverNames = Object.keys(mcpServers);

    this.logger.info("handleBatch", {
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
          const result = await this.addSingle(
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
          const mcpError = this.handleError(error, "handleBatch", {
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

      this.logger.info("handleBatch", {
        totalServers: serverNames.length,
        addedCount,
        failedCount,
      });

      return response;
    } catch (error) {
      // 如果发生未处理的错误，尝试回滚已成功添加的服务
      if (successfullyAddedServers.length > 0) {
        await this.rollbackBatch(successfullyAddedServers);
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
  private validateBatchServers(mcpServers: Record<string, MCPServerConfig>): {
    isValid: boolean;
    errors: string[];
  } {
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
  private async rollbackBatch(serverNames: string[]): Promise<void> {
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
        const mcpError = this.handleError(error, "rollbackBatch", {
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
