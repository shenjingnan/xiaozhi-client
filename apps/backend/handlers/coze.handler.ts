/**
 * 扣子 API HTTP 路由处理器
 * 提供扣子工作空间和工作流相关的 RESTful API 接口
 */

import { CozeApiService } from "@/lib/coze";
import {
  CozeWorkflowConverter,
  CozeWorkflowValidator,
} from "@/lib/coze";
import type { CozeWorkflow, CozeWorkflowsParams, WorkflowParameterConfig } from "@/types/coze";
import type { AppContext } from "@/types/hono.context.js";
import type {
  AddToolResponse,
  CozeWorkflowData,
} from "@/types/toolApi.js";
import { ToolType } from "@/types/toolApi.js";
import { configManager } from "@xiaozhi-client/config";
import type { CustomMCPTool } from "@xiaozhi-client/config";
import dayjs from "dayjs";
import type { Context } from "hono";
import { BaseHandler } from "./base.handler.js";

/**
 * 错误代码类型
 */
type CozeErrorCode =
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "API_ERROR"
  | "NETWORK_ERROR";

/**
 * 带 code 属性的错误接口
 */
interface ErrorWithCode {
  code: CozeErrorCode;
  message: string;
  statusCode?: number;
  response?: unknown;
}

/**
 * 类型守卫函数：检查错误是否带有 code 属性
 */
function isErrorWithCode(error: unknown): error is ErrorWithCode {
  if (!(error instanceof Error && "code" in error)) {
    return false;
  }

  const code = (error as ErrorWithCode).code;
  const validCodes: CozeErrorCode[] = [
    "AUTH_FAILED",
    "RATE_LIMITED",
    "TIMEOUT",
    "API_ERROR",
    "NETWORK_ERROR",
  ];

  return typeof code === "string" && validCodes.includes(code as CozeErrorCode);
}

/**
 * 获取扣子 API 服务实例
 */
function getCozeApiService(): CozeApiService {
  const token = configManager.getCozeToken();

  if (!token) {
    throw new Error(
      "扣子 API Token 未配置，请在配置文件中设置 platforms.coze.token"
    );
  }

  return new CozeApiService(token);
}

/**
 * 扣子 API 路由处理器类
 */
export class CozeHandler extends BaseHandler {
  private validator: CozeWorkflowValidator;
  private converter: CozeWorkflowConverter;

  constructor() {
    super();
    this.validator = new CozeWorkflowValidator();
    this.converter = new CozeWorkflowConverter();
  }

  /**
   * 处理 Coze API 错误并返回标准化的响应
   * @param c - Hono 上下文对象
   * @param error - 捕获的错误对象
   * @param operationName - 操作名称，用于日志和错误消息
   * @returns 标准化的错误响应
   */
  private handleCozeApiError(
    c: Context<AppContext>,
    error: unknown,
    operationName: string
  ): Response {
    c.get("logger").error(`${operationName}失败:`, error);

    // 根据错误类型返回不同的响应
    if (isErrorWithCode(error) && error.code === "AUTH_FAILED") {
      return c.fail(
        "AUTH_FAILED",
        "扣子 API 认证失败，请检查 Token 配置",
        undefined,
        401
      );
    }

    if (isErrorWithCode(error) && error.code === "RATE_LIMITED") {
      return c.fail("RATE_LIMITED", "请求过于频繁，请稍后重试", undefined, 429);
    }

    if (isErrorWithCode(error) && error.code === "TIMEOUT") {
      return c.fail("TIMEOUT", "请求超时，请稍后重试", undefined, 408);
    }

    const details =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.stack
        : undefined;

    return c.fail(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : `${operationName}失败`,
      details,
      500
    );
  }

  /**
   * 获取工作空间列表
   * GET /api/coze/workspaces
   */
  async getWorkspaces(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理获取工作空间列表请求");

      // 检查扣子配置
      if (!configManager.isCozeConfigValid()) {
        c.get("logger").debug("扣子配置无效");
        return c.fail(
          "CONFIG_INVALID",
          "扣子配置无效，请检查 platforms.coze.token 配置",
          undefined,
          400
        );
      }

      const cozeApiService = getCozeApiService();

      c.get("logger").info("调用 Coze API 获取工作空间列表");
      const workspaces = await cozeApiService.getWorkspaces();
      c.get("logger").info(`成功获取 ${workspaces.length} 个工作空间`);

      return c.success({ workspaces });
    } catch (error) {
      return this.handleCozeApiError(c, error, "获取工作空间列表");
    }
  }

  /**
   * 获取工作流列表
   * GET /api/coze/workflows?workspace_id=xxx&page_num=1&page_size=20
   */
  async getWorkflows(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理获取工作流列表请求");

      // 检查扣子配置
      if (!configManager.isCozeConfigValid()) {
        c.get("logger").debug("扣子配置无效");
        return c.fail(
          "CONFIG_INVALID",
          "扣子配置无效，请检查 platforms.coze.token 配置",
          undefined,
          400
        );
      }

      // 解析查询参数
      const workspace_id = c.req.query("workspace_id");
      const page_num = Number.parseInt(c.req.query("page_num") || "1", 10);
      const page_size = Number.parseInt(c.req.query("page_size") || "20", 10);

      // 验证必需参数
      if (!workspace_id) {
        c.get("logger").warn("缺少 workspace_id 参数");
        return c.fail(
          "MISSING_PARAMETER",
          "缺少必需参数: workspace_id",
          undefined,
          400
        );
      }

      // 验证分页参数
      if (page_num < 1 || page_num > 1000) {
        return c.fail(
          "INVALID_PARAMETER",
          "page_num 必须在 1-1000 之间",
          undefined,
          400
        );
      }

      if (page_size < 1 || page_size > 100) {
        return c.fail(
          "INVALID_PARAMETER",
          "page_size 必须在 1-100 之间",
          undefined,
          400
        );
      }

      const params: CozeWorkflowsParams = {
        workspace_id,
        page_num,
        page_size,
      };

      const cozeApiService = getCozeApiService();

      c.get("logger").info(
        `开始获取工作空间 ${workspace_id} 的工作流列表，页码: ${page_num}，每页: ${page_size}`
      );
      const result = await cozeApiService.getWorkflows(params);
      c.get("logger").info(
        `成功获取工作空间 ${workspace_id} 的 ${result.items.length} 个工作流`
      );

      // 获取已添加的自定义工具列表，检查工作流是否已被添加为工具
      const customMCPTools = configManager.getCustomMCPTools();

      // 为每个工作流添加工具状态信息
      const enhancedItems = result.items.map((item) => {
        // 查找对应的自定义工具
        const addedTool = customMCPTools.find(
          (tool) =>
            tool.handler.type === "proxy" &&
            tool.handler.platform === "coze" &&
            tool.handler.config.workflow_id === item.workflow_id
        );

        return {
          ...item,
          isAddedAsTool: !!addedTool,
          toolName: addedTool?.name || null,
        };
      });

      c.get("logger").info(
        `工作流工具状态检查完成，共 ${enhancedItems.filter((item) => item.isAddedAsTool).length} 个工作流已添加为工具`
      );

      return c.success(
        {
          items: enhancedItems,
          has_more: result.has_more,
          page_num,
          page_size,
          total_count: result.items.length, // 当前页的数量
        },
        `成功获取 ${enhancedItems.length} 个工作流`
      );
    } catch (error) {
      return this.handleCozeApiError(c, error, "获取工作流列表");
    }
  }

  /**
   * 清除扣子 API 缓存
   * POST /api/coze/cache/clear
   */
  async clearCache(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理清除扣子 API 缓存请求");

      // 检查扣子配置
      if (!configManager.isCozeConfigValid()) {
        c.get("logger").debug("扣子配置无效");
        return c.fail(
          "CONFIG_INVALID",
          "扣子配置无效，请检查 platforms.coze.token 配置",
          undefined,
          400
        );
      }

      const pattern = c.req.query("pattern"); // 可选的缓存模式参数

      const cozeApiService = getCozeApiService();

      const statsBefore = cozeApiService.getCacheStats();
      c.get("logger").info(
        `开始清除缓存${pattern ? ` (模式: ${pattern})` : ""}`
      );

      cozeApiService.clearCache(pattern);

      const statsAfter = cozeApiService.getCacheStats();

      c.get("logger").info(
        `缓存清除完成，清除前: ${statsBefore.size} 项，清除后: ${statsAfter.size} 项`
      );

      return c.success(
        {
          cleared: statsBefore.size - statsAfter.size,
          remaining: statsAfter.size,
          pattern: pattern || "all",
        },
        "缓存清除成功"
      );
    } catch (error) {
      c.get("logger").error("清除缓存失败:", error);

      const details =
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.stack
          : undefined;

      return c.fail(
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "清除缓存失败",
        details,
        500
      );
    }
  }

  /**
   * 获取缓存统计信息
   * GET /api/coze/cache/stats
   */
  async getCacheStats(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理获取缓存统计信息请求");

      // 检查扣子配置
      if (!configManager.isCozeConfigValid()) {
        c.get("logger").debug("扣子配置无效");
        return c.fail(
          "CONFIG_INVALID",
          "扣子配置无效，请检查 platforms.coze.token 配置",
          undefined,
          400
        );
      }

      const cozeApiService = getCozeApiService();
      const stats = cozeApiService.getCacheStats();

      return c.success(stats);
    } catch (error) {
      c.get("logger").error("获取缓存统计信息失败:", error);

      const details =
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.stack
          : undefined;

      return c.fail(
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "获取缓存统计信息失败",
        details,
        500
      );
    }
  }

  /**
   * 添加 Coze 工作流工具
   * POST /api/coze/tools
   */
  async addTool(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理添加 Coze 工具请求");

      const requestBody = await c.req.json();
      const { workflow, customName, customDescription, parameterConfig } =
        requestBody as CozeWorkflowData;

      // 验证工作流数据
      this.validator.validateWorkflowData(workflow);

      // 转换工作流为工具配置
      const tool = this.converter.convertToCustomMCPTool(
        workflow,
        customName,
        customDescription,
        parameterConfig
      );

      // 添加工具到配置
      configManager.addCustomMCPTool(tool);

      c.get("logger").info(`成功添加 Coze 工具: ${tool.name}`);

      const responseData: AddToolResponse = {
        tool,
        toolName: tool.name,
        toolType: ToolType.COZE,
        addedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      };

      return c.success(responseData, `Coze 工具 "${tool.name}" 添加成功`);
    } catch (error) {
      c.get("logger").error("添加 Coze 工具失败:", error);

      const { code, message, status } = this.handleAddToolError(error);
      return c.fail(code, message, undefined, status);
    }
  }

  /**
   * 更新 Coze 工作流工具
   * PUT /api/coze/tools/:toolName
   */
  async updateTool(c: Context<AppContext>): Promise<Response> {
    try {
      const toolName = c.req.param("toolName");

      if (!toolName) {
        return c.fail("INVALID_REQUEST", "工具名称不能为空", undefined, 400);
      }

      c.get("logger").info(`处理更新 Coze 工具请求: ${toolName}`);

      const requestBody = await c.req.json();
      const { workflow, customName, customDescription, parameterConfig } =
        requestBody as CozeWorkflowData;

      // 验证工具是否存在
      const existingTools = configManager.getCustomMCPTools();
      const existingTool = existingTools.find((tool) => tool.name === toolName);

      if (!existingTool) {
        return c.fail(
          "TOOL_NOT_FOUND",
          `工具 "${toolName}" 不存在`,
          undefined,
          404
        );
      }

      // 验证是否为 Coze 工具
      if (
        existingTool.handler.type !== "proxy" ||
        existingTool.handler.platform !== "coze"
      ) {
        return c.fail(
          "INVALID_TOOL_TYPE",
          `工具 "${toolName}" 不是 Coze 工作流工具，不支持参数配置更新`,
          undefined,
          400
        );
      }

      // 如果前端提供的 workflow 中没有 workflow_id，尝试从现有工具中获取
      if (!workflow.workflow_id && existingTool.handler?.config?.workflow_id) {
        workflow.workflow_id = existingTool.handler.config.workflow_id;
      }

      // 如果还没有 workflow_id，尝试从其他字段获取
      if (!workflow.workflow_id && workflow.app_id) {
        // 对于某些场景，app_id 可以作为替代标识
        // 但我们仍然需要 workflow_id 用于 Coze API 调用
        c.get("logger").warn(
          `工作流 ${toolName} 缺少 workflow_id，这可能会影响某些功能`
        );
      }

      // 验证工作流数据完整性
      this.validator.validateWorkflowUpdateData(workflow);

      // 更新工具的 inputSchema
      const updatedInputSchema = this.generateInputSchema(
        workflow,
        parameterConfig
      );

      // 构建更新后的工具配置
      const updatedTool: CustomMCPTool = {
        ...existingTool,
        description: customDescription || existingTool.description,
        inputSchema: updatedInputSchema,
      };

      // 更新工具配置
      configManager.updateCustomMCPTool(toolName, updatedTool);

      c.get("logger").info(`成功更新 Coze 工具: ${toolName}`);

      const responseData = {
        tool: updatedTool,
        toolName: toolName,
        toolType: ToolType.COZE,
        updatedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      };

      return c.success(responseData, `Coze 工具 "${toolName}" 配置更新成功`);
    } catch (error) {
      c.get("logger").error("更新 Coze 工具失败:", error);

      const { code, message, status } = this.handleUpdateToolError(error);
      return c.fail(code, message, undefined, status);
    }
  }

  /**
   * 生成输入参数结构
   */
  private generateInputSchema(
    workflow: Partial<CozeWorkflow>,
    parameterConfig?: WorkflowParameterConfig
  ): CustomMCPTool["inputSchema"] {
    // 如果提供了参数配置，使用参数配置生成schema
    if (parameterConfig && parameterConfig.parameters.length > 0) {
      return this.generateInputSchemaFromConfig(parameterConfig);
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
  private generateInputSchemaFromConfig(
    parameterConfig: WorkflowParameterConfig
  ): CustomMCPTool["inputSchema"] {
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
   * 处理添加工具时的错误
   */
  private handleAddToolError(error: unknown): {
    code: string;
    message: string;
    status: number;
  } {
    const errorMessage =
      error instanceof Error ? error.message : "添加 Coze 工具失败";

    // 数据验证错误 (400)
    if (
      errorMessage.includes("不能为空") ||
      errorMessage.includes("格式无效") ||
      errorMessage.includes("过长") ||
      errorMessage.includes("敏感词") ||
      errorMessage.includes("验证失败")
    ) {
      return {
        code: "VALIDATION_ERROR",
        message: errorMessage,
        status: 400,
      };
    }

    // 配置错误 (422)
    if (
      errorMessage.includes("配置") ||
      errorMessage.includes("token") ||
      errorMessage.includes("API")
    ) {
      return {
        code: "CONFIGURATION_ERROR",
        message: `${errorMessage}。请检查：1) 相关配置是否正确；2) 网络连接是否正常；3) 配置文件权限是否正确`,
        status: 422,
      };
    }

    // 系统错误 (500)
    return {
      code: "ADD_COZE_TOOL_ERROR",
      message: `添加 Coze 工具失败：${errorMessage}。请稍后重试，如问题持续存在请联系管理员`,
      status: 500,
    };
  }

  /**
   * 处理更新工具时的错误
   */
  private handleUpdateToolError(error: unknown): {
    code: string;
    message: string;
    status: number;
  } {
    const errorMessage =
      error instanceof Error ? error.message : "更新 Coze 工具失败";

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

    // 系统错误 (500)
    return {
      code: "UPDATE_COZE_TOOL_ERROR",
      message: `更新 Coze 工具失败：${errorMessage}。请稍后重试，如问题持续存在请联系管理员`,
      status: 500,
    };
  }
}
