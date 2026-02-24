/**
 * Coze 工作流处理逻辑
 * 提供扣子工作流相关的验证、转换和配置生成功能
 */

import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { JSONSchema } from "@/types/toolApi.js";
import type { ProxyHandlerConfig } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";

/**
 * 中文到英文的映射表
 */
const CHINESE_TO_ENGLISH_MAP: Record<string, string> = {
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

/**
 * 验证错误映射表
 */
const VALIDATION_ERROR_MAPPINGS: Record<string, string> = {
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

/**
 * 验证工作流数据完整性
 * 导出为 validateCozeWorkflowData 以明确用途
 */
export function validateCozeWorkflowData(workflow: CozeWorkflow): void {
  if (!workflow) {
    throw MCPError.validationError(
      MCPErrorCode.TOOL_VALIDATION_FAILED,
      "工作流数据不能为空"
    );
  }

  // 验证必需字段
  validateWorkflowRequiredFields(workflow);

  // 验证字段格式
  validateFieldFormats(workflow);

  // 验证字段长度
  validateFieldLengths(workflow);

  // 验证业务逻辑
  validateBusinessLogic(workflow);
}

/**
 * 验证工作流更新数据完整性
 * 用于更新场景，只验证关键字段
 * 导出为 validateCozeWorkflowUpdateData 以明确用途
 */
export function validateCozeWorkflowUpdateData(
  workflow: Partial<CozeWorkflow>
): void {
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
    if (typeof workflow.app_id !== "string" || workflow.app_id.trim() === "") {
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
 * 验证必需字段（内部函数）
 */
function validateWorkflowRequiredFields(workflow: CozeWorkflow): void {
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
function validateFieldFormats(workflow: CozeWorkflow): void {
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
function validateFieldLengths(workflow: CozeWorkflow): void {
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
function validateBusinessLogic(workflow: CozeWorkflow): void {
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
 * 规范化工具名称
 */
export function sanitizeToolName(name: string): string {
  if (!name || typeof name !== "string") {
    return "coze_workflow_unnamed";
  }

  // 去除首尾空格
  let sanitized = name.trim();

  if (!sanitized) {
    return "coze_workflow_empty";
  }

  // 将中文转换为拼音或英文描述（简化处理）
  sanitized = convertChineseToEnglish(sanitized);

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
 * 简单的中文到英文转换（导出以供使用）
 */
export function convertChineseToEnglish(text: string): string {
  let result = text;

  // 替换常见中文词汇
  for (const [chinese, english] of Object.entries(CHINESE_TO_ENGLISH_MAP)) {
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
 */
export function resolveToolNameConflict(baseName: string): string {
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
 */
export function generateToolDescription(
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
export function createHttpHandler(workflow: CozeWorkflow): ProxyHandlerConfig {
  // 验证扣子API配置
  validateCozeApiConfig();

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
function validateCozeApiConfig(): void {
  // 检查是否配置了扣子token
  const cozeConfig = configManager.getCozePlatformConfig();
  if (!cozeConfig || !cozeConfig.token) {
    throw MCPError.configError(
      MCPErrorCode.INVALID_CONFIG,
      "未配置扣子API Token，请先在配置中设置 platforms.coze.token"
    );
  }
}

/**
 * 生成输入参数结构
 */
export function generateInputSchema(
  workflow: CozeWorkflow,
  parameterConfig?: WorkflowParameterConfig
): JSONSchema {
  // 如果提供了参数配置，使用参数配置生成schema
  if (parameterConfig && parameterConfig.parameters.length > 0) {
    return generateInputSchemaFromConfig(parameterConfig);
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
function generateInputSchemaFromConfig(
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
 * 格式化验证错误信息（Coze 工作流专用）
 */
export function formatCozeValidationError(errorMessage: string): string {
  // 查找匹配的错误映射
  for (const [key, value] of Object.entries(VALIDATION_ERROR_MAPPINGS)) {
    if (errorMessage.includes(key)) {
      return value;
    }
  }

  return errorMessage;
}

/**
 * 判断是否为数据验证错误（Coze 工作流专用）
 */
export function isCozeValidationError(errorMessage: string): boolean {
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
