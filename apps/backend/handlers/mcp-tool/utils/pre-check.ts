/**
 * 边界检查工具模块
 * 提供请求参数预检查、系统状态检查、资源限制检查等功能
 */

import { configManager } from "@xiaozhi-client/config";

/**
 * 检查结果接口
 */
export interface CheckResult {
  code: string;
  message: string;
  status: number;
}

/**
 * 执行边界条件预检查
 */
export function performPreChecks(
  workflow: unknown,
  customName?: string,
  customDescription?: string
): CheckResult | null {
  // 检查基础参数
  const basicCheckResult = checkBasicParameters(
    workflow,
    customName,
    customDescription
  );
  if (basicCheckResult) return basicCheckResult;

  // 检查系统状态
  const systemCheckResult = checkSystemStatus();
  if (systemCheckResult) return systemCheckResult;

  // 检查资源限制
  const resourceCheckResult = checkResourceLimits();
  if (resourceCheckResult) return resourceCheckResult;

  return null; // 所有检查通过
}

/**
 * 检查基础参数
 */
export function checkBasicParameters(
  workflow: unknown,
  customName?: string,
  customDescription?: string
): CheckResult | null {
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
export function checkSystemStatus(): CheckResult | null {
  // 检查扣子API配置
  try {
    const cozeConfig = configManager.getCozePlatformConfig();
    if (!cozeConfig || !cozeConfig.token) {
      return {
        code: "CONFIGURATION_ERROR",
        message: "未配置扣子API Token。请在系统设置中配置 platforms.coze.token",
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
 */
export function checkResourceLimits(): CheckResult | null {
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
    // 注意：此处不返回错误，因为资源检查失败不应阻止操作
  }

  return null;
}

/**
 * 判断是否为数据验证错误
 */
export function isValidationError(errorMessage: string): boolean {
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
export function formatValidationError(errorMessage: string): string {
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
