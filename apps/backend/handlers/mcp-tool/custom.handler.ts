/**
 * 自定义工具 CRUD 处理器
 * 处理添加、更新、删除自定义 MCP 工具的请求
 */

import { MCPCacheManager } from "@/lib/mcp";
import type { AppContext } from "@/types/hono.context.js";
import type {
  AddCustomToolRequest,
  AddToolResponse,
  CozeWorkflowData,
  MCPToolData,
} from "@/types/toolApi.js";
import { ToolType } from "@/types/toolApi.js";
import { configManager } from "@xiaozhi-client/config";
import type { CustomMCPTool } from "@xiaozhi-client/config";
import dayjs from "dayjs";
import type { Context } from "hono";
import {
  convertWorkflowToTool,
  handleAddToolError,
  handleRemoveToolError,
  handleUpdateToolError,
  performPreChecks,
  updateCozeToolConfig,
  validateServiceAndToolExistence,
} from "./utils/index.js";

/**
 * 添加自定义工具请求接口（向后兼容）
 * @deprecated 使用新的 AddCustomToolRequest 类型定义
 */
interface LegacyAddCustomToolRequest {
  workflow: {
    workflow_id: string;
    workflow_name: string;
    app_id: string;
    description?: string;
    icon_url?: string;
    created_at?: number;
    updated_at?: number;
    creator?: { id: string; name: string };
  };
  customName?: string;
  customDescription?: string;
  parameterConfig?: {
    parameters: Array<{
      fieldName: string;
      type: "string" | "number" | "boolean";
      description: string;
      required: boolean;
    }>;
  };
}

/**
 * 自定义工具处理器类
 * 处理 POST/PUT/DELETE /api/tools/custom 请求
 */
export class CustomHandler {
  private static readonly TOOL_TYPE_VALUES = Object.values(ToolType);

  /**
   * 添加自定义 MCP 工具
   * POST /api/tools/custom
   * 支持多种工具类型：MCP 工具、Coze 工作流等
   */
  async addCustomTool(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理添加自定义工具请求");

      const requestBody = await c.req.json();

      // 检查是否为新格式的请求
      if (this.isNewFormatRequest(requestBody)) {
        // 新格式：支持多种工具类型
        return await this.handleNewFormatAddTool(
          c,
          requestBody as AddCustomToolRequest
        );
      }
      // 旧格式：向后兼容
      return await this.handleLegacyFormatAddTool(
        c,
        requestBody as LegacyAddCustomToolRequest
      );
    } catch (error) {
      c.get("logger").error("添加自定义工具失败:", error);

      // 根据错误类型返回不同的HTTP状态码和错误信息
      const { code, message, status } = handleAddToolError(error);
      return c.fail(code, message, undefined, status);
    }
  }

  /**
   * 更新自定义 MCP 工具配置
   * PUT /api/tools/custom/:toolName
   */
  async updateCustomTool(c: Context<AppContext>): Promise<Response> {
    try {
      const toolName = c.req.param("toolName");

      if (!toolName) {
        return c.fail("INVALID_REQUEST", "工具名称不能为空", undefined, 400);
      }

      c.get("logger").info(`处理更新自定义工具配置请求: ${toolName}`);

      const requestBody = await c.req.json();

      // 验证请求体
      if (!requestBody || typeof requestBody !== "object") {
        return c.fail(
          "INVALID_REQUEST",
          "请求体必须是有效对象",
          undefined,
          400
        );
      }

      // 检查是否为新格式的请求
      if (this.isNewFormatRequest(requestBody)) {
        // 新格式：支持多种工具类型
        return await this.handleNewFormatUpdateTool(
          c,
          toolName,
          requestBody as AddCustomToolRequest
        );
      }

      // 旧格式不支持更新操作
      return c.fail(
        "INVALID_REQUEST",
        "更新操作只支持新格式的请求",
        undefined,
        400
      );
    } catch (error) {
      c.get("logger").error("更新自定义工具配置失败:", error);

      // 根据错误类型返回不同的HTTP状态码和错误信息
      const { code, message, status } = handleUpdateToolError(error);
      return c.fail(code, message, undefined, status);
    }
  }

  /**
   * 删除自定义 MCP 工具
   * DELETE /api/tools/custom/:toolName
   */
  async removeCustomTool(c: Context<AppContext>): Promise<Response> {
    try {
      const toolName = c.req.param("toolName");

      if (!toolName) {
        return c.fail("INVALID_REQUEST", "工具名称不能为空", undefined, 400);
      }

      c.get("logger").info(`处理删除自定义工具请求: ${toolName}`);

      // 在删除之前，检查是否为 MCP 工具，如果是则需要在 mcpServerConfig 中同步禁用
      const existingTools = configManager.getCustomMCPTools();
      const toolToDelete = existingTools.find((tool) => tool.name === toolName);

      if (toolToDelete && toolToDelete.handler.type === "mcp") {
        // 这是 MCP 工具，需要在 mcpServerConfig 中同步禁用
        const mcpConfig = toolToDelete.handler.config;
        if (mcpConfig.serviceName && mcpConfig.toolName) {
          c.get("logger").info(
            `检测到 MCP 工具删除，同步禁用 mcpServerConfig 中的工具: ${mcpConfig.serviceName}/${mcpConfig.toolName}`
          );

          // 获取当前的服务工具配置
          const serverToolsConfig = configManager.getServerToolsConfig(
            mcpConfig.serviceName
          );

          if (serverToolsConfig?.[mcpConfig.toolName]) {
            // 更新配置，禁用该工具
            serverToolsConfig[mcpConfig.toolName].enable = false;

            // 保存更新后的配置
            configManager.updateServerToolsConfig(
              mcpConfig.serviceName,
              serverToolsConfig
            );

            c.get("logger").info(
              `已同步禁用 mcpServerConfig 中的工具: ${mcpConfig.serviceName}/${mcpConfig.toolName}`
            );
          }
        }
      }

      // 从配置中删除工具
      configManager.removeCustomMCPTool(toolName);

      c.get("logger").info(`成功删除自定义工具: ${toolName}`);

      return c.success(null, `工具 "${toolName}" 删除成功`);
    } catch (error) {
      c.get("logger").error("删除自定义工具失败:", error);

      // 根据错误类型返回不同的HTTP状态码和错误信息
      const { code, message, status } = handleRemoveToolError(error);
      return c.fail(code, message, undefined, status);
    }
  }

  /**
   * 判断是否为新格式的请求
   */
  private isNewFormatRequest(body: unknown): body is AddCustomToolRequest {
    return (
      body !== null &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      "type" in body &&
      "data" in body
    );
  }

  /**
   * 处理新格式的添加工具请求
   */
  private async handleNewFormatAddTool(
    c: Context<AppContext>,
    request: AddCustomToolRequest
  ): Promise<Response> {
    const { type, data } = request;

    c.get("logger").info(`处理新格式工具添加请求，类型: ${type}`);

    // 验证工具类型
    if (!CustomHandler.TOOL_TYPE_VALUES.includes(type)) {
      return c.fail(
        "INVALID_TOOL_TYPE",
        `不支持的工具类型: ${type}。支持的类型: ${CustomHandler.TOOL_TYPE_VALUES.join(", ")}`,
        undefined,
        400
      );
    }

    // 根据工具类型分发处理
    switch (type) {
      case ToolType.MCP:
        return await this.handleAddMCPTool(c, data as MCPToolData);

      case ToolType.COZE:
        return await this.handleAddCozeTool(c, data as CozeWorkflowData);

      case ToolType.HTTP:
      case ToolType.FUNCTION: {
        return c.fail(
          "TOOL_TYPE_NOT_IMPLEMENTED",
          `工具类型 ${type} 暂未实现，请使用 MCP 或 Coze 类型`,
          undefined,
          501
        );
      }

      default: {
        return c.fail(
          "UNKNOWN_TOOL_TYPE",
          `未知的工具类型: ${type}`,
          undefined,
          400
        );
      }
    }
  }

  /**
   * 处理旧格式的添加工具请求（向后兼容）
   */
  private async handleLegacyFormatAddTool(
    c: Context<AppContext>,
    request: LegacyAddCustomToolRequest
  ): Promise<Response> {
    c.get("logger").info("处理旧格式工具添加请求（向后兼容）");

    const { workflow, customName, customDescription, parameterConfig } =
      request;

    // 边界条件预检查
    const preCheckResult = performPreChecks(
      workflow,
      customName,
      customDescription
    );
    if (preCheckResult) {
      return c.fail(
        preCheckResult.code,
        preCheckResult.message,
        undefined,
        preCheckResult.status
      );
    }

    // 转换工作流为完整 CozeWorkflow 类型
    const fullWorkflow = {
      workflow_id: workflow.workflow_id,
      workflow_name: workflow.workflow_name,
      app_id: workflow.app_id,
      description: workflow.description || "",
      icon_url: workflow.icon_url || "",
      created_at: workflow.created_at || Date.now(),
      updated_at: workflow.updated_at || Date.now(),
      creator: workflow.creator || { id: "", name: "" },
    };

    // 转换工作流为工具配置
    const tool = convertWorkflowToTool(
      fullWorkflow,
      customName,
      customDescription,
      parameterConfig
    );

    // 添加工具到配置
    configManager.addCustomMCPTool(tool);

    c.get("logger").info(`成功添加自定义工具: ${tool.name}`);

    return c.success({ tool }, `工具 "${tool.name}" 添加成功`);
  }

  /**
   * 处理添加 MCP 工具
   */
  private async handleAddMCPTool(
    c: Context<AppContext>,
    data: MCPToolData
  ): Promise<Response> {
    const { serviceName, toolName, customName, customDescription } = data;

    c.get("logger").info(`处理添加 MCP 工具: ${serviceName}/${toolName}`);

    // 验证必需字段
    if (!serviceName || !toolName) {
      return c.fail(
        "MISSING_REQUIRED_FIELD",
        "serviceName 和 toolName 是必需字段",
        undefined,
        400
      );
    }

    // 从 Context 中获取 MCPServiceManager 实例
    const serviceManager = c.get("mcpServiceManager");
    if (!serviceManager) {
      return c.fail(
        "SERVICE_NOT_INITIALIZED",
        "MCP 服务管理器未初始化。请检查服务状态。",
        undefined,
        503
      );
    }

    // 验证服务和工具是否存在
    try {
      await validateServiceAndToolExistence(serviceName, toolName);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return c.fail("SERVICE_OR_TOOL_NOT_FOUND", errorMessage, undefined, 404);
    }

    // 从缓存中获取工具信息
    const cacheManager = new MCPCacheManager();
    const cachedTools = await cacheManager.getAllCachedTools();

    // 查找对应的工具
    const fullToolName = `${serviceName}__${toolName}`;
    const cachedTool = cachedTools.find((tool) => tool.name === fullToolName);

    if (!cachedTool) {
      return c.fail(
        "TOOL_NOT_FOUND",
        `在缓存中未找到工具: ${serviceName}/${toolName}`,
        undefined,
        404
      );
    }

    // 生成工具名称
    const finalToolName = customName || fullToolName;

    // 检查工具名称是否已存在
    const existingTools = configManager.getCustomMCPTools();
    const existingNames = new Set(existingTools.map((tool) => tool.name));

    if (existingNames.has(finalToolName)) {
      return c.fail(
        "TOOL_NAME_CONFLICT",
        `工具名称 "${finalToolName}" 已存在，请使用不同的自定义名称`,
        undefined,
        409
      );
    }

    // 创建 CustomMCPTool 配置
    const tool: CustomMCPTool = {
      name: finalToolName,
      description:
        customDescription ||
        cachedTool.description ||
        `MCP 工具: ${serviceName}/${toolName}`,
      inputSchema: cachedTool.inputSchema || {},
      handler: {
        type: "mcp",
        config: {
          serviceName,
          toolName,
        },
      },
      stats: {
        usageCount: 0,
        lastUsedTime: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      },
    };

    // 添加工具到配置
    configManager.addCustomMCPTool(tool);

    // 对于 MCP 工具，需要在 mcpServerConfig 中同步启用
    c.get("logger").info(
      `检测到 MCP 工具添加，同步启用 mcpServerConfig 中的工具: ${serviceName}/${toolName}`
    );

    // 获取当前的服务工具配置
    const serverToolsConfig = configManager.getServerToolsConfig(serviceName);

    if (serverToolsConfig?.toolName) {
      // 更新配置，启用该工具
      serverToolsConfig[toolName].enable = true;

      // 保存更新后的配置
      configManager.updateServerToolsConfig(serviceName, serverToolsConfig);

      c.get("logger").info(
        `已同步启用 mcpServerConfig 中的工具: ${serviceName}/${toolName}`
      );
    }

    c.get("logger").info(`成功添加 MCP 工具: ${finalToolName}`);

    const responseData: AddToolResponse = {
      tool,
      toolName: finalToolName,
      toolType: ToolType.MCP,
      addedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    };

    return c.success(responseData, `MCP 工具 "${finalToolName}" 添加成功`);
  }

  /**
   * 处理添加 Coze 工具
   */
  private async handleAddCozeTool(
    c: Context<AppContext>,
    data: CozeWorkflowData
  ): Promise<Response> {
    const { workflow, customName, customDescription, parameterConfig } = data;

    c.get("logger").info(`处理添加 Coze 工具: ${workflow.workflow_name}`);

    // 边界条件预检查
    const preCheckResult = performPreChecks(
      workflow,
      customName,
      customDescription
    );
    if (preCheckResult) {
      return c.fail(
        preCheckResult.code,
        preCheckResult.message,
        undefined,
        preCheckResult.status
      );
    }

    // 转换工作流为工具配置
    const tool = convertWorkflowToTool(
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
  }

  /**
   * 处理新格式的更新工具请求
   */
  private async handleNewFormatUpdateTool(
    c: Context<AppContext>,
    toolName: string,
    request: AddCustomToolRequest
  ): Promise<Response> {
    const { type, data } = request;

    c.get("logger").info(`处理新格式工具更新请求，类型: ${type}`);

    // 验证工具类型
    if (!CustomHandler.TOOL_TYPE_VALUES.includes(type)) {
      return c.fail(
        "INVALID_TOOL_TYPE",
        `不支持的工具类型: ${type}。支持的类型: ${CustomHandler.TOOL_TYPE_VALUES.join(", ")}`,
        undefined,
        400
      );
    }

    // 根据工具类型分发处理
    switch (type) {
      case ToolType.COZE:
        return await this.handleUpdateCozeTool(
          c,
          toolName,
          data as CozeWorkflowData
        );

      case ToolType.MCP:
      case ToolType.HTTP:
      case ToolType.FUNCTION: {
        return c.fail(
          "TOOL_TYPE_NOT_IMPLEMENTED",
          `工具类型 ${type} 暂不支持更新操作，目前仅支持 Coze 类型`,
          undefined,
          501
        );
      }

      default: {
        return c.fail(
          "UNKNOWN_TOOL_TYPE",
          `未知的工具类型: ${type}`,
          undefined,
          400
        );
      }
    }
  }

  /**
   * 处理更新 Coze 工具
   */
  private async handleUpdateCozeTool(
    c: Context<AppContext>,
    toolName: string,
    data: CozeWorkflowData
  ): Promise<Response> {
    const { workflow, customDescription, parameterConfig } = data;

    c.get("logger").info(`处理更新 Coze 工具: ${toolName}`);

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

    // 更新工具配置
    const updatedTool = updateCozeToolConfig(
      existingTool,
      workflow,
      customDescription,
      parameterConfig
    );

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
  }
}
