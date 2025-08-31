#!/usr/bin/env node

/**
 * CustomMCP 工具处理器
 * 负责解析和调用 customMCP 配置中定义的工具
 * 支持多种 handler 类型：proxy、function、http、script、chain
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { type Logger, logger } from "../Logger.js";
import { type CustomMCPTool, configManager } from "../configManager.js";

// 工具调用结果接口（与 MCPServiceManager 保持一致）
export interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

// 工具调用选项
interface ToolCallOptions {
  timeout?: number; // 超时时间（毫秒）
  retries?: number; // 重试次数
  retryDelay?: number; // 重试延迟（毫秒）
}

export class CustomMCPHandler {
  private logger: Logger;
  private tools: Map<string, CustomMCPTool> = new Map();
  private defaultTimeout = 30000; // 30秒默认超时
  private defaultRetries = 2; // 默认重试2次
  private defaultRetryDelay = 1000; // 默认重试延迟1秒

  constructor() {
    this.logger = logger;
  }

  /**
   * 初始化 CustomMCP 处理器
   * 加载配置中的 customMCP 工具
   */
  public initialize(): void {
    this.logger.info("[CustomMCP] 初始化 CustomMCP 处理器...");

    try {
      const customTools = configManager.getCustomMCPTools();

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
   * 调用工具
   */
  public async callTool(
    toolName: string,
    arguments_: any,
    options?: ToolCallOptions
  ): Promise<ToolCallResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`未找到工具: ${toolName}`);
    }

    this.logger.info(`[CustomMCP] 调用工具: ${toolName}`, {
      handler: tool.handler.type,
      arguments: arguments_,
    });

    const callOptions: Required<ToolCallOptions> = {
      timeout: options?.timeout ?? this.defaultTimeout,
      retries: options?.retries ?? this.defaultRetries,
      retryDelay: options?.retryDelay ?? this.defaultRetryDelay,
    };

    return await this.executeWithRetry(tool, arguments_, callOptions);
  }

  /**
   * 带重试机制的工具执行
   */
  private async executeWithRetry(
    tool: CustomMCPTool,
    arguments_: any,
    options: Required<ToolCallOptions>
  ): Promise<ToolCallResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= options.retries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.info(
            `[CustomMCP] 重试调用工具 ${tool.name}，第 ${attempt} 次重试`
          );
          await this.delay(options.retryDelay);
        }

        return await this.executeToolCall(tool, arguments_, options.timeout);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `[CustomMCP] 工具 ${tool.name} 调用失败 (尝试 ${attempt + 1}/${options.retries + 1}):`,
          lastError.message
        );

        // 如果是最后一次尝试，不再重试
        if (attempt === options.retries) {
          break;
        }
      }
    }

    // 所有重试都失败了
    this.logger.error(`[CustomMCP] 工具 ${tool.name} 调用最终失败:`, lastError);
    return {
      content: [
        {
          type: "text",
          text: `工具调用失败: ${lastError?.message || "未知错误"}`,
        },
      ],
      isError: true,
    };
  }

  /**
   * 执行具体的工具调用
   */
  private async executeToolCall(
    tool: CustomMCPTool,
    arguments_: any,
    timeout: number
  ): Promise<ToolCallResult> {
    // 创建超时 Promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`工具调用超时 (${timeout}ms)`));
      }, timeout);
    });

    // 创建实际调用 Promise
    const callPromise = this.callToolByType(tool, arguments_);

    // 使用 Promise.race 实现超时控制
    try {
      return await Promise.race([callPromise, timeoutPromise]);
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * 根据 handler 类型调用相应的工具
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
      default:
        throw new Error(`不支持的处理器类型: ${(tool.handler as any).type}`);
    }
  }

  /**
   * 调用代理工具（如 Coze 工作流）
   */
  private async callProxyTool(
    tool: CustomMCPTool,
    arguments_: any
  ): Promise<ToolCallResult> {
    this.logger.info(`[CustomMCP] 调用代理工具: ${tool.name}`, {
      platform: tool.handler.platform,
      config: tool.handler.config,
    });

    // 根据平台类型调用相应的代理
    if (tool.handler.platform === "coze") {
      return await this.callCozeWorkflow(tool, arguments_);
    }

    // 可以在这里添加其他平台的支持
    throw new Error(`不支持的代理平台: ${tool.handler.platform}`);
  }

  /**
   * 调用 Coze 工作流
   */
  private async callCozeWorkflow(
    tool: CustomMCPTool,
    arguments_: any
  ): Promise<ToolCallResult> {
    // TODO: 实现 Coze 工作流调用逻辑
    // 这里需要根据实际的 Coze API 进行实现
    this.logger.warn(`[CustomMCP] Coze 工作流调用尚未实现: ${tool.name}`);

    return {
      content: [
        {
          type: "text",
          text: `Coze 工作流调用功能正在开发中。工具: ${tool.name}, 参数: ${JSON.stringify(arguments_)}`,
        },
      ],
      isError: false,
    };
  }

  /**
   * 调用函数工具
   */
  private async callFunctionTool(
    tool: CustomMCPTool,
    arguments_: any
  ): Promise<ToolCallResult> {
    // TODO: 实现函数工具调用逻辑
    this.logger.warn(`[CustomMCP] 函数工具调用尚未实现: ${tool.name}`);

    return {
      content: [
        {
          type: "text",
          text: `函数工具调用功能正在开发中。工具: ${tool.name}, 参数: ${JSON.stringify(arguments_)}`,
        },
      ],
      isError: false,
    };
  }

  /**
   * 调用 HTTP 工具
   */
  private async callHttpTool(
    tool: CustomMCPTool,
    arguments_: any
  ): Promise<ToolCallResult> {
    // TODO: 实现 HTTP 工具调用逻辑
    this.logger.warn(`[CustomMCP] HTTP 工具调用尚未实现: ${tool.name}`);

    return {
      content: [
        {
          type: "text",
          text: `HTTP 工具调用功能正在开发中。工具: ${tool.name}, 参数: ${JSON.stringify(arguments_)}`,
        },
      ],
      isError: false,
    };
  }

  /**
   * 调用脚本工具
   */
  private async callScriptTool(
    tool: CustomMCPTool,
    arguments_: any
  ): Promise<ToolCallResult> {
    // TODO: 实现脚本工具调用逻辑
    this.logger.warn(`[CustomMCP] 脚本工具调用尚未实现: ${tool.name}`);

    return {
      content: [
        {
          type: "text",
          text: `脚本工具调用功能正在开发中。工具: ${tool.name}, 参数: ${JSON.stringify(arguments_)}`,
        },
      ],
      isError: false,
    };
  }

  /**
   * 调用链式工具
   */
  private async callChainTool(
    tool: CustomMCPTool,
    arguments_: any
  ): Promise<ToolCallResult> {
    // TODO: 实现链式工具调用逻辑
    this.logger.warn(`[CustomMCP] 链式工具调用尚未实现: ${tool.name}`);

    return {
      content: [
        {
          type: "text",
          text: `链式工具调用功能正在开发中。工具: ${tool.name}, 参数: ${JSON.stringify(arguments_)}`,
        },
      ],
      isError: false,
    };
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
   * 清理资源
   */
  public cleanup(): void {
    this.logger.info("[CustomMCP] 清理 CustomMCP 处理器资源");
    this.tools.clear();
  }
}
