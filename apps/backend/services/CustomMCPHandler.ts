#!/usr/bin/env node
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
import type {
  EnhancedToolResultCache,
  ExtendedMCPToolsCache,
  ToolCallResponse,
  ToolCallResult,
} from "@root/types/mcp.js";
import {
  DEFAULT_CONFIG,
  generateCacheKey,
  isCacheExpired,
  shouldCleanupCache,
} from "@root/types/mcp.js";
import { TimeoutError, createTimeoutResponse } from "@root/types/timeout.js";
import { getEventBus } from "./EventBus.js";

// 工具调用参数类型
type ToolArguments = Record<string, unknown>;

// 类型守卫函数：检查是否为代理处理器
function isProxyHandler(handler: HandlerConfig): handler is ProxyHandlerConfig {
  return handler.type === "proxy";
}

// Coze API 响应类型
interface CozeApiResponse {
  code: number;
  msg: string;
  debug_url: string;
  data: string;
  usage: {
    input_count: number;
    output_count: number;
    token_count: number;
  };
}

// Coze 请求数据类型
interface CozeRequestData {
  workflow_id?: string;
  bot_id?: string;
  parameters: Record<string, unknown>;
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
  private readonly CACHE_TTL = DEFAULT_CONFIG.CACHE_TTL; // 5分钟缓存过期

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

    // 首先检查是否有已完成的任务结果（一次性缓存）
    const completedResult = await this.getCompletedResult(toolName, arguments_);
    if (completedResult) {
      this.logger.debug(`[CustomMCP] 返回已完成的任务结果: ${toolName}`);
      // 立即清理已消费的缓存
      await this.clearConsumedCache(toolName, arguments_);
      return completedResult;
    }

    try {
      // 使用 Promise.race 实现超时控制
      const result = await Promise.race([
        this.callCozeWorkflow(tool, arguments_),
        this.createTimeoutPromise(toolName),
      ]);

      // 缓存结果（标记为未消费）
      await this.cacheResult(toolName, arguments_, result);

      return result;
    } catch (error) {
      // 如果是超时错误，返回友好提示
      if (error instanceof TimeoutError) {
        const taskId = await this.generateTaskId(toolName, arguments_);
        this.logger.info(
          `[CustomMCP] 工具超时，返回友好提示: ${toolName}, taskId: ${taskId}`
        );
        return createTimeoutResponse(taskId, toolName);
      }

      throw error;
    }
  }

  /**
   * 创建超时 Promise
   */
  private async createTimeoutPromise(toolName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`工具调用超时: ${toolName}`));
      }, this.TIMEOUT);
    });
  }

  /**
   * 获取已完成的任务结果（一次性缓存）
   */
  private async getCompletedResult(
    toolName: string,
    arguments_: ToolArguments
  ): Promise<ToolCallResult | null> {
    try {
      const cacheKey = this.generateCacheKey(toolName, arguments_);
      const cache = await this.loadExtendedCache();

      if (!cache.customMCPResults || !cache.customMCPResults[cacheKey]) {
        return null;
      }

      const cached = cache.customMCPResults[cacheKey];

      // 只返回已完成且未消费的结果
      if (cached.status === "completed" && !cached.consumed) {
        // 检查是否过期
        if (!isCacheExpired(cached.timestamp, cached.ttl)) {
          return cached.result;
        }
      }

      return null;
    } catch (error) {
      this.logger.warn(`[CustomMCP] 获取缓存失败: ${error}`);
      return null;
    }
  }

  /**
   * 调用 Coze 工作流
   */
  private async callCozeWorkflow(
    tool: CustomMCPTool,
    arguments_: ToolArguments
  ): Promise<ToolCallResult> {
    const handler = tool.handler as ProxyHandlerConfig;
    const config = handler.config;

    this.logger.info(`[CustomMCP] 调用 Coze 工作流: ${tool.name}`, {
      workflow_id: config.workflow_id,
    });

    try {
      // 构建请求参数
      const requestData = this.buildCozeRequest(config, arguments_);
      // 发送请求到 Coze API
      const response = await this.sendCozeRequest(config, requestData);
      this.logger.info(`[CustomMCP] Coze 工作流调用成功: ${tool.name}`);

      // 处理响应
      return this.processCozeResponse(tool.name, response);
    } catch (error) {
      this.logger.error(`[CustomMCP] Coze 工作流调用失败: ${tool.name}`, error);

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
   * 构建 Coze 请求数据
   */
  private buildCozeRequest(
    config: ProxyHandlerConfig["config"],
    arguments_: ToolArguments
  ): CozeRequestData {
    return {
      workflow_id: config.workflow_id,
      parameters: {
        ...arguments_,
      },
    };
  }

  /**
   * 发送 Coze API 请求
   */
  private async sendCozeRequest(
    config: ProxyHandlerConfig["config"],
    requestData: CozeRequestData
  ): Promise<CozeApiResponse> {
    const baseUrl = config.base_url || "https://api.coze.cn";
    const endpoint = "/v1/workflow/run";
    const url = `${baseUrl}${endpoint}`;
    const timeout = config.timeout || 300000;

    const token = configManager.getConfig().platforms?.coze?.token;
    if (!token) {
      throw new Error("Coze Token 配置不存在");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...config.headers,
    };

    this.logger.debug(`[CustomMCP] 发送 Coze 请求到: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Coze API 请求失败 (${response.status}): ${errorText}`);
      }

      const responseData = (await response.json()) as CozeApiResponse;
      this.logger.debug("[CustomMCP] Coze API 响应:", responseData);

      return responseData;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Coze API 请求超时 (${timeout}ms)`);
      }

      throw error;
    }
  }

  /**
   * 处理 Coze API 响应
   */
  private processCozeResponse(
    toolName: string,
    response: CozeApiResponse
  ): ToolCallResult {
    try {
      // 处理工作流响应
      if (response.data) {
        return {
          content: [
            {
              type: "text",
              text: response.data,
            },
          ],
          isError: false,
        };
      }

      // 默认处理：返回整个响应
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      this.logger.error(`[CustomMCP] 处理 Coze 响应失败: ${toolName}`, error);

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
   * 清理已消费的缓存
   */
  private async clearConsumedCache(
    toolName: string,
    arguments_: ToolArguments
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(toolName, arguments_);
      const cache = await this.loadExtendedCache();

      if (cache.customMCPResults?.[cacheKey]) {
        // 标记为已消费
        cache.customMCPResults[cacheKey].consumed = true;

        // 如果已消费且已过期，直接删除
        const cached = cache.customMCPResults[cacheKey];
        if (shouldCleanupCache(cached)) {
          delete cache.customMCPResults[cacheKey];
        }

        // 保存缓存更改
        await this.saveCache(cache);
        this.logger.debug(`[CustomMCP] 清理已消费缓存: ${cacheKey}`);
      }
    } catch (error) {
      this.logger.warn(`[CustomMCP] 清理缓存失败: ${error}`);
    }
  }

  /**
   * 生成任务ID
   */
  private async generateTaskId(
    toolName: string,
    arguments_: ToolArguments
  ): Promise<string> {
    return generateCacheKey(toolName, arguments_);
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(
    toolName: string,
    arguments_: ToolArguments
  ): string {
    return generateCacheKey(toolName, arguments_);
  }

  /**
   * 加载扩展缓存
   */
  private async loadExtendedCache(): Promise<ExtendedMCPToolsCache> {
    try {
      const cacheData = await this.cacheManager.loadExistingCache();
      return cacheData as ExtendedMCPToolsCache;
    } catch (error) {
      return {
        version: "1.0.0",
        mcpServers: {},
        metadata: {
          lastGlobalUpdate: new Date().toISOString(),
          totalWrites: 0,
          createdAt: new Date().toISOString(),
        },
        customMCPResults: {},
      };
    }
  }

  /**
   * 更新缓存结果
   */
  private async updateCacheWithResult(
    cacheKey: string,
    cacheData: EnhancedToolResultCache
  ): Promise<void> {
    try {
      const cache = await this.loadExtendedCache();

      if (!cache.customMCPResults) {
        cache.customMCPResults = {};
      }

      cache.customMCPResults[cacheKey] = cacheData;

      // 使用 MCPCacheManager 的保存方法
      await this.saveCache(cache);
    } catch (error) {
      this.logger.warn(`[CustomMCP] 更新缓存失败: ${error}`);
    }
  }

  /**
   * 缓存结果
   */
  private async cacheResult(
    toolName: string,
    arguments_: ToolArguments,
    result: ToolCallResult
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(toolName, arguments_);
      const cacheData: EnhancedToolResultCache = {
        result,
        timestamp: new Date().toISOString(),
        ttl: this.CACHE_TTL,
        status: "completed",
        consumed: false, // 初始状态为未消费
        retryCount: 0,
      };

      await this.updateCacheWithResult(cacheKey, cacheData);
      this.logger.debug(`[CustomMCP] 缓存工具结果: ${toolName}`);
    } catch (error) {
      this.logger.warn(`[CustomMCP] 缓存结果失败: ${error}`);
    }
  }

  /**
   * 保存缓存
   */
  private async saveCache(cache: ExtendedMCPToolsCache): Promise<void> {
    try {
      await this.cacheManager.saveCache(cache);
    } catch (error) {
      this.logger.warn(`[CustomMCP] 保存缓存失败: ${error}`);
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
