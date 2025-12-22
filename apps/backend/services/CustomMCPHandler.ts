#!/usr/bin/env node
import { CozeApiService } from "@/lib/coze";
import type { RunWorkflowData } from "@/lib/coze";
import type { MCPServiceManager } from "@/lib/mcp";
import { MCPCacheManager } from "@/lib/mcp";
import { ensureToolJSONSchema } from "@/lib/mcp/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import type {
  CustomMCPTool,
  HandlerConfig,
  ProxyHandlerConfig,
} from "@root/configManager.js";
import { configManager } from "@root/configManager.js";
import type { ToolCallResponse, ToolCallResult } from "@root/types/mcp.js";
import { DEFAULT_CONFIG, generateCacheKey } from "@root/types/mcp.js";
import { TimeoutError, createTimeoutResponse } from "@root/types/timeout.js";
import { getEventBus } from "./EventBus.js";

// 工具调用参数类型
type ToolArguments = Record<string, unknown>;

// 类型守卫函数：检查是否为代理处理器
function isProxyHandler(handler: HandlerConfig): handler is ProxyHandlerConfig {
  return handler.type === "proxy";
}

// 扩展的工具调用选项
interface ToolCallOptions {
  timeout?: number; // 超时时间（毫秒）
  enableCache?: boolean; // 是否启用缓存
  taskId?: string; // 任务ID
}

/**
 * 简化版的 CustomMCPHandler
 * 专门用于处理 Coze 工作流工具，保持超时友好响应机制
 */
export class CustomMCPHandler {
  private logger: Logger;
  private tools: Map<string, CustomMCPTool> = new Map();
  private cacheManager: MCPCacheManager;
  private mcpServiceManager?: MCPServiceManager;
  private readonly TIMEOUT = DEFAULT_CONFIG.TIMEOUT; // 统一8秒超时

  constructor(
    cacheManager?: MCPCacheManager,
    mcpServiceManager?: MCPServiceManager
  ) {
    this.logger = logger;
    this.cacheManager = cacheManager || new MCPCacheManager();
    this.mcpServiceManager = mcpServiceManager;

    // 设置事件监听器
    this.setupEventListeners();
  }

  /**
   * 获取 CozeApiService 实例
   */
  private getCozeApiService(): CozeApiService {
    const token = configManager.getConfig().platforms?.coze?.token;

    if (!token) {
      throw new Error("Coze Token 配置不存在");
    }

    return new CozeApiService(token);
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    const eventBus = getEventBus();

    // 监听配置更新事件
    eventBus.onEvent("config:updated", async (data) => {
      if (data.type === "customMCP") {
        this.logger.info("[CustomMCP] 检测到配置更新，重新初始化...");
        try {
          this.reinitialize();
        } catch (error) {
          this.logger.error("[CustomMCP] 配置更新处理失败:", error);
        }
      }
    });
  }

  /**
   * 初始化 CustomMCP 处理器
   * 加载配置中的 customMCP 工具
   * @param tools 可选的工具数组，如果提供则使用该数组，否则从配置管理器获取
   */
  public initialize(tools?: CustomMCPTool[]): void {
    this.logger.debug("[CustomMCP] 初始化 CustomMCP 处理器...");

    try {
      const customTools = tools || configManager.getCustomMCPTools();

      // 清空现有工具
      this.tools.clear();

      // 只加载 coze 代理工具
      for (const tool of customTools) {
        if (isProxyHandler(tool.handler) && tool.handler.platform === "coze") {
          this.tools.set(tool.name, tool);
          this.logger.debug(
            `[CustomMCP] 已加载 Coze 工具: ${tool.name} (workflow_id: ${tool.handler.config.workflow_id})`
          );
        } else {
          // 根据是否为 proxy 类型显示不同的警告信息
          const platformInfo = isProxyHandler(tool.handler)
            ? `/${tool.handler.platform}`
            : "";
          this.logger.warn(
            `[CustomMCP] 跳过不支持的工具类型: ${tool.name} (${tool.handler.type}${platformInfo})`
          );
        }
      }

      this.logger.debug(
        `[CustomMCP] 初始化完成，共加载 ${this.tools.size} 个 Coze 工具`
      );
    } catch (error) {
      this.logger.error("[CustomMCP] 初始化失败:", error);
      throw error;
    }
  }

  /**
   * 获取所有工具（标准 MCP 格式）
   */
  public getTools(): Tool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: ensureToolJSONSchema(tool.inputSchema),
    }));
  }

  /**
   * 检查是否存在指定工具
   */
  public hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * 获取工具数量
   */
  public getToolCount(): number {
    return this.tools.size;
  }

  /**
   * 获取所有工具名称
   */
  public getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 获取工具详细信息（用于调试）
   */
  public getToolInfo(toolName: string): CustomMCPTool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * 重新初始化 CustomMCP 处理器
   * 重新加载配置中的 customMCP 工具
   */
  public reinitialize(): void {
    this.logger.debug("[CustomMCP] 重新初始化 CustomMCP 处理器...");
    this.initialize();
  }

  /**
   * 调用工具（支持超时友好响应和缓存管理）
   * @deprecated 此方法保留向后兼容，建议使用 MCPServiceManager.executeCustomMCPTool
   */
  public async callTool(
    toolName: string,
    arguments_: ToolArguments,
    options?: ToolCallOptions
  ): Promise<ToolCallResponse> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`未找到工具: ${toolName}`);
    }

    try {
      const timeout = options?.timeout || this.TIMEOUT;
      const result = await Promise.race([
        this.executeCozeWorkflow(tool, arguments_),
        this.createTimeoutPromise(toolName, timeout),
      ]);

      return result;
    } catch (error) {
      // 如果是超时错误，返回友好提示
      if (error instanceof TimeoutError) {
        const taskId = generateCacheKey(toolName, arguments_);
        this.logger.info(
          `[CustomMCP] 工具超时，返回友好提示: ${toolName}, taskId: ${taskId}`
        );
        return createTimeoutResponse(taskId, toolName);
      }

      throw error;
    }
  }

  /**
   * 纯执行器方法 - 执行 Coze 工作流调用
   * 简化的执行方法，由 MCPServiceManager 统一管理缓存和超时
   * @param toolName 工具名称
   * @param arguments_ 工具参数
   * @returns 执行结果
   */
  public async executeTool(
    toolName: string,
    arguments_: ToolArguments
  ): Promise<ToolCallResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`未找到工具: ${toolName}`);
    }

    this.logger.info(`[CustomMCP] 执行工具: ${toolName}`, {
      workflow_id: (tool.handler as ProxyHandlerConfig).config.workflow_id,
    });

    return await this.executeCozeWorkflow(tool, arguments_);
  }

  /**
   * 创建超时 Promise
   */
  private async createTimeoutPromise(
    toolName: string,
    timeout: number
  ): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`工具调用超时: ${toolName}`));
      }, timeout);
    });
  }

  /**
   * 处理工作流响应
   */
  private processWorkflowResponse(
    toolName: string,
    workflowData: RunWorkflowData
  ): ToolCallResult {
    try {
      // 根据 RunWorkflowData 的实际结构进行处理
      // 假设 workflowData 有 data 字段或其他响应数据字段
      const responseData = workflowData.data || workflowData;

      if (typeof responseData === "string") {
        return {
          content: [
            {
              type: "text",
              text: responseData,
            },
          ],
          isError: false,
        };
      }

      // 如果是对象，转换为 JSON 字符串
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(responseData, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      this.logger.error(`[CustomMCP] 处理工作流响应失败: ${toolName}`, error);

      return {
        content: [
          {
            type: "text",
            text: `处理响应失败: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * 执行 Coze 工作流
   * 纯执行器方法，不包含缓存和超时逻辑
   */
  public async executeCozeWorkflow(
    tool: CustomMCPTool,
    arguments_: ToolArguments
  ): Promise<ToolCallResult> {
    const handler = tool.handler as ProxyHandlerConfig;
    const config = handler.config;

    this.logger.info(`[CustomMCP] 执行 Coze 工作流: ${tool.name}`, {
      workflow_id: config.workflow_id,
    });

    try {
      // 使用 CozeApiService
      const cozeApiService = this.getCozeApiService();

      // 检查 workflow_id 是否存在
      if (!config.workflow_id) {
        throw new Error("工作流ID未配置");
      }

      // 调用 callWorkflow 方法
      const workflowResult = await cozeApiService.callWorkflow(
        config.workflow_id,
        arguments_
      );

      this.logger.info(`[CustomMCP] Coze 工作流执行成功: ${tool.name}`);

      // 转换响应格式为 ToolCallResult
      return this.processWorkflowResponse(tool.name, workflowResult);
    } catch (error) {
      this.logger.error(`[CustomMCP] Coze 工作流执行失败: ${tool.name}`, error);

      return {
        content: [
          {
            type: "text",
            text: `Coze 工作流调用失败: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  
  /**
   * 清理资源
   */
  public cleanup(): void {
    this.logger.info("[CustomMCP] 清理 CustomMCP 处理器资源");
    this.tools.clear();
    this.cacheManager.cleanup();
  }
}
