/**
 * 工具验证服务
 * 提供工具配置、工作流数据、参数验证等功能
 */

import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { CozeWorkflow } from "@/types/coze.js";
import type { JSONSchema, ProxyHandlerConfig } from "@/types/toolApi.js";
import type { CustomMCPTool } from "@xiaozhi-client/config";

/**
 * 验证正则表达式常量
 */
export const VALIDATION_REGEX = {
  UNDERSCORE_TRIM: /^_+|_+$/g,
  LETTER_START: /^[a-zA-Z]/,
  CHINESE_CHAR: /[\u4e00-\u9fa5]/,
  DIGITS_ONLY: /^\d+$/,
  ALPHANUMERIC_UNDERSCORE: /^[a-zA-Z0-9_-]+$/,
  IDENTIFIER: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
};

/**
 * 工具验证服务
 */
export class ToolValidator {
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

    this.validateRequiredFields(workflow);
    this.validateFieldFormats(workflow);
    this.validateFieldLengths(workflow);
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

    // 对于更新操作，采用更灵活的验证策略
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

      if (!VALIDATION_REGEX.DIGITS_ONLY.test(workflow.workflow_id)) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "工作流ID格式无效，应为数字字符串"
        );
      }
    }

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

      if (workflow.workflow_name.length > 100) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "工作流名称过长，不能超过100个字符"
        );
      }
    }

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

      if (!VALIDATION_REGEX.ALPHANUMERIC_UNDERSCORE.test(workflow.app_id)) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "应用ID格式无效，只能包含字母、数字、下划线和连字符"
        );
      }

      if (workflow.app_id.length > 50) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "应用ID过长，不能超过50个字符"
        );
      }
    }
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
  private validateFieldFormats(workflow: CozeWorkflow): void {
    if (!VALIDATION_REGEX.DIGITS_ONLY.test(workflow.workflow_id)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "工作流ID格式无效，应为数字字符串"
      );
    }

    if (!VALIDATION_REGEX.ALPHANUMERIC_UNDERSCORE.test(workflow.app_id)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "应用ID格式无效，只能包含字母、数字、下划线和连字符"
      );
    }

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
  private validateFieldLengths(workflow: CozeWorkflow): void {
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
  private validateBusinessLogic(workflow: CozeWorkflow): void {
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
   * 验证生成的工具配置
   */
  validateGeneratedTool(tool: CustomMCPTool): void {
    this.validateToolStructure(tool);

    if (tool.handler) {
      this.validateProxyHandler(tool.handler as ProxyHandlerConfig);
    }

    this.validateJsonSchema(tool.inputSchema);
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

    const requiredFields = ["name", "description", "inputSchema", "handler"];
    for (const field of requiredFields) {
      if (!(field in tool) || tool[field as keyof CustomMCPTool] == null) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          `工具配置缺少必需字段: ${field}`
        );
      }
    }

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
   * 验证HTTP处理器配置
   */
  validateProxyHandler(handler: ProxyHandlerConfig): void {
    if (!handler || typeof handler !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "HTTP处理器配置不能为空"
      );
    }

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
          "Coze处理器必须包含有效的workflow_id"
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

    if (auth.type === "bearer") {
      if (!auth.token || typeof auth.token !== "string") {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "Bearer认证必须包含有效的token"
        );
      }

      if (
        !auth.token.startsWith("${") &&
        !VALIDATION_REGEX.ALPHANUMERIC_UNDERSCORE.test(auth.token)
      ) {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "Bearer token格式无效"
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
        "请求体模板必须是有效的JSON格式"
      );
    }

    const templateVars = bodyTemplate.match(/\{\{[^}]+\}\}/g);
    if (templateVars) {
      for (const templateVar of templateVars) {
        const varName = templateVar.slice(2, -2).trim();
        if (!varName || !VALIDATION_REGEX.IDENTIFIER.test(varName)) {
          throw MCPError.validationError(
            MCPErrorCode.TOOL_VALIDATION_FAILED,
            `模板变量格式无效: ${templateVar}`
          );
        }
      }
    }
  }

  /**
   * 验证JSON Schema格式
   */
  validateJsonSchema(schema: JSONSchema): void {
    if (!schema || typeof schema !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "输入参数结构必须是有效的对象"
      );
    }

    if (!schema.type || schema.type !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "输入参数结构的type必须是'object'"
      );
    }

    if (!schema.properties || typeof schema.properties !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "输入参数结构必须包含properties字段"
      );
    }

    if (schema.required && !Array.isArray(schema.required)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "输入参数结构的required字段必须是数组"
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

    if (!VALIDATION_REGEX.ALPHANUMERIC_UNDERSCORE.test(serverName)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "服务名称格式无效，只能包含字母、数字、下划线和连字符"
      );
    }

    if (!VALIDATION_REGEX.ALPHANUMERIC_UNDERSCORE.test(toolName)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "工具名称格式无效，只能包含字母、数字、下划线和连字符"
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

    for (const [key, value] of Object.entries(errorMappings)) {
      if (errorMessage.includes(key)) {
        return value;
      }
    }

    return errorMessage;
  }
}
