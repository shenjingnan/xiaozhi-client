/**
 * 工具服务
 * 负责工具的业务逻辑管理
 */

import { logger } from "@/Logger.js";
import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import { ToolConverter } from "@/converters/ToolConverter";
import { ToolValidator } from "@/validators/ToolValidator";
import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { CustomMCPTool, ProxyHandlerConfig } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";

/**
 * 预检查结果接口
 */
interface PreCheckResult {
  code: string;
  message: string;
  status: number;
}

/**
 * 工具服务类
 */
export class ToolService {
  private validator: ToolValidator;
  private converter: ToolConverter;

  constructor() {
    this.validator = new ToolValidator(logger);
    this.converter = new ToolConverter([]);
  }

  /**
   * 添加自定义工具
   */
  async addCustomTool(tool: CustomMCPTool): Promise<void> {
    // 验证工具配置
    this.validator.validateToolStructure(tool);

    // 使用 configManager 的验证方法
    if (!configManager.validateCustomMCPTools([tool])) {
      throw MCPError.validationError(
        MCPErrorCode.TOOL_VALIDATION_FAILED,
        "工具配置验证失败，请检查工具定义"
      );
    }

    // JSON Schema 验证
    this.validator.validateJsonSchema(tool.inputSchema);

    // HTTP 处理器验证
    if (tool.handler) {
      this.validator.validateProxyHandler(
        tool.handler as ProxyHandlerConfig
      );
    }

    // 添加工具到配置
    configManager.addCustomMCPTool(tool);
  }

  /**
   * 更新自定义工具
   */
  async updateCustomTool(
    toolName: string,
    updatedTool: CustomMCPTool
  ): Promise<void> {
    // 更新工具配置
    configManager.updateCustomMCPTool(toolName, updatedTool);
  }

  /**
   * 删除自定义工具
   */
  async removeCustomTool(toolName: string): Promise<void> {
    configManager.removeCustomMCPTool(toolName);
  }

  /**
   * 从扣子工作流创建工具
   */
  async createToolFromWorkflow(
    workflow: CozeWorkflow,
    customName?: string,
    customDescription?: string,
    parameterConfig?: WorkflowParameterConfig
  ): Promise<CustomMCPTool> {
    // 更新转换器的现有工具列表
    const existingTools = configManager.getCustomMCPTools();
    this.converter.updateExistingTools(existingTools);

    // 转换工作流为工具配置
    const tool = this.converter.convertWorkflowToTool(
      workflow,
      customName,
      customDescription,
      parameterConfig
    );

    return tool;
  }

  /**
   * 验证扣子 API 配置
   */
  validateCozeApiConfig(): void {
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
    // 检查 workflow 参数
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
    // 检查扣子 API 配置
    try {
      const cozeConfig = configManager.getCozePlatformConfig();
      if (!cozeConfig || !cozeConfig.token) {
        return {
          code: "CONFIGURATION_ERROR",
          message:
            "未配置扣子 API Token。请在系统设置中配置 platforms.coze.token",
          status: 422,
        };
      }

      // 检查 token 格式
      if (
        typeof cozeConfig.token !== "string" ||
        cozeConfig.token.trim() === ""
      ) {
        return {
          code: "CONFIGURATION_ERROR",
          message: "扣子 API Token 格式无效。请检查配置中的 platforms.coze.token",
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
      const maxConfigSize = 1024 * 1024; // 1MB 限制

      if (configSizeEstimate > maxConfigSize) {
        return {
          code: "PAYLOAD_TOO_LARGE",
          message: "配置文件过大。请删除一些不需要的工具以释放空间",
          status: 413,
        };
      }
    } catch (error) {
      // 资源检查失败不应阻止操作，只记录警告
      logger.warn("资源限制检查失败:", error);
    }

    return null;
  }

  /**
   * 获取验证器实例（用于 handler 直接调用验证方法）
   */
  getValidator(): ToolValidator {
    return this.validator;
  }

  /**
   * 获取转换器实例（用于 handler 直接调用转换方法）
   */
  getConverter(): ToolConverter {
    return this.converter;
  }
}
