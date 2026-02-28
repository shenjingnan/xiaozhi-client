/**
 * CustomMCP 工具管理
 *
 * 负责 CustomMCP 工具的验证、添加、更新和删除
 */
import type { AppConfig, CustomMCPTool, CustomMCPConfig } from "./types.js";
import { ConfigValidator } from "./ConfigValidator.js";

/**
 * CustomMCP 工具管理类
 */
export class CustomMCPToolsManager {
  private validator: ConfigValidator;

  constructor(validator: ConfigValidator) {
    this.validator = validator;
  }

  /**
   * 获取 CustomMCP 工具列表
   */
  public getCustomMCPTools(config: AppConfig): CustomMCPTool[] {
    return config.customMCP?.tools || [];
  }

  /**
   * 检查是否有有效的 CustomMCP 工具
   */
  public hasValidCustomMCPTools(config: AppConfig): boolean {
    const tools = this.getCustomMCPTools(config);

    if (tools.length === 0) {
      return false;
    }

    return this.validator.validateCustomMCPTools(tools);
  }

  /**
   * 添加 CustomMCP 工具
   */
  public addCustomMCPTool(config: AppConfig, tool: CustomMCPTool): void {
    if (!tool || typeof tool !== "object") {
      throw new Error("CustomMCP 工具必须是一个对象");
    }

    // 验证工具配置
    if (!this.validator.validateCustomMCPTools([tool])) {
      throw new Error("CustomMCP 工具配置验证失败");
    }

    // 确保 customMCP 存在
    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }

    if (!config.customMCP.tools) {
      config.customMCP.tools = [];
    }

    // 检查工具名称是否已存在
    const existingTool = config.customMCP.tools.find(
      (t) => t.name === tool.name
    );

    if (existingTool) {
      throw new Error(`CustomMCP 工具 ${tool.name} 已存在`);
    }

    // 添加工具
    config.customMCP.tools.push(tool);
  }

  /**
   * 移除 CustomMCP 工具
   */
  public removeCustomMCPTool(config: AppConfig, toolName: string): void {
    if (!toolName || typeof toolName !== "string") {
      throw new Error("工具名称必须是非空字符串");
    }

    if (!config.customMCP || !config.customMCP.tools) {
      throw new Error("没有可移除的 CustomMCP 工具");
    }

    const toolIndex = config.customMCP.tools.findIndex(
      (tool) => tool.name === toolName
    );

    if (toolIndex === -1) {
      throw new Error(`CustomMCP 工具 ${toolName} 不存在`);
    }

    config.customMCP.tools.splice(toolIndex, 1);

    // 如果没有工具了，可以清理整个 customMCP 对象
    if (config.customMCP.tools.length === 0) {
      config.customMCP = undefined;
    }
  }

  /**
   * 更新 CustomMCP 工具
   */
  public updateCustomMCPTool(
    config: AppConfig,
    toolName: string,
    updatedTool: CustomMCPTool
  ): void {
    if (!toolName || typeof toolName !== "string") {
      throw new Error("工具名称必须是非空字符串");
    }

    if (!updatedTool || typeof updatedTool !== "object") {
      throw new Error("更新的工具必须是一个对象");
    }

    if (!config.customMCP || !config.customMCP.tools) {
      throw new Error("没有可更新的 CustomMCP 工具");
    }

    const toolIndex = config.customMCP.tools.findIndex(
      (tool) => tool.name === toolName
    );

    if (toolIndex === -1) {
      throw new Error(`CustomMCP 工具 ${toolName} 不存在`);
    }

    // 验证更新后的工具配置
    if (!this.validator.validateCustomMCPTools([updatedTool])) {
      throw new Error("更新的 CustomMCP 工具配置验证失败");
    }

    // 更新工具
    config.customMCP.tools[toolIndex] = updatedTool;
  }

  /**
   * 批量更新 CustomMCP 工具
   */
  public updateCustomMCPTools(
    config: AppConfig,
    tools: CustomMCPTool[]
  ): void {
    // 验证所有工具
    if (!this.validator.validateCustomMCPTools(tools)) {
      throw new Error("CustomMCP 工具配置验证失败");
    }

    // 确保 customMCP 存在
    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }

    // 更新工具列表
    config.customMCP.tools = tools;

    // 如果没有工具了，可以清理整个 customMCP 对象
    if (tools.length === 0) {
      config.customMCP = undefined;
    }
  }

  /**
   * 根据 serverName 和 toolName 构造完整的工具名称
   */
  public getFullToolName(serverName: string, toolName: string): string {
    return `${serverName}__${toolName}`;
  }

  /**
   * 从完整工具名称中解析出 serverName 和 toolName
   */
  public parseFullToolName(fullToolName: string): {
    serverName: string;
    toolName: string;
  } | null {
    const parts = fullToolName.split("__");
    if (parts.length < 2) {
      return null;
    }

    return {
      serverName: parts[0],
      toolName: parts.slice(1).join("__"),
    };
  }
}
