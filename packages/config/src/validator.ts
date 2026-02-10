/**
 * 配置验证模块
 * 负责验证配置结构的正确性
 */

import type {
  AppConfig,
  CustomMCPTool,
  HandlerConfig,
  HttpHandlerConfig,
  ProxyHandlerConfig,
  FunctionHandlerConfig,
  ScriptHandlerConfig,
  ChainHandlerConfig,
  MCPHandlerConfig,
} from "./types.js";

/**
 * 配置验证器
 * 负责验证配置结构的正确性
 */
export class ConfigValidator {
  /**
   * 验证配置文件结构
   * @param config 配置对象
   * @throws {Error} 配置无效时抛出错误
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
    for (const [serverName, serverConfig] of Object.entries(
      configObj.mcpServers as Record<string, unknown>
    )) {
      if (!serverConfig || typeof serverConfig !== "object") {
        throw new Error(`配置文件格式错误：mcpServers.${serverName} 无效`);
      }

      // 基本验证：确保配置有效
      // 更详细的验证应该由调用方完成
    }
  }

  /**
   * 验证 customMCP 工具配置
   * @param tools CustomMCP 工具数组
   * @returns 验证是否通过
   */
  public validateCustomMCPTools(tools: CustomMCPTool[]): boolean {
    if (!Array.isArray(tools)) {
      return false;
    }

    for (const tool of tools) {
      // 检查必需字段
      if (!tool.name || typeof tool.name !== "string") {
        console.warn("CustomMCP 工具缺少有效的 name 字段", { tool });
        return false;
      }

      if (!tool.description || typeof tool.description !== "string") {
        console.warn("CustomMCP 工具缺少有效的 description 字段", {
          toolName: tool.name,
        });
        return false;
      }

      if (!tool.inputSchema || typeof tool.inputSchema !== "object") {
        console.warn("CustomMCP 工具缺少有效的 inputSchema 字段", {
          toolName: tool.name,
        });
        return false;
      }

      if (!tool.handler || typeof tool.handler !== "object") {
        console.warn("CustomMCP 工具缺少有效的 handler 字段", {
          toolName: tool.name,
        });
        return false;
      }

      // 检查 handler 类型
      if (
        !["proxy", "function", "http", "script", "chain", "mcp"].includes(
          tool.handler.type
        )
      ) {
        console.warn("CustomMCP 工具的 handler.type 类型无效", {
          toolName: tool.name,
          type: tool.handler.type,
        });
        return false;
      }

      // 根据处理器类型进行特定验证
      if (!this.validateHandlerConfig(tool.name, tool.handler)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 验证处理器配置
   * @param toolName 工具名称
   * @param handler 处理器配置
   * @returns 验证是否通过
   */
  private validateHandlerConfig(
    toolName: string,
    handler: HandlerConfig
  ): boolean {
    switch (handler.type) {
      case "proxy":
        return this.validateProxyHandler(toolName, handler);
      case "http":
        return this.validateHttpHandler(toolName, handler);
      case "function":
        return this.validateFunctionHandler(toolName, handler);
      case "script":
        return this.validateScriptHandler(toolName, handler);
      case "chain":
        return this.validateChainHandler(toolName, handler);
      case "mcp":
        return this.validateMCPHandler(toolName, handler);
      default:
        console.warn("CustomMCP 工具使用了未知的处理器类型", {
          toolName,
          handlerType: (handler as HandlerConfig).type,
        });
        return false;
    }
  }

  /**
   * 验证代理处理器配置
   * @param toolName 工具名称
   * @param handler 代理处理器配置
   * @returns 验证是否通过
   */
  private validateProxyHandler(
    toolName: string,
    handler: ProxyHandlerConfig
  ): boolean {
    if (!handler.platform) {
      console.warn("CustomMCP 工具的 proxy 处理器缺少 platform 字段", {
        toolName,
      });
      return false;
    }

    if (
      !["coze", "openai", "anthropic", "custom"].includes(handler.platform)
    ) {
      console.warn("CustomMCP 工具的 proxy 处理器使用了不支持的平台", {
        toolName,
        platform: handler.platform,
      });
      return false;
    }

    if (!handler.config || typeof handler.config !== "object") {
      console.warn("CustomMCP 工具的 proxy 处理器缺少 config 字段", {
        toolName,
      });
      return false;
    }

    // Coze 平台特定验证
    if (handler.platform === "coze") {
      if (!handler.config.workflow_id && !handler.config.bot_id) {
        console.warn(
          "CustomMCP 工具的 Coze 处理器必须提供 workflow_id 或 bot_id",
          { toolName }
        );
        return false;
      }
    }

    return true;
  }

  /**
   * 验证 HTTP 处理器配置
   * @param toolName 工具名称
   * @param handler HTTP 处理器配置
   * @returns 验证是否通过
   */
  private validateHttpHandler(
    toolName: string,
    handler: HttpHandlerConfig
  ): boolean {
    if (!handler.url || typeof handler.url !== "string") {
      console.warn("CustomMCP 工具的 http 处理器缺少有效的 url 字段", {
        toolName,
      });
      return false;
    }

    try {
      new URL(handler.url);
    } catch {
      console.warn("CustomMCP 工具的 http 处理器 url 格式无效", {
        toolName,
        url: handler.url,
      });
      return false;
    }

    if (
      handler.method &&
      !["GET", "POST", "PUT", "DELETE", "PATCH"].includes(handler.method)
    ) {
      console.warn("CustomMCP 工具的 http 处理器使用了不支持的 HTTP 方法", {
        toolName,
        method: handler.method,
      });
      return false;
    }

    return true;
  }

  /**
   * 验证函数处理器配置
   * @param toolName 工具名称
   * @param handler 函数处理器配置
   * @returns 验证是否通过
   */
  private validateFunctionHandler(
    toolName: string,
    handler: FunctionHandlerConfig
  ): boolean {
    if (!handler.module || typeof handler.module !== "string") {
      console.warn(
        "CustomMCP 工具的 function 处理器缺少有效的 module 字段",
        { toolName }
      );
      return false;
    }

    if (!handler.function || typeof handler.function !== "string") {
      console.warn(
        "CustomMCP 工具的 function 处理器缺少有效的 function 字段",
        { toolName }
      );
      return false;
    }

    return true;
  }

  /**
   * 验证脚本处理器配置
   * @param toolName 工具名称
   * @param handler 脚本处理器配置
   * @returns 验证是否通过
   */
  private validateScriptHandler(
    toolName: string,
    handler: ScriptHandlerConfig
  ): boolean {
    if (!handler.script || typeof handler.script !== "string") {
      console.warn("CustomMCP 工具的 script 处理器缺少有效的 script 字段", {
        toolName,
      });
      return false;
    }

    if (
      handler.interpreter &&
      !["node", "python", "bash"].includes(handler.interpreter)
    ) {
      console.warn("CustomMCP 工具的 script 处理器使用了不支持的解释器", {
        toolName,
        interpreter: handler.interpreter,
      });
      return false;
    }

    return true;
  }

  /**
   * 验证链式处理器配置
   * @param toolName 工具名称
   * @param handler 链式处理器配置
   * @returns 验证是否通过
   */
  private validateChainHandler(
    toolName: string,
    handler: ChainHandlerConfig
  ): boolean {
    if (
      !handler.tools ||
      !Array.isArray(handler.tools) ||
      handler.tools.length === 0
    ) {
      console.warn("CustomMCP 工具的 chain 处理器缺少有效的 tools 数组", {
        toolName,
      });
      return false;
    }

    if (!["sequential", "parallel"].includes(handler.mode)) {
      console.warn("CustomMCP 工具的 chain 处理器使用了不支持的执行模式", {
        toolName,
        mode: handler.mode,
      });
      return false;
    }

    if (
      !["stop", "continue", "retry"].includes(handler.error_handling)
    ) {
      console.warn(
        "CustomMCP 工具的 chain 处理器使用了不支持的错误处理策略",
        {
          toolName,
          errorHandling: handler.error_handling,
        }
      );
      return false;
    }

    return true;
  }

  /**
   * 验证 MCP 处理器配置
   * @param toolName 工具名称
   * @param handler MCP 处理器配置
   * @returns 验证是否通过
   */
  private validateMCPHandler(
    toolName: string,
    handler: MCPHandlerConfig
  ): boolean {
    if (!handler.config || typeof handler.config !== "object") {
      console.warn("CustomMCP 工具的 mcp 处理器缺少 config 字段", {
        toolName,
      });
      return false;
    }

    if (
      !handler.config.serviceName ||
      typeof handler.config.serviceName !== "string"
    ) {
      console.warn("CustomMCP 工具的 mcp 处理器缺少有效的 serviceName", {
        toolName,
      });
      return false;
    }

    if (
      !handler.config.toolName ||
      typeof handler.config.toolName !== "string"
    ) {
      console.warn("CustomMCP 工具的 mcp 处理器缺少有效的 toolName", {
        toolName,
      });
      return false;
    }

    return true;
  }
}

// 导出单例实例
export const configValidator = new ConfigValidator();
