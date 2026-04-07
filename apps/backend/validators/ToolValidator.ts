/**
 * 工具验证器
 * 负责验证工具相关的数据和配置
 */

import type { Logger } from "@/Logger.js";
import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { MCPServiceManager } from "@/lib/mcp";
import type { CozeWorkflow } from "@/types/coze.js";
import type { CustomMCPTool, ProxyHandlerConfig } from "@xiaozhi-client/config";
import Ajv from "ajv";

/**
 * 工具验证器类
 */
export class ToolValidator {
  // 预编译的正则表达式常量
  private static readonly DIGITS_ONLY_REGEX = /^\d+$/;
  private static readonly ALPHANUMERIC_UNDERSCORE_REGEX = /^[a-zA-Z0-9_-]+$/;
  private static readonly IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  private logger: Logger;
  private ajv: Ajv;

  constructor(logger: Logger) {
    this.logger = logger;
    this.ajv = new Ajv({ allErrors: true, verbose: true });
  }

  /**
   * 验证服务和工具是否存在
   */
  async validateServiceAndTool(
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
   */
  async validateCustomMCPArguments(
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
   * 验证工作流数据完整性
   */
  validateWorkflowData(workflow: CozeWorkflow): void {
    if (!workflow) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "工作流数据不能为空"
      );
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
  validateWorkflowUpdateData(workflow: Partial<CozeWorkflow>): void {
    if (!workflow) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "工作流数据不能为空"
      );
    }

    // 对于更新操作，我们采用更灵活的验证策略
    // 因为这可能是参数配置更新，而不是工作流本身更新

    // 如果提供了 workflow_id，验证其格式
    if (workflow.workflow_id) {
      if (
        typeof workflow.workflow_id !== "string" ||
        workflow.workflow_id.trim() === ""
      ) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "工作流ID必须是非空字符串"
        );
      }

      // 验证工作流ID格式（数字字符串）
      if (!ToolValidator.DIGITS_ONLY_REGEX.test(workflow.workflow_id)) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "工作流ID格式无效，应为数字字符串"
        );
      }
    }

    // 如果存在 workflow_name，验证其格式
    if (workflow.workflow_name) {
      if (
        typeof workflow.workflow_name !== "string" ||
        workflow.workflow_name.trim() === ""
      ) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "工作流名称必须是非空字符串"
        );
      }

      // 验证工作流名称长度
      if (workflow.workflow_name.length > 100) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "工作流名称过长，不能超过100个字符"
        );
      }
    }

    // 如果存在 app_id，验证其格式
    if (workflow.app_id) {
      if (
        typeof workflow.app_id !== "string" ||
        workflow.app_id.trim() === ""
      ) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "应用ID必须是非空字符串"
        );
      }

      // 验证应用ID格式
      if (!ToolValidator.ALPHANUMERIC_UNDERSCORE_REGEX.test(workflow.app_id)) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "应用ID格式无效，只能包含字母、数字、下划线和连字符"
        );
      }

      // 验证应用ID长度
      if (workflow.app_id.length > 50) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "应用ID过长，不能超过50个字符"
        );
      }
    }

    // 对于参数配置更新，workflow_id 可能不是必需的
    // 因为实际的工作流ID已经存储在工具配置中
    // 我们主要验证存在字段的格式，而不是强制要求所有字段都存在
  }

  /**
   * 验证必需字段
   */
  validateRequiredFields(workflow: CozeWorkflow): void {
    const requiredFields = [
      { field: "workflow_id", name: "工作流ID" },
      { field: "workflow_name", name: "工作流名称" },
      { field: "app_id", name: "应用ID" },
    ];

    for (const { field, name } of requiredFields) {
      const value = workflow[field as keyof CozeWorkflow];
      if (!value || typeof value !== "string" || value.trim() === "") {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          `${name}不能为空且必须是非空字符串`
        );
      }
    }
  }

  /**
   * 验证字段格式
   */
  validateFieldFormats(workflow: CozeWorkflow): void {
    // 验证工作流ID格式（数字字符串）
    if (!ToolValidator.DIGITS_ONLY_REGEX.test(workflow.workflow_id)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "工作流ID格式无效，应为数字字符串"
      );
    }

    // 验证应用ID格式
    if (!ToolValidator.ALPHANUMERIC_UNDERSCORE_REGEX.test(workflow.app_id)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "应用ID格式无效，只能包含字母、数字、下划线和连字符"
      );
    }

    // 验证图标URL格式（如果存在）
    if (workflow.icon_url?.trim()) {
      try {
        new URL(workflow.icon_url);
      } catch {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "图标URL格式无效"
        );
      }
    }

    // 验证时间戳格式
    if (
      workflow.created_at &&
      (!Number.isInteger(workflow.created_at) || workflow.created_at <= 0)
    ) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "创建时间格式无效，应为正整数时间戳"
      );
    }

    if (
      workflow.updated_at &&
      (!Number.isInteger(workflow.updated_at) || workflow.updated_at <= 0)
    ) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "更新时间格式无效，应为正整数时间戳"
      );
    }
  }

  /**
   * 验证字段长度
   */
  validateFieldLengths(workflow: CozeWorkflow): void {
    const lengthLimits = [
      { field: "workflow_name", name: "工作流名称", max: 100 },
      { field: "description", name: "工作流描述", max: 500 },
      { field: "app_id", name: "应用ID", max: 50 },
    ];

    for (const { field, name, max } of lengthLimits) {
      const value = workflow[field as keyof CozeWorkflow] as string;
      if (value && value.length > max) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          `${name}过长，不能超过${max}个字符`
        );
      }
    }
  }

  /**
   * 验证业务逻辑
   */
  validateBusinessLogic(workflow: CozeWorkflow): void {
    // 验证创建者信息
    if (workflow.creator) {
      if (!workflow.creator.id || typeof workflow.creator.id !== "string") {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "创建者ID不能为空且必须是字符串"
        );
      }

      if (!workflow.creator.name || typeof workflow.creator.name !== "string") {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "创建者名称不能为空且必须是字符串"
        );
      }
    }

    // 验证时间逻辑
    if (
      workflow.created_at &&
      workflow.updated_at &&
      workflow.updated_at < workflow.created_at
    ) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "更新时间不能早于创建时间"
      );
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
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          `工作流名称不能包含敏感词: ${word}`
        );
      }
    }
  }

  /**
   * 验证工具基础结构
   */
  validateToolStructure(tool: CustomMCPTool): void {
    if (!tool || typeof tool !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "工具配置必须是有效对象"
      );
    }

    // 验证必需字段
    const requiredFields = ["name", "description", "inputSchema", "handler"];
    for (const field of requiredFields) {
      if (!(field in tool) || tool[field as keyof CustomMCPTool] == null) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          `工具配置缺少必需字段: ${field}`
        );
      }
    }

    // 验证字段类型
    if (typeof tool.name !== "string" || tool.name.trim() === "") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "工具名称必须是非空字符串"
      );
    }

    if (
      typeof tool.description !== "string" ||
      tool.description.trim() === ""
    ) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "工具描述必须是非空字符串"
      );
    }

    if (typeof tool.inputSchema !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "输入参数结构必须是对象"
      );
    }

    if (typeof tool.handler !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "处理器配置必须是对象"
      );
    }
  }

  /**
   * 验证 HTTP 处理器配置
   */
  validateProxyHandler(handler: ProxyHandlerConfig): void {
    if (!handler || typeof handler !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "HTTP 处理器配置不能为空"
      );
    }

    // 验证处理器类型
    if (handler.type !== "proxy") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "处理器类型必须是'proxy'"
      );
    }

    if (handler.platform === "coze") {
      if (!handler.config.workflow_id) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "Coze 处理器必须包含有效的 workflow_id"
        );
      }
    } else {
      throw MCPError.configError(
        MCPErrorCode.INVALID_CONFIG,
        "不支持的工作流平台"
      );
    }
  }

  /**
   * 验证认证配置
   */
  validateAuthConfig(auth: { type: string; token?: string }): void {
    if (!auth || typeof auth !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "认证配置必须是对象"
      );
    }

    if (!auth.type || typeof auth.type !== "string") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "认证类型不能为空"
      );
    }

    const validAuthTypes = ["bearer", "basic", "api_key"];
    if (!validAuthTypes.includes(auth.type)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        `认证类型必须是以下之一: ${validAuthTypes.join(", ")}`
      );
    }

    // 验证 token 格式
    if (auth.type === "bearer") {
      if (!auth.token || typeof auth.token !== "string") {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "Bearer 认证必须包含有效的 token"
        );
      }

      // 验证 token 格式（应该是环境变量引用或实际 token）
      if (
        !auth.token.startsWith("${") &&
        !ToolValidator.ALPHANUMERIC_UNDERSCORE_REGEX.test(auth.token)
      ) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "Bearer token 格式无效"
        );
      }
    }
  }

  /**
   * 验证请求体模板
   */
  validateBodyTemplate(bodyTemplate: string): void {
    if (typeof bodyTemplate !== "string") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "请求体模板必须是字符串"
      );
    }

    try {
      JSON.parse(bodyTemplate);
    } catch {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "请求体模板必须是有效的 JSON 格式"
      );
    }

    // 验证模板变量格式
    const templateVars = bodyTemplate.match(/\{\{[^}]+\}\}/g);
    if (templateVars) {
      for (const templateVar of templateVars) {
        const varName = templateVar.slice(2, -2).trim();
        if (!varName || !ToolValidator.IDENTIFIER_REGEX.test(varName)) {
          throw MCPError.validationError(
            MCPErrorCode.TOOL_VALIDATION_FAILED,
            `模板变量格式无效: ${templateVar}`
          );
        }
      }
    }
  }

  /**
   * 验证 JSON Schema 格式
   */
  validateJsonSchema(schema: unknown): void {
    if (!schema || typeof schema !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "输入参数结构必须是有效的对象"
      );
    }

    const schemaObj = schema as Record<string, unknown>;

    if (!schemaObj.type || schemaObj.type !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "输入参数结构的 type 必须是'object'"
      );
    }

    if (!schemaObj.properties || typeof schemaObj.properties !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "输入参数结构必须包含 properties 字段"
      );
    }

    // 验证 required 字段
    if (schemaObj.required && !Array.isArray(schemaObj.required)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "输入参数结构的 required 字段必须是数组"
      );
    }
  }

  /**
   * 验证工具标识符
   */
  validateToolIdentifier(serverName: string, toolName: string): void {
    if (
      !serverName ||
      typeof serverName !== "string" ||
      serverName.trim() === ""
    ) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "服务名称不能为空"
      );
    }

    if (!toolName || typeof toolName !== "string" || toolName.trim() === "") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "工具名称不能为空"
      );
    }

    // 验证服务名称格式
    if (!ToolValidator.ALPHANUMERIC_UNDERSCORE_REGEX.test(serverName)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "服务名称格式无效，只能包含字母、数字、下划线和连字符"
      );
    }

    // 验证工具名称格式
    if (!ToolValidator.ALPHANUMERIC_UNDERSCORE_REGEX.test(toolName)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "工具名称格式无效，只能包含字母、数字、下划线和连字符"
      );
    }
  }

  /**
   * 验证服务和工具是否存在
   */
  async validateServiceAndToolExistence(
    mcpServers: Record<string, unknown>,
    getServerToolsConfig: (serverName: string) => Record<string, unknown>,
    serverName: string,
    toolName: string
  ): Promise<void> {
    // 检查服务是否存在
    if (!mcpServers[serverName]) {
      throw MCPError.validationError(
        MCPErrorCode.SERVER_NOT_FOUND,
        `MCP 服务 "${serverName}" 不存在`
      );
    }

    // 检查工具是否在服务中存在
    const toolsConfig = getServerToolsConfig(serverName);
    if (!toolsConfig[toolName]) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_NOT_FOUND,
        `工具 "${toolName}" 在服务 "${serverName}" 中不存在或未配置`
      );
    }
  }

  /**
   * 判断是否为数据验证错误
   */
  isValidationError(errorMessage: string): boolean {
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
  formatValidationError(errorMessage: string): string {
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
