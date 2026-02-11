/**
 * 工具调用处理器
 * 负责处理工具调用的核心逻辑
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { MCPServiceManager } from "@/lib/mcp";
import type { AppContext } from "@/types/hono.context.js";
import type { Context } from "hono";
import Ajv from "ajv";

/**
 * 工具调用请求接口
 */
interface ToolCallRequest {
  serviceName: string;
  toolName: string;
  args: Record<string, unknown>;
}

/**
 * 工具调用处理器类
 * 负责处理 MCP 工具的调用逻辑
 */
export class ToolCallHandler {
  private logger: Logger;
  private ajv: Ajv;

  constructor() {
    this.logger = logger;
    this.ajv = new Ajv({ allErrors: true, verbose: true });
  }

  /**
   * 调用 MCP 工具
   * POST /api/tools/call
   */
  async callTool(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理工具调用请求");

      // 解析请求体
      const requestBody: ToolCallRequest = await c.req.json();
      const { serviceName, toolName, args } = requestBody;

      // 验证请求参数
      if (!serviceName || !toolName) {
        return c.fail(
          "INVALID_REQUEST",
          "serviceName 和 toolName 是必需的参数",
          undefined,
          400
        );
      }

      c.get("logger").info(
        `准备调用工具: ${serviceName}/${toolName}，参数:`,
        JSON.stringify(args)
      );

      // 从 Context 中获取 MCPServiceManager 实例
      const serviceManager = c.get("mcpServiceManager");

      if (!serviceManager) {
        return c.fail(
          "SERVICE_NOT_INITIALIZED",
          "MCP 服务管理器未初始化。请检查服务状态。",
          undefined,
          503
        );
      }

      // 验证服务和工具是否存在
      await this.validateServiceAndTool(serviceManager, serviceName, toolName);

      // 对于 customMCP 工具，进行参数验证
      if (serviceName === "customMCP") {
        await this.validateCustomMCPArguments(
          serviceManager,
          toolName,
          args || {}
        );
      }

      // 调用工具 - 特殊处理 customMCP 服务
      let result: unknown;
      if (serviceName === "customMCP") {
        // 对于 customMCP 服务，直接使用 toolName 调用，传递60秒超时
        result = await serviceManager.callTool(toolName, args || {}, {
          timeout: 60000,
        });
      } else {
        // 对于标准 MCP 服务，使用 serviceName__toolName 格式，保持8秒超时
        const toolKey = `${serviceName}__${toolName}`;
        result = await serviceManager.callTool(toolKey, args || {});
      }

      return c.success(result, "工具调用成功");
    } catch (error) {
      c.get("logger").error("工具调用失败:", error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      let errorCode = "TOOL_CALL_ERROR";

      // 根据错误类型设置不同的错误码
      if (errorMessage.includes("不存在")) {
        errorCode = "SERVICE_OR_TOOL_NOT_FOUND";
      } else if (
        errorMessage.includes("未启动") ||
        errorMessage.includes("未连接")
      ) {
        errorCode = "SERVICE_NOT_AVAILABLE";
      } else if (errorMessage.includes("已被禁用")) {
        errorCode = "TOOL_DISABLED";
      } else if (errorMessage.includes("参数验证失败")) {
        errorCode = "INVALID_ARGUMENTS";
      } else if (
        errorMessage.includes("CustomMCP") ||
        errorMessage.includes("customMCP")
      ) {
        errorCode = "CUSTOM_MCP_ERROR";
      } else if (
        errorMessage.includes("工作流调用失败") ||
        errorMessage.includes("API 请求失败")
      ) {
        errorCode = "EXTERNAL_API_ERROR";
      } else if (errorMessage.includes("超时")) {
        errorCode = "TIMEOUT_ERROR";
      }

      return c.fail(errorCode, errorMessage, undefined, 500);
    }
  }

  /**
   * 验证服务和工具是否存在
   * @private
   */
  private async validateServiceAndTool(
    serviceManager: MCPServiceManager,
    serviceName: string,
    toolName: string
  ): Promise<void> {
    // 特殊处理 customMCP 服务
    if (serviceName === "customMCP") {
      // 验证 customMCP 工具是否存在
      if (!serviceManager.hasCustomMCPTool(toolName)) {
        const availableTools = serviceManager
          .getCustomMCPTools()
          .map((tool) => tool.name);

        if (availableTools.length === 0) {
          throw MCPError.validationError(
            MCPErrorCode.TOOL_NOT_FOUND,
            `customMCP 工具 '${toolName}' 不存在。当前没有配置任何 customMCP 工具。请检查 xiaozhi.config.json 中的 customMCP 配置。`
          );
        }

        throw MCPError.validationError(
          MCPErrorCode.TOOL_NOT_FOUND,
          `customMCP 工具 '${toolName}' 不存在。可用的 customMCP 工具: ${availableTools.join(", ")}。请使用 'xiaozhi mcp list' 查看所有可用工具。`
        );
      }

      // 验证 customMCP 工具配置是否有效
      try {
        const customTools = serviceManager.getCustomMCPTools();
        const targetTool = customTools.find((tool) => tool.name === toolName);

        if (targetTool && !targetTool.description) {
          this.logger.warn(`customMCP 工具 '${toolName}' 缺少描述信息`);
        }

        if (targetTool && !targetTool.inputSchema) {
          this.logger.warn(`customMCP 工具 '${toolName}' 缺少输入参数定义`);
        }
      } catch (error) {
        this.logger.error(
          `验证 customMCP 工具 '${toolName}' 配置时出错:`,
          error
        );
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          `customMCP 工具 '${toolName}' 配置验证失败。请检查配置文件中的工具定义。`
        );
      }

      return;
    }
  }

  /**
   * 验证 customMCP 工具的参数
   * @private
   */
  private async validateCustomMCPArguments(
    serviceManager: MCPServiceManager,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<void> {
    try {
      // 获取工具的 inputSchema
      const customTools = serviceManager.getCustomMCPTools();
      const targetTool = customTools.find((tool) => tool.name === toolName);

      if (!targetTool) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_NOT_FOUND,
          `customMCP 工具 '${toolName}' 不存在`
        );
      }

      // 如果工具没有定义 inputSchema，跳过验证
      if (!targetTool.inputSchema) {
        this.logger.warn(
          `customMCP 工具 '${toolName}' 没有定义 inputSchema，跳过参数验证`
        );
        return;
      }

      // 使用 AJV 验证参数
      const validate = this.ajv.compile(targetTool.inputSchema);
      const valid = validate(args);

      if (!valid) {
        // 构建详细的错误信息
        const errors = validate.errors || [];
        const errorMessages = errors.map((error) => {
          const path = error.instancePath || error.schemaPath || "";
          const message = error.message || "未知错误";

          if (error.keyword === "required") {
            const missingProperty = error.params?.missingProperty || "未知字段";
            return `缺少必需参数: ${missingProperty}`;
          }

          if (error.keyword === "type") {
            const expectedType = error.params?.type || "未知类型";
            return `参数 ${path} 类型错误，期望: ${expectedType}`;
          }

          if (error.keyword === "enum") {
            const allowedValues = error.params?.allowedValues || [];
            return `参数 ${path} 值无效，允许的值: ${allowedValues.join(", ")}`;
          }

          return `参数 ${path} ${message}`;
        });

        const errorMessage = `参数验证失败: ${errorMessages.join("; ")}`;
        this.logger.error(
          `customMCP 工具 '${toolName}' 参数验证失败:`,
          errorMessage
        );

        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          errorMessage
        );
      }

      this.logger.debug(`customMCP 工具 '${toolName}' 参数验证通过`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("参数验证失败")) {
        throw error;
      }

      this.logger.error(`验证 customMCP 工具 '${toolName}' 参数时出错:`, error);
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        `参数验证过程中发生错误: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }
}
