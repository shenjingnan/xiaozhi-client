/**
 * 工具调用 API 处理器
 * 处理通过 HTTP API 调用 MCP 工具的请求
 */

import Ajv from "ajv";
import type { Context } from "hono";
import { type Logger, logger } from "../Logger.js";
import { configManager } from "../configManager.js";
import type { CustomMCPTool, ProxyHandlerConfig } from "../configManager.js";
import { MCPServiceManagerSingleton } from "../services/MCPServiceManagerSingleton.js";
import { MCPCacheManager } from "../services/MCPCacheManager.js";
import type { CozeWorkflow, WorkflowParameterConfig } from "../types/coze.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * 工具调用请求接口
 */
interface ToolCallRequest {
  serviceName: string;
  toolName: string;
  args: any;
}

/**
 * 工具调用响应接口
 */
interface ToolCallResponse {
  success: boolean;
  data?: any | CustomMCPTool[] | { list: CustomMCPTool[]; total: number };
  error?: {
    code: string;
    message: string;
  };
  message?: string;
}

/**
 * 添加自定义工具请求接口
 */
interface AddCustomToolRequest {
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
    this.logger = logger.withTag("ToolApiHandler");
    this.ajv = new Ajv({ allErrors: true, verbose: true });
  }

  /**
   * 创建成功响应
   */
  private createSuccessResponse(data: any, message?: string): ToolCallResponse {
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

      // 检查 MCPServiceManager 是否已初始化
      if (!MCPServiceManagerSingleton.isInitialized()) {
        const errorResponse = this.createErrorResponse(
          "SERVICE_NOT_INITIALIZED",
          "MCP 服务管理器未初始化。请检查服务状态。"
        );
        return c.json(errorResponse, 503);
      }

      // 获取服务管理器实例
      const serviceManager = await MCPServiceManagerSingleton.getInstance();

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
      let result: any;
      if (serviceName === "customMCP") {
        // 对于 customMCP 服务，直接使用 toolName 调用
        result = await serviceManager.callTool(toolName, args || {});
      } else {
        // 对于标准 MCP 服务，使用 serviceName__toolName 格式
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
      let customTools: any[] = [];
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
      this.logger.info("处理获取工具列表请求");

      // 获取筛选参数
      const status =
        (c.req.query("status") as "enabled" | "disabled" | "all") || "all";

      let tools: CustomMCPTool[] = [];

      switch (status) {
        case "enabled":
          // 已启用工具：从 xiaozhi.config.json 的 customMCP.tools 获取
          tools = configManager.getCustomMCPTools();
          this.logger.info(`获取已启用工具，共 ${tools.length} 个`);
          break;

        case "disabled":
          // 未启用工具：从缓存中获取所有工具，过滤掉已启用的
          tools = await this.getDisabledTools();
          this.logger.info(`获取未启用工具，共 ${tools.length} 个`);
          break;

        default:
          // 所有工具：从 xiaozhi.config.json 的 customMCP.tools 获取
          tools = configManager.getCustomMCPTools();
          this.logger.info(`获取所有工具，共 ${tools.length} 个`);
          break;
      }

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
   * 获取未启用工具
   * 从缓存中获取所有工具，过滤掉已启用的工具
   */
  private async getDisabledTools(): Promise<CustomMCPTool[]> {
    try {
      // 1. 获取已启用的工具名称集合
      const enabledTools = configManager.getCustomMCPTools();
      const enabledToolNames = new Set(enabledTools.map((tool) => tool.name));

      // 2. 从缓存中获取所有可用工具
      const cacheManager = new MCPCacheManager();
      const allCachedTools = await cacheManager.getAllCachedTools();

      // 3. 过滤掉已启用的工具，返回未启用的工具
      const disabledTools: CustomMCPTool[] = [];

      for (const cachedTool of allCachedTools) {
        if (!enabledToolNames.has(cachedTool.name)) {
          // 将缓存中的 Tool 格式转换为 CustomMCPTool 格式
          const customTool: CustomMCPTool = {
            name: cachedTool.name,
            description: cachedTool.description || "",
            inputSchema: cachedTool.inputSchema || {},
            handler: {
              type: "mcp",
              config: {
                // 从工具名称中解析服务名称和工具名称
                serviceName: cachedTool.name.split("__")[0],
                toolName: cachedTool.name.split("__").slice(1).join("__"),
              },
            },
          };
          disabledTools.push(customTool);
        }
      }

      this.logger.debug(
        `从 ${allCachedTools.length} 个缓存工具中筛选出 ${disabledTools.length} 个未启用工具`
      );
      return disabledTools;
    } catch (error) {
      this.logger.error("获取未启用工具失败:", error);
      // 如果获取失败，返回空数组而不是抛出错误
      return [];
    }
  }

  /**
   * 验证服务和工具是否存在
   * @private
   */
  private async validateServiceAndTool(
    serviceManager: any,
    serviceName: string,
    toolName: string
  ): Promise<void> {
    // 特殊处理 customMCP 服务
    if (serviceName === "customMCP") {
      // 验证 customMCP 工具是否存在
      if (!serviceManager.hasCustomMCPTool(toolName)) {
        const availableTools = serviceManager
          .getCustomMCPTools()
          .map((tool: any) => tool.name);

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
        const targetTool = customTools.find(
          (tool: any) => tool.name === toolName
        );

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

    // 标准 MCP 服务验证逻辑
    // 检查配置中是否存在该服务
    const mcpServers = configManager.getMcpServers();
    if (!mcpServers[serviceName]) {
      const availableServices = Object.keys(mcpServers);
      throw new Error(
        `服务 '${serviceName}' 不存在。可用服务: ${availableServices.join(", ")}`
      );
    }

    // 检查服务是否已启动并连接
    const serviceInstance = serviceManager.getService(serviceName);
    if (!serviceInstance) {
      throw new Error(
        `服务 '${serviceName}' 未启动。请检查服务配置或重新启动 xiaozhi 服务。`
      );
    }

    if (!serviceInstance.isConnected()) {
      throw new Error(
        `服务 '${serviceName}' 未连接。请检查服务状态或重新启动 xiaozhi 服务。`
      );
    }

    // 检查工具是否存在
    const tools = serviceInstance.getTools();
    const toolExists = tools.some((tool: any) => tool.name === toolName);
    if (!toolExists) {
      const availableTools = tools.map((tool: any) => tool.name);
      throw new Error(
        `工具 '${toolName}' 在服务 '${serviceName}' 中不存在。可用工具: ${availableTools.join(", ")}`
      );
    }

    // 检查工具是否已启用
    const toolsConfig = configManager.getServerToolsConfig(serviceName);
    const toolConfig = toolsConfig[toolName];
    if (toolConfig && !toolConfig.enable) {
      throw new Error(
        `工具 '${toolName}' 已被禁用。请使用 'xiaozhi mcp tool ${serviceName} ${toolName} enable' 启用该工具。`
      );
    }
  }

  /**
   * 验证 customMCP 工具的参数
   * @private
   */
  private async validateCustomMCPArguments(
    serviceManager: any,
    toolName: string,
    args: any
  ): Promise<void> {
    try {
      // 获取工具的 inputSchema
      const customTools = serviceManager.getCustomMCPTools();
      const targetTool = customTools.find(
        (tool: any) => tool.name === toolName
      );

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
   */
  async addCustomTool(c: Context): Promise<Response> {
    try {
      this.logger.info("处理添加自定义工具请求");

      const requestBody: AddCustomToolRequest = await c.req.json();
      const { workflow, customName, customDescription, parameterConfig } =
        requestBody;

      // 边界条件预检查
      const preCheckResult = this.performPreChecks(
        workflow,
        customName,
        customDescription
      );
      if (preCheckResult) {
        return c.json(
          preCheckResult.errorResponse,
          preCheckResult.statusCode as any
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
    } catch (error) {
      this.logger.error("添加自定义工具失败:", error);

      // 根据错误类型返回不同的HTTP状态码和错误信息
      const { statusCode, errorResponse } = this.handleAddToolError(error);
      return c.json(errorResponse, statusCode as any);
    }
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
      return c.json(errorResponse, statusCode as any);
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
    this.validateProxyHandler(tool.handler);
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
  private validateProxyHandler(handler: any): void {
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
  private validateAuthConfig(auth: any): void {
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
  private validateJsonSchema(schema: any): void {
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
  ): any {
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
  ): any {
    const properties: Record<string, any> = {};
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
    errorResponse: any;
  } {
    const errorMessage =
      error instanceof Error ? error.message : "添加自定义工具失败";

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

    // 工具名称冲突错误 (409)
    if (errorMessage.includes("已存在") || errorMessage.includes("冲突")) {
      return {
        statusCode: 409,
        errorResponse: this.createErrorResponse(
          "TOOL_NAME_CONFLICT",
          `${errorMessage}。建议：1) 修改工作流名称；2) 使用自定义名称；3) 删除现有同名工具后重试`
        ),
      };
    }

    // 配置错误 (422)
    if (
      errorMessage.includes("配置") ||
      errorMessage.includes("token") ||
      errorMessage.includes("API")
    ) {
      return {
        statusCode: 422,
        errorResponse: this.createErrorResponse(
          "CONFIGURATION_ERROR",
          `${errorMessage}。请检查：1) 扣子API Token是否正确配置；2) 网络连接是否正常；3) 配置文件权限是否正确`
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
    errorResponse: any;
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
    workflow: any,
    customName?: string,
    customDescription?: string
  ): { statusCode: number; errorResponse: any } | null {
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
    workflow: any,
    customName?: string,
    customDescription?: string
  ): { statusCode: number; errorResponse: any } | null {
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

    // 检查必需字段
    if (
      !workflow.workflow_id ||
      typeof workflow.workflow_id !== "string" ||
      !workflow.workflow_id.trim()
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
      !workflow.workflow_name ||
      typeof workflow.workflow_name !== "string" ||
      !workflow.workflow_name.trim()
    ) {
      return {
        statusCode: 400,
        errorResponse: this.createErrorResponse(
          "INVALID_REQUEST",
          "workflow_name 不能为空且必须是非空字符串"
        ),
      };
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
    errorResponse: any;
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
    errorResponse: any;
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
}
