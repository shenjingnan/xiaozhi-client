/**
 * 工具调用 API 处理器
 * 处理通过 HTTP API 调用 MCP 工具的请求
 */

import type { Context } from "hono";
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

  constructor() {
    this.logger = logger.withTag("ToolApiHandler");
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

      // 调用工具
      const toolKey = `${serviceName}__${toolName}`;
      const result = await serviceManager.callTool(toolKey, args || {});

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
        const [serviceName] = tool.name.split("__");
        if (!toolsByService[serviceName]) {
          toolsByService[serviceName] = [];
        }
        toolsByService[serviceName].push({
          name: tool.name.replace(`${serviceName}__`, ""),
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
}
