/**
 * 工具管理 API 服务
 * 专门处理自定义工具的添加、删除和管理操作
 */

import type { CozeWorkflow, WorkflowParameterConfig } from "@xiaozhi/shared-types";
import { apiClient } from "./api";

/**
 * 添加工具请求参数
 */
export interface AddToolRequest {
  workflow: CozeWorkflow;
  customName?: string;
  customDescription?: string;
  parameterConfig?: WorkflowParameterConfig;
}

/**
 * 添加工具响应
 */
export interface AddToolResponse {
  name: string;
  description: string;
  inputSchema: any;
  handler: any;
}

/**
 * API错误类型
 */
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

/**
 * 工具管理服务类
 */
export class ToolsApiService {
  private readonly REQUEST_TIMEOUT = 30000; // 30秒超时
  private readonly MAX_RETRIES = 2; // 最大重试次数

  /**
   * 添加自定义工具
   */
  async addCustomTool(
    workflow: CozeWorkflow,
    customName?: string,
    customDescription?: string,
    parameterConfig?: WorkflowParameterConfig
  ): Promise<AddToolResponse> {
    // 请求参数验证
    this.validateAddToolRequest(
      workflow,
      customName,
      customDescription,
      parameterConfig
    );

    try {
      const result = await this.executeWithRetry(async () => {
        return await apiClient.addCustomTool(
          workflow,
          customName,
          customDescription,
          parameterConfig
        );
      });

      return result;
    } catch (error) {
      throw this.handleApiError(error, "添加工具");
    }
  }

  /**
   * 删除自定义工具
   */
  async removeCustomTool(toolName: string): Promise<void> {
    // 参数验证
    if (!toolName || typeof toolName !== "string" || toolName.trim() === "") {
      throw new Error("工具名称不能为空");
    }

    const sanitizedToolName = toolName.trim();

    try {
      await this.executeWithRetry(async () => {
        return await apiClient.removeCustomTool(sanitizedToolName);
      });
    } catch (error) {
      throw this.handleApiError(error, "删除工具");
    }
  }

  /**
   * 获取自定义工具列表
   */
  async getCustomTools(): Promise<any[]> {
    try {
      const tools = await this.executeWithRetry(async () => {
        return await apiClient.getCustomTools();
      });

      return Array.isArray(tools) ? tools : [];
    } catch (error) {
      throw this.handleApiError(error, "获取工具列表");
    }
  }

  /**
   * 验证添加工具请求参数
   */
  private validateAddToolRequest(
    workflow: CozeWorkflow,
    customName?: string,
    customDescription?: string,
    parameterConfig?: WorkflowParameterConfig
  ): void {
    // 验证workflow对象
    if (!workflow || typeof workflow !== "object") {
      throw new Error("工作流数据不能为空且必须是对象");
    }

    // 验证必需字段
    const requiredFields = [
      { field: "workflow_id", name: "工作流ID" },
      { field: "workflow_name", name: "工作流名称" },
      { field: "app_id", name: "应用ID" },
    ];

    for (const { field, name } of requiredFields) {
      const value = workflow[field as keyof CozeWorkflow];
      if (!value || typeof value !== "string" || value.trim() === "") {
        throw new Error(`${name}不能为空`);
      }
    }

    // 验证字段长度
    if (workflow.workflow_name.length > 100) {
      throw new Error("工作流名称过长，不能超过100个字符");
    }

    if (workflow.description && workflow.description.length > 500) {
      throw new Error("工作流描述过长，不能超过500个字符");
    }

    // 验证自定义参数
    if (customName !== undefined) {
      if (typeof customName !== "string") {
        throw new Error("自定义名称必须是字符串");
      }
      if (customName.trim() === "") {
        throw new Error("自定义名称不能为空");
      }
      if (customName.length > 50) {
        throw new Error("自定义名称过长，不能超过50个字符");
      }
    }

    if (customDescription !== undefined) {
      if (typeof customDescription !== "string") {
        throw new Error("自定义描述必须是字符串");
      }
      if (customDescription.length > 200) {
        throw new Error("自定义描述过长，不能超过200个字符");
      }
    }

    // 验证工作流ID格式
    if (!/^\d+$/.test(workflow.workflow_id)) {
      throw new Error("工作流ID格式无效，应为数字字符串");
    }

    // 验证时间戳
    if (
      workflow.created_at &&
      (!Number.isInteger(workflow.created_at) || workflow.created_at <= 0)
    ) {
      throw new Error("创建时间格式无效");
    }

    if (
      workflow.updated_at &&
      (!Number.isInteger(workflow.updated_at) || workflow.updated_at <= 0)
    ) {
      throw new Error("更新时间格式无效");
    }

    // 验证时间逻辑
    if (
      workflow.created_at &&
      workflow.updated_at &&
      workflow.updated_at < workflow.created_at
    ) {
      throw new Error("更新时间不能早于创建时间");
    }

    // 验证参数配置（可选）
    if (parameterConfig !== undefined) {
      this.validateParameterConfig(parameterConfig);
    }
  }

  /**
   * 验证参数配置
   */
  private validateParameterConfig(
    parameterConfig: WorkflowParameterConfig
  ): void {
    if (!parameterConfig || typeof parameterConfig !== "object") {
      throw new Error("参数配置必须是对象");
    }

    if (!Array.isArray(parameterConfig.parameters)) {
      throw new Error("参数配置的parameters字段必须是数组");
    }

    // 验证每个参数
    const fieldNames = new Set<string>();
    for (let i = 0; i < parameterConfig.parameters.length; i++) {
      const param = parameterConfig.parameters[i];

      // 验证参数结构
      if (!param || typeof param !== "object") {
        throw new Error(`第${i + 1}个参数配置必须是对象`);
      }

      // 验证字段名
      if (!param.fieldName || typeof param.fieldName !== "string") {
        throw new Error(`第${i + 1}个参数的字段名不能为空且必须是字符串`);
      }

      // 验证字段名格式
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(param.fieldName)) {
        throw new Error(
          `第${i + 1}个参数的字段名格式无效，必须以字母开头，只能包含字母、数字和下划线`
        );
      }

      // 验证字段名唯一性
      if (fieldNames.has(param.fieldName)) {
        throw new Error(`字段名"${param.fieldName}"重复`);
      }
      fieldNames.add(param.fieldName);

      // 验证描述
      if (!param.description || typeof param.description !== "string") {
        throw new Error(`第${i + 1}个参数的描述不能为空且必须是字符串`);
      }

      if (param.description.length > 200) {
        throw new Error(`第${i + 1}个参数的描述不能超过200个字符`);
      }

      // 验证类型
      if (!["string", "number", "boolean"].includes(param.type)) {
        throw new Error(
          `第${i + 1}个参数的类型必须是string、number或boolean之一`
        );
      }

      // 验证必填标志
      if (typeof param.required !== "boolean") {
        throw new Error(`第${i + 1}个参数的required字段必须是布尔值`);
      }
    }
  }

  /**
   * 带重试机制的请求执行
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // 设置超时
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("请求超时")), this.REQUEST_TIMEOUT);
        });

        const result = await Promise.race([operation(), timeoutPromise]);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 如果是最后一次尝试，或者是不可重试的错误，直接抛出
        if (attempt === retries || !this.isRetryableError(lastError)) {
          throw lastError;
        }

        // 等待一段时间后重试
        await this.delay(2 ** attempt * 1000); // 指数退避
      }
    }

    throw lastError!;
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      "网络错误",
      "连接失败",
      "请求超时",
      "服务暂时不可用",
      "Internal Server Error",
      "Bad Gateway",
      "Service Unavailable",
      "Gateway Timeout",
    ];

    return retryableMessages.some(
      (msg) =>
        error.message.includes(msg) || error.message.includes(msg.toLowerCase())
    );
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 处理API错误
   */
  private handleApiError(error: unknown, operation: string): Error {
    if (error instanceof Error) {
      // 根据错误信息分类处理
      if (error.message.includes("400")) {
        return new Error(`请求参数错误：${error.message}`);
      }
      if (error.message.includes("401")) {
        return new Error("认证失败，请检查API配置");
      }
      if (error.message.includes("403")) {
        return new Error("权限不足，请检查API权限配置");
      }
      if (error.message.includes("404")) {
        return new Error("资源不存在");
      }
      if (error.message.includes("409")) {
        return new Error("资源冲突，可能已存在同名工具");
      }
      if (error.message.includes("422")) {
        return new Error("数据验证失败，请检查输入数据");
      }
      if (error.message.includes("429")) {
        return new Error("请求过于频繁，请稍后重试");
      }
      if (error.message.includes("500")) {
        return new Error("服务器内部错误，请稍后重试");
      }
      if (
        error.message.includes("502") ||
        error.message.includes("503") ||
        error.message.includes("504")
      ) {
        return new Error("服务暂时不可用，请稍后重试");
      }

      return error;
    }

    return new Error(`${operation}失败：${String(error)}`);
  }
}

// 创建默认实例
export const toolsApiService = new ToolsApiService();
