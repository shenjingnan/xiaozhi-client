/**
 * MCP 工具验证器
 * 负责所有自定义工具的验证逻辑
 */

import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { CozeWorkflow } from "@/types/coze.js";
import type { JSONSchema } from "@/types/toolApi.js";
import type { CustomMCPTool, ProxyHandlerConfig } from "@xiaozhi-client/config";

/**
 * 验证结果接口
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * MCP 工具验证器
 * 负责验证工作流数据、工具配置、认证配置等
 */
export class MCPToolValidator {
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
      if (!/^\d+$/.test(workflow.workflow_id)) {
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
      if (!/^[a-zA-Z0-9_-]+$/.test(workflow.app_id)) {
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
    if (!/^\d+$/.test(workflow.workflow_id)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "工作流ID格式无效，应为数字字符串"
      );
    }

    // 验证应用ID格式
    if (!/^[a-zA-Z0-9_-]+$/.test(workflow.app_id)) {
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
   * 验证HTTP处理器配置
   */
  validateProxyHandler(handler: ProxyHandlerConfig): void {
    if (!handler || typeof handler !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "HTTP处理器配置不能为空"
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

    // 验证token格式
    if (auth.type === "bearer") {
      if (!auth.token || typeof auth.token !== "string") {
        throw MCPError.validationError(
          MCPErrorCode.TOOL_VALIDATION_FAILED,
          "Bearer认证必须包含有效的token"
        );
      }

      // 验证token格式（应该是环境变量引用或实际token）
      if (
        !auth.token.startsWith("${") &&
        !auth.token.match(/^[a-zA-Z0-9_-]+$/)
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

    // 验证模板变量格式
    const templateVars = bodyTemplate.match(/\{\{[^}]+\}\}/g);
    if (templateVars) {
      for (const templateVar of templateVars) {
        const varName = templateVar.slice(2, -2).trim();
        if (!varName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
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

    // 验证required字段
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

    // 验证服务名称格式
    if (!/^[a-zA-Z0-9_-]+$/.test(serverName)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "服务名称格式无效，只能包含字母、数字、下划线和连字符"
      );
    }

    // 验证工具名称格式
    if (!/^[a-zA-Z0-9_-]+$/.test(toolName)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "工具名称格式无效，只能包含字母、数字、下划线和连字符"
      );
    }
  }
}
