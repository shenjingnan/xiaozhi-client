/**
 * MCP 工具服务
 * 负责工具的创建、更新、删除等业务逻辑
 */

import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { JSONSchema } from "@/types/toolApi.js";
import { MCPToolValidator } from "@/validators/MCPToolValidator.js";
import type { CustomMCPTool, ProxyHandlerConfig } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";

/**
 * 基础参数检查结果
 */
interface PreCheckResult {
  code: string;
  message: string;
  status: number;
}

/**
 * MCP 工具服务
 * 负责工具的业务逻辑处理
 */
export class MCPToolService {
  private validator: MCPToolValidator;

  constructor() {
    this.validator = new MCPToolValidator();
  }

  /**
   * 将扣子工作流转换为自定义 MCP 工具
   */
  convertWorkflowToTool(
    workflow: CozeWorkflow,
    customName?: string,
    customDescription?: string,
    parameterConfig?: WorkflowParameterConfig
  ): CustomMCPTool {
    // 验证工作流数据完整性
    this.validator.validateWorkflowData(workflow);

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
      throw MCPError.configError(
        MCPErrorCode.INVALID_CONFIG,
        "未配置扣子API Token，请先在配置中设置 platforms.coze.token"
      );
    }
  }

  /**
   * 验证生成的工具配置
   */
  private validateGeneratedTool(tool: CustomMCPTool): void {
    // 基础结构验证
    this.validator.validateToolStructure(tool);

    // 使用configManager的验证方法
    if (!configManager.validateCustomMCPTools([tool])) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "生成的工具配置验证失败，请检查工具定义"
      );
    }

    // JSON Schema验证
    this.validator.validateJsonSchema(tool.inputSchema);

    // HTTP处理器验证
    if (tool.handler) {
      this.validator.validateProxyHandler(tool.handler as ProxyHandlerConfig);
    }
  }

  /**
   * 生成输入参数结构
   */
  generateInputSchema(
    workflow: CozeWorkflow,
    parameterConfig?: WorkflowParameterConfig
  ): JSONSchema {
    // 如果提供了参数配置，使用参数配置生成schema
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
   * 执行边界条件预检查
   */
  performPreChecks(
    workflow: unknown,
    customName?: string,
    customDescription?: string
  ): PreCheckResult | null {
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
  ): PreCheckResult | null {
    // 检查workflow参数
    if (!workflow) {
      return {
        code: "INVALID_REQUEST",
        message: "请求体中缺少 workflow 参数",
        status: 400,
      };
    }

    if (typeof workflow !== "object") {
      return {
        code: "INVALID_REQUEST",
        message: "workflow 参数必须是对象类型",
        status: 400,
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
          code: "INVALID_REQUEST",
          message: "workflow_id 不能为空且必须是非空字符串",
          status: 400,
        };
      }

      if (
        !workflowObj.workflow_name ||
        typeof workflowObj.workflow_name !== "string" ||
        !workflowObj.workflow_name.trim()
      ) {
        return {
          code: "INVALID_REQUEST",
          message: "workflow_name 不能为空且必须是非空字符串",
          status: 400,
        };
      }
    }

    // 检查自定义参数
    if (customName !== undefined) {
      if (typeof customName !== "string") {
        return {
          code: "INVALID_REQUEST",
          message: "customName 必须是字符串类型",
          status: 400,
        };
      }

      if (customName.trim() === "") {
        return {
          code: "INVALID_REQUEST",
          message: "customName 不能为空字符串",
          status: 400,
        };
      }

      if (customName.length > 50) {
        return {
          code: "INVALID_REQUEST",
          message: "customName 长度不能超过50个字符",
          status: 400,
        };
      }
    }

    if (customDescription !== undefined) {
      if (typeof customDescription !== "string") {
        return {
          code: "INVALID_REQUEST",
          message: "customDescription 必须是字符串类型",
          status: 400,
        };
      }

      if (customDescription.length > 200) {
        return {
          code: "INVALID_REQUEST",
          message: "customDescription 长度不能超过200个字符",
          status: 400,
        };
      }
    }

    return null;
  }

  /**
   * 检查系统状态
   */
  private checkSystemStatus(): PreCheckResult | null {
    // 检查扣子API配置
    try {
      const cozeConfig = configManager.getCozePlatformConfig();
      if (!cozeConfig || !cozeConfig.token) {
        return {
          code: "CONFIGURATION_ERROR",
          message:
            "未配置扣子API Token。请在系统设置中配置 platforms.coze.token",
          status: 422,
        };
      }

      // 检查token格式
      if (
        typeof cozeConfig.token !== "string" ||
        cozeConfig.token.trim() === ""
      ) {
        return {
          code: "CONFIGURATION_ERROR",
          message: "扣子API Token格式无效。请检查配置中的 platforms.coze.token",
          status: 422,
        };
      }
    } catch {
      return {
        code: "SYSTEM_ERROR",
        message: "系统配置检查失败，请稍后重试",
        status: 500,
      };
    }

    return null;
  }

  /**
   * 检查资源限制
   */
  private checkResourceLimits(): PreCheckResult | null {
    try {
      // 检查现有工具数量限制
      const existingTools = configManager.getCustomMCPTools();
      const maxTools = 100; // 设置最大工具数量限制

      if (existingTools.length >= maxTools) {
        return {
          code: "RESOURCE_LIMIT_EXCEEDED",
          message: `已达到最大工具数量限制 (${maxTools})。请删除一些不需要的工具后重试`,
          status: 429,
        };
      }

      // 检查配置文件大小（简单估算）
      const configSizeEstimate = JSON.stringify(existingTools).length;
      const maxConfigSize = 1024 * 1024; // 1MB限制

      if (configSizeEstimate > maxConfigSize) {
        return {
          code: "PAYLOAD_TOO_LARGE",
          message: "配置文件过大。请删除一些不需要的工具以释放空间",
          status: 413,
        };
      }
    } catch {
      // 资源检查失败不应阻止操作，只记录警告
    }

    return null;
  }

  /**
   * 获取验证器实例
   */
  getValidator(): MCPToolValidator {
    return this.validator;
  }
}
