/**
 * Coze 工具转换服务
 * 负责 Coze 工作流与 MCP 工具之间的转换逻辑
 */

import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { JSONSchema, ProxyHandlerConfig } from "@/types/toolApi.js";
import { configManager } from "@xiaozhi-client/config";
import type { CustomMCPTool } from "@xiaozhi-client/config";

/**
 * 工具转换选项
 */
export interface ToolConversionOptions {
  /** 自定义工具名称 */
  customName?: string;
  /** 自定义工具描述 */
  customDescription?: string;
  /** 参数配置 */
  parameterConfig?: WorkflowParameterConfig;
}

/**
 * Coze 工具转换服务
 */
export class CozeToolService {
  /**
   * 将 Coze 工作流转换为 MCP 工具
   */
  convertWorkflowToTool(
    workflow: CozeWorkflow,
    options?: ToolConversionOptions
  ): CustomMCPTool {
    const { customName, customDescription, parameterConfig } = options || {};

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
   * 规范化工具名称
   */
  sanitizeToolName(name: string): string {
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
   * 创建 HTTP 处理器配置
   */
  private createHttpHandler(workflow: CozeWorkflow): ProxyHandlerConfig {
    // 验证扣子 API 配置
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
   * 验证扣子 API 配置
   */
  private validateCozeApiConfig(): void {
    // 检查是否配置了扣子 token
    const cozeConfig = configManager.getCozePlatformConfig();
    if (!cozeConfig || !cozeConfig.token) {
      throw MCPError.configError(
        MCPErrorCode.INVALID_CONFIG,
        "未配置扣子 API Token，请先在配置中设置 platforms.coze.token"
      );
    }
  }

  /**
   * 验证生成的工具配置
   */
  private validateGeneratedTool(tool: CustomMCPTool): void {
    // 基础结构验证
    this.validateToolStructure(tool);

    // 使用 configManager 的验证方法
    if (!configManager.validateCustomMCPTools([tool])) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "生成的工具配置验证失败，请检查工具定义"
      );
    }

    // JSON Schema 验证
    this.validateJsonSchema(tool.inputSchema);

    // HTTP 处理器验证
    if (tool.handler) {
      this.validateProxyHandler(tool.handler as ProxyHandlerConfig);
    }
  }

  /**
   * 验证工具基础结构
   */
  private validateToolStructure(tool: CustomMCPTool): void {
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
   * 验证代理处理器配置
   */
  private validateProxyHandler(handler: ProxyHandlerConfig): void {
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
  private validateAuthConfig(auth: {
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
        !auth.token.match(/^[a-zA-Z0-9_-]+$/)
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
  private validateBodyTemplate(bodyTemplate: string): void {
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
   * 验证 JSON Schema 格式
   */
  private validateJsonSchema(schema: JSONSchema): void {
    if (!schema || typeof schema !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "输入参数结构必须是有效的对象"
      );
    }

    if (!schema.type || schema.type !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "输入参数结构的 type 必须是'object'"
      );
    }

    if (!schema.properties || typeof schema.properties !== "object") {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "输入参数结构必须包含 properties 字段"
      );
    }

    // 验证 required 字段
    if (schema.required && !Array.isArray(schema.required)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "输入参数结构的 required 字段必须是数组"
      );
    }
  }

  /**
   * 生成输入参数结构
   */
  generateInputSchema(
    workflow: CozeWorkflow,
    parameterConfig?: WorkflowParameterConfig
  ): JSONSchema {
    // 如果提供了参数配置，使用参数配置生成 schema
    if (parameterConfig && parameterConfig.parameters.length > 0) {
      return this.generateInputSchemaFromConfig(parameterConfig);
    }

    // 否则使用默认的基础参数结构
    const baseSchema: JSONSchema = {
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
    // 验证工作流 ID 格式（数字字符串）
    if (!/^\d+$/.test(workflow.workflow_id)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "工作流ID格式无效，应为数字字符串"
      );
    }

    // 验证应用 ID 格式
    if (!/^[a-zA-Z0-9_-]+$/.test(workflow.app_id)) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "应用ID格式无效，只能包含字母、数字、下划线和连字符"
      );
    }

    // 验证图标 URL 格式（如果存在）
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
}
