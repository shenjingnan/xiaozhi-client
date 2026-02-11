/**
 * 工具控制处理器
 * 负责工具的启用、禁用等状态控制
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { AppContext } from "@/types/hono.context.js";
import { configManager } from "@xiaozhi-client/config";
import type { ToolValidationService } from "./tool-validation.service.js";
import type { Context } from "hono";

/**
 * 工具控制处理器类
 * 负责处理工具状态控制相关的逻辑
 */
export class ToolControlHandler {
  private logger: Logger;
  private validationService: ToolValidationService;

  constructor(validationService: ToolValidationService) {
    this.logger = logger;
    this.validationService = validationService;
  }

  /**
   * 统一的 MCP 工具管理接口
   * POST /api/tools/mcp/manage
   * 支持 action: enable | disable | status | toggle
   */
  async manageMCPTool(c: Context<AppContext>): Promise<Response> {
    try {
      const requestBody = await c.req.json();
      const { action, serverName, toolName, description } = requestBody;

      // 验证 action 参数
      if (!action || typeof action !== "string") {
        return c.fail(
          "INVALID_REQUEST",
          "action 参数不能为空且必须是字符串",
          undefined,
          400
        );
      }

      const validActions = ["enable", "disable", "status", "toggle"];
      if (!validActions.includes(action)) {
        return c.fail(
          "INVALID_ACTION",
          `无效的 action: ${action}。支持的 action: ${validActions.join(", ")}`,
          undefined,
          400
        );
      }

      // 验证服务名和工具名
      this.validationService.validateToolNames(serverName, toolName);

      // 根据不同的 action 执行相应操作
      switch (action) {
        case "enable":
          return this.handleEnableTool(c, serverName, toolName, description);
        case "disable":
          return this.handleDisableTool(c, serverName, toolName);
        case "status":
          return this.handleGetToolStatus(c, serverName, toolName);
        case "toggle":
          return this.handleToggleTool(c, serverName, toolName);
        default: {
          return c.fail(
            "INVALID_ACTION",
            `未实现的 action: ${action}`,
            undefined,
            400
          );
        }
      }
    } catch (error) {
      c.get("logger").error("管理 MCP 工具失败:", error);
      const errorMessage =
        error instanceof Error ? error.message : "管理 MCP 工具失败";
      return c.fail("TOOL_MANAGE_ERROR", errorMessage, undefined, 500);
    }
  }

  /**
   * 处理启用工具
   * @private
   */
  private async handleEnableTool(
    c: Context<AppContext>,
    serverName: string,
    toolName: string,
    description?: string
  ): Promise<Response> {
    // 验证服务存在性
    await this.validationService.validateServiceAndToolExistence(
      serverName,
      toolName
    );

    // 设置工具为启用状态
    configManager.setToolEnabled(serverName, toolName, true, description);

    // 获取更新后的工具配置
    const toolsConfig = configManager.getServerToolsConfig(serverName);
    const toolConfig = toolsConfig[toolName];

    c.get("logger").info(`工具已启用: ${serverName}/${toolName}`);

    return c.success(
      {
        serverName,
        toolName,
        enabled: true,
        description: toolConfig?.description || description || "",
      },
      `工具 "${serverName}__${toolName}" 启用成功`
    );
  }

  /**
   * 处理禁用工具
   * @private
   */
  private async handleDisableTool(
    c: Context<AppContext>,
    serverName: string,
    toolName: string
  ): Promise<Response> {
    // 验证服务存在性
    await this.validationService.validateServiceAndToolExistence(
      serverName,
      toolName
    );

    // 设置工具为禁用状态
    configManager.setToolEnabled(serverName, toolName, false);

    c.get("logger").info(`工具已禁用: ${serverName}/${toolName}`);

    return c.success(
      {
        serverName,
        toolName,
        enabled: false,
      },
      `工具 "${serverName}__${toolName}" 禁用成功`
    );
  }

  /**
   * 处理获取工具状态
   * @private
   */
  private async handleGetToolStatus(
    c: Context<AppContext>,
    serverName: string,
    toolName: string
  ): Promise<Response> {
    // 获取工具配置
    const toolsConfig = configManager.getServerToolsConfig(serverName);
    const toolConfig = toolsConfig[toolName];

    if (!toolConfig) {
      return c.fail(
        "TOOL_NOT_FOUND",
        `工具 "${serverName}__${toolName}" 不存在或未配置`,
        undefined,
        404
      );
    }

    return c.success(
      {
        serverName,
        toolName,
        enabled: toolConfig.enable !== false,
        description: toolConfig.description || "",
        usageCount: toolConfig.usageCount,
        lastUsedTime: toolConfig.lastUsedTime,
      },
      "工具状态获取成功"
    );
  }

  /**
   * 处理切换工具状态
   * @private
   */
  private async handleToggleTool(
    c: Context<AppContext>,
    serverName: string,
    toolName: string
  ): Promise<Response> {
    // 验证服务存在性
    await this.validationService.validateServiceAndToolExistence(
      serverName,
      toolName
    );

    // 获取当前状态
    const currentEnabled = configManager.isToolEnabled(serverName, toolName);

    // 切换状态
    const newEnabled = !currentEnabled;
    configManager.setToolEnabled(serverName, toolName, newEnabled);

    c.get("logger").info(
      `工具状态已切换: ${serverName}/${toolName} -> ${newEnabled}`
    );

    return c.success(
      {
        serverName,
        toolName,
        enabled: newEnabled,
      },
      `工具 "${serverName}__${toolName}" 已${newEnabled ? "启用" : "禁用"}`
    );
  }
}
