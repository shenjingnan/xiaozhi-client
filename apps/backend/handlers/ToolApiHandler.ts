/**
 * 工具调用 API 处理器
 * 处理通过 HTTP API 调用 MCP 工具的请求
 */

import { MCPCacheManager } from "@/lib/mcp";
import type { MCPServiceManager } from "@/lib/mcp";
import type { JSONSchema } from "@/lib/mcp/types.js";
import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import type {
  CozeWorkflow,
  WorkflowParameterConfig,
} from "@root/types/coze.js";
import type {
  AddCustomToolRequest,
  AddToolResponse,
  CozeWorkflowData,
  MCPToolData,
} from "@root/types/toolApi.js";
import { ToolType } from "@root/types/toolApi.js";
import { configManager } from "@xiaozhi-client/config";
import type { CustomMCPTool, ProxyHandlerConfig } from "@xiaozhi-client/config";
import Ajv from "ajv";
import dayjs from "dayjs";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * 工具调用请求接口
 */
interface ToolCallRequest {
  serviceName: string;
  toolName: string;
  args: Record<string, unknown>;
}

/**
 * 工具调用响应接口
 */
interface ToolCallResponse {
  success: boolean;
  data?: unknown | CustomMCPTool[] | { list: CustomMCPTool[]; total: number };
  error?: {
    code: string;
    message: string;
  };
  message?: string;
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
 * 工具调用 API 处理器
 */
export class ToolApiHandler {
  private logger: Logger;
  private ajv: Ajv;

  constructor() {
    this.logger = logger;
    this.ajv = new Ajv({ allErrors: true, verbose: true });
  }

  /**
   * 创建成功响应
   */
  private createSuccessResponse(
    data: unknown,
    message?: string
  ): ToolCallResponse {
    return {
      success: true,
      data,
      message,
    };
  }

  /**
   * 创建错误响应
   */
  private createErrorResponse(code: string, message: string): ToolCallResponse {
    return {
      success: false,
      error: {
        code,
        message,
      },
    };
  }

  /**
   * 确保 HTTP 状态码是有效的
   */
  private ensureValidStatusCode(code: number): number {
    // 确保状态码是有效的 HTTP 状态码
    if (code >= 100 && code < 600) {
      return code;
    }
    // 默认返回 500
    return 500;
  }

  /**
   * 创建 Hono 响应，正确处理状态码类型
   */
  private createHonoResponse(
    c: Context,
    data: ToolCallResponse,
    statusCode: number
  ): Response {
    return c.json(data, statusCode as ContentfulStatusCode);
  }

  /**
   * 调用 MCP 工具
   * POST /api/tools/call
   */
  async callTool(c: Context): Promise<Response> {
    try {
      this.logger.info("处理工具调用请求");

      // 解析请求体
      const requestBody: ToolCallRequest = await c.req.json();
      const { serviceName, toolName, args } = requestBody;

      // 验证请求参数
      if (!serviceName || !toolName) {
        const errorResponse = this.createErrorResponse(
          "INVALID_REQUEST",
          "serviceName 和 toolName 是必需的参数"
        );
        return c.json(errorResponse, 400);
      }

      this.logger.info(
        `准备调用工具: ${serviceName}/${toolName}，参数:`,
        JSON.stringify(args)
      );

      // 从 Context 中获取 MCPServiceManager 实例
      const serviceManager = c.get("mcpServiceManager");
      if (!serviceManager) {
        const errorResponse = this.createErrorResponse(
          "SERVICE_NOT_INITIALIZED",
          "MCP 服务管理器未初始化。请检查服务状态。"
        );
        return c.json(errorResponse, 503);
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

      // this.logger.debug(`工具调用成功: ${serviceName}/${toolName}`);

      return c.json(this.createSuccessResponse(result, "工具调用成功"));
    } catch (error) {
      this.logger.error("工具调用失败:", error);

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

      const errorResponse = this.createErrorResponse(errorCode, errorMessage);
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取自定义 MCP 工具列表
   * GET /api/tools/custom
   */
  async getCustomTools(c: Context): Promise<Response> {
    try {
      this.logger.info("处理获取自定义 MCP 工具列表请求");

      // 检查配置文件是否存在
      if (!configManager.configExists()) {
        const errorResponse = this.createErrorResponse(
          "CONFIG_NOT_FOUND",
          "配置文件不存在，请先运行 'xiaozhi init' 初始化配置"
        );
        return c.json(errorResponse, 404);
      }

      // 获取自定义 MCP 工具列表
      let customTools: CustomMCPTool[] = [];
      let configPath = "";

      try {
        customTools = configManager.getCustomMCPTools();
        configPath = configManager.getConfigPath();
      } catch (error) {
        this.logger.error("读取自定义 MCP 工具配置失败:", error);
        const errorResponse = this.createErrorResponse(
          "CONFIG_PARSE_ERROR",
          `配置文件解析失败: ${error instanceof Error ? error.message : "未知错误"}`
        );
        return c.json(errorResponse, 500);
      }

      // 检查是否配置了自定义 MCP 工具
      if (!customTools || customTools.length === 0) {
        this.logger.info("未配置自定义 MCP 工具");
        return c.json(
          this.createSuccessResponse(
            {
              tools: [],
              totalTools: 0,
              configPath,
            },
            "未配置自定义 MCP 工具"
          )
        );
      }

      // 验证工具配置的有效性
      const isValid = configManager.validateCustomMCPTools(customTools);
      if (!isValid) {
        this.logger.warn("自定义 MCP 工具配置验证失败");
        const errorResponse = this.createErrorResponse(
          "INVALID_TOOL_CONFIG",
          "自定义 MCP 工具配置验证失败，请检查配置文件中的工具定义"
        );
        return c.json(errorResponse, 400);
      }

      this.logger.info(
        `获取自定义 MCP 工具列表成功，共 ${customTools.length} 个工具`
      );

      return c.json(
        this.createSuccessResponse(
          {
            tools: customTools,
            totalTools: customTools.length,
            configPath,
          },
          "获取自定义 MCP 工具列表成功"
        )
      );
    } catch (error) {
      this.logger.error("获取自定义 MCP 工具列表失败:", error);

      const errorResponse = this.createErrorResponse(
        "GET_CUSTOM_TOOLS_ERROR",
        error instanceof Error ? error.message : "获取自定义 MCP 工具列表失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取可用工具列表
   * GET /api/tools/list?status=enabled|disabled|all
   */
  async listTools(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理获取工具列表请求");

      // 获取筛选参数
      const status =
        (c.req.query("status") as "enabled" | "disabled" | "all") || "all";

      // 从 Context 中获取 MCPServiceManager 实例
      const serviceManager = c.get("mcpServiceManager");
      if (!serviceManager) {
        const errorResponse = this.createErrorResponse(
          "SERVICE_NOT_INITIALIZED",
          "MCP 服务管理器未初始化。请检查服务状态。"
        );
        return c.json(errorResponse, 503);
      }

      const rawTools = serviceManager.getAllTools(status);

      // 转换为 CustomMCPTool 格式
      const tools: CustomMCPTool[] = rawTools.map(
        (tool: {
          name: string;
          description: string;
          inputSchema: JSONSchema;
          serviceName: string;
          originalName: string;
          enabled: boolean;
          usageCount: number;
          lastUsedTime: string;
        }) => ({
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
          usageCount: tool.usageCount,
          lastUsedTime: tool.lastUsedTime,
        })
      );


      // 返回对象格式的响应
      const responseData = {
        list: tools,
        total: tools.length,
      };

      return c.json(
        this.createSuccessResponse(
          responseData,
          `获取工具列表成功（${status}）`
        )
      );
    } catch (error) {
      this.logger.error("获取工具列表失败:", error);

      const errorResponse = this.createErrorResponse(
        "GET_TOOLS_FAILED",
        "获取工具列表失败"
      );
      return c.json(errorResponse, 500);
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
          throw new Error(
            `customMCP 工具 '${toolName}' 不存在。当前没有配置任何 customMCP 工具。请检查 xiaozhi.config.json 中的 customMCP 配置。`
          );
        }

        throw new Error(
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
        throw new Error(
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
        throw new Error(`customMCP 工具 '${toolName}' 不存在`);
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

        throw new Error(errorMessage);
      }

      this.logger.debug(`customMCP 工具 '${toolName}' 参数验证通过`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("参数验证失败")) {
        throw error;
      }

      this.logger.error(`验证 customMCP 工具 '${toolName}' 参数时出错:`, error);
      throw new Error(
        `参数验证过程中发生错误: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  /**
   * 添加自定义 MCP 工具
   * POST /api/tools/custom
   * 支持多种工具类型：MCP 工具、Coze 工作流等
   */
  async addCustomTool(c: Context): Promise<Response> {
    try {
      this.logger.info("处理添加自定义工具请求");

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
      this.logger.error("添加自定义工具失败:", error);

      // 根据错误类型返回不同的HTTP状态码和错误信息
      const { statusCode, errorResponse } = this.handleAddToolError(error);
      return this.createHonoResponse(
        c,
        errorResponse,
        this.ensureValidStatusCode(statusCode)
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
    c: Context,
    request: AddCustomToolRequest
  ): Promise<Response> {
    const { type, data } = request;

    this.logger.info(`处理新格式工具添加请求，类型: ${type}`);

    // 验证工具类型
    if (!Object.values(ToolType).includes(type)) {
      const errorResponse = this.createErrorResponse(
        "INVALID_TOOL_TYPE",
        `不支持的工具类型: ${type}。支持的类型: ${Object.values(ToolType).join(", ")}`
      );
      return c.json(errorResponse, 400);
    }

    // 根据工具类型分发处理
    switch (type) {
      case ToolType.MCP:
        return await this.handleAddMCPTool(c, data as MCPToolData);

      case ToolType.COZE:
        return await this.handleAddCozeTool(c, data as CozeWorkflowData);

      case ToolType.HTTP:
      case ToolType.FUNCTION: {
        const httpErrorResponse = this.createErrorResponse(
          "TOOL_TYPE_NOT_IMPLEMENTED",
          `工具类型 ${type} 暂未实现，请使用 MCP 或 Coze 类型`
        );
        return c.json(httpErrorResponse, 501);
      }

      default: {
        const defaultErrorResponse = this.createErrorResponse(
          "UNKNOWN_TOOL_TYPE",
          `未知的工具类型: ${type}`
        );
        return c.json(defaultErrorResponse, 400);
      }
    }
  }

  /**
   * 处理旧格式的添加工具请求（向后兼容）
   */
  private async handleLegacyFormatAddTool(
    c: Context,
    request: LegacyAddCustomToolRequest
  ): Promise<Response> {
    this.logger.info("处理旧格式工具添加请求（向后兼容）");

    const { workflow, customName, customDescription, parameterConfig } =
      request;

    // 边界条件预检查
    const preCheckResult = this.performPreChecks(
      workflow,
      customName,
      customDescription
    );
    if (preCheckResult) {
      return this.createHonoResponse(
        c,
        preCheckResult.errorResponse,
        this.ensureValidStatusCode(preCheckResult.statusCode)
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

    this.logger.info(`成功添加自定义工具: ${tool.name}`);

    return c.json(
      this.createSuccessResponse({ tool }, `工具 "${tool.name}" 添加成功`)
    );
  }

  /**
   * 处理添加 MCP 工具
   */
  private async handleAddMCPTool(
    c: Context,
    data: MCPToolData
  ): Promise<Response> {
    const { serviceName, toolName, customName, customDescription } = data;

    this.logger.info(`处理添加 MCP 工具: ${serviceName}/${toolName}`);

    // 验证必需字段
    if (!serviceName || !toolName) {
      const errorResponse = this.createErrorResponse(
        "MISSING_REQUIRED_FIELD",
        "serviceName 和 toolName 是必需字段"
      );
      return c.json(errorResponse, 400);
    }

    // 从 Context 中获取 MCPServiceManager 实例
    const serviceManager = c.get("mcpServiceManager");
    if (!serviceManager) {
      const errorResponse = this.createErrorResponse(
        "SERVICE_NOT_INITIALIZED",
        "MCP 服务管理器未初始化。请检查服务状态。"
      );
      return c.json(errorResponse, 503);
    }

    // 验证服务和工具是否存在
    try {
      await this.validateServiceAndTool(serviceManager, serviceName, toolName);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorResponse = this.createErrorResponse(
        "SERVICE_OR_TOOL_NOT_FOUND",
        errorMessage
      );
      return c.json(errorResponse, 404);
    }

    // 从缓存中获取工具信息
    const cacheManager = new MCPCacheManager();
    const cachedTools = await cacheManager.getAllCachedTools();

    // 查找对应的工具
    const fullToolName = `${serviceName}__${toolName}`;
    const cachedTool = cachedTools.find((tool) => tool.name === fullToolName);

    if (!cachedTool) {
      const errorResponse = this.createErrorResponse(
        "TOOL_NOT_FOUND",
        `在缓存中未找到工具: ${serviceName}/${toolName}`
      );
      return c.json(errorResponse, 404);
    }

    // 生成工具名称
    const finalToolName = customName || fullToolName;

    // 检查工具名称是否已存在
    const existingTools = configManager.getCustomMCPTools();
    const existingNames = new Set(existingTools.map((tool) => tool.name));

    if (existingNames.has(finalToolName)) {
      const errorResponse = this.createErrorResponse(
        "TOOL_NAME_CONFLICT",
        `工具名称 "${finalToolName}" 已存在，请使用不同的自定义名称`
      );
      return c.json(errorResponse, 409);
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
    this.logger.info(
      `检测到 MCP 工具添加，同步启用 mcpServerConfig 中的工具: ${serviceName}/${toolName}`
    );

    // 获取当前的服务工具配置
    const serverToolsConfig = configManager.getServerToolsConfig(serviceName);

    if (serverToolsConfig?.toolName) {
      // 更新配置，启用该工具
      serverToolsConfig[toolName].enable = true;

      // 保存更新后的配置
      configManager.updateServerToolsConfig(serviceName, serverToolsConfig);

      this.logger.info(
        `已同步启用 mcpServerConfig 中的工具: ${serviceName}/${toolName}`
      );
    }

    this.logger.info(`成功添加 MCP 工具: ${finalToolName}`);

    const responseData: AddToolResponse = {
      tool,
      toolName: finalToolName,
      toolType: ToolType.MCP,
      addedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    };

    return c.json(
      this.createSuccessResponse(
        responseData,
        `MCP 工具 "${finalToolName}" 添加成功`
      )
    );
  }

  /**
   * 处理添加 Coze 工具
   */
  private async handleAddCozeTool(
    c: Context,
    data: CozeWorkflowData
  ): Promise<Response> {
    const { workflow, customName, customDescription, parameterConfig } = data;

    this.logger.info(`处理添加 Coze 工具: ${workflow.workflow_name}`);

    // 边界条件预检查
    const preCheckResult = this.performPreChecks(
      workflow,
      customName,
      customDescription
    );
    if (preCheckResult) {
      return this.createHonoResponse(
        c,
        preCheckResult.errorResponse,
        this.ensureValidStatusCode(preCheckResult.statusCode)
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

    this.logger.info(`成功添加 Coze 工具: ${tool.name}`);

    const responseData: AddToolResponse = {
      tool,
      toolName: tool.name,
      toolType: ToolType.COZE,
      addedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    };

    return c.json(
      this.createSuccessResponse(
        responseData,
        `Coze 工具 "${tool.name}" 添加成功`
      )
    );
  }

  /**
   * 更新自定义 MCP 工具配置
   * PUT /api/tools/custom/:toolName
   */
  async updateCustomTool(c: Context): Promise<Response> {
    try {
      const toolName = c.req.param("toolName");

      if (!toolName) {
        const errorResponse = this.createErrorResponse(
          "INVALID_REQUEST",
          "工具名称不能为空"
        );
        return c.json(errorResponse, 400);
      }

      this.logger.info(`处理更新自定义工具配置请求: ${toolName}`);

      const requestBody = await c.req.json();

      // 验证请求体
      if (!requestBody || typeof requestBody !== "object") {
        const errorResponse = this.createErrorResponse(
          "INVALID_REQUEST",
          "请求体必须是有效对象"
        );
        return c.json(errorResponse, 400);
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
      const errorResponse = this.createErrorResponse(
        "INVALID_REQUEST",
        "更新操作只支持新格式的请求"
      );
      return c.json(errorResponse, 400);
    } catch (error) {
      this.logger.error("更新自定义工具配置失败:", error);

      // 根据错误类型返回不同的HTTP状态码和错误信息
      const { statusCode, errorResponse } = this.handleUpdateToolError(error);
      return this.createHonoResponse(
        c,
        errorResponse,
        this.ensureValidStatusCode(statusCode)
      );
    }
  }

  /**
   * 处理新格式的更新工具请求
   */
  private async handleNewFormatUpdateTool(
    c: Context,
    toolName: string,
    request: AddCustomToolRequest
  ): Promise<Response> {
    const { type, data } = request;

    this.logger.info(`处理新格式工具更新请求，类型: ${type}`);

    // 验证工具类型
    if (!Object.values(ToolType).includes(type)) {
      const errorResponse = this.createErrorResponse(
        "INVALID_TOOL_TYPE",
        `不支持的工具类型: ${type}。支持的类型: ${Object.values(ToolType).join(", ")}`
      );
      return c.json(errorResponse, 400);
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
        const errorResponse = this.createErrorResponse(
          "TOOL_TYPE_NOT_IMPLEMENTED",
          `工具类型 ${type} 暂不支持更新操作，目前仅支持 Coze 类型`
        );
        return c.json(errorResponse, 501);
      }

      default: {
        const errorResponse = this.createErrorResponse(
          "UNKNOWN_TOOL_TYPE",
          `未知的工具类型: ${type}`
        );
        return c.json(errorResponse, 400);
      }
    }
  }

  /**
   * 处理更新 Coze 工具
   */
  private async handleUpdateCozeTool(
    c: Context,
    toolName: string,
    data: CozeWorkflowData
  ): Promise<Response> {
    const { workflow, customName, customDescription, parameterConfig } = data;

    this.logger.info(`处理更新 Coze 工具: ${toolName}`);

    // 验证工具是否存在
    const existingTools = configManager.getCustomMCPTools();
    const existingTool = existingTools.find((tool) => tool.name === toolName);

    if (!existingTool) {
      const errorResponse = this.createErrorResponse(
        "TOOL_NOT_FOUND",
        `工具 "${toolName}" 不存在`
      );
      return c.json(errorResponse, 404);
    }

    // 验证是否为 Coze 工具
    if (
      existingTool.handler.type !== "proxy" ||
      existingTool.handler.platform !== "coze"
    ) {
      const errorResponse = this.createErrorResponse(
        "INVALID_TOOL_TYPE",
        `工具 "${toolName}" 不是 Coze 工作流工具，不支持参数配置更新`
      );
      return c.json(errorResponse, 400);
    }

    // 如果前端提供的 workflow 中没有 workflow_id，尝试从现有工具中获取
    if (!workflow.workflow_id && existingTool.handler?.config?.workflow_id) {
      workflow.workflow_id = existingTool.handler.config.workflow_id;
    }

    // 如果还没有 workflow_id，尝试从其他字段获取
    if (!workflow.workflow_id && workflow.app_id) {
      // 对于某些场景，app_id 可以作为替代标识
      // 但我们仍然需要 workflow_id 用于 Coze API 调用
      this.logger.warn(
        `工作流 ${toolName} 缺少 workflow_id，这可能会影响某些功能`
      );
    }

    // 验证工作流数据完整性
    this.validateWorkflowUpdateData(workflow);

    // 更新工具的 inputSchema
    const updatedInputSchema = this.generateInputSchema(
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

    this.logger.info(`成功更新 Coze 工具: ${toolName}`);

    const responseData = {
      tool: updatedTool,
      toolName: toolName,
      toolType: ToolType.COZE,
      updatedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    };

    return c.json(
      this.createSuccessResponse(
        responseData,
        `Coze 工具 "${toolName}" 配置更新成功`
      )
    );
  }

  /**
   * 处理更新工具时的错误
   */
  private handleUpdateToolError(error: unknown): {
    statusCode: number;
    errorResponse: ToolCallResponse;
  } {
    const errorMessage =
      error instanceof Error ? error.message : "更新自定义工具配置失败";

    // 工具不存在错误 (404)
    if (errorMessage.includes("不存在") || errorMessage.includes("未找到")) {
      return {
        statusCode: 404,
        errorResponse: this.createErrorResponse(
          "TOOL_NOT_FOUND",
          `${errorMessage}。请检查工具名称是否正确`
        ),
      };
    }

    // 工具类型错误 (400)
    if (
      errorMessage.includes("工具类型") ||
      errorMessage.includes("INVALID_TOOL_TYPE")
    ) {
      return {
        statusCode: 400,
        errorResponse: this.createErrorResponse(
          "INVALID_TOOL_TYPE",
          errorMessage
        ),
      };
    }

    // 参数错误 (400)
    if (errorMessage.includes("不能为空") || errorMessage.includes("无效")) {
      return {
        statusCode: 400,
        errorResponse: this.createErrorResponse(
          "INVALID_REQUEST",
          `${errorMessage}。请提供有效的工具配置数据`
        ),
      };
    }

    // 配置错误 (422)
    if (errorMessage.includes("配置") || errorMessage.includes("权限")) {
      return {
        statusCode: 422,
        errorResponse: this.createErrorResponse(
          "CONFIGURATION_ERROR",
          `${errorMessage}。请检查配置文件权限和格式是否正确`
        ),
      };
    }

    // 未实现功能错误 (501)
    if (
      errorMessage.includes("未实现") ||
      errorMessage.includes("NOT_IMPLEMENTED")
    ) {
      return {
        statusCode: 501,
        errorResponse: this.createErrorResponse(
          "TOOL_TYPE_NOT_IMPLEMENTED",
          errorMessage
        ),
      };
    }

    // 系统错误 (500)
    return {
      statusCode: 500,
      errorResponse: this.createErrorResponse(
        "UPDATE_CUSTOM_TOOL_ERROR",
        `更新工具配置失败：${errorMessage}。请稍后重试，如问题持续存在请联系管理员`
      ),
    };
  }

  /**
   * 删除自定义 MCP 工具
   * DELETE /api/tools/custom/:toolName
   */
  async removeCustomTool(c: Context): Promise<Response> {
    try {
      const toolName = c.req.param("toolName");

      if (!toolName) {
        const errorResponse = this.createErrorResponse(
          "INVALID_REQUEST",
          "工具名称不能为空"
        );
        return c.json(errorResponse, 400);
      }

      this.logger.info(`处理删除自定义工具请求: ${toolName}`);

      // 在删除之前，检查是否为 MCP 工具，如果是则需要在 mcpServerConfig 中同步禁用
      const existingTools = configManager.getCustomMCPTools();
      const toolToDelete = existingTools.find((tool) => tool.name === toolName);

      if (toolToDelete && toolToDelete.handler.type === "mcp") {
        // 这是 MCP 工具，需要在 mcpServerConfig 中同步禁用
        const mcpConfig = toolToDelete.handler.config;
        if (mcpConfig.serviceName && mcpConfig.toolName) {
          this.logger.info(
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

            this.logger.info(
              `已同步禁用 mcpServerConfig 中的工具: ${mcpConfig.serviceName}/${mcpConfig.toolName}`
            );
          }
        }
      }

      // 从配置中删除工具
      configManager.removeCustomMCPTool(toolName);

      this.logger.info(`成功删除自定义工具: ${toolName}`);

      return c.json(
        this.createSuccessResponse(null, `工具 "${toolName}" 删除成功`)
      );
    } catch (error) {
      this.logger.error("删除自定义工具失败:", error);

      // 根据错误类型返回不同的HTTP状态码和错误信息
      const { statusCode, errorResponse } = this.handleRemoveToolError(error);
      return this.createHonoResponse(
        c,
        errorResponse,
        this.ensureValidStatusCode(statusCode)
      );
    }
  }

  /**
   * 将扣子工作流转换为自定义 MCP 工具
   */
  private convertWorkflowToTool(
    workflow: CozeWorkflow,
    customName?: string,
    customDescription?: string,
    parameterConfig?: WorkflowParameterConfig
  ): CustomMCPTool {
    // 验证工作流数据完整性
    this.validateWorkflowData(workflow);

    // 生成工具名称（处理冲突）
    const baseName =
      customName || this.sanitizeToolName(workflow.workflow_name);
    const toolName = this.resolveToolNameConflict(baseName);

    // 生成工具描述
    const description = this.generateToolDescription(
      workflow,
      customDescription
    );

    // 生成输入参数结构
    const inputSchema = this.generateInputSchema(workflow, parameterConfig);

    // 配置 HTTP 处理器
    const handler = this.createHttpHandler(workflow);

    // 创建工具配置
    const tool: CustomMCPTool = {
      name: toolName,
      description,
      inputSchema,
      handler,
    };

    // 验证生成的工具配置
    this.validateGeneratedTool(tool);

    return tool;
  }

  /**
   * 规范化工具名称
   */
  private sanitizeToolName(name: string): string {
    if (!name || typeof name !== "string") {
      return "coze_workflow_unnamed";
    }

    // 去除首尾空格
    let sanitized = name.trim();

    if (!sanitized) {
      return "coze_workflow_empty";
    }

    // 将中文转换为拼音或英文描述（简化处理）
    sanitized = this.convertChineseToEnglish(sanitized);

    // 移除特殊字符，只保留字母、数字和下划线
    sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, "_");

    // 移除连续的下划线
    sanitized = sanitized.replace(/_+/g, "_");

    // 移除开头和结尾的下划线
    sanitized = sanitized.replace(/^_+|_+$/g, "");

    // 确保以字母开头
    if (!/^[a-zA-Z]/.test(sanitized)) {
      sanitized = `coze_workflow_${sanitized}`;
    }

    // 限制长度（保留足够空间给数字后缀）
    if (sanitized.length > 45) {
      sanitized = sanitized.substring(0, 45);
    }

    // 确保不为空
    if (!sanitized) {
      sanitized = "coze_workflow_tool";
    }

    return sanitized;
  }

  /**
   * 简单的中文到英文转换（可以扩展为更复杂的拼音转换）
   */
  private convertChineseToEnglish(text: string): string {
    // 常见中文词汇的映射
    const chineseToEnglishMap: Record<string, string> = {
      工作流: "workflow",
      测试: "test",
      数据: "data",
      处理: "process",
      分析: "analysis",
      生成: "generate",
      查询: "query",
      搜索: "search",
      转换: "convert",
      计算: "calculate",
      统计: "statistics",
      报告: "report",
      文档: "document",
      图片: "image",
      视频: "video",
      音频: "audio",
      文本: "text",
      翻译: "translate",
      识别: "recognize",
      检测: "detect",
      监控: "monitor",
      管理: "manage",
      配置: "config",
      设置: "setting",
      用户: "user",
      系统: "system",
      服务: "service",
      接口: "api",
      数据库: "database",
      网络: "network",
      安全: "security",
      备份: "backup",
      恢复: "restore",
      同步: "sync",
      导入: "import",
      导出: "export",
      上传: "upload",
      下载: "download",
    };

    let result = text;

    // 替换常见中文词汇
    for (const [chinese, english] of Object.entries(chineseToEnglishMap)) {
      result = result.replace(new RegExp(chinese, "g"), english);
    }

    // 如果还有中文字符，用拼音前缀替代
    if (/[\u4e00-\u9fa5]/.test(result)) {
      result = `chinese_${result}`;
    }

    return result;
  }

  /**
   * 验证工作流数据完整性
   */
  private validateWorkflowData(workflow: CozeWorkflow): void {
    if (!workflow) {
      throw new Error("工作流数据不能为空");
    }

    // 验证必需字段
    this.validateRequiredFields(workflow);

    // 验证字段格式
    this.validateFieldFormats(workflow);

    // 验证字段长度
    this.validateFieldLengths(workflow);

    // 验证业务逻辑
    this.validateBusinessLogic(workflow);
  }

  /**
   * 验证工作流更新数据完整性
   * 用于更新场景，只验证关键字段
   */
  private validateWorkflowUpdateData(workflow: Partial<CozeWorkflow>): void {
    if (!workflow) {
      throw new Error("工作流数据不能为空");
    }

    // 对于更新操作，我们采用更灵活的验证策略
    // 因为这可能是参数配置更新，而不是工作流本身更新

    // 如果提供了 workflow_id，验证其格式
    if (workflow.workflow_id) {
      if (
        typeof workflow.workflow_id !== "string" ||
        workflow.workflow_id.trim() === ""
      ) {
        throw new Error("工作流ID必须是非空字符串");
      }

      // 验证工作流ID格式（数字字符串）
      if (!/^\d+$/.test(workflow.workflow_id)) {
        throw new Error("工作流ID格式无效，应为数字字符串");
      }
    }

    // 如果存在 workflow_name，验证其格式
    if (workflow.workflow_name) {
      if (
        typeof workflow.workflow_name !== "string" ||
        workflow.workflow_name.trim() === ""
      ) {
        throw new Error("工作流名称必须是非空字符串");
      }

      // 验证工作流名称长度
      if (workflow.workflow_name.length > 100) {
        throw new Error("工作流名称过长，不能超过100个字符");
      }
    }

    // 如果存在 app_id，验证其格式
    if (workflow.app_id) {
      if (
        typeof workflow.app_id !== "string" ||
        workflow.app_id.trim() === ""
      ) {
        throw new Error("应用ID必须是非空字符串");
      }

      // 验证应用ID格式
      if (!/^[a-zA-Z0-9_-]+$/.test(workflow.app_id)) {
        throw new Error("应用ID格式无效，只能包含字母、数字、下划线和连字符");
      }

      // 验证应用ID长度
      if (workflow.app_id.length > 50) {
        throw new Error("应用ID过长，不能超过50个字符");
      }
    }

    // 对于参数配置更新，workflow_id 可能不是必需的
    // 因为实际的工作流ID已经存储在工具配置中
    // 我们主要验证存在字段的格式，而不是强制要求所有字段都存在
  }

  /**
   * 验证必需字段
   */
  private validateRequiredFields(workflow: CozeWorkflow): void {
    const requiredFields = [
      { field: "workflow_id", name: "工作流ID" },
      { field: "workflow_name", name: "工作流名称" },
      { field: "app_id", name: "应用ID" },
    ];

    for (const { field, name } of requiredFields) {
      const value = workflow[field as keyof CozeWorkflow];
      if (!value || typeof value !== "string" || value.trim() === "") {
        throw new Error(`${name}不能为空且必须是非空字符串`);
      }
    }
  }

  /**
   * 验证字段格式
   */
  private validateFieldFormats(workflow: CozeWorkflow): void {
    // 验证工作流ID格式（数字字符串）
    if (!/^\d+$/.test(workflow.workflow_id)) {
      throw new Error("工作流ID格式无效，应为数字字符串");
    }

    // 验证应用ID格式
    if (!/^[a-zA-Z0-9_-]+$/.test(workflow.app_id)) {
      throw new Error("应用ID格式无效，只能包含字母、数字、下划线和连字符");
    }

    // 验证图标URL格式（如果存在）
    if (workflow.icon_url?.trim()) {
      try {
        new URL(workflow.icon_url);
      } catch {
        throw new Error("图标URL格式无效");
      }
    }

    // 验证时间戳格式
    if (
      workflow.created_at &&
      (!Number.isInteger(workflow.created_at) || workflow.created_at <= 0)
    ) {
      throw new Error("创建时间格式无效，应为正整数时间戳");
    }

    if (
      workflow.updated_at &&
      (!Number.isInteger(workflow.updated_at) || workflow.updated_at <= 0)
    ) {
      throw new Error("更新时间格式无效，应为正整数时间戳");
    }
  }

  /**
   * 验证字段长度
   */
  private validateFieldLengths(workflow: CozeWorkflow): void {
    const lengthLimits = [
      { field: "workflow_name", name: "工作流名称", max: 100 },
      { field: "description", name: "工作流描述", max: 500 },
      { field: "app_id", name: "应用ID", max: 50 },
    ];

    for (const { field, name, max } of lengthLimits) {
      const value = workflow[field as keyof CozeWorkflow] as string;
      if (value && value.length > max) {
        throw new Error(`${name}过长，不能超过${max}个字符`);
      }
    }
  }

  /**
   * 验证业务逻辑
   */
  private validateBusinessLogic(workflow: CozeWorkflow): void {
    // 验证创建者信息
    if (workflow.creator) {
      if (!workflow.creator.id || typeof workflow.creator.id !== "string") {
        throw new Error("创建者ID不能为空且必须是字符串");
      }
      if (!workflow.creator.name || typeof workflow.creator.name !== "string") {
        throw new Error("创建者名称不能为空且必须是字符串");
      }
    }

    // 验证时间逻辑
    if (
      workflow.created_at &&
      workflow.updated_at &&
      workflow.updated_at < workflow.created_at
    ) {
      throw new Error("更新时间不能早于创建时间");
    }

    // 验证工作流名称不能包含敏感词
    const sensitiveWords = [
      "admin",
      "root",
      "system",
      "config",
      "password",
      "token",
    ];
    const lowerName = workflow.workflow_name.toLowerCase();
    for (const word of sensitiveWords) {
      if (lowerName.includes(word)) {
        throw new Error(`工作流名称不能包含敏感词: ${word}`);
      }
    }
  }

  /**
   * 解决工具名称冲突
   */
  private resolveToolNameConflict(baseName: string): string {
    const existingTools = configManager.getCustomMCPTools();
    const existingNames = new Set(existingTools.map((tool) => tool.name));

    let finalName = baseName;
    let counter = 1;

    // 如果名称已存在，添加数字后缀
    while (existingNames.has(finalName)) {
      finalName = `${baseName}_${counter}`;
      counter++;

      // 防止无限循环
      if (counter > 999) {
        throw new Error(`无法为工具生成唯一名称，基础名称: ${baseName}`);
      }
    }

    return finalName;
  }

  /**
   * 生成工具描述
   */
  private generateToolDescription(
    workflow: CozeWorkflow,
    customDescription?: string
  ): string {
    if (customDescription) {
      return customDescription;
    }

    if (workflow.description?.trim()) {
      return workflow.description.trim();
    }

    // 生成默认描述
    return `扣子工作流工具: ${workflow.workflow_name}`;
  }

  /**
   * 创建HTTP处理器配置
   */
  private createHttpHandler(workflow: CozeWorkflow): ProxyHandlerConfig {
    // 验证扣子API配置
    this.validateCozeApiConfig();

    return {
      type: "proxy",
      platform: "coze",
      config: {
        workflow_id: workflow.workflow_id,
      },
    };
  }

  /**
   * 验证扣子API配置
   */
  private validateCozeApiConfig(): void {
    // 检查是否配置了扣子token
    const cozeConfig = configManager.getCozePlatformConfig();
    if (!cozeConfig || !cozeConfig.token) {
      throw new Error(
        "未配置扣子API Token，请先在配置中设置 platforms.coze.token"
      );
    }
  }

  /**
   * 验证生成的工具配置
   */
  private validateGeneratedTool(tool: CustomMCPTool): void {
    // 基础结构验证
    this.validateToolStructure(tool);

    // 使用configManager的验证方法
    if (!configManager.validateCustomMCPTools([tool])) {
      throw new Error("生成的工具配置验证失败，请检查工具定义");
    }

    // JSON Schema验证
    this.validateJsonSchema(tool.inputSchema);

    // HTTP处理器验证
    if (tool.handler) {
      this.validateProxyHandler(tool.handler as ProxyHandlerConfig);
    }
  }

  /**
   * 验证工具基础结构
   */
  private validateToolStructure(tool: CustomMCPTool): void {
    if (!tool || typeof tool !== "object") {
      throw new Error("工具配置必须是有效对象");
    }

    // 验证必需字段
    const requiredFields = ["name", "description", "inputSchema", "handler"];
    for (const field of requiredFields) {
      if (!(field in tool) || tool[field as keyof CustomMCPTool] == null) {
        throw new Error(`工具配置缺少必需字段: ${field}`);
      }
    }

    // 验证字段类型
    if (typeof tool.name !== "string" || tool.name.trim() === "") {
      throw new Error("工具名称必须是非空字符串");
    }

    if (
      typeof tool.description !== "string" ||
      tool.description.trim() === ""
    ) {
      throw new Error("工具描述必须是非空字符串");
    }

    if (typeof tool.inputSchema !== "object") {
      throw new Error("输入参数结构必须是对象");
    }

    if (typeof tool.handler !== "object") {
      throw new Error("处理器配置必须是对象");
    }
  }

  /**
   * 验证HTTP处理器配置
   */
  private validateProxyHandler(handler: ProxyHandlerConfig): void {
    if (!handler || typeof handler !== "object") {
      throw new Error("HTTP处理器配置不能为空");
    }

    // 验证处理器类型
    if (handler.type !== "proxy") {
      throw new Error("处理器类型必须是'proxy'");
    }

    if (handler.platform === "coze") {
      if (!handler.config.workflow_id) {
        throw new Error("Coze处理器必须包含有效的workflow_id");
      }
    } else {
      throw new Error("不支持的工作流平台");
    }
  }

  /**
   * 验证认证配置
   */
  private validateAuthConfig(auth: { type: string; token?: string }): void {
    if (!auth || typeof auth !== "object") {
      throw new Error("认证配置必须是对象");
    }

    if (!auth.type || typeof auth.type !== "string") {
      throw new Error("认证类型不能为空");
    }

    const validAuthTypes = ["bearer", "basic", "api_key"];
    if (!validAuthTypes.includes(auth.type)) {
      throw new Error(`认证类型必须是以下之一: ${validAuthTypes.join(", ")}`);
    }

    // 验证token格式
    if (auth.type === "bearer") {
      if (!auth.token || typeof auth.token !== "string") {
        throw new Error("Bearer认证必须包含有效的token");
      }

      // 验证token格式（应该是环境变量引用或实际token）
      if (
        !auth.token.startsWith("${") &&
        !auth.token.match(/^[a-zA-Z0-9_-]+$/)
      ) {
        throw new Error("Bearer token格式无效");
      }
    }
  }

  /**
   * 验证请求体模板
   */
  private validateBodyTemplate(bodyTemplate: string): void {
    if (typeof bodyTemplate !== "string") {
      throw new Error("请求体模板必须是字符串");
    }

    try {
      JSON.parse(bodyTemplate);
    } catch {
      throw new Error("请求体模板必须是有效的JSON格式");
    }

    // 验证模板变量格式
    const templateVars = bodyTemplate.match(/\{\{[^}]+\}\}/g);
    if (templateVars) {
      for (const templateVar of templateVars) {
        const varName = templateVar.slice(2, -2).trim();
        if (!varName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
          throw new Error(`模板变量格式无效: ${templateVar}`);
        }
      }
    }
  }

  /**
   * 验证JSON Schema格式
   */
  private validateJsonSchema(schema: JSONSchema): void {
    if (!schema || typeof schema !== "object") {
      throw new Error("输入参数结构必须是有效的对象");
    }

    if (!schema.type || schema.type !== "object") {
      throw new Error("输入参数结构的type必须是'object'");
    }

    if (!schema.properties || typeof schema.properties !== "object") {
      throw new Error("输入参数结构必须包含properties字段");
    }

    // 验证required字段
    if (schema.required && !Array.isArray(schema.required)) {
      throw new Error("输入参数结构的required字段必须是数组");
    }
  }

  /**
   * 生成输入参数结构
   */
  private generateInputSchema(
    workflow: CozeWorkflow,
    parameterConfig?: WorkflowParameterConfig
  ): JSONSchema {
    // 如果提供了参数配置，使用参数配置生成schema
    if (parameterConfig && parameterConfig.parameters.length > 0) {
      return this.generateInputSchemaFromConfig(parameterConfig);
    }

    // 否则使用默认的基础参数结构
    const baseSchema = {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "输入内容",
        },
      },
      required: ["input"],
      additionalProperties: false,
    };

    return baseSchema;
  }

  /**
   * 根据参数配置生成输入参数结构
   */
  private generateInputSchemaFromConfig(
    parameterConfig: WorkflowParameterConfig
  ): JSONSchema {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const param of parameterConfig.parameters) {
      properties[param.fieldName] = {
        type: param.type,
        description: param.description,
      };

      if (param.required) {
        required.push(param.fieldName);
      }
    }

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: false,
    };
  }

  /**
   * 处理添加工具时的错误
   */
  private handleAddToolError(error: unknown): {
    statusCode: number;
    errorResponse: ToolCallResponse;
  } {
    const errorMessage =
      error instanceof Error ? error.message : "添加自定义工具失败";

    // 工具类型错误 (400)
    if (
      errorMessage.includes("工具类型") ||
      errorMessage.includes("TOOL_TYPE")
    ) {
      return {
        statusCode: 400,
        errorResponse: this.createErrorResponse(
          "INVALID_TOOL_TYPE",
          errorMessage
        ),
      };
    }

    // 缺少必需字段错误 (400)
    if (
      errorMessage.includes("必需字段") ||
      errorMessage.includes("MISSING_REQUIRED_FIELD")
    ) {
      return {
        statusCode: 400,
        errorResponse: this.createErrorResponse(
          "MISSING_REQUIRED_FIELD",
          errorMessage
        ),
      };
    }

    // 工具或服务不存在错误 (404)
    if (
      errorMessage.includes("不存在") ||
      errorMessage.includes("NOT_FOUND") ||
      errorMessage.includes("未找到")
    ) {
      return {
        statusCode: 404,
        errorResponse: this.createErrorResponse(
          "SERVICE_OR_TOOL_NOT_FOUND",
          errorMessage
        ),
      };
    }

    // 服务未初始化错误 (503)
    if (
      errorMessage.includes("未初始化") ||
      errorMessage.includes("SERVICE_NOT_INITIALIZED")
    ) {
      return {
        statusCode: 503,
        errorResponse: this.createErrorResponse(
          "SERVICE_NOT_INITIALIZED",
          errorMessage
        ),
      };
    }

    // 工具名称冲突错误 (409)
    if (
      errorMessage.includes("已存在") ||
      errorMessage.includes("冲突") ||
      errorMessage.includes("TOOL_NAME_CONFLICT")
    ) {
      return {
        statusCode: 409,
        errorResponse: this.createErrorResponse(
          "TOOL_NAME_CONFLICT",
          `${errorMessage}。建议：1) 使用自定义名称；2) 删除现有同名工具后重试`
        ),
      };
    }

    // 数据验证错误 (400)
    if (this.isValidationError(errorMessage)) {
      return {
        statusCode: 400,
        errorResponse: this.createErrorResponse(
          "VALIDATION_ERROR",
          this.formatValidationError(errorMessage)
        ),
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
        statusCode: 422,
        errorResponse: this.createErrorResponse(
          "CONFIGURATION_ERROR",
          `${errorMessage}。请检查：1) 相关配置是否正确；2) 网络连接是否正常；3) 配置文件权限是否正确`
        ),
      };
    }

    // 资源限制错误 (429)
    if (
      errorMessage.includes("资源限制") ||
      errorMessage.includes("RESOURCE_LIMIT_EXCEEDED")
    ) {
      return {
        statusCode: 429,
        errorResponse: this.createErrorResponse(
          "RESOURCE_LIMIT_EXCEEDED",
          errorMessage
        ),
      };
    }

    // 未实现功能错误 (501)
    if (
      errorMessage.includes("未实现") ||
      errorMessage.includes("NOT_IMPLEMENTED")
    ) {
      return {
        statusCode: 501,
        errorResponse: this.createErrorResponse(
          "TOOL_TYPE_NOT_IMPLEMENTED",
          errorMessage
        ),
      };
    }

    // 系统错误 (500)
    return {
      statusCode: 500,
      errorResponse: this.createErrorResponse(
        "ADD_CUSTOM_TOOL_ERROR",
        `添加工具失败：${errorMessage}。请稍后重试，如问题持续存在请联系管理员`
      ),
    };
  }

  /**
   * 处理删除工具时的错误
   */
  private handleRemoveToolError(error: unknown): {
    statusCode: number;
    errorResponse: ToolCallResponse;
  } {
    const errorMessage =
      error instanceof Error ? error.message : "删除自定义工具失败";

    // 工具不存在错误 (404)
    if (errorMessage.includes("不存在") || errorMessage.includes("未找到")) {
      return {
        statusCode: 404,
        errorResponse: this.createErrorResponse(
          "TOOL_NOT_FOUND",
          `${errorMessage}。请检查工具名称是否正确，或刷新页面查看最新的工具列表`
        ),
      };
    }

    // 参数错误 (400)
    if (errorMessage.includes("不能为空") || errorMessage.includes("无效")) {
      return {
        statusCode: 400,
        errorResponse: this.createErrorResponse(
          "INVALID_REQUEST",
          `${errorMessage}。请提供有效的工具名称`
        ),
      };
    }

    // 配置错误 (422)
    if (errorMessage.includes("配置") || errorMessage.includes("权限")) {
      return {
        statusCode: 422,
        errorResponse: this.createErrorResponse(
          "CONFIGURATION_ERROR",
          `${errorMessage}。请检查配置文件权限和格式是否正确`
        ),
      };
    }

    // 系统错误 (500)
    return {
      statusCode: 500,
      errorResponse: this.createErrorResponse(
        "REMOVE_CUSTOM_TOOL_ERROR",
        `删除工具失败：${errorMessage}。请稍后重试，如问题持续存在请联系管理员`
      ),
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
   * 执行边界条件预检查
   */
  private performPreChecks(
    workflow: unknown,
    customName?: string,
    customDescription?: string
  ): { statusCode: number; errorResponse: ToolCallResponse } | null {
    // 检查基础参数
    const basicCheckResult = this.checkBasicParameters(
      workflow,
      customName,
      customDescription
    );
    if (basicCheckResult) return basicCheckResult;

    // 检查系统状态
    const systemCheckResult = this.checkSystemStatus();
    if (systemCheckResult) return systemCheckResult;

    // 检查资源限制
    const resourceCheckResult = this.checkResourceLimits();
    if (resourceCheckResult) return resourceCheckResult;

    return null; // 所有检查通过
  }

  /**
   * 检查基础参数
   */
  private checkBasicParameters(
    workflow: unknown,
    customName?: string,
    customDescription?: string
  ): { statusCode: number; errorResponse: ToolCallResponse } | null {
    // 检查workflow参数
    if (!workflow) {
      return {
        statusCode: 400,
        errorResponse: this.createErrorResponse(
          "INVALID_REQUEST",
          "请求体中缺少 workflow 参数"
        ),
      };
    }

    if (typeof workflow !== "object") {
      return {
        statusCode: 400,
        errorResponse: this.createErrorResponse(
          "INVALID_REQUEST",
          "workflow 参数必须是对象类型"
        ),
      };
    }

    // 类型守卫：确保 workflow 不是数组
    if (!Array.isArray(workflow)) {
      const workflowObj = workflow as Record<string, unknown>;

      // 检查必需字段
      if (
        !workflowObj.workflow_id ||
        typeof workflowObj.workflow_id !== "string" ||
        !workflowObj.workflow_id.trim()
      ) {
        return {
          statusCode: 400,
          errorResponse: this.createErrorResponse(
            "INVALID_REQUEST",
            "workflow_id 不能为空且必须是非空字符串"
          ),
        };
      }

      if (
        !workflowObj.workflow_name ||
        typeof workflowObj.workflow_name !== "string" ||
        !workflowObj.workflow_name.trim()
      ) {
        return {
          statusCode: 400,
          errorResponse: this.createErrorResponse(
            "INVALID_REQUEST",
            "workflow_name 不能为空且必须是非空字符串"
          ),
        };
      }
    }

    // 检查自定义参数
    if (customName !== undefined) {
      if (typeof customName !== "string") {
        return {
          statusCode: 400,
          errorResponse: this.createErrorResponse(
            "INVALID_REQUEST",
            "customName 必须是字符串类型"
          ),
        };
      }

      if (customName.trim() === "") {
        return {
          statusCode: 400,
          errorResponse: this.createErrorResponse(
            "INVALID_REQUEST",
            "customName 不能为空字符串"
          ),
        };
      }

      if (customName.length > 50) {
        return {
          statusCode: 400,
          errorResponse: this.createErrorResponse(
            "INVALID_REQUEST",
            "customName 长度不能超过50个字符"
          ),
        };
      }
    }

    if (customDescription !== undefined) {
      if (typeof customDescription !== "string") {
        return {
          statusCode: 400,
          errorResponse: this.createErrorResponse(
            "INVALID_REQUEST",
            "customDescription 必须是字符串类型"
          ),
        };
      }

      if (customDescription.length > 200) {
        return {
          statusCode: 400,
          errorResponse: this.createErrorResponse(
            "INVALID_REQUEST",
            "customDescription 长度不能超过200个字符"
          ),
        };
      }
    }

    return null;
  }

  /**
   * 检查系统状态
   */
  private checkSystemStatus(): {
    statusCode: number;
    errorResponse: ToolCallResponse;
  } | null {
    // 检查扣子API配置
    try {
      const cozeConfig = configManager.getCozePlatformConfig();
      if (!cozeConfig || !cozeConfig.token) {
        return {
          statusCode: 422,
          errorResponse: this.createErrorResponse(
            "CONFIGURATION_ERROR",
            "未配置扣子API Token。请在系统设置中配置 platforms.coze.token"
          ),
        };
      }

      // 检查token格式
      if (
        typeof cozeConfig.token !== "string" ||
        cozeConfig.token.trim() === ""
      ) {
        return {
          statusCode: 422,
          errorResponse: this.createErrorResponse(
            "CONFIGURATION_ERROR",
            "扣子API Token格式无效。请检查配置中的 platforms.coze.token"
          ),
        };
      }
    } catch (error) {
      return {
        statusCode: 500,
        errorResponse: this.createErrorResponse(
          "SYSTEM_ERROR",
          "系统配置检查失败，请稍后重试"
        ),
      };
    }

    return null;
  }

  /**
   * 检查资源限制
   */
  private checkResourceLimits(): {
    statusCode: number;
    errorResponse: ToolCallResponse;
  } | null {
    try {
      // 检查现有工具数量限制
      const existingTools = configManager.getCustomMCPTools();
      const maxTools = 100; // 设置最大工具数量限制

      if (existingTools.length >= maxTools) {
        return {
          statusCode: 429,
          errorResponse: this.createErrorResponse(
            "RESOURCE_LIMIT_EXCEEDED",
            `已达到最大工具数量限制 (${maxTools})。请删除一些不需要的工具后重试`
          ),
        };
      }

      // 检查配置文件大小（简单估算）
      const configSizeEstimate = JSON.stringify(existingTools).length;
      const maxConfigSize = 1024 * 1024; // 1MB限制

      if (configSizeEstimate > maxConfigSize) {
        return {
          statusCode: 413,
          errorResponse: this.createErrorResponse(
            "PAYLOAD_TOO_LARGE",
            "配置文件过大。请删除一些不需要的工具以释放空间"
          ),
        };
      }
    } catch (error) {
      // 资源检查失败不应阻止操作，只记录警告
      this.logger.warn("资源限制检查失败:", error);
    }

    return null;
  }

  /**
   * 统一的 MCP 工具管理接口
   * POST /api/tools/mcp/manage
   * 支持 action: enable | disable | status | toggle
   */
  async manageMCPTool(c: Context): Promise<Response> {
    try {
      const requestBody = await c.req.json();
      const { action, serverName, toolName, description } = requestBody;

      // 验证 action 参数
      if (!action || typeof action !== "string") {
        const errorResponse = this.createErrorResponse(
          "INVALID_REQUEST",
          "action 参数不能为空且必须是字符串"
        );
        return c.json(errorResponse, 400);
      }

      const validActions = ["enable", "disable", "status", "toggle"];
      if (!validActions.includes(action)) {
        const errorResponse = this.createErrorResponse(
          "INVALID_ACTION",
          `无效的 action: ${action}。支持的 action: ${validActions.join(", ")}`
        );
        return c.json(errorResponse, 400);
      }

      // 验证服务名和工具名
      this.validateToolIdentifier(serverName, toolName);

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
          const errorResponse = this.createErrorResponse(
            "INVALID_ACTION",
            `未实现的 action: ${action}`
          );
          return c.json(errorResponse, 400);
        }
      }
    } catch (error) {
      this.logger.error("管理 MCP 工具失败:", error);
      const errorMessage =
        error instanceof Error ? error.message : "管理 MCP 工具失败";
      const errorResponse = this.createErrorResponse(
        "TOOL_MANAGE_ERROR",
        errorMessage
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取服务工具列表
   * POST /api/tools/mcp/list
   */
  async listMCPTools(c: Context): Promise<Response> {
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
      this.logger.error("获取工具列表失败:", error);
      const errorResponse = this.createErrorResponse(
        "GET_TOOL_LIST_ERROR",
        error instanceof Error ? error.message : "获取工具列表失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 处理启用工具
   */
  private async handleEnableTool(
    c: Context,
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

    this.logger.info(`工具已启用: ${serverName}/${toolName}`);

    return c.json(
      this.createSuccessResponse(
        {
          serverName,
          toolName,
          enabled: true,
          description: toolConfig?.description || description || "",
        },
        `工具 "${serverName}__${toolName}" 启用成功`
      )
    );
  }

  /**
   * 处理禁用工具
   */
  private async handleDisableTool(
    c: Context,
    serverName: string,
    toolName: string
  ): Promise<Response> {
    // 验证服务存在性
    await this.validateServiceAndToolExistence(serverName, toolName);

    // 设置工具为禁用状态
    configManager.setToolEnabled(serverName, toolName, false);

    this.logger.info(`工具已禁用: ${serverName}/${toolName}`);

    return c.json(
      this.createSuccessResponse(
        {
          serverName,
          toolName,
          enabled: false,
        },
        `工具 "${serverName}__${toolName}" 禁用成功`
      )
    );
  }

  /**
   * 处理获取工具状态
   */
  private async handleGetToolStatus(
    c: Context,
    serverName: string,
    toolName: string
  ): Promise<Response> {
    // 获取工具配置
    const toolsConfig = configManager.getServerToolsConfig(serverName);
    const toolConfig = toolsConfig[toolName];

    if (!toolConfig) {
      const errorResponse = this.createErrorResponse(
        "TOOL_NOT_FOUND",
        `工具 "${serverName}__${toolName}" 不存在或未配置`
      );
      return c.json(errorResponse, 404);
    }

    return c.json(
      this.createSuccessResponse(
        {
          serverName,
          toolName,
          enabled: toolConfig.enable !== false,
          description: toolConfig.description || "",
          usageCount: toolConfig.usageCount,
          lastUsedTime: toolConfig.lastUsedTime,
        },
        "工具状态获取成功"
      )
    );
  }

  /**
   * 处理切换工具状态
   */
  private async handleToggleTool(
    c: Context,
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

    this.logger.info(
      `工具状态已切换: ${serverName}/${toolName} -> ${newEnabled}`
    );

    return c.json(
      this.createSuccessResponse(
        {
          serverName,
          toolName,
          enabled: newEnabled,
        },
        `工具 "${serverName}__${toolName}" 已${newEnabled ? "启用" : "禁用"}`
      )
    );
  }

  /**
   * 处理获取指定服务的工具列表
   */
  private async handleListServerTools(
    c: Context,
    serverName: string,
    includeUsageStats?: boolean
  ): Promise<Response> {
    // 检查服务是否存在
    const mcpServers = configManager.getMcpServers();
    if (!mcpServers[serverName]) {
      const errorResponse = this.createErrorResponse(
        "SERVICE_NOT_FOUND",
        `MCP 服务 "${serverName}" 不存在`
      );
      return c.json(errorResponse, 404);
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

    return c.json(
      this.createSuccessResponse(
        {
          serverName,
          tools,
          total: tools.length,
          enabledCount,
          disabledCount,
        },
        "获取工具列表成功"
      )
    );
  }

  /**
   * 处理获取所有服务的工具列表
   */
  private async handleListAllTools(
    c: Context,
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

    return c.json(this.createSuccessResponse(result, "获取所有工具列表成功"));
  }

  /**
   * 验证工具标识符
   */
  private validateToolIdentifier(serverName: string, toolName: string): void {
    if (
      !serverName ||
      typeof serverName !== "string" ||
      serverName.trim() === ""
    ) {
      throw new Error("服务名称不能为空");
    }

    if (!toolName || typeof toolName !== "string" || toolName.trim() === "") {
      throw new Error("工具名称不能为空");
    }

    // 验证服务名称格式
    if (!/^[a-zA-Z0-9_-]+$/.test(serverName)) {
      throw new Error("服务名称格式无效，只能包含字母、数字、下划线和连字符");
    }

    // 验证工具名称格式
    if (!/^[a-zA-Z0-9_-]+$/.test(toolName)) {
      throw new Error("工具名称格式无效，只能包含字母、数字、下划线和连字符");
    }
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
      throw new Error(`MCP 服务 "${serverName}" 不存在`);
    }

    // 检查工具是否在服务中存在
    const toolsConfig = configManager.getServerToolsConfig(serverName);
    if (!toolsConfig[toolName]) {
      throw new Error(
        `工具 "${toolName}" 在服务 "${serverName}" 中不存在或未配置`
      );
    }
  }
}
