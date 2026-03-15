/**
 * MCP 工具增删改处理器
 * 负责处理自定义工具的添加、更新和删除操作
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import { MCPCacheManager } from "@/lib/mcp";
import type { MCPServiceManager } from "@/lib/mcp";
import { ToolNameService } from "@/services/tool-name.service.js";
import { ToolValidationService } from "@/services/tool-validation.service.js";
import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { AppContext } from "@/types/hono.context.js";
import type {
  AddCustomToolRequest,
  AddToolResponse,
  CozeWorkflowData,
  MCPToolData,
} from "@/types/toolApi.js";
import { ToolType } from "@/types/toolApi.js";
import type { CustomMCPTool } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";
import dayjs from "dayjs";
import type { Context } from "hono";

/**
 * 添加自定义工具请求接口（向后兼容）
 * @deprecated 使用新的 AddCustomToolRequest 类型定义
 */
interface LegacyAddCustomToolRequest {
  workflow: CozeWorkflow;
  customName?: string;
  customDescription?: string;
  parameterConfig?: WorkflowParameterConfig;
}

/**
 * MCP 工具增删改处理器
 * 负责处理自定义工具的添加、更新和删除操作
 */
export class MCPToolMutationHandler {
  private logger: Logger;
  private nameService: ToolNameService;
  private validationService: ToolValidationService;
  private static readonly TOOL_TYPE_VALUES = Object.values(ToolType);

  constructor() {
    this.logger = logger;
    this.nameService = new ToolNameService();
    this.validationService = new ToolValidationService();
  }

  /**
   * 添加自定义 MCP 工具
   * POST /api/tools/custom
   * 支持多种工具类型：MCP 工具、Coze 工作流等
   */
  async addCustomTool(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理添加自定义工具请求");

      const requestBody = await c.req.json();

      // 检查是否为新格式的请求
      if (this.isNewFormatRequest(requestBody)) {
        // 新格式：支持多种工具类型
        return await this.handleNewFormatAddTool(
          c,
          requestBody as AddCustomToolRequest
        );
      }
      // 旧格式：向后兼容
      return await this.handleLegacyFormatAddTool(
        c,
        requestBody as LegacyAddCustomToolRequest
      );
    } catch (error) {
      c.get("logger").error("添加自定义工具失败:", error);

      // 根据错误类型返回不同的 HTTP 状态码和错误信息
      const { code, message, status } = this.handleAddToolError(error);
      return c.fail(code, message, undefined, status);
    }
  }

  /**
   * 判断是否为新格式的请求
   */
  private isNewFormatRequest(body: unknown): body is AddCustomToolRequest {
    return (
      body !== null &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      "type" in body &&
      "data" in body
    );
  }

  /**
   * 处理新格式的添加工具请求
   */
  private async handleNewFormatAddTool(
    c: Context<AppContext>,
    request: AddCustomToolRequest
  ): Promise<Response> {
    const { type, data } = request;

    c.get("logger").info(`处理新格式工具添加请求，类型: ${type}`);

    // 验证工具类型
    if (!MCPToolMutationHandler.TOOL_TYPE_VALUES.includes(type)) {
      return c.fail(
        "INVALID_TOOL_TYPE",
        `不支持的工具类型: ${type}。支持的类型: ${MCPToolMutationHandler.TOOL_TYPE_VALUES.join(", ")}`,
        undefined,
        400
      );
    }

    // 根据工具类型分发处理
    switch (type) {
      case ToolType.MCP:
        return await this.handleAddMCPTool(c, data as MCPToolData);

      case ToolType.COZE:
        return await this.handleAddCozeTool(c, data as CozeWorkflowData);

      case ToolType.HTTP:
      case ToolType.FUNCTION: {
        return c.fail(
          "TOOL_TYPE_NOT_IMPLEMENTED",
          `工具类型 ${type} 暂未实现，请使用 MCP 或 Coze 类型`,
          undefined,
          501
        );
      }

      default: {
        return c.fail(
          "UNKNOWN_TOOL_TYPE",
          `未知的工具类型: ${type}`,
          undefined,
          400
        );
      }
    }
  }

  /**
   * 处理旧格式的添加工具请求（向后兼容）
   */
  private async handleLegacyFormatAddTool(
    c: Context<AppContext>,
    request: LegacyAddCustomToolRequest
  ): Promise<Response> {
    c.get("logger").info("处理旧格式工具添加请求（向后兼容）");

    const { workflow, customName, customDescription, parameterConfig } =
      request;

    // 边界条件预检查
    const preCheckResult = this.validationService.performPreChecks(
      workflow,
      customName,
      customDescription
    );
    if (preCheckResult) {
      return c.fail(
        preCheckResult.code,
        preCheckResult.message,
        undefined,
        preCheckResult.status
      );
    }

    // 转换工作流为工具配置
    const tool = this.convertWorkflowToTool(
      workflow,
      customName,
      customDescription,
      parameterConfig
    );

    // 添加工具到配置
    configManager.addCustomMCPTool(tool);

    c.get("logger").info(`成功添加自定义工具: ${tool.name}`);

    return c.success({ tool }, `工具 "${tool.name}" 添加成功`);
  }

  /**
   * 处理添加 MCP 工具
   */
  private async handleAddMCPTool(
    c: Context<AppContext>,
    data: MCPToolData
  ): Promise<Response> {
    const { serviceName, toolName, customName, customDescription } = data;

    c.get("logger").info(`处理添加 MCP 工具: ${serviceName}/${toolName}`);

    // 验证必需字段
    if (!serviceName || !toolName) {
      return c.fail(
        "MISSING_REQUIRED_FIELD",
        "serviceName 和 toolName 是必需字段",
        undefined,
        400
      );
    }

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
    try {
      await this.validateServiceAndTool(serviceManager, serviceName, toolName);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return c.fail("SERVICE_OR_TOOL_NOT_FOUND", errorMessage, undefined, 404);
    }

    // 从缓存中获取工具信息
    const cacheManager = new MCPCacheManager();
    const cachedTools = await cacheManager.getAllCachedTools();

    // 查找对应的工具
    const fullToolName = `${serviceName}__${toolName}`;
    const cachedTool = cachedTools.find((tool) => tool.name === fullToolName);

    if (!cachedTool) {
      return c.fail(
        "TOOL_NOT_FOUND",
        `在缓存中未找到工具: ${serviceName}/${toolName}`,
        undefined,
        404
      );
    }

    // 生成工具名称
    const finalToolName = customName || fullToolName;

    // 检查工具名称是否已存在
    const existingTools = configManager.getCustomMCPTools();
    const existingNames = new Set(existingTools.map((tool) => tool.name));

    if (existingNames.has(finalToolName)) {
      return c.fail(
        "TOOL_NAME_CONFLICT",
        `工具名称 "${finalToolName}" 已存在，请使用不同的自定义名称`,
        undefined,
        409
      );
    }

    // 创建 CustomMCPTool 配置
    const tool: CustomMCPTool = {
      name: finalToolName,
      description:
        customDescription ||
        cachedTool.description ||
        `MCP 工具: ${serviceName}/${toolName}`,
      inputSchema: cachedTool.inputSchema || {},
      handler: {
        type: "mcp",
        config: {
          serviceName,
          toolName,
        },
      },
      stats: {
        usageCount: 0,
        lastUsedTime: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      },
    };

    // 添加工具到配置
    configManager.addCustomMCPTool(tool);

    // 对于 MCP 工具，需要在 mcpServerConfig 中同步启用
    c.get("logger").info(
      `检测到 MCP 工具添加，同步启用 mcpServerConfig 中的工具: ${serviceName}/${toolName}`
    );

    // 获取当前的服务工具配置
    const serverToolsConfig = configManager.getServerToolsConfig(serviceName);

    if (serverToolsConfig?.toolName) {
      // 更新配置，启用该工具
      serverToolsConfig[toolName].enable = true;

      // 保存更新后的配置
      configManager.updateServerToolsConfig(serviceName, serverToolsConfig);

      c.get("logger").info(
        `已同步启用 mcpServerConfig 中的工具: ${serviceName}/${toolName}`
      );
    }

    c.get("logger").info(`成功添加 MCP 工具: ${finalToolName}`);

    const responseData: AddToolResponse = {
      tool,
      toolName: finalToolName,
      toolType: ToolType.MCP,
      addedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    };

    return c.success(responseData, `MCP 工具 "${finalToolName}" 添加成功`);
  }

  /**
   * 处理添加 Coze 工具
   */
  private async handleAddCozeTool(
    c: Context<AppContext>,
    data: CozeWorkflowData
  ): Promise<Response> {
    const { workflow, customName, customDescription, parameterConfig } = data;

    c.get("logger").info(`处理添加 Coze 工具: ${workflow.workflow_name}`);

    // 边界条件预检查
    const preCheckResult = this.validationService.performPreChecks(
      workflow,
      customName,
      customDescription
    );
    if (preCheckResult) {
      return c.fail(
        preCheckResult.code,
        preCheckResult.message,
        undefined,
        preCheckResult.status
      );
    }

    // 转换工作流为工具配置
    const tool = this.convertWorkflowToTool(
      workflow,
      customName,
      customDescription,
      parameterConfig
    );

    // 添加工具到配置
    configManager.addCustomMCPTool(tool);

    c.get("logger").info(`成功添加 Coze 工具: ${tool.name}`);

    const responseData: AddToolResponse = {
      tool,
      toolName: tool.name,
      toolType: ToolType.COZE,
      addedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    };

    return c.success(responseData, `Coze 工具 "${tool.name}" 添加成功`);
  }

  /**
   * 更新自定义 MCP 工具配置
   * PUT /api/tools/custom/:toolName
   */
  async updateCustomTool(c: Context<AppContext>): Promise<Response> {
    try {
      const toolName = c.req.param("toolName");

      if (!toolName) {
        return c.fail("INVALID_REQUEST", "工具名称不能为空", undefined, 400);
      }

      c.get("logger").info(`处理更新自定义工具配置请求: ${toolName}`);

      const requestBody = await c.req.json();

      // 验证请求体
      if (!requestBody || typeof requestBody !== "object") {
        return c.fail(
          "INVALID_REQUEST",
          "请求体必须是有效对象",
          undefined,
          400
        );
      }

      // 检查是否为新格式的请求
      if (this.isNewFormatRequest(requestBody)) {
        // 新格式：支持多种工具类型
        return await this.handleNewFormatUpdateTool(
          c,
          toolName,
          requestBody as AddCustomToolRequest
        );
      }

      // 旧格式不支持更新操作
      return c.fail(
        "INVALID_REQUEST",
        "更新操作只支持新格式的请求",
        undefined,
        400
      );
    } catch (error) {
      c.get("logger").error("更新自定义工具配置失败:", error);

      // 根据错误类型返回不同的HTTP状态码和错误信息
      const { code, message, status } = this.handleUpdateToolError(error);
      return c.fail(code, message, undefined, status);
    }
  }

  /**
   * 处理新格式的更新工具请求
   */
  private async handleNewFormatUpdateTool(
    c: Context<AppContext>,
    toolName: string,
    request: AddCustomToolRequest
  ): Promise<Response> {
    const { type, data } = request;

    c.get("logger").info(`处理新格式工具更新请求，类型: ${type}`);

    // 验证工具类型
    if (!MCPToolMutationHandler.TOOL_TYPE_VALUES.includes(type)) {
      return c.fail(
        "INVALID_TOOL_TYPE",
        `不支持的工具类型: ${type}。支持的类型: ${MCPToolMutationHandler.TOOL_TYPE_VALUES.join(", ")}`,
        undefined,
        400
      );
    }

    // 根据工具类型分发处理
    switch (type) {
      case ToolType.COZE:
        return await this.handleUpdateCozeTool(
          c,
          toolName,
          data as CozeWorkflowData
        );

      case ToolType.MCP:
      case ToolType.HTTP:
      case ToolType.FUNCTION: {
        return c.fail(
          "TOOL_TYPE_NOT_IMPLEMENTED",
          `工具类型 ${type} 暂不支持更新操作，目前仅支持 Coze 类型`,
          undefined,
          501
        );
      }

      default: {
        return c.fail(
          "UNKNOWN_TOOL_TYPE",
          `未知的工具类型: ${type}`,
          undefined,
          400
        );
      }
    }
  }

  /**
   * 处理更新 Coze 工具
   */
  private async handleUpdateCozeTool(
    c: Context<AppContext>,
    toolName: string,
    data: CozeWorkflowData
  ): Promise<Response> {
    const { workflow, parameterConfig } = data;

    c.get("logger").info(`处理更新 Coze 工具: ${toolName}`);

    // 验证工作流更新数据
    this.validationService.validateWorkflowUpdateData(workflow);

    // 获取现有工具配置
    const existingTools = configManager.getCustomMCPTools();
    const existingTool = existingTools.find((t) => t.name === toolName);

    if (!existingTool) {
      return c.fail(
        "TOOL_NOT_FOUND",
        `工具 "${toolName}" 不存在`,
        undefined,
        404
      );
    }

    // 验证现有工具是 Coze 类型
    if (
      existingTool.handler.type !== "proxy" ||
      existingTool.handler.platform !== "coze"
    ) {
      return c.fail(
        "INVALID_TOOL_TYPE",
        `工具 "${toolName}" 不是 Coze 类型，无法更新为 Coze 工作流`,
        undefined,
        400
      );
    }

    // 更新工具配置
    const updatedTool: CustomMCPTool = {
      ...existingTool,
      description: this.nameService.generateToolDescription(workflow),
      inputSchema: this.nameService.generateInputSchema(
        workflow,
        parameterConfig
      ),
      handler: this.nameService.createHttpHandler(workflow),
    };

    // 保存更新后的配置
    configManager.updateCustomMCPTool(toolName, updatedTool);

    c.get("logger").info(`成功更新 Coze 工具: ${toolName}`);

    return c.success({ tool: updatedTool }, `工具 "${toolName}" 更新成功`);
  }

  /**
   * 删除自定义 MCP 工具
   * DELETE /api/tools/custom/:toolName
   */
  async removeCustomTool(c: Context<AppContext>): Promise<Response> {
    try {
      const toolName = c.req.param("toolName");

      if (!toolName) {
        return c.fail("INVALID_REQUEST", "工具名称不能为空", undefined, 400);
      }

      c.get("logger").info(`处理删除自定义工具请求: ${toolName}`);

      // 获取现有工具列表
      const existingTools = configManager.getCustomMCPTools();
      const toolToDelete = existingTools.find((tool) => tool.name === toolName);

      if (!toolToDelete) {
        return c.fail(
          "TOOL_NOT_FOUND",
          `工具 "${toolName}" 不存在`,
          undefined,
          404
        );
      }

      // 删除工具
      configManager.removeCustomMCPTool(toolName);

      c.get("logger").info(`成功删除自定义工具: ${toolName}`);

      return c.success(
        { toolName, deletedTool: toolToDelete },
        `工具 "${toolName}" 删除成功`
      );
    } catch (error) {
      c.get("logger").error("删除自定义工具失败:", error);

      // 根据错误类型返回不同的HTTP状态码和错误信息
      const { code, message, status } = this.handleRemoveToolError(error);
      return c.fail(code, message, undefined, status);
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
   * 转换工作流为工具配置
   * @private
   */
  private convertWorkflowToTool(
    workflow: CozeWorkflow,
    customName?: string,
    customDescription?: string,
    parameterConfig?: WorkflowParameterConfig
  ): CustomMCPTool {
    // 验证工作流数据
    this.validationService.validateWorkflowData(workflow);

    // 生成工具名称
    const sanitizedName = this.nameService.sanitizeCozeToolName(
      workflow.workflow_name
    );
    const finalName = customName || sanitizedName;

    // 解决名称冲突
    const uniqueName = this.nameService.resolveToolNameConflict(finalName);

    // 生成工具描述
    const description = this.nameService.generateToolDescription(
      workflow,
      customDescription
    );

    // 生成输入模式
    const inputSchema = this.nameService.generateInputSchema(
      workflow,
      parameterConfig
    );

    // 创建 HTTP 处理器配置
    const handler = this.nameService.createHttpHandler(workflow);

    return {
      name: uniqueName,
      description,
      inputSchema,
      handler,
      stats: {
        usageCount: 0,
        lastUsedTime: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      },
    };
  }

  /**
   * 处理添加工具时的错误
   * @private
   */
  private handleAddToolError(error: unknown): {
    code: string;
    message: string;
    status: number;
  } {
    const errorMessage =
      error instanceof Error ? error.message : "添加自定义工具失败";

    // 数据验证错误 (400)
    if (this.isValidationError(errorMessage)) {
      return {
        code: "VALIDATION_ERROR",
        message: this.formatValidationError(errorMessage),
        status: 400,
      };
    }

    // 工具名称冲突错误 (409)
    if (
      errorMessage.includes("名称冲突") ||
      errorMessage.includes("NAME_CONFLICT") ||
      errorMessage.includes("已存在")
    ) {
      return {
        code: "TOOL_NAME_CONFLICT",
        message: errorMessage,
        status: 409,
      };
    }

    // 服务或工具未找到错误 (404)
    if (
      errorMessage.includes("不存在") ||
      errorMessage.includes("未找到") ||
      errorMessage.includes("SERVICE_OR_TOOL_NOT_FOUND")
    ) {
      return {
        code: "SERVICE_OR_TOOL_NOT_FOUND",
        message: errorMessage,
        status: 404,
      };
    }

    // 配置错误 (422)
    if (
      errorMessage.includes("配置") ||
      errorMessage.includes("权限") ||
      errorMessage.includes("CONFIGURATION_ERROR")
    ) {
      return {
        code: "CONFIGURATION_ERROR",
        message: errorMessage,
        status: 422,
      };
    }

    // 资源限制错误 (429)
    if (
      errorMessage.includes("资源限制") ||
      errorMessage.includes("RESOURCE_LIMIT_EXCEEDED")
    ) {
      return {
        code: "RESOURCE_LIMIT_EXCEEDED",
        message: errorMessage,
        status: 429,
      };
    }

    // 未实现功能错误 (501)
    if (
      errorMessage.includes("未实现") ||
      errorMessage.includes("NOT_IMPLEMENTED")
    ) {
      return {
        code: "TOOL_TYPE_NOT_IMPLEMENTED",
        message: errorMessage,
        status: 501,
      };
    }

    // 系统错误 (500)
    return {
      code: "ADD_CUSTOM_TOOL_ERROR",
      message: `添加工具失败：${errorMessage}。请稍后重试，如问题持续存在请联系管理员`,
      status: 500,
    };
  }

  /**
   * 处理更新工具时的错误
   * @private
   */
  private handleUpdateToolError(error: unknown): {
    code: string;
    message: string;
    status: number;
  } {
    const errorMessage =
      error instanceof Error ? error.message : "更新自定义工具失败";

    // 工具不存在错误 (404)
    if (errorMessage.includes("不存在") || errorMessage.includes("未找到")) {
      return {
        code: "TOOL_NOT_FOUND",
        message: `${errorMessage}。请检查工具名称是否正确，或刷新页面查看最新的工具列表`,
        status: 404,
      };
    }

    // 数据验证错误 (400)
    if (this.isValidationError(errorMessage)) {
      return {
        code: "VALIDATION_ERROR",
        message: this.formatValidationError(errorMessage),
        status: 400,
      };
    }

    // 配置错误 (422)
    if (errorMessage.includes("配置") || errorMessage.includes("权限")) {
      return {
        code: "CONFIGURATION_ERROR",
        message: `${errorMessage}。请检查配置文件权限和格式是否正确`,
        status: 422,
      };
    }

    // 未实现功能错误 (501)
    if (
      errorMessage.includes("未实现") ||
      errorMessage.includes("NOT_IMPLEMENTED") ||
      errorMessage.includes("暂不支持")
    ) {
      return {
        code: "TOOL_TYPE_NOT_IMPLEMENTED",
        message: errorMessage,
        status: 501,
      };
    }

    // 系统错误 (500)
    return {
      code: "UPDATE_CUSTOM_TOOL_ERROR",
      message: `更新工具失败：${errorMessage}。请稍后重试，如问题持续存在请联系管理员`,
      status: 500,
    };
  }

  /**
   * 处理删除工具时的错误
   * @private
   */
  private handleRemoveToolError(error: unknown): {
    code: string;
    message: string;
    status: number;
  } {
    const errorMessage =
      error instanceof Error ? error.message : "删除自定义工具失败";

    // 工具不存在错误 (404)
    if (errorMessage.includes("不存在") || errorMessage.includes("未找到")) {
      return {
        code: "TOOL_NOT_FOUND",
        message: `${errorMessage}。请检查工具名称是否正确，或刷新页面查看最新的工具列表`,
        status: 404,
      };
    }

    // 参数错误 (400)
    if (errorMessage.includes("不能为空") || errorMessage.includes("无效")) {
      return {
        code: "INVALID_REQUEST",
        message: `${errorMessage}。请提供有效的工具名称`,
        status: 400,
      };
    }

    // 配置错误 (422)
    if (errorMessage.includes("配置") || errorMessage.includes("权限")) {
      return {
        code: "CONFIGURATION_ERROR",
        message: `${errorMessage}。请检查配置文件权限和格式是否正确`,
        status: 422,
      };
    }

    // 系统错误 (500)
    return {
      code: "REMOVE_CUSTOM_TOOL_ERROR",
      message: `删除工具失败：${errorMessage}。请稍后重试，如问题持续存在请联系管理员`,
      status: 500,
    };
  }

  /**
   * 判断是否为数据验证错误
   * @private
   */
  private isValidationError(errorMessage: string): boolean {
    const validationKeywords = [
      "不能为空",
      "必须是",
      "格式无效",
      "过长",
      "过短",
      "验证失败",
      "无效",
      "不符合",
      "超过",
      "少于",
      "敏感词",
      "时间",
      "URL",
    ];

    return validationKeywords.some((keyword) => errorMessage.includes(keyword));
  }

  /**
   * 格式化验证错误信息
   * @private
   */
  private formatValidationError(errorMessage: string): string {
    // 为常见的验证错误提供更友好的提示
    const errorMappings: Record<string, string> = {
      工作流ID不能为空: "请提供有效的工作流ID",
      工作流名称不能为空: "请提供有效的工作流名称",
      应用ID不能为空: "请提供有效的应用ID",
      工作流ID格式无效: "工作流ID应为数字格式，请检查工作流配置",
      应用ID格式无效: "应用ID只能包含字母、数字、下划线和连字符",
      工作流名称过长: "工作流名称不能超过100个字符，请缩短名称",
      工作流描述过长: "工作流描述不能超过500个字符，请缩短描述",
      图标URL格式无效: "请提供有效的图标URL地址",
      更新时间不能早于创建时间: "工作流的时间信息有误，请检查工作流数据",
      敏感词: "工作流名称包含敏感词汇，请修改后重试",
    };

    // 查找匹配的错误映射
    for (const [key, value] of Object.entries(errorMappings)) {
      if (errorMessage.includes(key)) {
        return value;
      }
    }

    return errorMessage;
  }
}
