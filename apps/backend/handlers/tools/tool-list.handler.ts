/**
 * 工具列表查询处理器
 * 负责处理各类工具列表查询请求
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import type { EnhancedToolInfo } from "@/lib/mcp/types.js";
import type { AppContext } from "@/types/hono.context.js";
import type { CustomMCPToolWithStats } from "@/types/toolApi.js";
import type { ToolSortField, sortTools } from "@/utils/toolSorters";
import { configManager } from "@xiaozhi-client/config";
import type { CustomMCPTool } from "@xiaozhi-client/config";
import type { Context } from "hono";

/**
 * 工具列表查询处理器类
 * 负责处理所有工具列表查询相关的逻辑
 */
export class ToolListHandler {
  private logger: Logger;
  private sortTools: typeof sortTools;

  constructor() {
    this.logger = logger;
    // 动态导入 sortTools 以避免循环依赖
    this.sortTools = (...args: Parameters<typeof sortTools>) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("@/utils/toolSorters").sortTools(...args);
    };
  }

  /**
   * 获取自定义 MCP 工具列表
   * GET /api/tools/custom
   */
  async getCustomTools(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理获取自定义 MCP 工具列表请求");

      // 检查配置文件是否存在
      if (!configManager.configExists()) {
        return c.fail(
          "CONFIG_NOT_FOUND",
          "配置文件不存在，请先运行 'xiaozhi init' 初始化配置",
          undefined,
          404
        );
      }

      // 获取自定义 MCP 工具列表
      let customTools: CustomMCPTool[] = [];
      let configPath = "";

      try {
        customTools = configManager.getCustomMCPTools();
        configPath = configManager.getConfigPath();
      } catch (error) {
        c.get("logger").error("读取自定义 MCP 工具配置失败:", error);
        return c.fail(
          "CONFIG_PARSE_ERROR",
          `配置文件解析失败: ${error instanceof Error ? error.message : "未知错误"}`,
          undefined,
          500
        );
      }

      // 检查是否配置了自定义 MCP 工具
      if (!customTools || customTools.length === 0) {
        c.get("logger").info("未配置自定义 MCP 工具");
        return c.success(
          {
            tools: [],
            totalTools: 0,
            configPath,
          },
          "未配置自定义 MCP 工具"
        );
      }

      // 验证工具配置的有效性
      const isValid = configManager.validateCustomMCPTools(customTools);
      if (!isValid) {
        c.get("logger").warn("自定义 MCP 工具配置验证失败");
        return c.fail(
          "INVALID_TOOL_CONFIG",
          "自定义 MCP 工具配置验证失败，请检查配置文件中的工具定义",
          undefined,
          400
        );
      }

      c.get("logger").info(
        `获取自定义 MCP 工具列表成功，共 ${customTools.length} 个工具`
      );

      return c.success(
        {
          tools: customTools,
          totalTools: customTools.length,
          configPath,
        },
        "获取自定义 MCP 工具列表成功"
      );
    } catch (error) {
      c.get("logger").error("获取自定义 MCP 工具列表失败:", error);

      return c.fail(
        "GET_CUSTOM_TOOLS_ERROR",
        error instanceof Error ? error.message : "获取自定义 MCP 工具列表失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取可用工具列表
   * GET /api/tools/list?status=enabled|disabled|all&sortBy=name
   *
   * @param status 筛选状态：'enabled'（已启用）、'disabled'（未启用）、'all'（全部，默认）
   * @param sortBy 排序字段：'name'（工具名称，默认）、'enabled'（启用状态）、'usageCount'（使用次数）、'lastUsedTime'（最近使用时间）
   */
  async listTools(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取工具列表请求");

      // 获取筛选参数
      const status =
        (c.req.query("status") as "enabled" | "disabled" | "all") || "all";

      // 解析排序参数并验证
      const sortByParam = c.req.query("sortBy");
      const validSortFields: ToolSortField[] = [
        "name",
        "enabled",
        "usageCount",
        "lastUsedTime",
      ];
      const sortBy = validSortFields.includes(sortByParam as ToolSortField)
        ? (sortByParam as ToolSortField)
        : "name";

      // 如果提供了无效的排序字段，返回错误
      if (
        sortByParam &&
        !validSortFields.includes(sortByParam as ToolSortField)
      ) {
        return c.fail(
          "INVALID_SORT_FIELD",
          `无效的排序字段: ${sortByParam}。支持的排序字段: ${validSortFields.join(", ")}`,
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

      let rawTools: EnhancedToolInfo[] = serviceManager.getAllTools(status);

      // 应用排序
      rawTools = this.sortTools(rawTools, { field: sortBy });

      // 转换为 CustomMCPToolWithStats 格式（使用共享类型）
      const tools: CustomMCPToolWithStats[] = rawTools.map(
        (tool: EnhancedToolInfo) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          handler: {
            type: "mcp",
            config: {
              serviceName: tool.serviceName,
              toolName: tool.originalName,
            },
          },
          enabled: tool.enabled,
          usageCount: tool.usageCount,
          lastUsedTime: tool.lastUsedTime,
        })
      );

      // 返回对象格式的响应
      const responseData = {
        list: tools,
        total: tools.length,
      };

      return c.success(responseData, `获取工具列表成功（${status}）`);
    } catch (error) {
      c.get("logger").error("获取工具列表失败:", error);

      return c.fail("GET_TOOLS_FAILED", "获取工具列表失败", undefined, 500);
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
   * 处理获取指定服务的工具列表
   * @private
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
   * @private
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
