/**
 * 工具管理服务
 *
 * 提供 MCP 工具管理功能，包括：
 * - 工作流到工具的转换
 * - 输入参数结构生成
 * - 错误处理和格式化
 * - 预检查逻辑
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { JSONSchema, ProxyHandlerConfig } from "@/types/toolApi.js";
import {
  createHttpHandler,
  generateToolDescription,
  resolveToolNameConflict,
  sanitizeToolName,
} from "@/utils/tool-utils.js";
import type { CustomMCPTool } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";
import { ToolValidationService } from "./ToolValidationService.js";

/**
 * 工具管理服务
 *
 * 封装工具管理相关的业务逻辑
 */
export class ToolManagementService {
  private logger: Logger;
  private validationService: ToolValidationService;

  constructor() {
    this.logger = logger;
    this.validationService = new ToolValidationService();
  }

  /**
   * 将扣子工作流转换为自定义 MCP 工具
   *
   * @param workflow - Coze 工作流对象
   * @param customName - 自定义工具名称（可选）
   * @param customDescription - 自定义工具描述（可选）
   * @param parameterConfig - 参数配置（可选）
   * @returns 自定义 MCP 工具配置
   * @throws 当转换失败时抛出错误
   */
  convertWorkflowToTool(
    workflow: CozeWorkflow,
    customName?: string,
    customDescription?: string,
    parameterConfig?: WorkflowParameterConfig
  ): CustomMCPTool {
    // 验证工作流数据完整性
    this.validationService.validateWorkflowData(workflow);

    // 生成工具名称（处理冲突）
    const baseName = customName || sanitizeToolName(workflow.workflow_name);
    const existingNames = this.getExistingToolNames();
    const toolName = resolveToolNameConflict(baseName, existingNames);

    // 生成工具描述
    const description = generateToolDescription(workflow, customDescription);

    // 生成输入参数结构
    const inputSchema = this.generateInputSchema(workflow, parameterConfig);

    // 配置 HTTP 处理器
    const handler = createHttpHandler(workflow);

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
   * 生成输入参数结构
   *
   * @param workflow - Coze 工作流对象
   * @param parameterConfig - 参数配置（可选）
   * @returns JSON Schema 格式的输入参数结构
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
   *
   * @param parameterConfig - 参数配置对象
   * @returns JSON Schema 格式的输入参数结构
   */
  generateInputSchemaFromConfig(
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
   * 验证生成的工具配置
   *
   * @param tool - 自定义 MCP 工具配置
   * @throws 当工具配置无效时抛出错误
   */
  private validateGeneratedTool(tool: CustomMCPTool): void {
    // 基础结构验证
    this.validationService.validateToolStructure(tool);

    // 使用configManager的验证方法
    if (!configManager.validateCustomMCPTools([tool])) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "生成的工具配置验证失败，请检查工具定义"
      );
    }

    // JSON Schema验证
    this.validationService.validateJsonSchema(tool.inputSchema);

    // HTTP处理器验证
    if (tool.handler) {
      this.validationService.validateProxyHandler(
        tool.handler as ProxyHandlerConfig
      );
    }
  }

  /**
   * 获取现有工具名称集合
   *
   * @returns 工具名称的 Set 集合
   */
  private getExistingToolNames(): Set<string> {
    const existingTools = configManager.getCustomMCPTools();
    return new Set(existingTools.map((tool) => tool.name));
  }

  /**
   * 执行边界条件预检查
   *
   * @param workflow - 工作流对象
   * @param customName - 自定义名称（可选）
   * @param customDescription - 自定义描述（可选）
   * @returns 检查结果对象，如果检查通过返回 null
   */
  performPreChecks(
    workflow: unknown,
    customName?: string,
    customDescription?: string
  ): { code: string; message: string; status: number } | null {
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
   *
   * @param workflow - 工作流对象
   * @param customName - 自定义名称（可选）
   * @param customDescription - 自定义描述（可选）
   * @returns 检查结果对象，如果检查通过返回 null
   */
  private checkBasicParameters(
    workflow: unknown,
    customName?: string,
    customDescription?: string
  ): { code: string; message: string; status: number } | null {
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
   *
   * @returns 检查结果对象，如果检查通过返回 null
   */
  private checkSystemStatus(): {
    code: string;
    message: string;
    status: number;
  } | null {
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
    } catch (error) {
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
   *
   * @returns 检查结果对象，如果检查通过返回 null
   */
  private checkResourceLimits(): {
    code: string;
    message: string;
    status: number;
  } | null {
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
    } catch (error) {
      // 资源检查失败不应阻止操作，只记录警告
      this.logger.warn("资源限制检查失败:", error);
    }

    return null;
  }

  /**
   * 处理添加工具时的错误
   *
   * @param error - 错误对象
   * @returns 包含错误码、消息和状态码的对象
   */
  handleAddToolError(error: unknown): {
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
    if (this.isValidationError(errorMessage)) {
      return {
        code: "VALIDATION_ERROR",
        message: this.formatValidationError(errorMessage),
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
   * 处理删除工具时的错误
   *
   * @param error - 错误对象
   * @returns 包含错误码、消息和状态码的对象
   */
  handleRemoveToolError(error: unknown): {
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
   * 判断是否为数据验证错误
   *
   * @param errorMessage - 错误消息
   * @returns 是否为验证错误
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
   *
   * @param errorMessage - 原始错误消息
   * @returns 格式化后的错误消息
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
}
