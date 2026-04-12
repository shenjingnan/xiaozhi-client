/**
 * MCP 工具调用 API 处理器
 * 处理通过 HTTP API 调用 MCP 工具的请求
 *
 * 重构说明：
 * 原文件共 2743 行，职责过多违反单一职责原则。
 * 现已拆分为多个专门的服务：
 * - ToolValidator: 验证逻辑
 * - ToolSchemaGenerator: Schema 生成
 * - ToolErrorHandler: 错误处理
 * - CozeWorkflowConverter: Workflow 转换
 * - ToolPreCheckService: 边界条件预检查
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { HTTP_TIMEOUTS } from "@/constants/timeout.constants.js";
import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import { MCPCacheManager } from "@/lib/mcp";
import type { MCPServiceManager } from "@/lib/mcp";
import type { EnhancedToolInfo } from "@/lib/mcp/types.js";
import {
  CozeWorkflowConverter,
  ToolErrorHandler,
  ToolPreCheckService,
  ToolSchemaGenerator,
  ToolValidator,
} from "@/services/tool/index.js";
import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { AppContext } from "@/types/hono.context.js";
import type {
  AddCustomToolRequest,
  AddToolResponse,
  CozeWorkflowData,
  CustomMCPToolWithStats,
  MCPToolData,
} from "@/types/toolApi.js";
import { ToolType } from "@/types/toolApi.js";
import { type ToolSortField, sortTools } from "@/utils/toolSorters";
import { configManager } from "@xiaozhi-client/config";
import type { CustomMCPTool } from "@xiaozhi-client/config";
import Ajv from "ajv";
import dayjs from "dayjs";
import type { Context } from "hono";

/**
 * 工具调用请求接口
 */
interface ToolCallRequest {
  serviceName: string;
  toolName: string;
  args: Record<string, unknown>;
}

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
 * MCP 工具调用 API 处理器
 */
export class MCPToolHandler {
  private logger: Logger;
  private ajv: Ajv;
  private static readonly TOOL_TYPE_VALUES = Object.values(ToolType);

  // 服务依赖
  private validator: ToolValidator;
  private schemaGenerator: ToolSchemaGenerator;
  private errorHandler: ToolErrorHandler;
  private workflowConverter: CozeWorkflowConverter;
  private preCheckService: ToolPreCheckService;

  constructor() {
    this.logger = logger;
    this.ajv = new Ajv({ allErrors: true, verbose: true });

    // 初始化服务
    this.validator = new ToolValidator();
    this.schemaGenerator = new ToolSchemaGenerator();
    this.errorHandler = new ToolErrorHandler(this.logger);
    this.workflowConverter = new CozeWorkflowConverter();
    this.preCheckService = new ToolPreCheckService(this.logger);
  }

  /**
   * 调用 MCP 工具
   * POST /api/tools/call
   */
  async callTool(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理工具调用请求");

      const requestBody: ToolCallRequest = await c.req.json();
      const { serviceName, toolName, args } = requestBody;

      if (!serviceName || !toolName) {
        return c.fail(
          "INVALID_REQUEST",
          "serviceName 和 toolName 是必需的参数",
          undefined,
          400
        );
      }

      const serviceManager = c.get("mcpServiceManager");
      if (!serviceManager) {
        return c.fail(
          "SERVICE_NOT_INITIALIZED",
          "MCP 服务管理器未初始化。请检查服务状态。",
          undefined,
          503
        );
      }

      await this.validateServiceAndTool(serviceManager, serviceName, toolName);

      if (serviceName === "customMCP") {
        await this.validateCustomMCPArguments(
          serviceManager,
          toolName,
          args || {}
        );
      }

      let result: unknown;
      if (serviceName === "customMCP") {
        result = await serviceManager.callTool(toolName, args || {}, {
          timeout: HTTP_TIMEOUTS.LONG_RUNNING,
        });
      } else {
        const toolKey = `${serviceName}__${toolName}`;
        result = await serviceManager.callTool(toolKey, args || {});
      }

      return c.success(result, "工具调用成功");
    } catch (error) {
      c.get("logger").error("工具调用失败:", error);
      const errorResponse = this.errorHandler.handleToolCallError(error);
      return c.fail(
        errorResponse.code,
        errorResponse.message,
        undefined,
        errorResponse.status
      );
    }
  }

  /**
   * 获取自定义 MCP 工具列表
   * GET /api/tools/custom
   */
  async getCustomTools(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理获取自定义 MCP 工具列表请求");

      if (!configManager.configExists()) {
        return c.fail(
          "CONFIG_NOT_FOUND",
          "配置文件不存在，请先运行 'xiaozhi init' 初始化配置",
          undefined,
          404
        );
      }

      let customTools: CustomMCPTool[] = [];
      let configPath = "";

      try {
        customTools = configManager.getCustomMCPTools();
        configPath = configManager.getConfigPath();
      } catch (error) {
        c.get("logger").error("读取自定义 MCP 工具配置失败:", error);
        return c.fail(
          "CONFIG_PARSE_ERROR",
          `配置文件解析失败: ${error instanceof Error ? error.message : "未知错误"}`,
          undefined,
          500
        );
      }

      if (!customTools || customTools.length === 0) {
        return c.success(
          { tools: [], totalTools: 0, configPath },
          "未配置自定义 MCP 工具"
        );
      }

      const isValid = configManager.validateCustomMCPTools(customTools);
      if (!isValid) {
        return c.fail(
          "INVALID_TOOL_CONFIG",
          "自定义 MCP 工具配置验证失败，请检查配置文件中的工具定义",
          undefined,
          400
        );
      }

      return c.success(
        { tools: customTools, totalTools: customTools.length, configPath },
        "获取自定义 MCP 工具列表成功"
      );
    } catch (error) {
      c.get("logger").error("获取自定义 MCP 工具列表失败:", error);
      return c.fail(
        "GET_CUSTOM_TOOLS_ERROR",
        error instanceof Error ? error.message : "获取自定义 MCP 工具列表失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取可用工具列表
   * GET /api/tools/list?status=enabled|disabled|all&sortBy=name
   */
  async listTools(c: Context<AppContext>): Promise<Response> {
    try {
      const status =
        (c.req.query("status") as "enabled" | "disabled" | "all") || "all";
      const sortByParam = c.req.query("sortBy");
      const validSortFields: ToolSortField[] = [
        "name",
        "enabled",
        "usageCount",
        "lastUsedTime",
      ];
      const sortBy = validSortFields.includes(sortByParam as ToolSortField)
        ? (sortByParam as ToolSortField)
        : "name";

      if (
        sortByParam &&
        !validSortFields.includes(sortByParam as ToolSortField)
      ) {
        return c.fail(
          "INVALID_SORT_FIELD",
          `无效的排序字段: ${sortByParam}。支持的排序字段: ${validSortFields.join(", ")}`,
          undefined,
          400
        );
      }

      const serviceManager = c.get("mcpServiceManager");
      if (!serviceManager) {
        return c.fail(
          "SERVICE_NOT_INITIALIZED",
          "MCP 服务管理器未初始化。请检查服务状态。",
          undefined,
          503
        );
      }

      let rawTools: EnhancedToolInfo[] = serviceManager.getAllTools(status);
      rawTools = sortTools(rawTools, { field: sortBy });

      const tools: CustomMCPToolWithStats[] = rawTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        handler: {
          type: "mcp",
          config: {
            serviceName: tool.serviceName,
            toolName: tool.originalName,
          },
        },
        enabled: tool.enabled,
        usageCount: tool.usageCount,
        lastUsedTime: tool.lastUsedTime,
      }));

      return c.success(
        { list: tools, total: tools.length },
        `获取工具列表成功（${status}）`
      );
    } catch (error) {
      c.get("logger").error("获取工具列表失败:", error);
      return c.fail("GET_TOOLS_FAILED", "获取工具列表失败", undefined, 500);
    }
  }

  /**
   * 添加自定义 MCP 工具
   * POST /api/tools/custom
   */
  async addCustomTool(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理添加自定义工具请求");
      const requestBody = await c.req.json();

      if (this.isNewFormatRequest(requestBody)) {
        return await this.handleNewFormatAddTool(
          c,
          requestBody as AddCustomToolRequest
        );
      }
      return await this.handleLegacyFormatAddTool(
        c,
        requestBody as LegacyAddCustomToolRequest
      );
    } catch (error) {
      c.get("logger").error("添加自定义工具失败:", error);
      const errorResponse = this.errorHandler.handleAddToolError(error);
      return c.fail(
        errorResponse.code,
        errorResponse.message,
        undefined,
        errorResponse.status
      );
    }
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

      if (!requestBody || typeof requestBody !== "object") {
        return c.fail(
          "INVALID_REQUEST",
          "请求体必须是有效对象",
          undefined,
          400
        );
      }

      if (this.isNewFormatRequest(requestBody)) {
        return await this.handleNewFormatUpdateTool(
          c,
          toolName,
          requestBody as AddCustomToolRequest
        );
      }

      return c.fail(
        "INVALID_REQUEST",
        "更新操作只支持新格式的请求",
        undefined,
        400
      );
    } catch (error) {
      c.get("logger").error("更新自定义工具配置失败:", error);
      const errorResponse = this.errorHandler.handleUpdateToolError(error);
      return c.fail(
        errorResponse.code,
        errorResponse.message,
        undefined,
        errorResponse.status
      );
    }
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

      const existingTools = configManager.getCustomMCPTools();
      const toolToDelete = existingTools.find((tool) => tool.name === toolName);

      if (toolToDelete && toolToDelete.handler.type === "mcp") {
        const mcpConfig = toolToDelete.handler.config;
        if (mcpConfig.serviceName && mcpConfig.toolName) {
          const serverToolsConfig = configManager.getServerToolsConfig(
            mcpConfig.serviceName
          );
          if (serverToolsConfig?.[mcpConfig.toolName]) {
            serverToolsConfig[mcpConfig.toolName].enable = false;
            configManager.updateServerToolsConfig(
              mcpConfig.serviceName,
              serverToolsConfig
            );
          }
        }
      }

      configManager.removeCustomMCPTool(toolName);
      return c.success(null, `工具 "${toolName}" 删除成功`);
    } catch (error) {
      c.get("logger").error("删除自定义工具失败:", error);
      const errorResponse = this.errorHandler.handleRemoveToolError(error);
      return c.fail(
        errorResponse.code,
        errorResponse.message,
        undefined,
        errorResponse.status
      );
    }
  }

  /**
   * 统一的 MCP 工具管理接口
   * POST /api/tools/mcp/manage
   */
  async manageMCPTool(c: Context<AppContext>): Promise<Response> {
    try {
      const requestBody = await c.req.json();
      const { action, serverName, toolName, description } = requestBody;

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

      this.validator.validateToolIdentifier(serverName, toolName);

      switch (action) {
        case "enable":
          return this.handleEnableTool(c, serverName, toolName, description);
        case "disable":
          return this.handleDisableTool(c, serverName, toolName);
        case "status":
          return this.handleGetToolStatus(c, serverName, toolName);
        case "toggle":
          return this.handleToggleTool(c, serverName, toolName);
        default:
          return c.fail(
            "INVALID_ACTION",
            `未实现的 action: ${action}`,
            undefined,
            400
          );
      }
    } catch (error) {
      c.get("logger").error("管理 MCP 工具失败:", error);
      return c.fail(
        "TOOL_MANAGE_ERROR",
        error instanceof Error ? error.message : "管理 MCP 工具失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取服务工具列表
   * POST /api/tools/mcp/list
   */
  async listMCPTools(c: Context<AppContext>): Promise<Response> {
    try {
      const requestBody = await c.req.json();
      const { serverName, includeUsageStats } = requestBody;

      if (serverName) {
        return this.handleListServerTools(c, serverName, includeUsageStats);
      }
      return this.handleListAllTools(c, includeUsageStats);
    } catch (error) {
      c.get("logger").error("获取工具列表失败:", error);
      return c.fail(
        "GET_TOOL_LIST_ERROR",
        error instanceof Error ? error.message : "获取工具列表失败",
        undefined,
        500
      );
    }
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 验证服务和工具是否存在
   */
  private async validateServiceAndTool(
    serviceManager: MCPServiceManager,
    serviceName: string,
    toolName: string
  ): Promise<void> {
    if (serviceName === "customMCP") {
      if (!serviceManager.hasCustomMCPTool(toolName)) {
        const availableTools = serviceManager
          .getCustomMCPTools()
          .map((tool) => tool.name);
        if (availableTools.length === 0) {
          throw MCPError.validationError(
            MCPErrorCode.TOOL_NOT_FOUND,
            `customMCP 工具 '${toolName}' 不存在。当前没有配置任何 customMCP 工具。`
          );
        }
        throw MCPError.validationError(
          MCPErrorCode.TOOL_NOT_FOUND,
          `customMCP 工具 '${toolName}' 不存在。可用的 customMCP 工具: ${availableTools.join(", ")}。`
        );
      }
      return;
    }
  }

  /**
   * 验证 customMCP 工具的参数
   */
  private async validateCustomMCPArguments(
    serviceManager: MCPServiceManager,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<void> {
    const customTools = serviceManager.getCustomMCPTools();
    const targetTool = customTools.find((tool) => tool.name === toolName);

    if (!targetTool) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_NOT_FOUND,
        `customMCP 工具 '${toolName}' 不存在`
      );
    }

    if (!targetTool.inputSchema) {
      this.logger.warn(
        `customMCP 工具 '${toolName}' 没有定义 inputSchema，跳过参数验证`
      );
      return;
    }

    const validate = this.ajv.compile(targetTool.inputSchema);
    const valid = validate(args);

    if (!valid) {
      const errors = validate.errors || [];
      const errorMessages = errors.map((error) => {
        const path = error.instancePath || error.schemaPath || "";
        if (error.keyword === "required") {
          return `缺少必需参数: ${error.params?.missingProperty || "未知字段"}`;
        }
        if (error.keyword === "type") {
          return `参数 ${path} 类型错误，期望: ${error.params?.type || "未知类型"}`;
        }
        if (error.keyword === "enum") {
          return `参数 ${path} 值无效，允许的值: ${error.params?.allowedValues?.join(", ") || ""}`;
        }
        return `参数 ${path} ${error.message || "未知错误"}`;
      });
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        `参数验证失败: ${errorMessages.join("; ")}`
      );
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

    if (!MCPToolHandler.TOOL_TYPE_VALUES.includes(type)) {
      return c.fail(
        "INVALID_TOOL_TYPE",
        `不支持的工具类型: ${type}。支持的类型: ${MCPToolHandler.TOOL_TYPE_VALUES.join(", ")}`,
        undefined,
        400
      );
    }

    switch (type) {
      case ToolType.MCP:
        return await this.handleAddMCPTool(c, data as MCPToolData);
      case ToolType.COZE:
        return await this.handleAddCozeTool(c, data as CozeWorkflowData);
      case ToolType.HTTP:
      case ToolType.FUNCTION:
        return c.fail(
          "TOOL_TYPE_NOT_IMPLEMENTED",
          `工具类型 ${type} 暂未实现`,
          undefined,
          501
        );
      default:
        return c.fail(
          "UNKNOWN_TOOL_TYPE",
          `未知的工具类型: ${type}`,
          undefined,
          400
        );
    }
  }

  /**
   * 处理旧格式的添加工具请求（向后兼容）
   */
  private async handleLegacyFormatAddTool(
    c: Context<AppContext>,
    request: LegacyAddCustomToolRequest
  ): Promise<Response> {
    const { workflow, customName, customDescription, parameterConfig } =
      request;

    const preCheckResult = this.preCheckService.performPreChecks(
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

    const tool = this.workflowConverter.convertWorkflowToTool(
      workflow,
      customName,
      customDescription,
      parameterConfig
    );

    configManager.addCustomMCPTool(tool);
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

    if (!serviceName || !toolName) {
      return c.fail(
        "MISSING_REQUIRED_FIELD",
        "serviceName 和 toolName 是必需字段",
        undefined,
        400
      );
    }

    const serviceManager = c.get("mcpServiceManager");
    if (!serviceManager) {
      return c.fail(
        "SERVICE_NOT_INITIALIZED",
        "MCP 服务管理器未初始化",
        undefined,
        503
      );
    }

    try {
      await this.validateServiceAndTool(serviceManager, serviceName, toolName);
    } catch (error) {
      return c.fail(
        "SERVICE_OR_TOOL_NOT_FOUND",
        error instanceof Error ? error.message : String(error),
        undefined,
        404
      );
    }

    const cacheManager = new MCPCacheManager();
    const cachedTools = await cacheManager.getAllCachedTools();
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

    const finalToolName = customName || fullToolName;
    const existingTools = configManager.getCustomMCPTools();
    const existingNames = new Set(existingTools.map((tool) => tool.name));

    if (existingNames.has(finalToolName)) {
      return c.fail(
        "TOOL_NAME_CONFLICT",
        `工具名称 "${finalToolName}" 已存在`,
        undefined,
        409
      );
    }

    const tool: CustomMCPTool = {
      name: finalToolName,
      description:
        customDescription ||
        cachedTool.description ||
        `MCP 工具: ${serviceName}/${toolName}`,
      inputSchema: cachedTool.inputSchema || {},
      handler: { type: "mcp", config: { serviceName, toolName } },
      stats: {
        usageCount: 0,
        lastUsedTime: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      },
    };

    configManager.addCustomMCPTool(tool);

    const serverToolsConfig = configManager.getServerToolsConfig(serviceName);
    if (serverToolsConfig?.[toolName]) {
      serverToolsConfig[toolName].enable = true;
      configManager.updateServerToolsConfig(serviceName, serverToolsConfig);
    }

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

    const preCheckResult = this.preCheckService.performPreChecks(
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

    const tool = this.workflowConverter.convertWorkflowToTool(
      workflow,
      customName,
      customDescription,
      parameterConfig
    );

    configManager.addCustomMCPTool(tool);

    const responseData: AddToolResponse = {
      tool,
      toolName: tool.name,
      toolType: ToolType.COZE,
      addedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    };

    return c.success(responseData, `Coze 工具 "${tool.name}" 添加成功`);
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

    if (!MCPToolHandler.TOOL_TYPE_VALUES.includes(type)) {
      return c.fail(
        "INVALID_TOOL_TYPE",
        `不支持的工具类型: ${type}`,
        undefined,
        400
      );
    }

    switch (type) {
      case ToolType.COZE:
        return await this.handleUpdateCozeTool(
          c,
          toolName,
          data as CozeWorkflowData
        );
      case ToolType.MCP:
      case ToolType.HTTP:
      case ToolType.FUNCTION:
        return c.fail(
          "TOOL_TYPE_NOT_IMPLEMENTED",
          `工具类型 ${type} 暂不支持更新操作`,
          undefined,
          501
        );
      default:
        return c.fail(
          "UNKNOWN_TOOL_TYPE",
          `未知的工具类型: ${type}`,
          undefined,
          400
        );
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
    const { workflow, customDescription, parameterConfig } = data;

    const existingTools = configManager.getCustomMCPTools();
    const existingTool = existingTools.find((tool) => tool.name === toolName);

    if (!existingTool) {
      return c.fail(
        "TOOL_NOT_FOUND",
        `工具 "${toolName}" 不存在`,
        undefined,
        404
      );
    }

    if (
      existingTool.handler.type !== "proxy" ||
      existingTool.handler.platform !== "coze"
    ) {
      return c.fail(
        "INVALID_TOOL_TYPE",
        `工具 "${toolName}" 不是 Coze 工作流工具`,
        undefined,
        400
      );
    }

    if (!workflow.workflow_id && existingTool.handler?.config?.workflow_id) {
      workflow.workflow_id = existingTool.handler.config.workflow_id;
    }

    this.validator.validateWorkflowUpdateData(workflow);

    const updatedInputSchema = this.schemaGenerator.generateInputSchema(
      workflow,
      parameterConfig
    );

    const updatedTool: CustomMCPTool = {
      ...existingTool,
      description: customDescription || existingTool.description,
      inputSchema: updatedInputSchema,
    };

    configManager.updateCustomMCPTool(toolName, updatedTool);

    const responseData = {
      tool: updatedTool,
      toolName,
      toolType: ToolType.COZE,
      updatedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    };

    return c.success(responseData, `Coze 工具 "${toolName}" 配置更新成功`);
  }

  /**
   * 处理启用工具
   */
  private async handleEnableTool(
    c: Context<AppContext>,
    serverName: string,
    toolName: string,
    description?: string
  ): Promise<Response> {
    await this.validateServiceAndToolExistence(serverName, toolName);
    configManager.setToolEnabled(serverName, toolName, true, description);

    const toolsConfig = configManager.getServerToolsConfig(serverName);
    const toolConfig = toolsConfig[toolName];

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
   */
  private async handleDisableTool(
    c: Context<AppContext>,
    serverName: string,
    toolName: string
  ): Promise<Response> {
    await this.validateServiceAndToolExistence(serverName, toolName);
    configManager.setToolEnabled(serverName, toolName, false);
    return c.success(
      { serverName, toolName, enabled: false },
      `工具 "${serverName}__${toolName}" 禁用成功`
    );
  }

  /**
   * 处理获取工具状态
   */
  private async handleGetToolStatus(
    c: Context<AppContext>,
    serverName: string,
    toolName: string
  ): Promise<Response> {
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
   */
  private async handleToggleTool(
    c: Context<AppContext>,
    serverName: string,
    toolName: string
  ): Promise<Response> {
    await this.validateServiceAndToolExistence(serverName, toolName);
    const currentEnabled = configManager.isToolEnabled(serverName, toolName);
    const newEnabled = !currentEnabled;
    configManager.setToolEnabled(serverName, toolName, newEnabled);

    return c.success(
      { serverName, toolName, enabled: newEnabled },
      `工具 "${serverName}__${toolName}" 已${newEnabled ? "启用" : "禁用"}`
    );
  }

  /**
   * 处理获取指定服务的工具列表
   */
  private async handleListServerTools(
    c: Context<AppContext>,
    serverName: string,
    includeUsageStats?: boolean
  ): Promise<Response> {
    const mcpServers = configManager.getMcpServers();
    if (!mcpServers[serverName]) {
      return c.fail(
        "SERVICE_NOT_FOUND",
        `MCP 服务 "${serverName}" 不存在`,
        undefined,
        404
      );
    }

    const toolsConfig = configManager.getServerToolsConfig(serverName);
    const tools = Object.entries(toolsConfig).map(([toolName, toolConfig]) => {
      const result: Record<string, unknown> = {
        toolName,
        enabled: toolConfig.enable !== false,
        description: toolConfig.description || "",
      };

      if (includeUsageStats) {
        result.usageCount = toolConfig.usageCount;
        result.lastUsedTime = toolConfig.lastUsedTime;
      }

      return result;
    });

    const enabledCount = tools.filter((t) => t.enabled).length;

    return c.success(
      {
        serverName,
        tools,
        total: tools.length,
        enabledCount,
        disabledCount: tools.length - enabledCount,
      },
      "获取工具列表成功"
    );
  }

  /**
   * 处理获取所有服务的工具列表
   */
  private async handleListAllTools(
    c: Context<AppContext>,
    includeUsageStats?: boolean
  ): Promise<Response> {
    const mcpServerConfig = configManager.getMcpServerConfig();

    interface ToolInfo {
      toolName: string;
      enabled: boolean;
      description: string;
      usageCount?: number;
      lastUsedTime?: string;
    }

    interface ServerToolsInfo {
      serverName: string;
      tools: ToolInfo[];
      total: number;
      enabledCount: number;
      disabledCount: number;
    }

    interface AllToolsResult {
      servers: ServerToolsInfo[];
      totalTools: number;
      totalEnabled: number;
      totalDisabled: number;
    }

    const result: AllToolsResult = {
      servers: [],
      totalTools: 0,
      totalEnabled: 0,
      totalDisabled: 0,
    };

    for (const [serverName, serverConfig] of Object.entries(mcpServerConfig)) {
      const tools: ToolInfo[] = Object.entries(serverConfig.tools || {}).map(
        ([toolName, toolConfig]) => {
          const toolInfo: ToolInfo = {
            toolName,
            enabled: toolConfig.enable !== false,
            description: toolConfig.description || "",
          };

          if (includeUsageStats) {
            toolInfo.usageCount = toolConfig.usageCount;
            toolInfo.lastUsedTime = toolConfig.lastUsedTime;
          }

          return toolInfo;
        }
      );

      const enabledCount = tools.filter((t) => t.enabled).length;

      result.servers.push({
        serverName,
        tools,
        total: tools.length,
        enabledCount,
        disabledCount: tools.length - enabledCount,
      });

      result.totalTools += tools.length;
      result.totalEnabled += enabledCount;
      result.totalDisabled += tools.length - enabledCount;
    }

    return c.success(result, "获取所有工具列表成功");
  }

  /**
   * 验证服务和工具是否存在
   */
  private async validateServiceAndToolExistence(
    serverName: string,
    toolName: string
  ): Promise<void> {
    const mcpServers = configManager.getMcpServers();
    if (!mcpServers[serverName]) {
      throw MCPError.validationError(
        MCPErrorCode.SERVER_NOT_FOUND,
        `MCP 服务 "${serverName}" 不存在`
      );
    }

    const toolsConfig = configManager.getServerToolsConfig(serverName);
    if (!toolsConfig[toolName]) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_NOT_FOUND,
        `工具 "${toolName}" 在服务 "${serverName}" 中不存在或未配置`
      );
    }
  }
}
