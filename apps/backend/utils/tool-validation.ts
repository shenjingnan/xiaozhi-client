/**
 * 工具验证相关实用函数
 * 提供工具验证、JSON Schema 验证等共享功能
 */

import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { JSONSchema } from "@/types/toolApi.js";
import type { CustomMCPTool, ProxyHandlerConfig } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";

/**
 * 验证生成的工具配置
 */
export function validateGeneratedTool(tool: CustomMCPTool): void {
  // 基础结构验证
  validateToolStructure(tool);

  // 使用configManager的验证方法
  if (!configManager.validateCustomMCPTools([tool])) {
    throw MCPError.validationError(
      MCPErrorCode.TOOL_VALIDATION_FAILED,
      "生成的工具配置验证失败，请检查工具定义"
    );
  }

  // JSON Schema验证
  validateJsonSchema(tool.inputSchema);

  // HTTP处理器验证
  if (tool.handler) {
    validateProxyHandler(tool.handler as ProxyHandlerConfig);
  }
}

/**
 * 验证工具基础结构
 */
function validateToolStructure(tool: CustomMCPTool): void {
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

  if (typeof tool.description !== "string" || tool.description.trim() === "") {
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
export function validateProxyHandler(handler: ProxyHandlerConfig): void {
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
export function validateAuthConfig(auth: {
  type: string;
  token?: string;
}): void {
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
    if (!auth.token.startsWith("${") && !auth.token.match(/^[a-zA-Z0-9_-]+$/)) {
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
export function validateBodyTemplate(bodyTemplate: string): void {
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
export function validateJsonSchema(schema: JSONSchema): void {
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
