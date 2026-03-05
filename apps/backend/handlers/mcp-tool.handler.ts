/**
 * MCP 工具调用 API 处理器
 * 处理通过 HTTP API 调用 MCP 工具的请求
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { HTTP_TIMEOUTS } from "@/constants/timeout.constants.js";
import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import { MCPCacheManager } from "@/lib/mcp";
import type { MCPServiceManager } from "@/lib/mcp";
import type { EnhancedToolInfo } from "@/lib/mcp/types.js";
import { MCPToolService } from "@/services/MCPToolService.js";
import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { AppContext } from "@/types/hono.context.js";
import type {
  AddCustomToolRequest,
  AddToolResponse,
  CozeWorkflowData,
  MCPToolData,
} from "@/types/toolApi.js";
import { ToolType } from "@/types/toolApi.js";
import type { CustomMCPToolWithStats } from "@/types/toolApi.js";
import { type ToolSortField, sortTools } from "@/utils/toolSorters";
import { MCPToolValidator } from "@/validators/MCPToolValidator.js";
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
  private toolService: MCPToolService;
  private validator: MCPToolValidator;

  constructor() {
    this.logger = logger;
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    this.toolService = new MCPToolService();
    this.validator = new MCPToolValidator();
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
        // 对于 customMCP 服务，直接使用 toolName 调用，传递长运行任务超时
        result = await serviceManager.callTool(toolName, args || {}, {
          timeout: HTTP_TIMEOUTS.LONG_RUNNING,
        });
      } else {
        // 对于标准 MCP 服务，使用 serviceName__toolName 格式，保持8秒超时
        const toolKey = `${serviceName}__${toolName}`;
        result = await serviceManager.callTool(toolKey, args || {});
      }

      // c.get("logger").debug(`工具调用成功: ${serviceName}/${toolName}`);

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
   * 获取自定义 MCP 工具列表
   * GET /api/tools/custom
   */
  async getCustomTools(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理获取自定义 MCP 工具列表请求");

      // 检查配置文件是否存在
      if (!configManager.configExists()) {
        return c.fail(
          "CONFIG_NOT_FOUND",
          "配置文件不存在，请先运行 'xiaozhi init' 初始化配置",
          undefined,
          404
        );
      }

      // 获取自定义 MCP 工具列表
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

      // 检查是否配置了自定义 MCP 工具
      if (!customTools || customTools.length === 0) {
        c.get("logger").info("未配置自定义 MCP 工具");
        return c.success(
          {
            tools: [],
            totalTools: 0,
            configPath,
          },
          "未配置自定义 MCP 工具"
        );
      }

      // 验证工具配置的有效性
      const isValid = configManager.validateCustomMCPTools(customTools);
      if (!isValid) {
        c.get("logger").warn("自定义 MCP 工具配置验证失败");
        return c.fail(
          "INVALID_TOOL_CONFIG",
          "自定义 MCP 工具配置验证失败，请检查配置文件中的工具定义",
          undefined,
          400
        );
      }

      c.get("logger").info(
        `获取自定义 MCP 工具列表成功，共 ${customTools.length} 个工具`
      );

      return c.success(
        {
          tools: customTools,
          totalTools: customTools.length,
          configPath,
        },
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
   *
   * @param status 筛选状态：'enabled'（已启用）、'disabled'（未启用）、'all'（全部，默认）
   * @param sortBy 排序字段：'name'（工具名称，默认）、'enabled'（启用状态）、'usageCount'（使用次数）、'lastUsedTime'（最近使用时间）
   */
  async listTools(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取工具列表请求");

      // 获取筛选参数
      const status =
        (c.req.query("status") as "enabled" | "disabled" | "all") || "all";

      // 解析排序参数并验证
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

      // 如果提供了无效的排序字段，返回错误
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

      let rawTools: EnhancedToolInfo[] = serviceManager.getAllTools(status);

      // 应用排序
      rawTools = sortTools(rawTools, { field: sortBy });

      // 转换为 CustomMCPToolWithStats 格式（使用共享类型）
      const tools: CustomMCPToolWithStats[] = rawTools.map(
        (tool: EnhancedToolInfo) => ({
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
        })
      );

      // 返回对象格式的响应
      const responseData = {
        list: tools,
        total: tools.length,
      };

      return c.success(responseData, `获取工具列表成功（${status}）`);
    } catch (error) {
      c.get("logger").error("获取工具列表失败:", error);

      return c.fail("GET_TOOLS_FAILED", "获取工具列表失败", undefined, 500);
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

      // 根据错误类型返回不同的HTTP状态码和错误信息
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
    if (!Object.values(ToolType).includes(type)) {
      return c.fail(
        "INVALID_TOOL_TYPE",
        `不支持的工具类型: ${type}。支持的类型: ${Object.values(ToolType).join(", ")}`,
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
    const preCheckResult = this.toolService.performPreChecks(
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
    const tool = this.toolService.convertWorkflowToTool(
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
    const preCheckResult = this.toolService.performPreChecks(
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
    const tool = this.toolService.convertWorkflowToTool(
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
    if (!Object.values(ToolType).includes(type)) {
      return c.fail(
        "INVALID_TOOL_TYPE",
        `不支持的工具类型: ${type}。支持的类型: ${Object.values(ToolType).join(", ")}`,
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
    const { workflow, customName, customDescription, parameterConfig } = data;

    c.get("logger").info(`处理更新 Coze 工具: ${toolName}`);

    // 验证工具是否存在
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

    // 验证是否为 Coze 工具
    if (
      existingTool.handler.type !== "proxy" ||
      existingTool.handler.platform !== "coze"
    ) {
      return c.fail(
        "INVALID_TOOL_TYPE",
        `工具 "${toolName}" 不是 Coze 工作流工具，不支持参数配置更新`,
        undefined,
        400
      );
    }

    // 如果前端提供的 workflow 中没有 workflow_id，尝试从现有工具中获取
    if (!workflow.workflow_id && existingTool.handler?.config?.workflow_id) {
      workflow.workflow_id = existingTool.handler.config.workflow_id;
    }

    // 如果还没有 workflow_id，尝试从其他字段获取
    if (!workflow.workflow_id && workflow.app_id) {
      // 对于某些场景，app_id 可以作为替代标识
      // 但我们仍然需要 workflow_id 用于 Coze API 调用
      c.get("logger").warn(
        `工作流 ${toolName} 缺少 workflow_id，这可能会影响某些功能`
      );
    }

    // 验证工作流数据完整性
    this.validator.validateWorkflowUpdateData(workflow);

    // 更新工具的 inputSchema
    const updatedInputSchema = this.toolService.generateInputSchema(
      workflow,
      parameterConfig
    );

    // 构建更新后的工具配置
    const updatedTool: CustomMCPTool = {
      ...existingTool,
      description: customDescription || existingTool.description,
      inputSchema: updatedInputSchema,
    };

    // 更新工具配置
    configManager.updateCustomMCPTool(toolName, updatedTool);

    c.get("logger").info(`成功更新 Coze 工具: ${toolName}`);

    const responseData = {
      tool: updatedTool,
      toolName: toolName,
      toolType: ToolType.COZE,
      updatedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    };

    return c.success(responseData, `Coze 工具 "${toolName}" 配置更新成功`);
  }

  /**
   * 处理更新工具时的错误
   */
  private handleUpdateToolError(error: unknown): {
    code: string;
    message: string;
    status: number;
  } {
    const errorMessage =
      error instanceof Error ? error.message : "更新自定义工具配置失败";

    // 工具不存在错误 (404)
    if (errorMessage.includes("不存在") || errorMessage.includes("未找到")) {
      return {
        code: "TOOL_NOT_FOUND",
        message: `${errorMessage}。请检查工具名称是否正确`,
        status: 404,
      };
    }

    // 工具类型错误 (400)
    if (
      errorMessage.includes("工具类型") ||
      errorMessage.includes("INVALID_TOOL_TYPE")
    ) {
      return {
        code: "INVALID_TOOL_TYPE",
        message: errorMessage,
        status: 400,
      };
    }

    // 参数错误 (400)
    if (errorMessage.includes("不能为空") || errorMessage.includes("无效")) {
      return {
        code: "INVALID_REQUEST",
        message: `${errorMessage}。请提供有效的工具配置数据`,
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
      code: "UPDATE_CUSTOM_TOOL_ERROR",
      message: `更新工具配置失败：${errorMessage}。请稍后重试，如问题持续存在请联系管理员`,
      status: 500,
    };
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

      // 在删除之前，检查是否为 MCP 工具，如果是则需要在 mcpServerConfig 中同步禁用
      const existingTools = configManager.getCustomMCPTools();
      const toolToDelete = existingTools.find((tool) => tool.name === toolName);

      if (toolToDelete && toolToDelete.handler.type === "mcp") {
        // 这是 MCP 工具，需要在 mcpServerConfig 中同步禁用
        const mcpConfig = toolToDelete.handler.config;
        if (mcpConfig.serviceName && mcpConfig.toolName) {
          c.get("logger").info(
            `检测到 MCP 工具删除，同步禁用 mcpServerConfig 中的工具: ${mcpConfig.serviceName}/${mcpConfig.toolName}`
          );

          // 获取当前的服务工具配置
          const serverToolsConfig = configManager.getServerToolsConfig(
            mcpConfig.serviceName
          );

          if (serverToolsConfig?.[mcpConfig.toolName]) {
            // 更新配置，禁用该工具
            serverToolsConfig[mcpConfig.toolName].enable = false;

            // 保存更新后的配置
            configManager.updateServerToolsConfig(
              mcpConfig.serviceName,
              serverToolsConfig
            );

            c.get("logger").info(
              `已同步禁用 mcpServerConfig 中的工具: ${mcpConfig.serviceName}/${mcpConfig.toolName}`
            );
          }
        }
      }

      // 从配置中删除工具
      configManager.removeCustomMCPTool(toolName);

      c.get("logger").info(`成功删除自定义工具: ${toolName}`);

      return c.success(null, `工具 "${toolName}" 删除成功`);
    } catch (error) {
      c.get("logger").error("删除自定义工具失败:", error);

      // 根据错误类型返回不同的HTTP状态码和错误信息
      const { code, message, status } = this.handleRemoveToolError(error);
      return c.fail(code, message, undefined, status);
    }
  }

  /**
   * 验证工作流更新数据完整性
   * 使用验证器进行验证
   * @deprecated 使用 this.validator.validateWorkflowUpdateData 代替
   */
  private validateWorkflowUpdateData(workflow: Partial<CozeWorkflow>): void {
    this.validator.validateWorkflowUpdateData(workflow);
  }

  /**
   * 处理添加工具时的错误
   */
  private handleAddToolError(error: unknown): {
    code: string;
    message: string;
    status: number;
  } {
    const errorMessage =
      error instanceof Error ? error.message : "添加自定义工具失败";

    // 工具类型错误 (400)
    if (
      errorMessage.includes("工具类型") ||
      errorMessage.includes("TOOL_TYPE")
    ) {
      return {
        code: "INVALID_TOOL_TYPE",
        message: errorMessage,
        status: 400,
      };
    }

    // 缺少必需字段错误 (400)
    if (
      errorMessage.includes("必需字段") ||
      errorMessage.includes("MISSING_REQUIRED_FIELD")
    ) {
      return {
        code: "MISSING_REQUIRED_FIELD",
        message: errorMessage,
        status: 400,
      };
    }

    // 工具或服务不存在错误 (404)
    if (
      errorMessage.includes("不存在") ||
      errorMessage.includes("NOT_FOUND") ||
      errorMessage.includes("未找到")
    ) {
      return {
        code: "SERVICE_OR_TOOL_NOT_FOUND",
        message: errorMessage,
        status: 404,
      };
    }

    // 服务未初始化错误 (503)
    if (
      errorMessage.includes("未初始化") ||
      errorMessage.includes("SERVICE_NOT_INITIALIZED")
    ) {
      return {
        code: "SERVICE_NOT_INITIALIZED",
        message: errorMessage,
        status: 503,
      };
    }

    // 工具名称冲突错误 (409)
    if (
      errorMessage.includes("已存在") ||
      errorMessage.includes("冲突") ||
      errorMessage.includes("TOOL_NAME_CONFLICT")
    ) {
      return {
        code: "TOOL_NAME_CONFLICT",
        message: `${errorMessage}。建议：1) 使用自定义名称；2) 删除现有同名工具后重试`,
        status: 409,
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
    if (
      errorMessage.includes("配置") ||
      errorMessage.includes("token") ||
      errorMessage.includes("API") ||
      errorMessage.includes("CONFIGURATION_ERROR")
    ) {
      return {
        code: "CONFIGURATION_ERROR",
        message: `${errorMessage}。请检查：1) 相关配置是否正确；2) 网络连接是否正常；3) 配置文件权限是否正确`,
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
   * 处理删除工具时的错误
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
      this.validator.validateToolIdentifier(serverName, toolName);

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
   * 获取服务工具列表
   * POST /api/tools/mcp/list
   */
  async listMCPTools(c: Context<AppContext>): Promise<Response> {
    try {
      const requestBody = await c.req.json();
      const { serverName, includeUsageStats } = requestBody;

      // 如果指定了服务名，获取该服务的工具列表
      if (serverName) {
        return this.handleListServerTools(c, serverName, includeUsageStats);
      }

      // 否则获取所有服务的工具列表
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

  /**
   * 处理启用工具
   */
  private async handleEnableTool(
    c: Context<AppContext>,
    serverName: string,
    toolName: string,
    description?: string
  ): Promise<Response> {
    // 验证服务存在性
    await this.validateServiceAndToolExistence(serverName, toolName);

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
   */
  private async handleDisableTool(
    c: Context<AppContext>,
    serverName: string,
    toolName: string
  ): Promise<Response> {
    // 验证服务存在性
    await this.validateServiceAndToolExistence(serverName, toolName);

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
   */
  private async handleToggleTool(
    c: Context<AppContext>,
    serverName: string,
    toolName: string
  ): Promise<Response> {
    // 验证服务存在性
    await this.validateServiceAndToolExistence(serverName, toolName);

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

  /**
   * 处理获取指定服务的工具列表
   */
  private async handleListServerTools(
    c: Context<AppContext>,
    serverName: string,
    includeUsageStats?: boolean
  ): Promise<Response> {
    // 检查服务是否存在
    const mcpServers = configManager.getMcpServers();
    if (!mcpServers[serverName]) {
      return c.fail(
        "SERVICE_NOT_FOUND",
        `MCP 服务 "${serverName}" 不存在`,
        undefined,
        404
      );
    }

    // 获取工具配置
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
    const disabledCount = tools.length - enabledCount;

    return c.success(
      {
        serverName,
        tools,
        total: tools.length,
        enabledCount,
        disabledCount,
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

    // 定义工具信息接口
    interface ToolInfo {
      toolName: string;
      enabled: boolean;
      description: string;
      usageCount?: number;
      lastUsedTime?: string;
    }

    // 定义服务器工具信息接口
    interface ServerToolsInfo {
      serverName: string;
      tools: ToolInfo[];
      total: number;
      enabledCount: number;
      disabledCount: number;
    }

    // 定义返回结果接口
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
    // 检查服务是否存在
    const mcpServers = configManager.getMcpServers();
    if (!mcpServers[serverName]) {
      throw MCPError.validationError(
        MCPErrorCode.SERVER_NOT_FOUND,
        `MCP 服务 "${serverName}" 不存在`
      );
    }

    // 检查工具是否在服务中存在
    const toolsConfig = configManager.getServerToolsConfig(serverName);
    if (!toolsConfig[toolName]) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_NOT_FOUND,
        `工具 "${toolName}" 在服务 "${serverName}" 中不存在或未配置`
      );
    }
  }
}
