import { logger } from "@/Logger.js";
import type { MCPCacheManager } from "@/lib/mcp/cache.js";
import type { ToolCallLogger } from "@/lib/mcp/log.js";
import type {
  CustomMCPTool,
  EnhancedToolInfo,
  MCPServiceConfig,
  ToolCallResult,
  ToolInfo,
  ToolStatusFilter,
} from "@/lib/mcp/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { configManager } from "@xiaozhi-client/config";
import type { MCPToolConfig } from "@xiaozhi-client/config";
import type { CustomMCPHandler } from "../custom.js";

// 工具调用结果类型（从 types 导入）

/**
 * MCP 工具注册表
 * 负责工具的聚合、查询、调用和缓存管理
 */
export class MCPToolRegistry {
  private tools: Map<string, ToolInfo> = new Map(); // 缓存工具信息，保持向后兼容
  private customMCPHandler: CustomMCPHandler; // CustomMCP 工具处理器
  private cacheManager: MCPCacheManager; // 缓存管理器
  private toolCallLogger: ToolCallLogger; // 工具调用记录器

  constructor(
    customMCPHandler: CustomMCPHandler,
    cacheManager: MCPCacheManager,
    toolCallLogger: ToolCallLogger
  ) {
    this.customMCPHandler = customMCPHandler;
    this.cacheManager = cacheManager;
    this.toolCallLogger = toolCallLogger;
  }

  /**
   * 刷新工具缓存
   * @param services 服务 Map
   * @param configs 服务配置
   */
  async refreshToolsCache(
    services: Map<string, unknown>,
    configs: Record<string, MCPServiceConfig>
  ): Promise<void> {
    this.tools.clear();

    for (const [serviceName, service] of services) {
      // 检查服务是否连接
      const isConnected = (
        service as { isConnected?: () => boolean }
      )?.isConnected?.();
      if (!isConnected) {
        continue;
      }

      const tools = (service as { getTools?: () => Tool[] })?.getTools?.();
      if (!tools) {
        continue;
      }

      const config = configs[serviceName];

      // 异步写入缓存（不阻塞主流程）
      if (config) {
        this.cacheManager
          .writeCacheEntry(serviceName, tools, config)
          .then(() => {
            logger.debug(`[ToolRegistry] 已将 ${serviceName} 工具列表写入缓存`);
          })
          .catch((error) => {
            logger.warn(
              `[ToolRegistry] 写入缓存失败: ${serviceName}, 错误: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          });
      }

      // 原有逻辑保持不变
      for (const tool of tools) {
        const toolKey = `${serviceName}__${tool.name}`;
        this.tools.set(toolKey, {
          serviceName,
          originalName: tool.name,
          tool,
        });
      }
    }

    // 同步工具配置到配置文件
    await this.syncToolsConfigToFile(services, configs);
  }

  /**
   * 获取所有可用工具
   * @param services 服务 Map
   * @param status 工具状态过滤：'enabled' 仅返回已启用工具，'disabled' 仅返回未启用工具，'all' 返回所有工具
   * @returns 工具数组，包含工具的启用状态信息
   */
  getAllTools(
    services: Map<string, unknown>,
    status: ToolStatusFilter = "all"
  ): EnhancedToolInfo[] {
    const allTools: EnhancedToolInfo[] = [];

    // 1. 收集所有已连接服务的工具（包含启用状态过滤）
    for (const [serviceName, service] of services) {
      try {
        const isConnected = (
          service as { isConnected?: () => boolean }
        )?.isConnected?.();
        if (!isConnected) {
          continue;
        }

        const serviceTools = (
          service as { getTools?: () => Tool[] }
        )?.getTools?.();
        if (!serviceTools) {
          continue;
        }

        for (const tool of serviceTools) {
          try {
            // 检查工具启用状态 - 这个调用可能会抛出异常
            const isEnabled = configManager.isToolEnabled(
              serviceName,
              tool.name
            );
            const toolConfig =
              configManager.getMcpServerConfig()[serviceName].tools[tool.name];

            // 根据 status 参数过滤工具
            if (status === "enabled" && !isEnabled) {
              continue; // 跳过未启用的工具
            }
            if (status === "disabled" && isEnabled) {
              continue; // 跳过已启用的工具
            }

            const toolKey = `${serviceName}__${tool.name}`;
            allTools.push({
              name: toolKey,
              description: tool.description || "",
              inputSchema: tool.inputSchema,
              serviceName,
              originalName: tool.name,
              enabled: isEnabled,
              usageCount: toolConfig.usageCount ?? 0,
              lastUsedTime: toolConfig.lastUsedTime ?? "",
            });
          } catch (toolError) {
            logger.warn(
              `[ToolRegistry] 检查工具 ${serviceName}.${tool.name} 启用状态失败，跳过该工具:`,
              toolError
            );
          }
        }
      } catch (serviceError) {
        logger.warn(
          `[ToolRegistry] 获取服务 ${serviceName} 的工具失败，跳过该服务:`,
          serviceError
        );
      }
    }

    // 2. 添加CustomMCP工具（默认视为已启用）
    let customTools: Tool[] = [];
    try {
      customTools = this.customMCPHandler.getTools();
      logger.debug(
        `[ToolRegistry] 成功获取 ${customTools.length} 个 customMCP 工具`
      );
    } catch (error) {
      logger.warn(
        "[ToolRegistry] 获取 CustomMCP 工具失败，将只返回标准 MCP 工具:",
        error
      );
      // 根据技术方案要求，CustomMCP 工具获取失败时不应该影响标准 MCP 工具的返回
      customTools = [];
    }

    // CustomMCP 工具默认视为已启用
    if (status !== "disabled") {
      for (const tool of customTools) {
        try {
          allTools.push({
            name: tool.name,
            description: tool.description || "",
            inputSchema: tool.inputSchema,
            serviceName: this.getServiceNameForTool(tool),
            originalName: tool.name,
            enabled: true, // CustomMCP 工具默认启用
            usageCount: 0,
            lastUsedTime: "",
          });
        } catch (toolError) {
          logger.warn(
            `[ToolRegistry] 处理 CustomMCP 工具 ${tool.name} 失败，跳过该工具:`,
            toolError
          );
        }
      }
    }

    logger.debug(
      `[ToolRegistry] 成功获取 ${allTools.length} 个可用工具（status=${status}）`
    );
    return allTools;
  }

  /**
   * 根据工具配置确定服务名称
   * @param tool 工具对象
   * @returns 服务名称
   */
  private getServiceNameForTool(tool: CustomMCPTool): string {
    if (tool.handler?.type === "mcp") {
      // 如果是从 MCP 同步的工具，返回原始服务名称
      const config = tool.handler.config as
        | { serviceName?: string; toolName?: string }
        | undefined;
      return config?.serviceName || "customMCP";
    }
    return "customMCP";
  }

  /**
   * 根据工具信息获取日志记录用的服务名称
   * @param customTool CustomMCP 工具信息
   * @returns 用于日志记录的服务名称
   */
  getLogServerName(customTool: CustomMCPTool): string {
    if (!customTool?.handler) {
      return "custom";
    }

    switch (customTool.handler.type) {
      case "mcp": {
        const config = customTool.handler.config as
          | { serviceName?: string; toolName?: string }
          | undefined;
        return config?.serviceName || "customMCP";
      }
      case "coze":
        return "coze";
      case "dify":
        return "dify";
      case "n8n":
        return "n8n";
      default:
        return "custom";
    }
  }

  /**
   * 根据工具信息获取原始工具名称
   * @param toolName 格式化后的工具名称
   * @param customTool CustomMCP 工具信息
   * @param toolInfo 标准工具信息
   * @returns 原始工具名称
   */
  getOriginalToolName(
    toolName: string,
    customTool: CustomMCPTool | undefined,
    toolInfo?: ToolInfo
  ): string {
    if (customTool) {
      // CustomMCP 工具
      if (customTool.handler?.type === "mcp") {
        const config = customTool.handler.config as
          | { serviceName?: string; toolName?: string }
          | undefined;
        return config?.toolName || toolName;
      }
      return toolName;
    }

    // 标准 MCP 工具
    return toolInfo?.originalName || toolName;
  }

  /**
   * 调用 MCP 工具（支持标准 MCP 工具和 customMCP 工具）
   * @param toolName 工具名称
   * @param arguments_ 工具参数
   * @param options 选项（超时等）
   * @param services 服务 Map
   * @param updateStatsCallback 统计更新回调
   * @returns 工具调用结果
   */
  async callTool(
    toolName: string,
    arguments_: Record<string, unknown>,
    options: { timeout?: number } | undefined,
    services: Map<string, unknown>,
    updateStatsCallback: (
      toolName: string,
      serviceName: string,
      originalToolName: string,
      isSuccess: boolean
    ) => Promise<void>
  ): Promise<ToolCallResult> {
    const startTime = Date.now();

    // 初始化日志信息
    let logServerName = "unknown";
    let originalToolName: string = toolName;

    try {
      let result: ToolCallResult;

      // 检查是否是 customMCP 工具
      if (this.customMCPHandler.hasTool(toolName)) {
        const customTool = this.customMCPHandler.getToolInfo(toolName);

        // 设置日志信息（添加空值检查）
        if (customTool) {
          logServerName = this.getLogServerName(customTool);
          originalToolName = this.getOriginalToolName(toolName, customTool);
        }

        if (customTool?.handler?.type === "mcp") {
          // 对于 mcp 类型的工具，直接路由到对应的 MCP 服务
          result = await this.callMCPTool(
            toolName,
            customTool.handler.config,
            arguments_,
            services
          );

          // 异步更新工具调用统计（成功调用）
          await updateStatsCallback(
            toolName,
            customTool.handler.config.serviceName,
            customTool.handler.config.toolName,
            true
          );
        } else {
          // 其他类型的 customMCP 工具正常处理，传递options参数
          result = await this.customMCPHandler.callTool(
            toolName,
            arguments_,
            options
          );
          logger.info(`[ToolRegistry] CustomMCP 工具 ${toolName} 调用成功`);

          // 异步更新工具调用统计（成功调用）
          await updateStatsCallback(toolName, "customMCP", toolName, true);
        }
      } else {
        // 如果不是 customMCP 工具，则查找标准 MCP 工具
        const toolInfo = this.tools.get(toolName);
        if (!toolInfo) {
          throw new Error(`未找到工具: ${toolName}`);
        }

        // 设置日志信息
        logServerName = toolInfo.serviceName;
        originalToolName = toolInfo.originalName;

        const service = services.get(toolInfo.serviceName);
        if (!service) {
          throw new Error(`服务 ${toolInfo.serviceName} 不可用`);
        }

        const isConnected = (
          service as { isConnected?: () => boolean }
        )?.isConnected?.();
        if (!isConnected) {
          throw new Error(`服务 ${toolInfo.serviceName} 未连接`);
        }

        result = (await (
          service as {
            callTool: (name: string, args: unknown) => Promise<unknown>;
          }
        ).callTool(toolInfo.originalName, arguments_ || {})) as ToolCallResult;

        logger.debug("[ToolRegistry] 工具调用成功", {
          toolName: toolName,
          result: result,
        });

        // 异步更新工具调用统计（成功调用）
        await updateStatsCallback(
          toolName,
          toolInfo.serviceName,
          toolInfo.originalName,
          true
        );
      }

      // 记录成功的工具调用
      this.toolCallLogger.recordToolCall({
        toolName: originalToolName,
        serverName: logServerName,
        arguments: arguments_,
        result: result,
        success: (result as { isError?: boolean })?.isError !== true,
        duration: Date.now() - startTime,
      });

      return result as ToolCallResult;
    } catch (error) {
      // 记录失败的工具调用
      this.toolCallLogger.recordToolCall({
        toolName: originalToolName,
        serverName: logServerName,
        arguments: arguments_,
        result: null,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });

      // 更新失败统计
      if (this.customMCPHandler.hasTool(toolName)) {
        const customTool = this.customMCPHandler.getToolInfo(toolName);
        if (customTool?.handler?.type === "mcp") {
          await updateStatsCallback(
            toolName,
            customTool.handler.config.serviceName,
            customTool.handler.config.toolName,
            false
          );
        } else {
          await updateStatsCallback(toolName, "customMCP", toolName, false);
          logger.error(
            `[ToolRegistry] CustomMCP 工具 ${toolName} 调用失败:`,
            (error as Error).message
          );
        }
      } else {
        const toolInfo = this.tools.get(toolName);
        if (toolInfo) {
          await updateStatsCallback(
            toolName,
            toolInfo.serviceName,
            toolInfo.originalName,
            false
          );
          logger.error(
            `[ToolRegistry] 工具 ${toolName} 调用失败:`,
            (error as Error).message
          );
        }
      }

      throw error;
    }
  }

  /**
   * 调用 MCP 工具（用于从 mcpServerConfig 同步的工具）
   * @param toolName 工具名称
   * @param config MCP handler 配置
   * @param arguments_ 工具参数
   * @param services 服务 Map
   * @returns 工具调用结果
   */
  private async callMCPTool(
    toolName: string,
    config: { serviceName: string; toolName: string },
    arguments_: Record<string, unknown>,
    services: Map<string, unknown>
  ): Promise<ToolCallResult> {
    const { serviceName, toolName: originalToolName } = config;

    logger.debug(
      `[ToolRegistry] 调用 MCP 同步工具 ${toolName} -> ${serviceName}.${originalToolName}`
    );

    const service = services.get(serviceName);
    if (!service) {
      throw new Error(`服务 ${serviceName} 不可用`);
    }

    const isConnected = (
      service as { isConnected?: () => boolean }
    )?.isConnected?.();
    if (!isConnected) {
      throw new Error(`服务 ${serviceName} 未连接`);
    }

    try {
      const result = await (
        service as {
          callTool: (name: string, args: unknown) => Promise<unknown>;
        }
      ).callTool(originalToolName, arguments_ || {});
      logger.debug(`[ToolRegistry] MCP 同步工具 ${toolName} 调用成功`);
      return result as ToolCallResult;
    } catch (error) {
      logger.error(
        `[ToolRegistry] MCP 同步工具 ${toolName} 调用失败:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 检查是否存在指定工具（包括标准 MCP 工具和 customMCP 工具）
   * @param toolName 工具名称
   * @returns 工具是否存在
   */
  hasTool(toolName: string): boolean {
    // 检查是否是 customMCP 工具
    if (this.customMCPHandler.hasTool(toolName)) {
      return true;
    }

    // 检查是否是标准 MCP 工具
    return this.tools.has(toolName);
  }

  /**
   * 检查指定的 customMCP 工具是否存在
   * @param toolName 工具名称
   * @returns 如果工具存在返回 true，否则返回 false
   */
  hasCustomMCPTool(toolName: string): boolean {
    try {
      return this.customMCPHandler.hasTool(toolName);
    } catch (error) {
      logger.warn(
        `[ToolRegistry] 检查 CustomMCP 工具 ${toolName} 是否存在失败:`,
        error
      );
      // 异常情况下返回 false，表示工具不存在
      return false;
    }
  }

  /**
   * 获取所有 customMCP 工具列表
   * @returns customMCP 工具数组
   */
  getCustomMCPTools(): Tool[] {
    try {
      return this.customMCPHandler.getTools();
    } catch (error) {
      logger.warn(
        "[ToolRegistry] 获取 CustomMCP 工具列表失败，返回空数组:",
        error
      );
      // 异常情况下返回空数组，避免影响调用方
      return [];
    }
  }

  /**
   * 获取 CustomMCP 处理器实例
   * @returns CustomMCPHandler 实例
   */
  getCustomMCPHandler(): CustomMCPHandler {
    return this.customMCPHandler;
  }

  /**
   * 同步工具配置到配置文件
   * 实现自动同步 MCP 服务工具配置到 xiaozhi.config.json
   * @param services 服务 Map
   * @param configs 服务配置
   */
  private async syncToolsConfigToFile(
    services: Map<string, unknown>,
    configs: Record<string, MCPServiceConfig>
  ): Promise<void> {
    try {
      logger.debug("[ToolRegistry] 开始同步工具配置到配置文件");

      // 获取当前配置文件中的 mcpServerConfig
      const currentServerConfigs = configManager.getMcpServerConfig();

      // 遍历所有已连接的服务
      for (const [serviceName, service] of services) {
        const isConnected = (
          service as { isConnected?: () => boolean }
        )?.isConnected?.();
        if (!isConnected) {
          continue;
        }

        const tools = (service as { getTools?: () => Tool[] })?.getTools?.();
        if (!tools || tools.length === 0) {
          continue;
        }

        // 获取当前服务在配置文件中的工具配置
        const currentToolsConfig =
          currentServerConfigs[serviceName]?.tools || {};

        // 构建新的工具配置
        const newToolsConfig: Record<string, MCPToolConfig> = {};

        for (const tool of tools) {
          const currentToolConfig = currentToolsConfig[tool.name];

          // 如果工具已存在，保留用户设置的 enable 状态，但更新描述
          if (currentToolConfig) {
            newToolsConfig[tool.name] = {
              ...currentToolConfig,
              description:
                tool.description || currentToolConfig.description || "",
            };
          } else {
            // 新工具，默认启用
            newToolsConfig[tool.name] = {
              description: tool.description || "",
              enable: true,
            };
          }
        }

        // 检查是否有工具被移除（在配置文件中存在但在当前工具列表中不存在）
        const currentToolNames = tools.map((t) => t.name);
        const configToolNames = Object.keys(currentToolsConfig);
        const removedTools = configToolNames.filter(
          (name) => !currentToolNames.includes(name)
        );

        if (removedTools.length > 0) {
          logger.info(
            `[ToolRegistry] 检测到服务 ${serviceName} 移除了 ${
              removedTools.length
            } 个工具: ${removedTools.join(", ")}`
          );
        }

        // 检查配置是否有变化
        const hasChanges = this.hasToolsConfigChanged(
          currentToolsConfig,
          newToolsConfig
        );

        if (hasChanges) {
          // 更新配置文件
          configManager.updateServerToolsConfig(serviceName, newToolsConfig);

          const addedTools = Object.keys(newToolsConfig).filter(
            (name) => !currentToolsConfig[name]
          );
          const updatedTools = Object.keys(newToolsConfig).filter((name) => {
            const current = currentToolsConfig[name];
            const updated = newToolsConfig[name];
            return current && current.description !== updated.description;
          });

          logger.debug(`[ToolRegistry] 已同步服务 ${serviceName} 的工具配置:`);
          if (addedTools.length > 0) {
            logger.debug(`  - 新增工具: ${addedTools.join(", ")}`);
          }
          if (updatedTools.length > 0) {
            logger.debug(`  - 更新工具: ${updatedTools.join(", ")}`);
          }
          if (removedTools.length > 0) {
            logger.debug(`  - 移除工具: ${removedTools.join(", ")}`);
          }
        }
      }

      logger.debug("[ToolRegistry] 工具配置同步完成");
    } catch (error) {
      logger.error("[ToolRegistry] 同步工具配置到配置文件失败:", error);
      // 不抛出错误，避免影响服务正常运行
    }
  }

  /**
   * 检查工具配置是否有变化
   * @param currentConfig 当前配置
   * @param newConfig 新配置
   * @returns 是否有变化
   */
  private hasToolsConfigChanged(
    currentConfig: Record<string, MCPToolConfig>,
    newConfig: Record<string, MCPToolConfig>
  ): boolean {
    const currentKeys = Object.keys(currentConfig);
    const newKeys = Object.keys(newConfig);

    // 检查工具数量是否变化
    if (currentKeys.length !== newKeys.length) {
      return true;
    }

    // 检查是否有新增或删除的工具
    const addedTools = newKeys.filter((key) => !currentKeys.includes(key));
    const removedTools = currentKeys.filter((key) => !newKeys.includes(key));

    if (addedTools.length > 0 || removedTools.length > 0) {
      return true;
    }

    // 检查现有工具的描述是否有变化
    for (const toolName of currentKeys) {
      const currentTool = currentConfig[toolName];
      const newTool = newConfig[toolName];

      if (currentTool.description !== newTool.description) {
        return true;
      }
    }

    return false;
  }
}
