#!/usr/bin/env node

/**
 * CustomMCP 工具处理器
 * 负责解析和调用 customMCP 配置中定义的工具
 * 支持多种 handler 类型：proxy、function、http、script、chain
 */

import { createHash } from "node:crypto";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { type Logger, logger } from "../Logger.js";
import {
  type ChainHandlerConfig,
  type CustomMCPTool,
  type FunctionHandlerConfig,
  type HttpHandlerConfig,
  type MCPHandlerConfig,
  type ProxyHandlerConfig,
  type ScriptHandlerConfig,
  configManager,
} from "../configManager.js";
import { CacheLifecycleManager } from "../managers/CacheLifecycleManager.js";
import { TaskStateManager } from "../managers/TaskStateManager.js";
import {
  type CacheConfig,
  type CacheStatistics,
  DEFAULT_CONFIG,
  type EnhancedToolResultCache,
  type ExtendedMCPToolsCache,
  type TaskStatus,
  type TimeoutConfig,
  type ToolCallResponse,
  generateCacheKey,
  isCacheExpired,
  shouldCleanupCache,
} from "../types/mcp.js";
import {
  TimeoutError,
  createTimeoutResponse,
  isTimeoutResponse,
} from "../types/timeout.js";
import { getEventBus } from "./EventBus.js";
import { MCPCacheManager } from "./MCPCacheManager.js";
import type { MCPServiceManager } from "./MCPServiceManager.js";

// 工具调用结果接口（与 MCPServiceManager 保持一致）
export interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

// 扩展的工具调用选项
interface ToolCallOptions {
  timeout?: number; // 超时时间（毫秒）
  retries?: number; // 重试次数（已弃用，移除重试机制）
  retryDelay?: number; // 重试延迟（毫秒）
  enableCache?: boolean; // 是否启用缓存
  taskId?: string; // 任务ID
}

// 任务状态管理接口
interface TaskManager {
  taskId: string;
  status: TaskStatus;
  startTime: number;
  endTime?: string; // 改为string类型以匹配toISOString()
  error?: string;
  result?: any; // 添加result属性以支持任务结果存储
}

export class CustomMCPHandler {
  private logger: Logger;
  private tools: Map<string, CustomMCPTool> = new Map();
  private cacheManager: MCPCacheManager;
  private cacheLifecycleManager: CacheLifecycleManager;
  private taskStateManager: TaskStateManager;
  private mcpServiceManager?: MCPServiceManager;
  private readonly TIMEOUT = DEFAULT_CONFIG.TIMEOUT; // 统一8秒超时
  private readonly CACHE_TTL = DEFAULT_CONFIG.CACHE_TTL; // 5分钟缓存过期
  private readonly CLEANUP_INTERVAL = DEFAULT_CONFIG.CLEANUP_INTERVAL; // 1分钟清理间隔
  private cleanupTimer?: NodeJS.Timeout;
  private activeTasks: Map<string, TaskManager> = new Map();
  private eventBus = getEventBus();

  constructor(
    cacheManager?: MCPCacheManager,
    mcpServiceManager?: MCPServiceManager
  ) {
    this.logger = logger;
    this.cacheManager = cacheManager || new MCPCacheManager();
    this.mcpServiceManager = mcpServiceManager;
    this.cacheLifecycleManager = new CacheLifecycleManager(this.logger);
    this.taskStateManager = new TaskStateManager(this.logger);
    // 启动缓存清理定时器
    this.startCleanupTimer();
    this.cacheLifecycleManager.startAutoCleanup();
    // 设置事件监听器
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听配置更新事件
    this.eventBus.onEvent("config:updated", async (data) => {
      await this.handleConfigUpdated(data);
    });
  }

  /**
   * 处理配置更新事件
   */
  private async handleConfigUpdated(data: {
    type: string;
    serviceName?: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.info("[CustomMCP] 检测到配置更新，检查是否需要重新初始化");

    try {
      // 如果是 customMCP 配置更新，需要重新初始化
      if (data.type === "customMCP") {
        this.logger.info("[CustomMCP] customMCP 配置已更新，重新初始化处理器");
        await this.reinitialize();
      } else if (data.type === "serverTools") {
        // 如果是 serverTools 配置更新，可能影响 MCP 类型的工具
        this.logger.info(
          "[CustomMCP] serverTools 配置已更新，重新初始化处理器"
        );
        await this.reinitialize();
      }
    } catch (error) {
      this.logger.error("[CustomMCP] 配置更新处理失败:", error);
    }
  }

  /**
   * 重新初始化处理器
   */
  public async reinitialize(): Promise<void> {
    try {
      this.logger.info("[CustomMCP] 开始重新初始化处理器");

      // 清理现有工具
      this.tools.clear();

      // 重新加载工具
      const customTools = configManager.getCustomMCPTools();
      for (const tool of customTools) {
        this.tools.set(tool.name, tool);
        this.logger.info(
          `[CustomMCP] 重新加载工具: ${tool.name} (${tool.handler.type})`
        );
      }

      this.logger.info(
        `[CustomMCP] 重新初始化完成，共加载 ${this.tools.size} 个工具`
      );
    } catch (error) {
      this.logger.error("[CustomMCP] 重新初始化失败:", error);
      throw error;
    }
  }

  /**
   * 初始化 CustomMCP 处理器
   * 加载配置中的 customMCP 工具
   * @param tools 可选的工具数组，如果提供则使用该数组，否则从配置管理器获取
   */
  public initialize(tools?: CustomMCPTool[]): void {
    this.logger.info("[CustomMCP] 初始化 CustomMCP 处理器...");

    try {
      const customTools = tools || configManager.getCustomMCPTools();

      // 清空现有工具
      this.tools.clear();

      // 加载工具
      for (const tool of customTools) {
        this.tools.set(tool.name, tool);
        this.logger.info(
          `[CustomMCP] 已加载工具: ${tool.name} (${tool.handler.type})`
        );
      }

      this.logger.info(
        `[CustomMCP] 初始化完成，共加载 ${this.tools.size} 个工具`
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
      inputSchema: tool.inputSchema,
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
   * 调用工具（支持超时友好响应和缓存管理）
   */
  public async callTool(
    toolName: string,
    arguments_: any,
    options?: ToolCallOptions
  ): Promise<ToolCallResponse> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`未找到工具: ${toolName}`);
    }

    this.logger.info(`[CustomMCP] 调用工具: ${toolName}`, {
      handler: tool.handler.type,
      arguments: arguments_,
    });

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
        this.executeToolWithBackgroundProcessing(toolName, arguments_),
        this.createTimeoutPromise(toolName, arguments_),
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
   * 执行工具（支持后台处理）
   */
  private async executeToolWithBackgroundProcessing(
    toolName: string,
    arguments_: any
  ): Promise<ToolCallResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`工具不存在: ${toolName}`);
    }

    // 标记任务为处理中状态
    const taskId = await this.generateTaskId(toolName, arguments_);
    await this.markTaskAsPending(taskId, toolName, arguments_);

    try {
      // 直接调用，移除重试逻辑
      const result = await this.callToolByType(tool, arguments_);

      // 更新任务状态为完成
      await this.markTaskAsCompleted(taskId, result);

      return result;
    } catch (error) {
      // 更新任务状态为失败
      await this.markTaskAsFailed(taskId, error);
      throw error;
    }
  }

  /**
   * 创建超时 Promise（带任务跟踪）
   */
  private async createTimeoutPromise(
    toolName: string,
    arguments_: any
  ): Promise<never> {
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
    arguments_: any
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
   * 根据工具类型调用相应的处理方法
   */
  private async callToolByType(
    tool: CustomMCPTool,
    arguments_: any
  ): Promise<ToolCallResult> {
    switch (tool.handler.type) {
      case "proxy":
        return await this.callProxyTool(tool, arguments_);
      case "function":
        return await this.callFunctionTool(tool, arguments_);
      case "http":
        return await this.callHttpTool(tool, arguments_);
      case "script":
        return await this.callScriptTool(tool, arguments_);
      case "chain":
        return await this.callChainTool(tool, arguments_);
      case "mcp":
        // MCP 类型的工具转发给 MCPServiceManager 处理
        return await this.forwardToMCPServiceManager(tool, arguments_);
      default:
        throw new Error(`不支持的处理器类型: ${(tool.handler as any).type}`);
    }
  }

  /**
   * 转发MCP工具调用到MCPServiceManager
   */
  private async forwardToMCPServiceManager(
    tool: CustomMCPTool,
    arguments_: any
  ): Promise<ToolCallResult> {
    if (!this.mcpServiceManager) {
      this.logger.error(
        `[CustomMCP] MCPServiceManager 未初始化，无法转发工具 ${tool.name} 的调用`
      );
      return {
        content: [
          { type: "text", text: "内部错误：MCPServiceManager 未初始化" },
        ],
        isError: true,
      };
    }

    const mcpHandler = tool.handler as MCPHandlerConfig;
    this.logger.info(`[CustomMCP] 转发MCP工具调用: ${tool.name}`, {
      serviceName: mcpHandler.config.serviceName,
      toolName: mcpHandler.config.toolName,
    });

    try {
      // 通过MCPServiceManager调用工具
      const result = await this.mcpServiceManager.callTool(
        mcpHandler.config.toolName,
        arguments_
      );

      this.logger.info(`[CustomMCP] MCP工具转发成功: ${tool.name}`);
      return result;
    } catch (error) {
      this.logger.error(`[CustomMCP] MCP工具转发失败: ${tool.name}`, error);
      return {
        content: [
          {
            type: "text",
            text: `MCP工具调用失败: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * 调用代理工具（如 Coze 工作流）
   */
  private async callProxyTool(
    tool: CustomMCPTool,
    arguments_: any
  ): Promise<ToolCallResult> {
    const proxyHandler = tool.handler as ProxyHandlerConfig;
    this.logger.info(`[CustomMCP] 调用代理工具: ${tool.name}`, {
      platform: proxyHandler.platform,
      config: proxyHandler.config,
    });

    // 根据平台类型调用相应的代理
    if (proxyHandler.platform === "coze") {
      return await this.callCozeWorkflow(tool, arguments_);
    }

    // 可以在这里添加其他平台的支持
    throw new Error(`不支持的代理平台: ${proxyHandler.platform}`);
  }

  /**
   * 调用 Coze 工作流
   */
  private async callCozeWorkflow(
    tool: CustomMCPTool,
    arguments_: any
  ): Promise<ToolCallResult> {
    const handler = tool.handler as ProxyHandlerConfig;
    const config = handler.config;

    this.logger.info(`[CustomMCP] 调用 Coze 工作流: ${tool.name}`, {
      workflow_id: config.workflow_id,
      bot_id: config.bot_id,
    });

    try {
      // 构建请求参数
      const requestData = this.buildCozeRequest(config, arguments_);
      // 发送请求到 Coze API
      const response = await this.sendCozeRequest(config, requestData);
      this.logger.info(`[CustomMCP] Coze 工作流调用成功: ${tool.name}`, {
        response,
      });

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
   * TODO: 这里要看一下构建的格式是否正确
   */
  private buildCozeRequest(
    config: ProxyHandlerConfig["config"],
    arguments_: any
  ): any {
    const baseRequest = {
      workflow_id: config.workflow_id,
      parameters: {
        ...arguments_,
      },
    };

    return baseRequest;
  }

  /**
   * 发送 Coze API 请求
   */
  private async sendCozeRequest(
    config: ProxyHandlerConfig["config"],
    requestData: any
  ): Promise<any> {
    const baseUrl = config.base_url || "https://api.coze.cn";
    let endpoint = "";

    const token = configManager.getConfig().platforms?.coze?.token;
    if (!token) {
      throw new Error("Coze Token 配置不存在");
    }

    // 根据配置选择 API 端点
    if (config.workflow_id) {
      endpoint = "/v1/workflow/run";
      requestData.workflow_id = config.workflow_id;
    } else if (config.bot_id) {
      endpoint = "/v3/chat";
      requestData.bot_id = config.bot_id;
    } else {
      throw new Error("Coze 配置必须提供 workflow_id 或 bot_id");
    }

    const url = `${baseUrl}${endpoint}`;
    const timeout = config.timeout || 300000;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...config.headers,
    };

    this.logger.debug(`[CustomMCP] 发送 Coze 请求到: ${url}`, {
      headers: {
        ...headers,
      },
      body: requestData,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestData),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Coze API 请求失败 (${response.status}): ${errorText}`);
      }

      const responseData = await response.json();
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
    response: {
      code: number;
      msg: string;
      debug_url: string;
      data: string;
      usage: { input_count: number; output_count: number; token_count: number };
    }
  ): ToolCallResult {
    try {
      // 处理工作流响应
      if (response.data) {
        const data = response.data;

        return {
          content: [
            {
              type: "text",
              text: data,
            },
          ],
          isError: false,
        };
      }

      // 处理聊天机器人响应
      // if (response.messages && Array.isArray(response.messages)) {
      //   const lastMessage = response.messages[response.messages.length - 1];
      //   if (lastMessage?.content) {
      //     return {
      //       content: [
      //         {
      //           type: "text",
      //           text: lastMessage.content,
      //         },
      //       ],
      //       isError: false,
      //     };
      //   }
      // }

      // 处理其他格式的响应
      // if (response.content) {
      //   return {
      //     content: [
      //       {
      //         type: "text",
      //         text:
      //           typeof response.content === "string"
      //             ? response.content
      //             : JSON.stringify(response.content, null, 2),
      //       },
      //     ],
      //     isError: false,
      //   };
      // }

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
   * 调用函数工具
   */
  private async callFunctionTool(
    tool: CustomMCPTool,
    arguments_: any
  ): Promise<ToolCallResult> {
    const handler = tool.handler as FunctionHandlerConfig;

    this.logger.info(`[CustomMCP] 调用函数工具: ${tool.name}`, {
      module: handler.module,
      function: handler.function,
    });

    try {
      // 动态导入模块
      const moduleExports = await this.loadModule(handler.module);

      // 获取函数
      const targetFunction = this.getFunction(moduleExports, handler.function);

      // 调用函数
      const result = await this.executeFunction(
        targetFunction,
        arguments_,
        handler
      );

      return {
        content: [
          {
            type: "text",
            text:
              typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      this.logger.error(`[CustomMCP] 函数工具调用失败: ${tool.name}`, error);

      return {
        content: [
          {
            type: "text",
            text: `函数工具调用失败: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * 动态加载模块
   */
  private async loadModule(modulePath: string): Promise<any> {
    try {
      // 支持相对路径和绝对路径
      let resolvedPath = modulePath;

      // 如果是相对路径，相对于项目根目录解析
      if (!modulePath.startsWith("/") && !modulePath.startsWith("file://")) {
        resolvedPath = new URL(modulePath, `file://${process.cwd()}/`).href;
      }

      this.logger.debug(`[CustomMCP] 加载模块: ${resolvedPath}`);

      // 动态导入模块
      const moduleExports = await import(resolvedPath);

      return moduleExports;
    } catch (error) {
      throw new Error(
        `无法加载模块 ${modulePath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 获取函数
   */
  private getFunction(
    moduleExports: any,
    functionName: string
  ): (...args: any[]) => any {
    let targetFunction: any;

    // 尝试从默认导出获取函数
    if (moduleExports.default && typeof moduleExports.default === "function") {
      if (functionName === "default") {
        targetFunction = moduleExports.default;
      } else if (
        moduleExports.default[functionName] &&
        typeof moduleExports.default[functionName] === "function"
      ) {
        targetFunction = moduleExports.default[functionName];
      }
    }

    // 尝试从命名导出获取函数
    if (
      !targetFunction &&
      moduleExports[functionName] &&
      typeof moduleExports[functionName] === "function"
    ) {
      targetFunction = moduleExports[functionName];
    }

    if (!targetFunction) {
      throw new Error(`在模块中找不到函数: ${functionName}`);
    }

    return targetFunction;
  }

  /**
   * 执行函数
   */
  private async executeFunction(
    targetFunction: (...args: any[]) => any,
    arguments_: any,
    handler: FunctionHandlerConfig
  ): Promise<any> {
    const timeout = handler.timeout || 30000;

    // 创建执行上下文
    const context = {
      ...handler.context,
      logger: this.logger,
      arguments: arguments_,
    };

    // 使用 Promise.race 实现超时控制
    const executePromise = Promise.resolve().then(() => {
      // 如果函数需要上下文，将上下文作为第二个参数传递
      if (targetFunction.length > 1) {
        return targetFunction(arguments_, context);
      }
      return targetFunction(arguments_);
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`函数执行超时 (${timeout}ms)`)),
        timeout
      );
    });

    return Promise.race([executePromise, timeoutPromise]);
  }

  /**
   * 调用 HTTP 工具
   */
  private async callHttpTool(
    tool: CustomMCPTool,
    arguments_: any
  ): Promise<ToolCallResult> {
    const handler = tool.handler as HttpHandlerConfig;

    this.logger.info(`[CustomMCP] 调用 HTTP 工具: ${tool.name}`, {
      url: handler.url,
      method: handler.method || "POST",
    });

    try {
      // 构建请求
      const { url, requestOptions } = this.buildHttpRequest(
        handler,
        arguments_
      );

      // 发送请求
      const response = await this.sendHttpRequest(url, requestOptions, handler);

      // 处理响应
      return this.processHttpResponse(tool.name, response, handler);
    } catch (error) {
      this.logger.error(`[CustomMCP] HTTP 工具调用失败: ${tool.name}`, error);

      return {
        content: [
          {
            type: "text",
            text: `HTTP 工具调用失败: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * 构建 HTTP 请求
   */
  private buildHttpRequest(
    handler: HttpHandlerConfig,
    arguments_: any
  ): {
    url: string;
    requestOptions: RequestInit;
  } {
    const method = handler.method || "POST";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "xiaozhi-client/1.0",
      ...handler.headers,
    };

    // 处理认证
    if (handler.auth) {
      switch (handler.auth.type) {
        case "bearer":
          if (handler.auth.token) {
            headers.Authorization = `Bearer ${handler.auth.token}`;
          }
          break;
        case "basic":
          if (handler.auth.username && handler.auth.password) {
            const credentials = btoa(
              `${handler.auth.username}:${handler.auth.password}`
            );
            headers.Authorization = `Basic ${credentials}`;
          }
          break;
        case "api_key":
          if (handler.auth.api_key && handler.auth.api_key_header) {
            headers[handler.auth.api_key_header] = handler.auth.api_key;
          }
          break;
      }
    }

    let body: string | undefined;
    let url = handler.url;

    // 处理请求体
    if (method !== "GET") {
      if (handler.body_template) {
        // 使用模板替换变量
        body = this.replaceTemplateVariables(handler.body_template, arguments_);
      } else {
        // 直接使用参数作为请求体
        body = JSON.stringify(arguments_);
      }
    } else {
      // GET 请求将参数添加到 URL 查询字符串
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(arguments_)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes("?") ? "&" : "?") + queryString;
      }
    }

    const requestOptions: RequestInit = {
      method,
      headers,
      body,
    };

    return { url, requestOptions };
  }

  /**
   * 发送 HTTP 请求
   */
  private async sendHttpRequest(
    url: string,
    requestOptions: RequestInit,
    handler: HttpHandlerConfig
  ): Promise<Response> {
    const timeout = handler.timeout || 30000;
    const retryCount = handler.retry_count || 0;
    const retryDelay = handler.retry_delay || 1000;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        this.logger.debug(
          `[CustomMCP] 发送 HTTP 请求 (尝试 ${attempt + 1}/${
            retryCount + 1
          }): ${url}`,
          {
            method: requestOptions.method,
            headers: requestOptions.headers,
          }
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 如果是最后一次尝试或者请求成功，直接返回
        if (response.ok || attempt === retryCount) {
          return response;
        }

        // 记录失败但继续重试
        this.logger.warn(
          `[CustomMCP] HTTP 请求失败 (${response.status}), 将在 ${retryDelay}ms 后重试`
        );
        lastError = new Error(
          `HTTP 请求失败: ${response.status} ${response.statusText}`
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof Error && error.name === "AbortError") {
          lastError = new Error(`HTTP 请求超时 (${timeout}ms)`);
        }

        this.logger.warn(
          `[CustomMCP] HTTP 请求异常 (尝试 ${attempt + 1}/${retryCount + 1}):`,
          lastError.message
        );

        // 如果是最后一次尝试，抛出错误
        if (attempt === retryCount) {
          throw lastError;
        }
      }

      // 等待重试延迟
      if (attempt < retryCount) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    throw lastError || new Error("HTTP 请求失败");
  }

  /**
   * 处理 HTTP 响应
   */
  private async processHttpResponse(
    toolName: string,
    response: Response,
    handler: HttpHandlerConfig
  ): Promise<ToolCallResult> {
    try {
      const contentType = response.headers.get("content-type") || "";
      let responseData: any;

      // 根据内容类型解析响应
      if (contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // 检查响应状态
      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `HTTP 请求失败 (${response.status}): ${
                typeof responseData === "string"
                  ? responseData
                  : JSON.stringify(responseData)
              }`,
            },
          ],
          isError: true,
        };
      }

      // 使用响应映射提取数据
      let resultData = responseData;
      if (handler.response_mapping) {
        resultData = this.extractResponseData(
          responseData,
          handler.response_mapping
        );
      }

      return {
        content: [
          {
            type: "text",
            text:
              typeof resultData === "string"
                ? resultData
                : JSON.stringify(resultData, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      this.logger.error(`[CustomMCP] 处理 HTTP 响应失败: ${toolName}`, error);

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
   * 替换模板变量
   */
  private replaceTemplateVariables(
    template: string,
    variables: Record<string, any>
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const replacement =
        typeof value === "string" ? value : JSON.stringify(value);
      result = result.replace(
        new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"),
        replacement
      );
    }

    return result;
  }

  /**
   * 从响应中提取数据
   */
  private extractResponseData(
    responseData: any,
    mapping: HttpHandlerConfig["response_mapping"]
  ): any {
    if (!mapping) return responseData;

    // 简单的 JSONPath 实现
    const extractByPath = (data: any, path: string): any => {
      if (!path) return data;

      const parts = path.split(".");
      let current = data;

      for (const part of parts) {
        if (current && typeof current === "object" && part in current) {
          current = current[part];
        } else {
          return undefined;
        }
      }

      return current;
    };

    // 提取成功数据
    if (mapping.success_path) {
      const successData = extractByPath(responseData, mapping.success_path);
      if (successData !== undefined) {
        return mapping.data_path
          ? extractByPath(successData, mapping.data_path)
          : successData;
      }
    }

    // 提取数据
    if (mapping.data_path) {
      const data = extractByPath(responseData, mapping.data_path);
      if (data !== undefined) {
        return data;
      }
    }

    return responseData;
  }

  /**
   * 调用脚本工具
   */
  private async callScriptTool(
    tool: CustomMCPTool,
    arguments_: any
  ): Promise<ToolCallResult> {
    const handler = tool.handler as ScriptHandlerConfig;

    this.logger.info(`[CustomMCP] 调用脚本工具: ${tool.name}`, {
      script:
        handler.script.substring(0, 100) +
        (handler.script.length > 100 ? "..." : ""),
      interpreter: handler.interpreter || "node",
    });

    try {
      // 执行脚本
      const result = await this.executeScript(handler, arguments_);

      return {
        content: [
          {
            type: "text",
            text:
              typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      this.logger.error(`[CustomMCP] 脚本工具调用失败: ${tool.name}`, error);

      return {
        content: [
          {
            type: "text",
            text: `脚本工具调用失败: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * 执行脚本
   */
  private async executeScript(
    handler: ScriptHandlerConfig,
    arguments_: any
  ): Promise<string> {
    const { spawn } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const os = await import("node:os");

    const timeout = handler.timeout || 30000;
    const interpreter = handler.interpreter || "node";

    let scriptPath: string | undefined;
    let isTemporaryFile = false;

    try {
      // 判断是脚本内容还是文件路径
      if (handler.script.includes("\n") || handler.script.length > 200) {
        // 看起来是脚本内容，创建临时文件
        const tempDir = await fs.mkdtemp(
          path.join(os.tmpdir(), "xiaozhi-script-")
        );
        const extension = this.getScriptExtension(interpreter);
        scriptPath = path.join(tempDir, `script${extension}`);

        await fs.writeFile(scriptPath, handler.script, "utf8");
        isTemporaryFile = true;
      } else {
        // 看起来是文件路径
        scriptPath = handler.script;

        // 检查文件是否存在
        try {
          await fs.access(scriptPath);
        } catch {
          throw new Error(`脚本文件不存在: ${scriptPath}`);
        }
      }

      // 准备执行环境
      const env = {
        ...process.env,
        ...handler.env,
        XIAOZHI_ARGUMENTS: JSON.stringify(arguments_),
      };

      // 构建命令
      const command = this.buildScriptCommand(interpreter, scriptPath);

      this.logger.debug(`[CustomMCP] 执行脚本命令: ${command.join(" ")}`);

      // 执行脚本
      return new Promise((resolve, reject) => {
        const child = spawn(command[0], command.slice(1), {
          env,
          stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        // 设置超时
        const timeoutId = setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error(`脚本执行超时 (${timeout}ms)`));
        }, timeout);

        child.on("close", (code) => {
          clearTimeout(timeoutId);

          if (code === 0) {
            resolve(stdout.trim());
          } else {
            reject(
              new Error(`脚本执行失败 (退出码: ${code}): ${stderr.trim()}`)
            );
          }
        });

        child.on("error", (error) => {
          clearTimeout(timeoutId);
          reject(new Error(`脚本执行错误: ${error.message}`));
        });

        // 如果有输入参数，通过 stdin 传递
        if (arguments_ && Object.keys(arguments_).length > 0) {
          child.stdin?.write(JSON.stringify(arguments_));
          child.stdin?.end();
        }
      });
    } finally {
      // 清理临时文件
      if (isTemporaryFile && scriptPath) {
        try {
          await fs.unlink(scriptPath);
          await fs.rmdir(path.dirname(scriptPath));
        } catch {
          // 忽略清理错误
        }
      }
    }
  }

  /**
   * 获取脚本文件扩展名
   */
  private getScriptExtension(interpreter: string): string {
    switch (interpreter) {
      case "node":
        return ".js";
      case "python":
        return ".py";
      case "bash":
        return ".sh";
      default:
        return ".txt";
    }
  }

  /**
   * 构建脚本执行命令
   */
  private buildScriptCommand(
    interpreter: string,
    scriptPath: string
  ): string[] {
    switch (interpreter) {
      case "node":
        return ["node", scriptPath];
      case "python":
        return ["python3", scriptPath];
      case "bash":
        return ["bash", scriptPath];
      default:
        throw new Error(`不支持的脚本解释器: ${interpreter}`);
    }
  }

  /**
   * 调用链式工具
   */
  private async callChainTool(
    tool: CustomMCPTool,
    arguments_: any
  ): Promise<ToolCallResult> {
    const handler = tool.handler as ChainHandlerConfig;

    this.logger.info(`[CustomMCP] 调用链式工具: ${tool.name}`, {
      tools: handler.tools,
      mode: handler.mode,
      error_handling: handler.error_handling,
    });

    try {
      let results: ToolCallResult[];

      if (handler.mode === "sequential") {
        results = await this.executeSequentialChain(handler, arguments_);
      } else {
        results = await this.executeParallelChain(handler, arguments_);
      }

      // 合并结果
      const combinedContent = results.flatMap((result) => result.content);
      const hasError = results.some((result) => result.isError);

      return {
        content: combinedContent,
        isError: hasError,
      };
    } catch (error) {
      this.logger.error(`[CustomMCP] 链式工具调用失败: ${tool.name}`, error);

      return {
        content: [
          {
            type: "text",
            text: `链式工具调用失败: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取工具详细信息（用于调试）
   */
  public getToolInfo(toolName: string): CustomMCPTool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * 顺序执行链式工具
   */
  private async executeSequentialChain(
    handler: ChainHandlerConfig,
    arguments_: any
  ): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = [];
    let currentArguments = arguments_;

    for (const toolName of handler.tools) {
      try {
        this.logger.debug(`[CustomMCP] 执行链式工具中的: ${toolName}`);

        // 递归调用工具（可能是其他 CustomMCP 工具或标准 MCP 工具）
        const result = await this.callToolRecursive(toolName, currentArguments);
        results.push(result);

        // 如果出错，根据错误处理策略决定是否继续
        if (result.isError) {
          if (handler.error_handling === "stop") {
            break;
          }

          if (handler.error_handling === "retry") {
            // 简单重试一次
            this.logger.warn(`[CustomMCP] 工具 ${toolName} 执行失败，尝试重试`);
            const retryResult = await this.callToolRecursive(
              toolName,
              currentArguments
            );
            results[results.length - 1] = retryResult;

            // 重试后如果仍然失败，则停止执行
            if (retryResult.isError) {
              break;
            }
          }
          // continue 模式下继续执行下一个工具
        }

        // 将当前结果作为下一个工具的输入（如果结果是文本）
        if (!result.isError && result.content.length > 0) {
          const textContent = result.content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n");

          if (textContent) {
            try {
              // 尝试解析为 JSON，如果失败则作为字符串传递
              currentArguments = JSON.parse(textContent);
            } catch {
              currentArguments = { input: textContent, ...arguments_ };
            }
          }
        }
      } catch (error) {
        const errorResult: ToolCallResult = {
          content: [
            {
              type: "text",
              text: `工具 ${toolName} 执行异常: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };

        results.push(errorResult);

        if (handler.error_handling === "stop") {
          break;
        }
      }
    }

    return results;
  }

  /**
   * 并行执行链式工具
   */
  private async executeParallelChain(
    handler: ChainHandlerConfig,
    arguments_: any
  ): Promise<ToolCallResult[]> {
    const promises = handler.tools.map(async (toolName) => {
      try {
        this.logger.debug(`[CustomMCP] 并行执行链式工具中的: ${toolName}`);
        return await this.callToolRecursive(toolName, arguments_);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `工具 ${toolName} 执行异常: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        } as ToolCallResult;
      }
    });

    return Promise.all(promises);
  }

  /**
   * 递归调用工具（支持调用其他 CustomMCP 工具）
   */
  private async callToolRecursive(
    toolName: string,
    arguments_: any
  ): Promise<ToolCallResult> {
    // 检查是否是当前 CustomMCP 中的工具
    const tool = this.tools.get(toolName);
    if (tool) {
      return this.callTool(toolName, arguments_);
    }

    // 如果不是 CustomMCP 工具，可能需要调用外部工具
    // 这里可以扩展为调用 MCPServiceManager 中的其他工具
    // 但为了避免循环依赖，暂时返回错误
    throw new Error(
      `链式工具中引用的工具 ${toolName} 不存在于当前 CustomMCP 工具集中`
    );
  }

  /**
   * 清理已消费的缓存
   */
  private async clearConsumedCache(
    toolName: string,
    arguments_: any
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
    arguments_: any
  ): Promise<string> {
    return this.taskStateManager.generateTaskId(toolName, arguments_);
  }

  /**
   * 标记任务为处理中
   */
  private async markTaskAsPending(
    taskId: string,
    toolName: string,
    arguments_: any
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(toolName, arguments_);
      const cacheData: EnhancedToolResultCache = {
        result: { content: [{ type: "text", text: "处理中..." }] },
        timestamp: new Date().toISOString(),
        ttl: this.CACHE_TTL,
        status: "pending",
        consumed: false,
        taskId,
        retryCount: 0,
      };

      await this.updateCacheWithResult(cacheKey, cacheData);

      // 使用TaskStateManager管理任务状态
      this.taskStateManager.markTaskAsPending(taskId, toolName, arguments_);

      // 同时维护原有的活动任务列表（兼容性）
      this.activeTasks.set(taskId, {
        taskId,
        status: "pending",
        startTime: Date.now(),
      });

      this.logger.debug(`[CustomMCP] 标记任务为处理中: ${taskId}`);
    } catch (error) {
      this.logger.warn(`[CustomMCP] 标记任务状态失败: ${error}`);
    }
  }

  /**
   * 标记任务为已完成
   */
  private async markTaskAsCompleted(
    taskId: string,
    result: ToolCallResult
  ): Promise<void> {
    try {
      // 首先更新activeTasks中的状态
      const task = this.activeTasks.get(taskId);
      if (task) {
        task.status = "completed";
        task.endTime = new Date().toISOString();
        task.result = result;
      }

      const cache = await this.loadExtendedCache();

      // 查找对应的任务并更新状态
      for (const [cacheKey, cached] of Object.entries(
        cache.customMCPResults || {}
      )) {
        if (cached.taskId === taskId) {
          cached.status = "completed";
          cached.result = result;
          cached.timestamp = new Date().toISOString();
          cached.consumed = false;
          break;
        }
      }

      await this.saveCache(cache);

      // 使用TaskStateManager管理任务状态
      this.taskStateManager.markTaskAsCompleted(taskId, result);

      this.logger.debug(`[CustomMCP] 标记任务为已完成: ${taskId}`);
    } catch (error) {
      this.logger.warn(`[CustomMCP] 更新任务状态失败: ${error}`);
    }
  }

  /**
   * 标记任务为失败
   */
  private async markTaskAsFailed(taskId: string, error: any): Promise<void> {
    try {
      const cache = await this.loadExtendedCache();

      // 查找对应的任务并更新状态
      for (const [cacheKey, cached] of Object.entries(
        cache.customMCPResults || {}
      )) {
        if (cached.taskId === taskId) {
          cached.status = "failed";
          cached.result = {
            content: [{ type: "text", text: `任务失败: ${error.message}` }],
          };
          cached.timestamp = new Date().toISOString();
          cached.consumed = true; // 失败的任务自动标记为已消费
          break;
        }
      }

      await this.saveCache(cache);

      // 使用TaskStateManager管理任务状态
      this.taskStateManager.markTaskAsFailed(taskId, error.message);

      // 同时维护原有的活动任务列表（兼容性）
      const task = this.activeTasks.get(taskId);
      if (task) {
        task.status = "failed";
        task.endTime = new Date().toISOString();
        task.error = error.message;
      }

      this.logger.debug(`[CustomMCP] 标记任务为失败: ${taskId}`);
    } catch (err) {
      this.logger.warn(`[CustomMCP] 更新任务状态失败: ${err}`);
    }
  }

  /**
   * 启动缓存清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredCache().catch((error) => {
        this.logger.warn(`[CustomMCP] 缓存清理失败: ${error}`);
      });
    }, this.CLEANUP_INTERVAL);

    this.logger.info(
      `[CustomMCP] 启动缓存清理定时器，间隔: ${this.CLEANUP_INTERVAL}ms`
    );
  }

  /**
   * 清理过期缓存
   */
  private async cleanupExpiredCache(): Promise<void> {
    try {
      const cache = await this.loadExtendedCache();
      let hasChanges = false;
      let cleanedCount = 0;

      for (const [cacheKey, cached] of Object.entries(
        cache.customMCPResults || {}
      )) {
        if (shouldCleanupCache(cached)) {
          cache.customMCPResults?.[cacheKey] &&
            delete cache.customMCPResults[cacheKey];
          hasChanges = true;
          cleanedCount++;

          // 从活动任务中移除
          if (cached.taskId) {
            this.activeTasks.delete(cached.taskId);
          }
        }
      }

      if (hasChanges) {
        await this.saveCache(cache);
        this.logger.debug(
          `[CustomMCP] 清理过期缓存完成，清理了 ${cleanedCount} 个条目`
        );
      }
    } catch (error) {
      this.logger.warn(`[CustomMCP] 清理过期缓存失败: ${error}`);
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(toolName: string, arguments_: any): string {
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
    arguments_: any,
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
   * 停止清理定时器
   */
  public stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      this.logger.info("[CustomMCP] 停止缓存清理定时器");
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.logger.info("[CustomMCP] 清理 CustomMCP 处理器资源");
    this.stopCleanupTimer();
    this.cacheLifecycleManager.stopAutoCleanup();
    this.cacheLifecycleManager.cleanup();
    this.taskStateManager.cleanup();
    this.cacheManager.cleanup();
    this.tools.clear();
    this.activeTasks.clear();
  }

  // ==================== 新增的管理器集成方法 ====================

  /**
   * 获取缓存生命周期管理器
   */
  public getCacheLifecycleManager(): CacheLifecycleManager {
    return this.cacheLifecycleManager;
  }

  /**
   * 获取任务状态管理器
   */
  public getTaskStateManager(): TaskStateManager {
    return this.taskStateManager;
  }

  /**
   * 获取缓存统计信息
   */
  public async getCacheStatistics(): Promise<CacheStatistics> {
    return this.cacheManager.getCustomMCPStatistics();
  }

  /**
   * 获取任务统计信息
   */
  public getTaskStatistics() {
    return this.taskStateManager.getTaskStatistics();
  }

  /**
   * 获取任务状态
   */
  public getTaskStatus(taskId: string): string | null {
    return this.taskStateManager.getTaskStatus(taskId);
  }

  /**
   * 验证任务ID
   */
  public validateTaskId(taskId: string): boolean {
    return this.taskStateManager.validateTaskId(taskId);
  }

  /**
   * 重启停滞任务
   */
  public restartStalledTasks(timeoutMs = 30000): number {
    return this.taskStateManager.restartStalledTasks(timeoutMs);
  }

  /**
   * 手动清理过期缓存
   */
  public async manualCleanupCache(): Promise<{
    cleaned: number;
    total: number;
  }> {
    return this.cacheManager.cleanupCustomMCPResults();
  }

  /**
   * 验证系统完整性
   */
  public async validateSystemIntegrity(): Promise<{
    cacheValid: boolean;
    taskValid: boolean;
    issues: string[];
  }> {
    const cache = await this.cacheManager.loadExtendedCache();
    const cacheValidation =
      this.cacheLifecycleManager.validateCacheIntegrity(cache);
    const taskValidation = this.taskStateManager.validateTaskIntegrity();

    return {
      cacheValid: cacheValidation.isValid,
      taskValid: taskValidation.isValid,
      issues: [...cacheValidation.issues, ...taskValidation.issues],
    };
  }
}
