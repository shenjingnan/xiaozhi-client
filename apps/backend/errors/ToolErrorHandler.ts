/**
 * 工具错误处理器
 * 负责处理工具相关的错误并提供统一的错误响应格式
 */

import { MCPErrorCode } from "@/errors/mcp-errors.js";
import { ToolValidator } from "@/validators/ToolValidator.js";

/**
 * 错误响应接口
 */
interface ErrorResponse {
  code: string;
  message: string;
  status: number;
}

/**
 * 工具错误处理器类
 */
export class ToolErrorHandler {
  private validator: ToolValidator;

  constructor(validator: ToolValidator) {
    this.validator = validator;
  }

  /**
   * 处理添加工具时的错误
   */
  handleAddToolError(error: unknown): ErrorResponse {
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
    if (this.validator.isValidationError(errorMessage)) {
      return {
        code: "VALIDATION_ERROR",
        message: this.validator.formatValidationError(errorMessage),
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
   * 处理更新工具时的错误
   */
  handleUpdateToolError(error: unknown): ErrorResponse {
    const errorMessage =
      error instanceof Error ? error.message : "更新自定义工具配置失败";

    // 工具不存在错误 (404)
    if (errorMessage.includes("不存在") || errorMessage.includes("未找到")) {
      return {
        code: "TOOL_NOT_FOUND",
        message: `${errorMessage}。请检查工具名称是否正确`,
        status: 404,
      };
    }

    // 工具类型错误 (400)
    if (
      errorMessage.includes("工具类型") ||
      errorMessage.includes("INVALID_TOOL_TYPE")
    ) {
      return {
        code: "INVALID_TOOL_TYPE",
        message: errorMessage,
        status: 400,
      };
    }

    // 参数错误 (400)
    if (errorMessage.includes("不能为空") || errorMessage.includes("无效")) {
      return {
        code: "INVALID_REQUEST",
        message: `${errorMessage}。请提供有效的工具配置数据`,
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
      code: "UPDATE_CUSTOM_TOOL_ERROR",
      message: `更新工具配置失败：${errorMessage}。请稍后重试，如问题持续存在请联系管理员`,
      status: 500,
    };
  }

  /**
   * 处理删除工具时的错误
   */
  handleRemoveToolError(error: unknown): ErrorResponse {
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
}
