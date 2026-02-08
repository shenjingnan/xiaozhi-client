/**
 * 工具预检查服务
 * 负责工具操作前的预检查逻辑
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import type { ConfigManager } from "@xiaozhi-client/config";

/**
 * 预检查结果接口
 */
interface PreCheckResult {
  code: string;
  message: string;
  status: number;
}

/**
 * 工具预检查服务
 */
export class ToolPreCheckService {
  private logger: Logger;
  private configManager: ConfigManager;
  private readonly MAX_TOOLS = 100; // 最大工具数量限制
  private readonly MAX_CONFIG_SIZE = 1024 * 1024; // 1MB配置大小限制

  constructor(configManager: ConfigManager) {
    this.logger = logger;
    this.configManager = configManager;
  }

  /**
   * 执行边界条件预检查
   * @param workflow 工作流数据
   * @param customName 自定义名称
   * @param customDescription 自定义描述
   * @returns 预检查结果，如果检查通过返回 null
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
   * @param workflow 工作流数据
   * @param customName 自定义名称
   * @param customDescription 自定义描述
   * @returns 预检查结果，如果检查通过返回 null
   * @private
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
   * @returns 预检查结果，如果检查通过返回 null
   * @private
   */
  private checkSystemStatus(): PreCheckResult | null {
    // 检查扣子API配置
    try {
      const cozeConfig = this.configManager.getCozePlatformConfig();
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
   * @returns 预检查结果，如果检查通过返回 null
   * @private
   */
  private checkResourceLimits(): PreCheckResult | null {
    try {
      // 检查现有工具数量限制
      const existingTools = this.configManager.getCustomMCPTools();

      if (existingTools.length >= this.MAX_TOOLS) {
        return {
          code: "RESOURCE_LIMIT_EXCEEDED",
          message: `已达到最大工具数量限制 (${this.MAX_TOOLS})。请删除一些不需要的工具后重试`,
          status: 429,
        };
      }

      // 检查配置文件大小（简单估算）
      const configSizeEstimate = JSON.stringify(existingTools).length;

      if (configSizeEstimate > this.MAX_CONFIG_SIZE) {
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
   * 验证工具标识符
   * @param serverName 服务名称
   * @param toolName 工具名称
   * @throws {MCPError} 当标识符无效时
   */
  validateToolIdentifier(serverName: string, toolName: string): void {
    if (
      !serverName ||
      typeof serverName !== "string" ||
      serverName.trim() === ""
    ) {
      throw new Error("服务名称不能为空");
    }

    if (!toolName || typeof toolName !== "string" || toolName.trim() === "") {
      throw new Error("工具名称不能为空");
    }

    // 验证服务名称格式
    if (!/^[a-zA-Z0-9_-]+$/.test(serverName)) {
      throw new Error(
        "服务名称格式无效，只能包含字母、数字、下划线和连字符"
      );
    }

    // 验证工具名称格式
    if (!/^[a-zA-Z0-9_-]+$/.test(toolName)) {
      throw new Error(
        "工具名称格式无效，只能包含字母、数字、下划线和连字符"
      );
    }
  }
}
