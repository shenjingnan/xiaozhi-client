/**
 * 配置验证器
 *
 * 负责配置文件的验证逻辑
 */
import type { AppConfig, CustomMCPTool, HandlerConfig } from "./types.js";

/**
 * 配置验证器类
 */
export class ConfigValidator {
  /**
   * 验证配置文件结构
   */
  public validateConfig(config: unknown): void {
    if (!config || typeof config !== "object") {
      throw new Error("配置文件格式错误：根对象无效");
    }

    const configObj = config as Record<string, unknown>;

    if (
      configObj.mcpEndpoint === undefined ||
      configObj.mcpEndpoint === null
    ) {
      throw new Error("配置文件格式错误：mcpEndpoint 字段无效");
    }

    // 验证 mcpEndpoint 类型（字符串或字符串数组）
    if (typeof configObj.mcpEndpoint === "string") {
      // 空字符串是允许的，getMcpEndpoints 会返回空数组
    } else if (Array.isArray(configObj.mcpEndpoint)) {
      for (const endpoint of configObj.mcpEndpoint) {
        if (typeof endpoint !== "string" || endpoint.trim() === "") {
          throw new Error(
            "配置文件格式错误：mcpEndpoint 数组中的每个元素必须是非空字符串"
          );
        }
      }
    } else {
      throw new Error(
        "配置文件格式错误：mcpEndpoint 必须是字符串或字符串数组"
      );
    }

    if (!configObj.mcpServers || typeof configObj.mcpServers !== "object") {
      throw new Error("配置文件格式错误：mcpServers 字段无效");
    }

    // 验证每个 MCP 服务配置
    for (const [
      serverName,
      serverConfig,
    ] of Object.entries(configObj.mcpServers as Record<string, unknown>)) {
      if (!serverConfig || typeof serverConfig !== "object") {
        throw new Error(`配置文件格式错误：mcpServers.${serverName} 无效`);
      }

      // 基本验证：确保配置有效
      // 更详细的验证应该由调用方完成
    }
  }

  /**
   * 验证 CustomMCP 工具配置
   */
  public validateCustomMCPTools(tools: CustomMCPTool[]): boolean {
    if (!Array.isArray(tools)) {
      return false;
    }

    for (const tool of tools) {
      // 验证工具名称
      if (!tool.name || typeof tool.name !== "string") {
        console.error("CustomMCP 工具名称无效", { tool });
        return false;
      }

      // 验证工具描述
      if (!tool.description || typeof tool.description !== "string") {
        console.error("CustomMCP 工具描述无效", { toolName: tool.name });
        return false;
      }

      // 验证输入模式
      if (!tool.inputSchema || typeof tool.inputSchema !== "object") {
        console.error("CustomMCP 工具输入模式无效", { toolName: tool.name });
        return false;
      }

      // 验证处理器配置
      if (!tool.handler || typeof tool.handler !== "object") {
        console.error("CustomMCP 工具处理器配置无效", {
          toolName: tool.name,
        });
        return false;
      }

      // 根据处理器类型进行详细验证
      const handler = tool.handler as HandlerConfig;
      if (!this.validateHandlerConfig(handler)) {
        console.error("CustomMCP 工具处理器配置验证失败", {
          toolName: tool.name,
          handlerType: handler.type,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * 验证处理器配置
   */
  private validateHandlerConfig(handler: HandlerConfig): boolean {
    switch (handler.type) {
      case "proxy":
        return this.validateProxyHandler(handler);

      case "http":
        return this.validateHttpHandler(handler);

      case "function":
        return this.validateFunctionHandler(handler);

      case "script":
        return this.validateScriptHandler(handler);

      case "chain":
        return this.validateChainHandler(handler);

      case "mcp":
        return this.validateMCPHandler(handler);

      default:
        // TypeScript exhaustive check - handle all known types
        const unknownType: never = handler;
        console.error("未知的处理器类型", { type: (unknownType as { type: string }).type });
        return false;
    }
  }

  /**
   * 验证代理处理器配置
   */
  private validateProxyHandler(handler: HandlerConfig): boolean {
    if (handler.type !== "proxy") {
      return false;
    }

    if (!handler.platform) {
      console.error("代理处理器缺少平台配置");
      return false;
    }

    const validPlatforms = ["coze", "openai", "anthropic", "custom"];
    if (!validPlatforms.includes(handler.platform)) {
      console.error("代理处理器平台配置无效", {
        platform: handler.platform,
      });
      return false;
    }

    if (!handler.config || typeof handler.config !== "object") {
      console.error("代理处理器配置无效");
      return false;
    }

    // Coze 平台特定验证
    if (handler.platform === "coze") {
      const config = handler.config;
      if (!config.workflow_id && !config.bot_id) {
        console.error("Coze 代理处理器必须提供 workflow_id 或 bot_id");
        return false;
      }
    }

    return true;
  }

  /**
   * 验证 HTTP 处理器配置
   */
  private validateHttpHandler(handler: HandlerConfig): boolean {
    if (handler.type !== "http") {
      return false;
    }

    if (!handler.url || typeof handler.url !== "string") {
      console.error("HTTP 处理器 URL 无效");
      return false;
    }

    return true;
  }

  /**
   * 验证函数处理器配置
   */
  private validateFunctionHandler(handler: HandlerConfig): boolean {
    if (handler.type !== "function") {
      return false;
    }

    if (!handler.module || typeof handler.module !== "string") {
      console.error("函数处理器模块路径无效");
      return false;
    }

    if (!handler.function || typeof handler.function !== "string") {
      console.error("函数处理器函数名无效");
      return false;
    }

    return true;
  }

  /**
   * 验证脚本处理器配置
   */
  private validateScriptHandler(handler: HandlerConfig): boolean {
    if (handler.type !== "script") {
      return false;
    }

    if (!handler.script || typeof handler.script !== "string") {
      console.error("脚本处理器脚本内容无效");
      return false;
    }

    return true;
  }

  /**
   * 验证链式处理器配置
   */
  private validateChainHandler(handler: HandlerConfig): boolean {
    if (handler.type !== "chain") {
      return false;
    }

    if (!Array.isArray(handler.tools) || handler.tools.length === 0) {
      console.error("链式处理器工具列表无效");
      return false;
    }

    const validModes = ["sequential", "parallel"];
    if (!validModes.includes(handler.mode)) {
      console.error("链式处理器执行模式无效", { mode: handler.mode });
      return false;
    }

    const validErrorHandling = ["stop", "continue", "retry"];
    if (!validErrorHandling.includes(handler.error_handling)) {
      console.error("链式处理器错误处理策略无效", {
        error_handling: handler.error_handling,
      });
      return false;
    }

    return true;
  }

  /**
   * 验证 MCP 处理器配置
   */
  private validateMCPHandler(handler: HandlerConfig): boolean {
    if (handler.type !== "mcp") {
      return false;
    }

    if (!handler.config || typeof handler.config !== "object") {
      console.error("MCP 处理器配置无效");
      return false;
    }

    if (!handler.config.serviceName || typeof handler.config.serviceName !== "string") {
      console.error("MCP 处理器服务名称无效");
      return false;
    }

    if (!handler.config.toolName || typeof handler.config.toolName !== "string") {
      console.error("MCP 处理器工具名称无效");
      return false;
    }

    return true;
  }
}
