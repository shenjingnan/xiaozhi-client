/**
 * CustomMCP 配置管理器
 *
 * 负责 CustomMCP 工具的管理：
 * - 工具的增删改查
 * - 工具配置验证
 * - 工具统计信息管理
 */

import type {
  CustomMCPConfig,
  CustomMCPTool,
  HandlerConfig,
} from "../types.js";
import { ConfigStore } from "./ConfigStore.js";

/**
 * CustomMCP 配置管理器
 */
export class CustomMCPConfigManager {
  constructor(private readonly store: ConfigStore) {}

  /**
   * 获取 customMCP 配置
   */
  public getCustomMCPConfig(): CustomMCPConfig | null {
    const config = this.store.getConfig();
    return config.customMCP || null;
  }

  /**
   * 获取 customMCP 工具列表
   */
  public getCustomMCPTools(): CustomMCPTool[] {
    const customMCPConfig = this.getCustomMCPConfig();
    if (!customMCPConfig || !customMCPConfig.tools) {
      return [];
    }

    return customMCPConfig.tools;
  }

  /**
   * 检查是否配置了有效的 customMCP 工具
   */
  public hasValidCustomMCPTools(): boolean {
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

  /**
   * 验证 customMCP 工具配置
   */
  public validateCustomMCPTools(tools: CustomMCPTool[]): boolean {
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

      // 验证处理器配置
      const handler = tool.handler;
      if (!this.validateHandler(tool.name, handler)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 添加自定义 MCP 工具
   */
  public addCustomMCPTool(tool: CustomMCPTool): void {
    if (!tool || typeof tool !== "object") {
      throw new Error("工具配置不能为空");
    }

    const config = this.getMutableConfig();

    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }

    const existingTool = config.customMCP.tools.find(
      (t: CustomMCPTool) => t.name === tool.name
    );
    if (existingTool) {
      throw new Error(`工具 "${tool.name}" 已存在`);
    }

    if (!this.validateCustomMCPTools([tool])) {
      throw new Error("工具配置验证失败");
    }

    config.customMCP.tools.unshift(tool);
    this.store.saveConfig(config);

    console.log("成功添加自定义 MCP 工具", { toolName: tool.name });
  }

  /**
   * 批量添加自定义 MCP 工具
   */
  public async addCustomMCPTools(tools: CustomMCPTool[]): Promise<void> {
    if (!Array.isArray(tools)) {
      throw new Error("工具配置必须是数组");
    }

    if (tools.length === 0) {
      return;
    }

    const config = this.getMutableConfig();

    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }

    const existingNames = new Set(
      config.customMCP.tools.map((tool: CustomMCPTool) => tool.name)
    );
    const newTools = tools.filter((tool: CustomMCPTool) => !existingNames.has(tool.name));

    if (newTools.length > 0) {
      if (!this.validateCustomMCPTools(newTools)) {
        throw new Error("工具配置验证失败");
      }

      config.customMCP.tools.push(...newTools);
      this.store.saveConfig(config);

      this.emitConfigUpdate({ type: "customMCP", timestamp: new Date() });

      console.log("成功批量添加自定义 MCP 工具", {
        count: newTools.length,
        toolNames: newTools.map((t) => t.name),
      });
    }
  }

  /**
   * 删除自定义 MCP 工具
   */
  public removeCustomMCPTool(toolName: string): void {
    if (!toolName || typeof toolName !== "string") {
      throw new Error("工具名称不能为空");
    }

    const config = this.getMutableConfig();

    if (!config.customMCP || !config.customMCP.tools) {
      throw new Error("未配置自定义 MCP 工具");
    }

    const toolIndex = config.customMCP.tools.findIndex(
      (t: CustomMCPTool) => t.name === toolName
    );
    if (toolIndex === -1) {
      throw new Error(`工具 "${toolName}" 不存在`);
    }

    config.customMCP.tools.splice(toolIndex, 1);
    this.store.saveConfig(config);

    console.log("成功删除自定义 MCP 工具", { toolName });
  }

  /**
   * 更新单个自定义 MCP 工具配置
   */
  public updateCustomMCPTool(
    toolName: string,
    updatedTool: CustomMCPTool
  ): void {
    if (!toolName || typeof toolName !== "string") {
      throw new Error("工具名称不能为空");
    }
    if (!updatedTool || typeof updatedTool !== "object") {
      throw new Error("更新后的工具配置不能为空");
    }

    const config = this.getMutableConfig();

    if (!config.customMCP || !config.customMCP.tools) {
      throw new Error("未配置自定义 MCP 工具");
    }

    const toolIndex = config.customMCP.tools.findIndex(
      (t: CustomMCPTool) => t.name === toolName
    );
    if (toolIndex === -1) {
      throw new Error(`工具 "${toolName}" 不存在`);
    }

    if (!this.validateCustomMCPTools([updatedTool])) {
      throw new Error("更新后的工具配置验证失败");
    }

    config.customMCP.tools[toolIndex] = updatedTool;
    this.store.saveConfig(config);

    console.log("成功更新自定义 MCP 工具", { toolName });
  }

  /**
   * 更新自定义 MCP 工具配置
   */
  public updateCustomMCPTools(tools: CustomMCPTool[]): void {
    if (!Array.isArray(tools)) {
      throw new Error("工具配置必须是数组");
    }

    if (!this.validateCustomMCPTools(tools)) {
      throw new Error("工具配置验证失败");
    }

    const config = this.getMutableConfig();

    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }

    config.customMCP.tools = tools;
    this.store.saveConfig(config);

    this.emitConfigUpdate({ type: "customMCP", timestamp: new Date() });

    console.log("成功更新自定义 MCP 工具配置", { count: tools.length });
  }

  /**
   * 验证处理器配置
   */
  private validateHandler(toolName: string, handler: HandlerConfig): boolean {
    const handlerType = handler.type;

    switch (handlerType) {
      case "proxy":
        return this.validateProxyHandler(toolName, handler as import("../types.js").ProxyHandlerConfig);
      case "http":
        return this.validateHttpHandler(toolName, handler as import("../types.js").HttpHandlerConfig);
      case "function":
        return this.validateFunctionHandler(toolName, handler as import("../types.js").FunctionHandlerConfig);
      case "script":
        return this.validateScriptHandler(toolName, handler as import("../types.js").ScriptHandlerConfig);
      case "chain":
        return this.validateChainHandler(toolName, handler as import("../types.js").ChainHandlerConfig);
      case "mcp":
        return this.validateMCPHandler(toolName, handler as import("../types.js").MCPHandlerConfig);
      default:
        console.warn("CustomMCP 工具使用了不支持的处理器类型", {
          toolName,
          handlerType,
        });
        return false;
    }
  }

  private validateProxyHandler(
    toolName: string,
    handler: import("../types.js").ProxyHandlerConfig
  ): boolean {
    if (!handler.config || typeof handler.config !== "object") {
      console.warn("CustomMCP 工具的 proxy 处理器缺少 config 字段", {
        toolName,
      });
      return false;
    }

    const { platform } = handler;
    if (!["coze", "openai", "anthropic", "custom"].includes(platform)) {
      console.warn("CustomMCP 工具的 proxy 处理器使用了不支持的平台", {
        toolName,
        platform,
      });
      return false;
    }

    return true;
  }

  private validateHttpHandler(
    toolName: string,
    handler: import("../types.js").HttpHandlerConfig
  ): boolean {
    if (!handler.url || typeof handler.url !== "string") {
      console.warn("CustomMCP 工具的 http 处理器缺少有效的 url 字段", {
        toolName,
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

  private validateFunctionHandler(
    toolName: string,
    handler: import("../types.js").FunctionHandlerConfig
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

  private validateScriptHandler(
    toolName: string,
    handler: import("../types.js").ScriptHandlerConfig
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

  private validateChainHandler(
    toolName: string,
    handler: import("../types.js").ChainHandlerConfig
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

  private validateMCPHandler(
    toolName: string,
    handler: import("../types.js").MCPHandlerConfig
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

  private getMutableConfig(): any {
    return (this.store as any).getMutableConfig();
  }

  private emitConfigUpdate(data: { type: string; timestamp: Date }): void {
    (this.store as any).emitEvent("config:updated", data);
  }
}
