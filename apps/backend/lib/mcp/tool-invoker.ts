/**
 * MCP 工具调用管理器
 * 负责工具调用、统计更新和日志记录
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { MCPService } from "@/lib/mcp/connection.js";
import type { CustomMCPTool } from "@/lib/mcp/types";
import type { CustomMCPHandler } from "./custom.js";
import type { ToolCallLogger } from "./log.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { configManager } from "@xiaozhi-client/config";

/**
 * 工具信息接口
 */
interface ToolInfo {
  serviceName: string;
  originalName: string;
  tool: Tool;
}

/**
 * 工具调用结果接口
 */
interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * 工具调用管理器
 * 专注于工具调用和统计更新
 */
export class MCPToolInvoker {
  private logger: Logger;
  private customMCPHandler: CustomMCPHandler;
  private toolCallLogger: ToolCallLogger;
  private getServiceFn: (name: string) => MCPService | undefined;
  private getToolsMapFn: () => Map<string, ToolInfo>;

  constructor(
    customMCPHandler: CustomMCPHandler,
    toolCallLogger: ToolCallLogger,
    getServiceFn: (name: string) => MCPService | undefined,
    getToolsMapFn: () => Map<string, ToolInfo>
  ) {
    this.logger = logger;
    this.customMCPHandler = customMCPHandler;
    this.toolCallLogger = toolCallLogger;
    this.getServiceFn = getServiceFn;
    this.getToolsMapFn = getToolsMapFn;
  }

  /**
   * 调用工具（支持标准 MCP 工具和 customMCP 工具）
   */
  async callTool(
    toolName: string,
    arguments_: Record<string, unknown>,
    options?: { timeout?: number }
  ): Promise<ToolCallResult> {
    const startTime = Date.now();

    // 初始化日志信息
    let logServerName = "unknown";
    let originalToolName: string = toolName;

    try {
      let result: ToolCallResult;

      // 检查是否是 customMCP 工具
      if (this.customMCPHandler.hasTool(toolName)) {
        const customTool = this.customMCPHandler.getToolInfo(toolName);

        // 设置日志信息（添加空值检查）
        if (customTool) {
          logServerName = this.getLogServerName(customTool);
          originalToolName = this.getOriginalToolName(toolName, customTool);
        }

        if (customTool?.handler?.type === "mcp") {
          // 对于 mcp 类型的工具，直接路由到对应的 MCP 服务
          result = await this.callMCPTool(
            toolName,
            customTool.handler.config,
            arguments_
          );

          // 异步更新工具调用统计（成功调用）
          this.updateToolStatsSafe(
            toolName,
            customTool.handler.config.serviceName,
            customTool.handler.config.toolName,
            true
          );
        } else {
          // 其他类型的 customMCP 工具正常处理，传递options参数
          result = await this.customMCPHandler.callTool(
            toolName,
            arguments_,
            options
          );
          this.logger.info(`[ToolInvoker] CustomMCP 工具 ${toolName} 调用成功`);

          // 异步更新工具调用统计（成功调用）
          this.updateToolStatsSafe(toolName, "customMCP", toolName, true);
        }
      } else {
        // 如果不是 customMCP 工具，则查找标准 MCP 工具
        const toolsMap = this.getToolsMapFn();
        const toolInfo = toolsMap.get(toolName);
        if (!toolInfo) {
          throw new Error(`未找到工具: ${toolName}`);
        }

        // 设置日志信息
        logServerName = toolInfo.serviceName;
        originalToolName = toolInfo.originalName;

        const service = this.getServiceFn(toolInfo.serviceName);
        if (!service) {
          throw new Error(`服务 ${toolInfo.serviceName} 不可用`);
        }

        if (!service.isConnected()) {
          throw new Error(`服务 ${toolInfo.serviceName} 未连接`);
        }

        result = (await service.callTool(
          toolInfo.originalName,
          arguments_ || {}
        )) as ToolCallResult;

        this.logger.debug("[ToolInvoker] 工具调用成功", {
          toolName: toolName,
          result: result,
        });

        // 异步更新工具调用统计（成功调用）
        this.updateToolStatsSafe(
          toolName,
          toolInfo.serviceName,
          toolInfo.originalName,
          true
        );
      }

      // 记录成功的工具调用
      this.toolCallLogger.recordToolCall({
        toolName: originalToolName,
        serverName: logServerName,
        arguments: arguments_,
        result: result,
        success: result.isError !== true,
        duration: Date.now() - startTime,
      });

      return result as ToolCallResult;
    } catch (error) {
      // 记录失败的工具调用
      this.toolCallLogger.recordToolCall({
        toolName: originalToolName,
        serverName: logServerName,
        arguments: arguments_,
        result: null,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });

      // 更新失败统计
      if (this.customMCPHandler.hasTool(toolName)) {
        const customTool = this.customMCPHandler.getToolInfo(toolName);
        if (customTool?.handler?.type === "mcp") {
          this.updateToolStatsSafe(
            toolName,
            customTool.handler.config.serviceName,
            customTool.handler.config.toolName,
            false
          );
        } else {
          this.updateToolStatsSafe(toolName, "customMCP", toolName, false);
          this.logger.error(
            `[ToolInvoker] CustomMCP 工具 ${toolName} 调用失败:`,
            (error as Error).message
          );
        }
      } else {
        const toolsMap = this.getToolsMapFn();
        const toolInfo = toolsMap.get(toolName);
        if (toolInfo) {
          this.updateToolStatsSafe(
            toolName,
            toolInfo.serviceName,
            toolInfo.originalName,
            false
          );
          this.logger.error(
            `[ToolInvoker] 工具 ${toolName} 调用失败:`,
            (error as Error).message
          );
        }
      }

      throw error;
    }
  }

  /**
   * 调用 MCP 工具（用于从 mcpServerConfig 同步的工具）
   */
  private async callMCPTool(
    toolName: string,
    config: { serviceName: string; toolName: string },
    arguments_: Record<string, unknown>
  ): Promise<ToolCallResult> {
    const { serviceName, toolName: originalToolName } = config;

    this.logger.debug(
      `[ToolInvoker] 调用 MCP 同步工具 ${toolName} -> ${serviceName}.${originalToolName}`
    );

    const service = this.getServiceFn(serviceName);
    if (!service) {
      throw new Error(`服务 ${serviceName} 不可用`);
    }

    if (!service.isConnected()) {
      throw new Error(`服务 ${serviceName} 未连接`);
    }

    try {
      const result = await service.callTool(originalToolName, arguments_ || {});
      this.logger.debug(`[ToolInvoker] MCP 同步工具 ${toolName} 调用成功`);
      return result as ToolCallResult;
    } catch (error) {
      this.logger.error(
        `[ToolInvoker] MCP 同步工具 ${toolName} 调用失败:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 根据工具信息获取日志记录用的服务名称
   */
  private getLogServerName(customTool: CustomMCPTool): string {
    if (!customTool?.handler) {
      return "custom";
    }

    switch (customTool.handler.type) {
      case "mcp": {
        const config = customTool.handler.config as
          | { serviceName?: string; toolName?: string }
          | undefined;
        return config?.serviceName || "customMCP";
      }
      case "coze":
        return "coze";
      case "dify":
        return "dify";
      case "n8n":
        return "n8n";
      default:
        return "custom";
    }
  }

  /**
   * 根据工具信息获取原始工具名称
   */
  private getOriginalToolName(
    toolName: string,
    customTool: CustomMCPTool
  ): string {
    if (customTool.handler?.type === "mcp") {
      const config = customTool.handler.config as
        | { serviceName?: string; toolName?: string }
        | undefined;
      return config?.toolName || toolName;
    }
    return toolName;
  }

  /**
   * 更新工具调用统计信息的通用方法
   */
  private async updateToolStats(
    toolName: string,
    serviceName: string,
    originalToolName: string,
    isSuccess: boolean
  ): Promise<void> {
    try {
      const currentTime = new Date().toISOString();

      if (isSuccess) {
        // 成功调用：更新使用统计
        await this.updateCustomMCPToolStats(toolName, currentTime);

        // 如果是 MCP 服务工具，同时更新 mcpServerConfig 配置（双写机制）
        if (serviceName !== "customMCP") {
          await this.updateMCPServerToolStats(
            serviceName,
            originalToolName,
            currentTime
          );
        }

        this.logger.debug(`[ToolInvoker] 已更新工具 ${toolName} 的统计信息`);
      } else {
        // 失败调用：只更新最后使用时间
        await this.updateCustomMCPToolLastUsedTime(toolName, currentTime);

        // 如果是 MCP 服务工具，同时更新 mcpServerConfig 配置（双写机制）
        if (serviceName !== "customMCP") {
          await this.updateMCPServerToolLastUsedTime(
            serviceName,
            originalToolName,
            currentTime
          );
        }

        this.logger.debug("[ToolInvoker] 已更新工具的失败调用统计信息", {
          toolName,
        });
      }
    } catch (error) {
      this.logger.error("[ToolInvoker] 更新工具统计信息失败:", { toolName, error });
      throw error;
    }
  }

  /**
   * 统一的统计更新处理方法（带错误处理）
   */
  private async updateToolStatsSafe(
    toolName: string,
    serviceName: string,
    originalToolName: string,
    isSuccess: boolean
  ): Promise<void> {
    try {
      await this.updateToolStats(toolName, serviceName, originalToolName, isSuccess);
    } catch (error) {
      const action = isSuccess ? "统计信息" : "失败统计信息";
      this.logger.warn("[ToolInvoker] 更新工具统计信息失败:", {
        toolName,
        action,
        error,
      });
      // 统计更新失败不应该影响主流程，所以这里只记录警告
    }
  }

  /**
   * 更新 customMCP 工具统计信息
   */
  private async updateCustomMCPToolStats(
    toolName: string,
    currentTime: string
  ): Promise<void> {
    try {
      await configManager.updateToolUsageStatsWithLock(toolName, true);
      this.logger.debug(`[ToolInvoker] 已更新 customMCP 工具 ${toolName} 使用统计`);
    } catch (error) {
      this.logger.error(
        `[ToolInvoker] 更新 customMCP 工具 ${toolName} 统计失败:`,
        error
      );
      throw error;
    }
  }

  /**
   * 更新 customMCP 工具最后使用时间
   */
  private async updateCustomMCPToolLastUsedTime(
    toolName: string,
    currentTime: string
  ): Promise<void> {
    try {
      await configManager.updateToolUsageStatsWithLock(toolName, false); // 只更新时间，不增加计数
      this.logger.debug(
        `[ToolInvoker] 已更新 customMCP 工具 ${toolName} 最后使用时间`
      );
    } catch (error) {
      this.logger.error(
        `[ToolInvoker] 更新 customMCP 工具 ${toolName} 最后使用时间失败:`,
        error
      );
      throw error;
    }
  }

  /**
   * 更新 MCP 服务工具统计信息
   */
  private async updateMCPServerToolStats(
    serviceName: string,
    toolName: string,
    currentTime: string
  ): Promise<void> {
    try {
      await configManager.updateMCPServerToolStatsWithLock(
        serviceName,
        toolName,
        currentTime,
        true
      );
      this.logger.debug(
        `[ToolInvoker] 已更新 MCP 服务工具 ${serviceName}/${toolName} 统计`
      );
    } catch (error) {
      this.logger.error(
        `[ToolInvoker] 更新 MCP 服务工具 ${serviceName}/${toolName} 统计失败:`,
        error
      );
      throw error;
    }
  }

  /**
   * 更新 MCP 服务工具最后使用时间
   */
  private async updateMCPServerToolLastUsedTime(
    serviceName: string,
    toolName: string,
    currentTime: string
  ): Promise<void> {
    try {
      await configManager.updateMCPServerToolStatsWithLock(
        serviceName,
        toolName,
        currentTime,
        false
      ); // 只更新时间，不增加计数
      this.logger.debug(
        `[ToolInvoker] 已更新 MCP 服务工具 ${serviceName}/${toolName} 最后使用时间`
      );
    } catch (error) {
      this.logger.error(
        `[ToolInvoker] 更新 MCP 服务工具 ${serviceName}/${toolName} 最后使用时间失败:`,
        error
      );
      throw error;
    }
  }
}
