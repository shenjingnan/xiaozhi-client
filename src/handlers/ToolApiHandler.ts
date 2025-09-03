/**
 * 工具调用 API 处理器
 * 处理通过 HTTP API 调用 MCP 工具的请求
 */

import type { Context } from "hono";
import Ajv from "ajv";
import { type Logger, logger } from "../Logger.js";
import { configManager } from "../configManager.js";
import { MCPServiceManagerSingleton } from "../services/MCPServiceManagerSingleton.js";

/**
 * 工具调用请求接口
 */
interface ToolCallRequest {
  serviceName: string;
  toolName: string;
  args: any;
}

/**
 * 工具调用响应接口
 */
interface ToolCallResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
  message?: string;
}

/**
 * 工具调用 API 处理器
 */
export class ToolApiHandler {
  private logger: Logger;
  private ajv: Ajv;

  constructor() {
    this.logger = logger.withTag("ToolApiHandler");
    this.ajv = new Ajv({ allErrors: true, verbose: true });
  }

  /**
   * 创建成功响应
   */
  private createSuccessResponse(data: any, message?: string): ToolCallResponse {
    return {
      success: true,
      data,
      message,
    };
  }

  /**
   * 创建错误响应
   */
  private createErrorResponse(code: string, message: string): ToolCallResponse {
    return {
      success: false,
      error: {
        code,
        message,
      },
    };
  }

  /**
   * 调用 MCP 工具
   * POST /api/tools/call
   */
  async callTool(c: Context): Promise<Response> {
    try {
      this.logger.info("处理工具调用请求");

      // 解析请求体
      const requestBody: ToolCallRequest = await c.req.json();
      const { serviceName, toolName, args } = requestBody;

      // 验证请求参数
      if (!serviceName || !toolName) {
        const errorResponse = this.createErrorResponse(
          "INVALID_REQUEST",
          "serviceName 和 toolName 是必需的参数"
        );
        return c.json(errorResponse, 400);
      }

      this.logger.info(
        `准备调用工具: ${serviceName}/${toolName}，参数:`,
        JSON.stringify(args)
      );

      // 检查 MCPServiceManager 是否已初始化
      if (!MCPServiceManagerSingleton.isInitialized()) {
        const errorResponse = this.createErrorResponse(
          "SERVICE_NOT_INITIALIZED",
          "MCP 服务管理器未初始化。请检查服务状态。"
        );
        return c.json(errorResponse, 503);
      }

      // 获取服务管理器实例
      const serviceManager = await MCPServiceManagerSingleton.getInstance();

      // 验证服务和工具是否存在
      await this.validateServiceAndTool(serviceManager, serviceName, toolName);

      // 对于 customMCP 工具，进行参数验证
      if (serviceName === 'customMCP') {
        await this.validateCustomMCPArguments(serviceManager, toolName, args || {});
      }

      // 调用工具 - 特殊处理 customMCP 服务
      let result: any;
      if (serviceName === 'customMCP') {
        // 对于 customMCP 服务，直接使用 toolName 调用
        result = await serviceManager.callTool(toolName, args || {});
      } else {
        // 对于标准 MCP 服务，使用 serviceName__toolName 格式
        const toolKey = `${serviceName}__${toolName}`;
        result = await serviceManager.callTool(toolKey, args || {});
      }

      // this.logger.debug(`工具调用成功: ${serviceName}/${toolName}`);

      return c.json(this.createSuccessResponse(result, "工具调用成功"));
    } catch (error) {
      this.logger.error("工具调用失败:", error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      let errorCode = "TOOL_CALL_ERROR";

      // 根据错误类型设置不同的错误码
      if (errorMessage.includes("不存在")) {
        errorCode = "SERVICE_OR_TOOL_NOT_FOUND";
      } else if (
        errorMessage.includes("未启动") ||
        errorMessage.includes("未连接")
      ) {
        errorCode = "SERVICE_NOT_AVAILABLE";
      } else if (errorMessage.includes("已被禁用")) {
        errorCode = "TOOL_DISABLED";
      } else if (errorMessage.includes("参数验证失败")) {
        errorCode = "INVALID_ARGUMENTS";
      } else if (errorMessage.includes("CustomMCP") || errorMessage.includes("customMCP")) {
        errorCode = "CUSTOM_MCP_ERROR";
      } else if (errorMessage.includes("工作流调用失败") || errorMessage.includes("API 请求失败")) {
        errorCode = "EXTERNAL_API_ERROR";
      } else if (errorMessage.includes("超时")) {
        errorCode = "TIMEOUT_ERROR";
      }

      const errorResponse = this.createErrorResponse(errorCode, errorMessage);
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取可用工具列表
   * GET /api/tools/list
   */
  async listTools(c: Context): Promise<Response> {
    try {
      this.logger.info("处理获取工具列表请求");

      // 检查 MCPServiceManager 是否已初始化
      if (!MCPServiceManagerSingleton.isInitialized()) {
        const errorResponse = this.createErrorResponse(
          "SERVICE_NOT_INITIALIZED",
          "MCP 服务管理器未初始化。请检查服务状态。"
        );
        return c.json(errorResponse, 503);
      }

      // 获取服务管理器实例
      const serviceManager = await MCPServiceManagerSingleton.getInstance();

      // 获取所有工具
      const allTools = serviceManager.getAllTools();

      // 按服务分组工具
      const toolsByService: Record<string, any[]> = {};
      for (const tool of allTools) {
        const serviceName = tool.serviceName;

        if (!toolsByService[serviceName]) {
          toolsByService[serviceName] = [];
        }

        // 对于 customMCP 工具，直接使用工具名称
        // 对于标准 MCP 工具，使用原始名称
        const displayName = serviceName === "customMCP" ? tool.name : tool.originalName;

        toolsByService[serviceName].push({
          name: displayName,
          fullName: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
      }

      this.logger.info(`获取工具列表成功，共 ${allTools.length} 个工具`);

      return c.json(
        this.createSuccessResponse(
          {
            totalTools: allTools.length,
            services: toolsByService,
          },
          "获取工具列表成功"
        )
      );
    } catch (error) {
      this.logger.error("获取工具列表失败:", error);

      const errorResponse = this.createErrorResponse(
        "LIST_TOOLS_ERROR",
        error instanceof Error ? error.message : "获取工具列表失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 验证服务和工具是否存在
   * @private
   */
  private async validateServiceAndTool(
    serviceManager: any,
    serviceName: string,
    toolName: string
  ): Promise<void> {
    // 特殊处理 customMCP 服务
    if (serviceName === 'customMCP') {
      // 验证 customMCP 工具是否存在
      if (!serviceManager.hasCustomMCPTool(toolName)) {
        const availableTools = serviceManager.getCustomMCPTools().map((tool: any) => tool.name);

        if (availableTools.length === 0) {
          throw new Error(
            `customMCP 工具 '${toolName}' 不存在。当前没有配置任何 customMCP 工具。请检查 xiaozhi.config.json 中的 customMCP 配置。`
          );
        }

        throw new Error(
          `customMCP 工具 '${toolName}' 不存在。可用的 customMCP 工具: ${availableTools.join(", ")}。请使用 'xiaozhi mcp list' 查看所有可用工具。`
        );
      }

      // 验证 customMCP 工具配置是否有效
      try {
        const customTools = serviceManager.getCustomMCPTools();
        const targetTool = customTools.find((tool: any) => tool.name === toolName);

        if (targetTool && !targetTool.description) {
          this.logger.warn(`customMCP 工具 '${toolName}' 缺少描述信息`);
        }

        if (targetTool && !targetTool.inputSchema) {
          this.logger.warn(`customMCP 工具 '${toolName}' 缺少输入参数定义`);
        }
      } catch (error) {
        this.logger.error(`验证 customMCP 工具 '${toolName}' 配置时出错:`, error);
        throw new Error(
          `customMCP 工具 '${toolName}' 配置验证失败。请检查配置文件中的工具定义。`
        );
      }

      return;
    }

    // 标准 MCP 服务验证逻辑
    // 检查配置中是否存在该服务
    const mcpServers = configManager.getMcpServers();
    if (!mcpServers[serviceName]) {
      const availableServices = Object.keys(mcpServers);
      throw new Error(
        `服务 '${serviceName}' 不存在。可用服务: ${availableServices.join(", ")}`
      );
    }

    // 检查服务是否已启动并连接
    const serviceInstance = serviceManager.getService(serviceName);
    if (!serviceInstance) {
      throw new Error(
        `服务 '${serviceName}' 未启动。请检查服务配置或重新启动 xiaozhi 服务。`
      );
    }

    if (!serviceInstance.isConnected()) {
      throw new Error(
        `服务 '${serviceName}' 未连接。请检查服务状态或重新启动 xiaozhi 服务。`
      );
    }

    // 检查工具是否存在
    const tools = serviceInstance.getTools();
    const toolExists = tools.some((tool: any) => tool.name === toolName);
    if (!toolExists) {
      const availableTools = tools.map((tool: any) => tool.name);
      throw new Error(
        `工具 '${toolName}' 在服务 '${serviceName}' 中不存在。可用工具: ${availableTools.join(", ")}`
      );
    }

    // 检查工具是否已启用
    const toolsConfig = configManager.getServerToolsConfig(serviceName);
    const toolConfig = toolsConfig[toolName];
    if (toolConfig && !toolConfig.enable) {
      throw new Error(
        `工具 '${toolName}' 已被禁用。请使用 'xiaozhi mcp tool ${serviceName} ${toolName} enable' 启用该工具。`
      );
    }
  }

  /**
   * 验证 customMCP 工具的参数
   * @private
   */
  private async validateCustomMCPArguments(
    serviceManager: any,
    toolName: string,
    args: any
  ): Promise<void> {
    try {
      // 获取工具的 inputSchema
      const customTools = serviceManager.getCustomMCPTools();
      const targetTool = customTools.find((tool: any) => tool.name === toolName);

      if (!targetTool) {
        throw new Error(`customMCP 工具 '${toolName}' 不存在`);
      }

      // 如果工具没有定义 inputSchema，跳过验证
      if (!targetTool.inputSchema) {
        this.logger.warn(`customMCP 工具 '${toolName}' 没有定义 inputSchema，跳过参数验证`);
        return;
      }

      // 使用 AJV 验证参数
      const validate = this.ajv.compile(targetTool.inputSchema);
      const valid = validate(args);

      if (!valid) {
        // 构建详细的错误信息
        const errors = validate.errors || [];
        const errorMessages = errors.map(error => {
          const path = error.instancePath || error.schemaPath || '';
          const message = error.message || '未知错误';

          if (error.keyword === 'required') {
            const missingProperty = error.params?.missingProperty || '未知字段';
            return `缺少必需参数: ${missingProperty}`;
          }

          if (error.keyword === 'type') {
            const expectedType = error.params?.type || '未知类型';
            return `参数 ${path} 类型错误，期望: ${expectedType}`;
          }

          if (error.keyword === 'enum') {
            const allowedValues = error.params?.allowedValues || [];
            return `参数 ${path} 值无效，允许的值: ${allowedValues.join(', ')}`;
          }

          return `参数 ${path} ${message}`;
        });

        const errorMessage = `参数验证失败: ${errorMessages.join('; ')}`;
        this.logger.error(`customMCP 工具 '${toolName}' 参数验证失败:`, errorMessage);

        throw new Error(errorMessage);
      }

      this.logger.debug(`customMCP 工具 '${toolName}' 参数验证通过`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('参数验证失败')) {
        throw error;
      }

      this.logger.error(`验证 customMCP 工具 '${toolName}' 参数时出错:`, error);
      throw new Error(`参数验证过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}
