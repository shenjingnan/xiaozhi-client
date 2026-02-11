/**
 * 工具管理处理器
 * 负责工具的 CRUD 操作（添加、更新、删除）
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import { MCPCacheManager } from "@/lib/mcp";
import type { MCPServiceManager } from "@/lib/mcp";
import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { AppContext } from "@/types/hono.context.js";
import type {
  AddCustomToolRequest,
  AddToolResponse,
  CozeWorkflowData,
  MCPToolData,
} from "@/types/toolApi.js";
import { ToolType } from "@/types/toolApi.js";
import type { CustomMCPTool, ProxyHandlerConfig } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";
import dayjs from "dayjs";
import type { Context } from "hono";
import type { ToolValidationService } from "./tool-validation.service.js";

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
 * 工具管理处理器类
 * 负责处理工具的添加、更新、删除等管理操作
 */
export class ToolManagementHandler {
  private logger: Logger;
  private validationService: ToolValidationService;

  constructor(validationService: ToolValidationService) {
    this.logger = logger;
    this.validationService = validationService;
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
   * 判断是否为新格式的请求
   * @private
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
   * @private
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
   * @private
   */
  private async handleLegacyFormatAddTool(
    c: Context<AppContext>,
    request: LegacyAddCustomToolRequest
  ): Promise<Response> {
    c.get("logger").info("处理旧格式工具添加请求（向后兼容）");

    const { workflow, customName, customDescription, parameterConfig } =
      request;

    // 边界条件预检查
    const preCheckResult = this.validationService.checkBasicParameters(
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

    // 检查系统状态
    const systemCheckResult = this.validationService.checkSystemStatus();
    if (systemCheckResult) {
      return c.fail(
        systemCheckResult.code,
        systemCheckResult.message,
        undefined,
        systemCheckResult.status
      );
    }

    // 检查资源限制
    const resourceCheckResult = this.validationService.checkResourceLimits();
    if (resourceCheckResult) {
      return c.fail(
        resourceCheckResult.code,
        resourceCheckResult.message,
        undefined,
        resourceCheckResult.status
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
   * @private
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
      await this.validateServiceAndToolForMCP(serviceManager, serviceName, toolName);
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
   * @private
   */
  private async handleAddCozeTool(
    c: Context<AppContext>,
    data: CozeWorkflowData
  ): Promise<Response> {
    const { workflow, customName, customDescription, parameterConfig } = data;

    c.get("logger").info(`处理添加 Coze 工具: ${workflow.workflow_name}`);

    // 边界条件预检查
    const preCheckResult = this.validationService.checkBasicParameters(
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

    // 检查系统状态
    const systemCheckResult = this.validationService.checkSystemStatus();
    if (systemCheckResult) {
      return c.fail(
        systemCheckResult.code,
        systemCheckResult.message,
        undefined,
        systemCheckResult.status
      );
    }

    // 检查资源限制
    const resourceCheckResult = this.validationService.checkResourceLimits();
    if (resourceCheckResult) {
      return c.fail(
        resourceCheckResult.code,
        resourceCheckResult.message,
        undefined,
        resourceCheckResult.status
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
   * 处理新格式的更新工具请求
   * @private
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
   * @private
   */
  private async handleUpdateCozeTool(
    c: Context<AppContext>,
    toolName: string,
    data: CozeWorkflowData
  ): Promise<Response> {
    const { workflow, customDescription, parameterConfig } = data;

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

    // 验证工作流更新数据完整性
    this.validationService.validateWorkflowUpdateData(workflow);

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
   * 将扣子工作流转换为自定义 MCP 工具
   * @private
   */
  private convertWorkflowToTool(
    workflow: CozeWorkflow,
    customName?: string,
    customDescription?: string,
    parameterConfig?: WorkflowParameterConfig
  ): CustomMCPTool {
    // 验证工作流数据完整性
    this.validationService.validateWorkflowData(workflow);

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
    this.validationService.validateGeneratedTool(tool);

    return tool;
  }

  /**
   * 规范化工具名称
   * @private
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
   * @private
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
   * 解决工具名称冲突
   * @private
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
        throw MCPError.operationError(
          MCPErrorCode.OPERATION_FAILED,
          `无法为工具生成唯一名称，基础名称: ${baseName}`
        );
      }
    }

    return finalName;
  }

  /**
   * 生成工具描述
   * @private
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
   * @private
   */
  private createHttpHandler(workflow: CozeWorkflow): ProxyHandlerConfig {
    // 验证扣子API配置
    this.validationService.validateCozeApiConfig();

    return {
      type: "proxy",
      platform: "coze",
      config: {
        workflow_id: workflow.workflow_id,
      },
    };
  }

  /**
   * 生成输入参数结构
   * @private
   */
  private generateInputSchema(
    workflow: CozeWorkflow,
    parameterConfig?: WorkflowParameterConfig
  ): Record<string, unknown> {
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
   * @private
   */
  private generateInputSchemaFromConfig(
    parameterConfig: WorkflowParameterConfig
  ): Record<string, unknown> {
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
   * @private
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
    if (this.validationService.isValidationError(errorMessage)) {
      return {
        code: "VALIDATION_ERROR",
        message: this.validationService.formatValidationError(errorMessage),
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
   * 处理更新工具时的错误
   * @private
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
   * 验证服务和工具是否存在（用于MCP工具）
   * @private
   */
  private async validateServiceAndToolForMCP(
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
            `customMCP 工具 '${toolName}' 不存在。当前没有配置任何 customMCP 工具。`
          );
        }

        throw MCPError.validationError(
          MCPErrorCode.TOOL_NOT_FOUND,
          `customMCP 工具 '${toolName}' 不存在。可用的 customMCP 工具: ${availableTools.join(", ")}`
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
          `customMCP 工具 '${toolName}' 配置验证失败。`
        );
      }

      return;
    }

    // 对于标准 MCP 服务，这里可以添加额外的验证逻辑
    // 目前简化处理，假设服务已经正确初始化
  }
}
