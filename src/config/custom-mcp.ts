/**
 * CustomMCP 工具管理器
 *
 * 负责自定义 MCP 工具的完整生命周期管理，包括：
 * - 工具配置的 CRUD 操作
 * - 工具配置验证（支持 6 种处理器类型）
 * - 工具使用统计信息更新
 *
 * 从 ConfigManager 中拆分出来，遵循单一职责原则
 */

import dayjs from "dayjs";

// ==================== CustomMCP 工具处理器配置类型 ====================

/** 代理处理器配置 */
export interface ProxyHandlerConfig {
  type: "proxy";
  platform: "coze" | "openai" | "anthropic" | "custom";
  config: {
    workflow_id?: string;
    bot_id?: string;
    api_key?: string;
    base_url?: string;
    timeout?: number;
    retry_count?: number;
    retry_delay?: number;
    headers?: Record<string, unknown>;
    params?: Record<string, unknown>;
  };
}

/** HTTP 处理器配置 */
export interface HttpHandlerConfig {
  type: "http";
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  timeout?: number;
  retry_count?: number;
  retry_delay?: number;
  auth?: {
    type: "bearer" | "basic" | "api_key";
    token?: string;
    username?: string;
    password?: string;
    api_key?: string;
    api_key_header?: string;
  };
  body_template?: string;
  response_mapping?: {
    success_path?: string;
    error_path?: string;
    data_path?: string;
  };
}

/** 函数处理器配置 */
export interface FunctionHandlerConfig {
  type: "function";
  module: string;
  function: string;
  timeout?: number;
  context?: Record<string, unknown>;
}

/** 脚本处理器配置 */
export interface ScriptHandlerConfig {
  type: "script";
  script: string;
  interpreter?: "node" | "python" | "bash";
  timeout?: number;
  env?: Record<string, string>;
}

/** 链式处理器配置 */
export interface ChainHandlerConfig {
  type: "chain";
  tools: string[];
  mode: "sequential" | "parallel";
  error_handling: "stop" | "continue" | "retry";
}

/** MCP 处理器配置（用于同步的工具） */
export interface MCPHandlerConfig {
  type: "mcp";
  config: {
    serviceName: string;
    toolName: string;
  };
}

/** 统一的处理器配置联合类型 */
export type HandlerConfig =
  | ProxyHandlerConfig
  | HttpHandlerConfig
  | FunctionHandlerConfig
  | ScriptHandlerConfig
  | ChainHandlerConfig
  | MCPHandlerConfig;

/** CustomMCP 工具接口 */
export interface CustomMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: HandlerConfig;
  stats?: {
    usageCount?: number;
    lastUsedTime?: string;
  };
}

/** CustomMCP 配置接口 */
export interface CustomMCPConfig {
  tools: CustomMCPTool[];
}

/** 配置管理器接口（CustomMCPManager 依赖的最小操作集） */
export interface IConfigAccessor {
  /** 获取只读配置 */
  getConfig(): Readonly<object>;
  /** 获取可修改的配置副本 */
  getMutableConfig(): object;
  /** 保存配置到文件 */
  saveConfig(config: object): void;
  /** 发射配置更新事件 */
  notifyConfigUpdate(type: string): void;
}

/**
 * CustomMCP 工具管理器
 *
 * 管理自定义 MCP 工具的增删改查、验证和统计功能。
 * 通过 IConfigAccessor 接口与 ConfigManager 解耦，便于测试和独立维护。
 */
export class CustomMCPManager {
  constructor(private configAccessor: IConfigAccessor) {}

  /** 获取带类型的可变配置（内部辅助方法） */
  private getTypedConfig(): { customMCP?: CustomMCPConfig } & Record<
    string,
    unknown
  > {
    return this.configAccessor.getMutableConfig() as unknown as {
      customMCP?: CustomMCPConfig;
    } & Record<string, unknown>;
  }

  // ==================== 查询方法 ====================

  /**
   * 获取 customMCP 配置
   */
  getCustomMCPConfig(): CustomMCPConfig | null {
    const config = this.configAccessor.getConfig();
    return (config as { customMCP?: CustomMCPConfig }).customMCP || null;
  }

  /**
   * 获取 customMCP 工具列表
   */
  getCustomMCPTools(): CustomMCPTool[] {
    const customMCPConfig = this.getCustomMCPConfig();
    if (!customMCPConfig || !customMCPConfig.tools) {
      return [];
    }
    return customMCPConfig.tools;
  }

  /**
   * 检查是否配置了有效的 customMCP 工具
   */
  hasValidCustomMCPTools(): boolean {
    try {
      const tools = this.getCustomMCPTools();
      if (tools.length === 0) {
        return false;
      }
      return this.validateCustomMCPTools(tools);
    } catch (error) {
      console.error("检查 customMCP 工具配置时出错", { error });
      return false;
    }
  }

  // ==================== 验证方法 ====================

  /**
   * 验证 customMCP 工具配置
   */
  validateCustomMCPTools(tools: CustomMCPTool[]): boolean {
    if (!Array.isArray(tools)) {
      return false;
    }

    for (const tool of tools) {
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

      if (!this.validateHandlerConfig(tool.name, tool.handler)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 验证处理器配置
   */
  validateHandlerConfig(toolName: string, handler: HandlerConfig): boolean {
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

  /** 验证代理处理器配置 */
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

    if (!["coze", "openai", "anthropic", "custom"].includes(handler.platform)) {
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

  /** 验证 HTTP 处理器配置 */
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

  /** 验证函数处理器配置 */
  private validateFunctionHandler(
    toolName: string,
    handler: FunctionHandlerConfig
  ): boolean {
    if (!handler.module || typeof handler.module !== "string") {
      console.warn("CustomMCP 工具的 function 处理器缺少有效的 module 字段", {
        toolName,
      });
      return false;
    }

    if (!handler.function || typeof handler.function !== "string") {
      console.warn("CustomMCP 工具的 function 处理器缺少有效的 function 字段", {
        toolName,
      });
      return false;
    }

    return true;
  }

  /** 验证脚本处理器配置 */
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

  /** 验证链式处理器配置 */
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

    if (!["stop", "continue", "retry"].includes(handler.error_handling)) {
      console.warn("CustomMCP 工具的 chain 处理器使用了不支持的错误处理策略", {
        toolName,
        errorHandling: handler.error_handling,
      });
      return false;
    }

    return true;
  }

  /** 验证 MCP 处理器配置 */
  private validateMCPHandler(
    toolName: string,
    handler: MCPHandlerConfig
  ): boolean {
    if (!handler.config || typeof handler.config !== "object") {
      console.warn("CustomMCP 工具的 mcp 处理器缺少 config 字段", { toolName });
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

  // ==================== CRUD 方法 ====================

  /**
   * 添加自定义 MCP 工具
   */
  addCustomMCPTool(tool: CustomMCPTool): void {
    if (!tool || typeof tool !== "object") {
      throw new Error("工具配置不能为空");
    }

    const config = this.getTypedConfig();

    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }

    const existingTool = config.customMCP.tools.find(
      (t) => t.name === tool.name
    );
    if (existingTool) {
      throw new Error(`工具 "${tool.name}" 已存在`);
    }

    if (!this.validateCustomMCPTools([tool])) {
      throw new Error("工具配置验证失败");
    }

    config.customMCP.tools.unshift(tool);
    this.configAccessor.saveConfig(config);

    console.log("成功添加自定义 MCP 工具", { toolName: tool.name });
  }

  /**
   * 批量添加自定义 MCP 工具
   */
  async addCustomMCPTools(tools: CustomMCPTool[]): Promise<void> {
    if (!Array.isArray(tools)) {
      throw new Error("工具配置必须是数组");
    }

    if (tools.length === 0) {
      return;
    }

    const config = this.getTypedConfig();

    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }

    const existingNames = new Set(
      config.customMCP.tools.map((tool) => tool.name)
    );
    const newTools = tools.filter((tool) => !existingNames.has(tool.name));

    if (newTools.length > 0) {
      if (!this.validateCustomMCPTools(newTools)) {
        throw new Error("工具配置验证失败");
      }

      config.customMCP.tools.push(...newTools);
      this.configAccessor.saveConfig(config);

      this.configAccessor.notifyConfigUpdate("customMCP");

      console.log("成功批量添加自定义 MCP 工具", {
        count: newTools.length,
        toolNames: newTools.map((t) => t.name),
      });
    }
  }

  /**
   * 删除自定义 MCP 工具
   */
  removeCustomMCPTool(toolName: string): void {
    if (!toolName || typeof toolName !== "string") {
      throw new Error("工具名称不能为空");
    }

    const config = this.getTypedConfig();

    if (!config.customMCP || !config.customMCP.tools) {
      throw new Error("未配置自定义 MCP 工具");
    }

    const toolIndex = config.customMCP.tools.findIndex(
      (t) => t.name === toolName
    );
    if (toolIndex === -1) {
      throw new Error(`工具 "${toolName}" 不存在`);
    }

    config.customMCP.tools.splice(toolIndex, 1);
    this.configAccessor.saveConfig(config);

    console.log("成功删除自定义 MCP 工具", { toolName });
  }

  /**
   * 更新单个自定义 MCP 工具配置
   */
  updateCustomMCPTool(toolName: string, updatedTool: CustomMCPTool): void {
    if (!toolName || typeof toolName !== "string") {
      throw new Error("工具名称不能为空");
    }
    if (!updatedTool || typeof updatedTool !== "object") {
      throw new Error("更新后的工具配置不能为空");
    }

    const config = this.getTypedConfig();

    if (!config.customMCP || !config.customMCP.tools) {
      throw new Error("未配置自定义 MCP 工具");
    }

    const toolIndex = config.customMCP.tools.findIndex(
      (t) => t.name === toolName
    );
    if (toolIndex === -1) {
      throw new Error(`工具 "${toolName}" 不存在`);
    }

    if (!this.validateCustomMCPTools([updatedTool])) {
      throw new Error("更新后的工具配置验证失败");
    }

    config.customMCP.tools[toolIndex] = updatedTool;
    this.configAccessor.saveConfig(config);

    console.log("成功更新自定义 MCP 工具", { toolName });
  }

  /**
   * 更新自定义 MCP 工具配置（批量替换）
   */
  updateCustomMCPTools(tools: CustomMCPTool[]): void {
    if (!Array.isArray(tools)) {
      throw new Error("工具配置必须是数组");
    }

    if (!this.validateCustomMCPTools(tools)) {
      throw new Error("工具配置验证失败");
    }

    const config = this.getTypedConfig();

    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }

    config.customMCP.tools = tools;
    this.configAccessor.saveConfig(config);

    this.configAccessor.notifyConfigUpdate("customMCP");

    console.log("成功更新自定义 MCP 工具配置", { count: tools.length });
  }

  /**
   * 移除与指定服务相关的 CustomMCP 工具
   * 用于在删除 MCP 服务时清理关联的自定义工具
   */
  removeRelatedTools(
    serverName: string,
    config: { customMCP?: CustomMCPConfig } & object
  ): void {
    if (!config.customMCP?.tools) {
      return;
    }

    const relatedTools = config.customMCP.tools.filter(
      (tool) =>
        tool.handler?.type === "mcp" &&
        tool.handler.config?.serviceName === serverName
    );

    for (const tool of relatedTools) {
      const toolIndex = config.customMCP.tools.findIndex(
        (t) => t.name === tool.name
      );
      if (toolIndex !== -1) {
        config.customMCP.tools.splice(toolIndex, 1);
      }
    }

    if (config.customMCP.tools.length === 0) {
      config.customMCP = undefined;
    }
  }

  // ==================== 统计方法 ====================

  /**
   * 更新 customMCP 中的工具使用统计信息（服务名+工具名版本）
   */
  async updateCustomMCPToolStats(
    serverName: string,
    toolName: string,
    callTime: string
  ): Promise<void>;

  /**
   * 更新 customMCP 中的工具使用统计信息（工具名版本）
   */
  async updateCustomMCPToolStats(
    toolName: string,
    callTime: string,
    incrementUsageCount?: boolean
  ): Promise<void>;

  /**
   * 更新 customMCP 工具使用统计信息的实现
   */
  async updateCustomMCPToolStats(
    arg1: string,
    arg2: string,
    arg3?: string | boolean
  ): Promise<void> {
    try {
      let resolvedToolName: string;
      let callTime: string;
      let incrementUsageCount = true;

      if (typeof arg3 === "string") {
        const serverName = arg1;
        resolvedToolName = `${serverName}__${arg2}`;
        callTime = arg3;
      } else {
        resolvedToolName = arg1;
        callTime = arg2;
        incrementUsageCount = (arg3 as boolean) || true;
      }

      const customTools = this.getCustomMCPTools();
      const toolIndex = customTools.findIndex(
        (tool) => tool.name === resolvedToolName
      );

      if (toolIndex === -1) {
        return;
      }

      const updatedTools = [...customTools];
      const tool = updatedTools[toolIndex];

      if (!tool.stats) {
        tool.stats = {};
      }

      const currentUsageCount = tool.stats.usageCount || 0;
      const currentLastUsedTime = tool.stats.lastUsedTime;

      if (incrementUsageCount) {
        tool.stats.usageCount = currentUsageCount + 1;
      }

      if (
        !currentLastUsedTime ||
        new Date(callTime) > new Date(currentLastUsedTime)
      ) {
        tool.stats.lastUsedTime = dayjs(callTime).format("YYYY-MM-DD HH:mm:ss");
      }

      await this.updateCustomMCPToolsInternal(updatedTools);
    } catch (error) {
      if (typeof arg3 === "string") {
        console.error("更新 customMCP 工具统计信息失败", {
          serverName: arg1,
          toolName: arg2,
          error,
        });
      } else {
        console.error("更新 customMCP 工具统计信息失败", {
          toolName: arg1,
          error,
        });
      }
    }
  }

  /**
   * 内部方法：直接更新工具列表（不触发事件通知，用于统计场景）
   */
  private async updateCustomMCPToolsInternal(
    tools: CustomMCPTool[]
  ): Promise<void> {
    const config = this.getTypedConfig();
    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }
    config.customMCP.tools = tools;
    this.configAccessor.saveConfig(config);
  }
}
