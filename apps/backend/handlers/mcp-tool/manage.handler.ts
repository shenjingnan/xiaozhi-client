/**
 * MCP 工具管理处理器
 * 处理启用/禁用/查询 MCP 工具状态的请求
 */

import type { AppContext } from "@/types/hono.context.js";
import { configManager } from "@xiaozhi-client/config";
import type { Context } from "hono";
import {
  validateServiceAndToolExistence,
  validateToolIdentifier,
} from "./utils/index.js";

/**
 * MCP 工具管理处理器类
 * 处理 POST /api/tools/mcp/manage 和 POST /api/tools/mcp/list 请求
 */
export class ManageHandler {
  /**
   * 统一的 MCP 工具管理接口
   * POST /api/tools/mcp/manage
   * 支持 action: enable | disable | status | toggle
   */
  async manageMCPTool(c: Context<AppContext>): Promise<Response> {
    try {
      const requestBody = await c.req.json();
      const { action, serverName, toolName, description } = requestBody;

      // 验证 action 参数
      if (!action || typeof action !== "string") {
        return c.fail(
          "INVALID_REQUEST",
          "action 参数不能为空且必须是字符串",
          undefined,
          400
        );
      }

      const validActions = ["enable", "disable", "status", "toggle"];
      if (!validActions.includes(action)) {
        return c.fail(
          "INVALID_ACTION",
          `无效的 action: ${action}。支持的 action: ${validActions.join(", ")}`,
          undefined,
          400
        );
      }

      // 验证服务名和工具名
      validateToolIdentifier(serverName, toolName);

      // 根据不同的 action 执行相应操作
      switch (action) {
        case "enable":
          return this.handleEnableTool(c, serverName, toolName, description);
        case "disable":
          return this.handleDisableTool(c, serverName, toolName);
        case "status":
          return this.handleGetToolStatus(c, serverName, toolName);
        case "toggle":
          return this.handleToggleTool(c, serverName, toolName);
        default: {
          return c.fail(
            "INVALID_ACTION",
            `未实现的 action: ${action}`,
            undefined,
            400
          );
        }
      }
    } catch (error) {
      c.get("logger").error("管理 MCP 工具失败:", error);
      const errorMessage =
        error instanceof Error ? error.message : "管理 MCP 工具失败";
      return c.fail("TOOL_MANAGE_ERROR", errorMessage, undefined, 500);
    }
  }

  /**
   * 获取服务工具列表
   * POST /api/tools/mcp/list
   */
  async listMCPTools(c: Context<AppContext>): Promise<Response> {
    try {
      const requestBody = await c.req.json();
      const { serverName, includeUsageStats } = requestBody;

      // 如果指定了服务名，获取该服务的工具列表
      if (serverName) {
        return this.handleListServerTools(c, serverName, includeUsageStats);
      }

      // 否则获取所有服务的工具列表
      return this.handleListAllTools(c, includeUsageStats);
    } catch (error) {
      c.get("logger").error("获取工具列表失败:", error);
      return c.fail(
        "GET_TOOL_LIST_ERROR",
        error instanceof Error ? error.message : "获取工具列表失败",
        undefined,
        500
      );
    }
  }

  /**
   * 处理启用工具
   */
  private async handleEnableTool(
    c: Context<AppContext>,
    serverName: string,
    toolName: string,
    description?: string
  ): Promise<Response> {
    // 验证服务存在性
    await validateServiceAndToolExistence(serverName, toolName);

    // 设置工具为启用状态
    configManager.setToolEnabled(serverName, toolName, true, description);

    // 获取更新后的工具配置
    const toolsConfig = configManager.getServerToolsConfig(serverName);
    const toolConfig = toolsConfig[toolName];

    c.get("logger").info(`工具已启用: ${serverName}/${toolName}`);

    return c.success(
      {
        serverName,
        toolName,
        enabled: true,
        description: toolConfig?.description || description || "",
      },
      `工具 "${serverName}__${toolName}" 启用成功`
    );
  }

  /**
   * 处理禁用工具
   */
  private async handleDisableTool(
    c: Context<AppContext>,
    serverName: string,
    toolName: string
  ): Promise<Response> {
    // 验证服务存在性
    await validateServiceAndToolExistence(serverName, toolName);

    // 设置工具为禁用状态
    configManager.setToolEnabled(serverName, toolName, false);

    c.get("logger").info(`工具已禁用: ${serverName}/${toolName}`);

    return c.success(
      {
        serverName,
        toolName,
        enabled: false,
      },
      `工具 "${serverName}__${toolName}" 禁用成功`
    );
  }

  /**
   * 处理获取工具状态
   */
  private async handleGetToolStatus(
    c: Context<AppContext>,
    serverName: string,
    toolName: string
  ): Promise<Response> {
    // 获取工具配置
    const toolsConfig = configManager.getServerToolsConfig(serverName);
    const toolConfig = toolsConfig[toolName];

    if (!toolConfig) {
      return c.fail(
        "TOOL_NOT_FOUND",
        `工具 "${serverName}__${toolName}" 不存在或未配置`,
        undefined,
        404
      );
    }

    return c.success(
      {
        serverName,
        toolName,
        enabled: toolConfig.enable !== false,
        description: toolConfig.description || "",
        usageCount: toolConfig.usageCount,
        lastUsedTime: toolConfig.lastUsedTime,
      },
      "工具状态获取成功"
    );
  }

  /**
   * 处理切换工具状态
   */
  private async handleToggleTool(
    c: Context<AppContext>,
    serverName: string,
    toolName: string
  ): Promise<Response> {
    // 验证服务存在性
    await validateServiceAndToolExistence(serverName, toolName);

    // 获取当前状态
    const currentEnabled = configManager.isToolEnabled(serverName, toolName);

    // 切换状态
    const newEnabled = !currentEnabled;
    configManager.setToolEnabled(serverName, toolName, newEnabled);

    c.get("logger").info(
      `工具状态已切换: ${serverName}/${toolName} -> ${newEnabled}`
    );

    return c.success(
      {
        serverName,
        toolName,
        enabled: newEnabled,
      },
      `工具 "${serverName}__${toolName}" 已${newEnabled ? "启用" : "禁用"}`
    );
  }

  /**
   * 处理获取指定服务的工具列表
   */
  private async handleListServerTools(
    c: Context<AppContext>,
    serverName: string,
    includeUsageStats?: boolean
  ): Promise<Response> {
    // 检查服务是否存在
    const mcpServers = configManager.getMcpServers();
    if (!mcpServers[serverName]) {
      return c.fail(
        "SERVICE_NOT_FOUND",
        `MCP 服务 "${serverName}" 不存在`,
        undefined,
        404
      );
    }

    // 获取工具配置
    const toolsConfig = configManager.getServerToolsConfig(serverName);
    const tools = Object.entries(toolsConfig).map(([toolName, toolConfig]) => {
      const result: Record<string, unknown> = {
        toolName,
        enabled: toolConfig.enable !== false,
        description: toolConfig.description || "",
      };

      if (includeUsageStats) {
        result.usageCount = toolConfig.usageCount;
        result.lastUsedTime = toolConfig.lastUsedTime;
      }

      return result;
    });

    const enabledCount = tools.filter((t) => t.enabled).length;
    const disabledCount = tools.length - enabledCount;

    return c.success(
      {
        serverName,
        tools,
        total: tools.length,
        enabledCount,
        disabledCount,
      },
      "获取工具列表成功"
    );
  }

  /**
   * 处理获取所有服务的工具列表
   */
  private async handleListAllTools(
    c: Context<AppContext>,
    includeUsageStats?: boolean
  ): Promise<Response> {
    const mcpServerConfig = configManager.getMcpServerConfig();

    // 定义工具信息接口
    interface ToolInfo {
      toolName: string;
      enabled: boolean;
      description: string;
      usageCount?: number;
      lastUsedTime?: string;
    }

    // 定义服务器工具信息接口
    interface ServerToolsInfo {
      serverName: string;
      tools: ToolInfo[];
      total: number;
      enabledCount: number;
      disabledCount: number;
    }

    // 定义返回结果接口
    interface AllToolsResult {
      servers: ServerToolsInfo[];
      totalTools: number;
      totalEnabled: number;
      totalDisabled: number;
    }

    const result: AllToolsResult = {
      servers: [],
      totalTools: 0,
      totalEnabled: 0,
      totalDisabled: 0,
    };

    for (const [serverName, serverConfig] of Object.entries(mcpServerConfig)) {
      const tools: ToolInfo[] = Object.entries(serverConfig.tools || {}).map(
        ([toolName, toolConfig]) => {
          const toolInfo: ToolInfo = {
            toolName,
            enabled: toolConfig.enable !== false,
            description: toolConfig.description || "",
          };

          if (includeUsageStats) {
            toolInfo.usageCount = toolConfig.usageCount;
            toolInfo.lastUsedTime = toolConfig.lastUsedTime;
          }

          return toolInfo;
        }
      );

      const enabledCount = tools.filter((t) => t.enabled).length;

      result.servers.push({
        serverName,
        tools,
        total: tools.length,
        enabledCount,
        disabledCount: tools.length - enabledCount,
      });

      result.totalTools += tools.length;
      result.totalEnabled += enabledCount;
      result.totalDisabled += tools.length - enabledCount;
    }

    return c.success(result, "获取所有工具列表成功");
  }
}
