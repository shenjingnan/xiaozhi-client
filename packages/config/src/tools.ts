/**
 * 配置工具管理模块
 * 负责工具配置的管理操作
 */

import dayjs from "dayjs";
import type {
  AppConfig,
  MCPServerToolsConfig,
  MCPToolConfig,
  CustomMCPTool,
} from "./types.js";
import { configStorage } from "./storage.js";
import { configEvents } from "./events.js";
import { configValidator } from "./validator.js";

/**
 * 配置工具管理器
 * 负责工具配置的管理操作
 */
export class ConfigTools {
  /**
   * 获取 MCP 服务工具配置
   * @returns MCP 服务工具配置对象
   */
  public getMcpServerConfig(): Readonly<Record<string, MCPServerToolsConfig>> {
    const config = this.getMutableConfig();
    return config.mcpServerConfig || {};
  }

  /**
   * 获取指定服务的工具配置
   * @param serverName 服务名称
   * @returns 工具配置对象
   */
  public getServerToolsConfig(
    serverName: string
  ): Readonly<Record<string, MCPToolConfig>> {
    const serverConfig = this.getMcpServerConfig();
    return serverConfig[serverName]?.tools || {};
  }

  /**
   * 检查工具是否启用
   * @param serverName 服务名称
   * @param toolName 工具名称
   * @returns 工具是否启用
   */
  public isToolEnabled(serverName: string, toolName: string): boolean {
    const toolsConfig = this.getServerToolsConfig(serverName);
    const toolConfig = toolsConfig[toolName];
    return toolConfig?.enable !== false; // 默认启用
  }

  /**
   * 更新服务工具配置
   * @param serverName 服务名称
   * @param toolsConfig 工具配置对象
   */
  public updateServerToolsConfig(
    serverName: string,
    toolsConfig: Record<string, MCPToolConfig>
  ): void {
    const config = this.getMutableConfig();

    // 确保 mcpServerConfig 存在
    if (!config.mcpServerConfig) {
      config.mcpServerConfig = {};
    }

    // 如果 toolsConfig 为空对象，则删除该服务的配置
    if (Object.keys(toolsConfig).length === 0) {
      delete config.mcpServerConfig[serverName];
    } else {
      // 更新指定服务的工具配置
      config.mcpServerConfig[serverName] = {
        tools: toolsConfig,
      };
    }

    configStorage.saveConfig(config);

    // 发射配置更新事件
    configEvents.emit("config:updated", {
      type: "serverTools",
      serviceName: serverName,
      timestamp: new Date(),
    });
  }

  /**
   * 删除指定服务器的工具配置
   * @param serverName 服务名称
   */
  public removeServerToolsConfig(serverName: string): void {
    const config = this.getMutableConfig();
    const newConfig = { ...config };

    // 确保 mcpServerConfig 存在
    if (newConfig.mcpServerConfig) {
      // 删除指定服务的工具配置
      delete newConfig.mcpServerConfig[serverName];
      configStorage.saveConfig(newConfig);
    }
  }

  /**
   * 清理无效的服务器工具配置
   * 删除在 mcpServerConfig 中存在但在 mcpServers 中不存在的服务配置
   */
  public cleanupInvalidServerToolsConfig(): void {
    const config = this.getMutableConfig();

    // 如果没有 mcpServerConfig，无需清理
    if (!config.mcpServerConfig) {
      return;
    }

    const validServerNames = Object.keys(config.mcpServers);
    const configuredServerNames = Object.keys(config.mcpServerConfig);

    // 找出需要清理的服务名称
    const invalidServerNames = configuredServerNames.filter(
      (serverName) => !validServerNames.includes(serverName)
    );

    if (invalidServerNames.length > 0) {
      // 删除无效的服务配置
      for (const serverName of invalidServerNames) {
        delete config.mcpServerConfig[serverName];
      }

      configStorage.saveConfig(config);

      console.log("已清理无效的服务工具配置", {
        count: invalidServerNames.length,
        serverNames: invalidServerNames,
      });
    }
  }

  /**
   * 设置工具启用状态
   * @param serverName 服务名称
   * @param toolName 工具名称
   * @param enabled 是否启用
   * @param description 工具描述（可选）
   */
  public setToolEnabled(
    serverName: string,
    toolName: string,
    enabled: boolean,
    description?: string
  ): void {
    const config = this.getMutableConfig();

    // 确保 mcpServerConfig 存在
    if (!config.mcpServerConfig) {
      config.mcpServerConfig = {};
    }

    // 确保服务配置存在
    if (!config.mcpServerConfig[serverName]) {
      config.mcpServerConfig[serverName] = { tools: {} };
    }

    // 更新工具配置
    config.mcpServerConfig[serverName].tools[toolName] = {
      ...config.mcpServerConfig[serverName].tools[toolName],
      enable: enabled,
      ...(description && { description }),
    };

    configStorage.saveConfig(config);
  }

  /**
   * 更新 mcpServerConfig 中的工具使用统计信息（内部实现）
   * @param serverName 服务名称
   * @param toolName 工具名称
   * @param callTime 调用时间（ISO 8601 格式）
   * @param incrementUsageCount 是否增加使用计数
   */
  public async updateMCPServerToolStats(
    serverName: string,
    toolName: string,
    callTime: string,
    incrementUsageCount = true
  ): Promise<void> {
    const config = this.getMutableConfig();

    // 确保 mcpServerConfig 存在
    if (!config.mcpServerConfig) {
      config.mcpServerConfig = {};
    }

    // 确保服务配置存在
    if (!config.mcpServerConfig[serverName]) {
      config.mcpServerConfig[serverName] = { tools: {} };
    }

    // 确保工具配置存在
    if (!config.mcpServerConfig[serverName].tools[toolName]) {
      config.mcpServerConfig[serverName].tools[toolName] = {
        enable: true, // 默认启用
      };
    }

    const toolConfig = config.mcpServerConfig[serverName].tools[toolName];
    const currentUsageCount = toolConfig.usageCount || 0;
    const currentLastUsedTime = toolConfig.lastUsedTime;

    // 根据参数决定是否更新使用次数
    if (incrementUsageCount) {
      toolConfig.usageCount = currentUsageCount + 1;
    }

    // 时间校验：只有新时间晚于现有时间才更新 lastUsedTime
    if (
      !currentLastUsedTime ||
      new Date(callTime) > new Date(currentLastUsedTime)
    ) {
      // 使用 dayjs 格式化时间为更易读的格式
      toolConfig.lastUsedTime = dayjs(callTime).format("YYYY-MM-DD HH:mm:ss");
    }

    // 保存配置
    configStorage.saveConfig(config);
  }

  // ============ CustomMCP 工具管理 ============

  /**
   * 获取 customMCP 配置
   * @returns CustomMCP 配置对象或 null
   */
  public getCustomMCPConfig(): CustomMCPTool[] | null {
    const config = this.getMutableConfig();
    return config.customMCP?.tools || null;
  }

  /**
   * 获取 customMCP 工具列表
   * @returns CustomMCP 工具数组
   */
  public getCustomMCPTools(): CustomMCPTool[] {
    const tools = this.getCustomMCPConfig();
    if (!tools) {
      return [];
    }
    return tools;
  }

  /**
   * 检查是否配置了有效的 customMCP 工具
   * @returns 是否有有效的 customMCP 工具
   */
  public hasValidCustomMCPTools(): boolean {
    try {
      const tools = this.getCustomMCPTools();
      if (tools.length === 0) {
        return false;
      }

      return configValidator.validateCustomMCPTools(tools);
    } catch (error) {
      console.error("检查 customMCP 工具配置时出错", { error });
      return false;
    }
  }

  /**
   * 添加自定义 MCP 工具
   * @param tool CustomMCP 工具配置
   */
  public addCustomMCPTool(tool: CustomMCPTool): void {
    if (!tool || typeof tool !== "object") {
      throw new Error("工具配置不能为空");
    }

    const config = this.getMutableConfig();

    // 确保 customMCP 配置存在
    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }

    // 检查工具名称是否已存在
    const existingTool = config.customMCP.tools.find(
      (t) => t.name === tool.name
    );
    if (existingTool) {
      throw new Error(`工具 "${tool.name}" 已存在`);
    }

    // 验证工具配置
    if (!configValidator.validateCustomMCPTools([tool])) {
      throw new Error("工具配置验证失败");
    }

    // 添加工具
    config.customMCP.tools.unshift(tool);
    configStorage.saveConfig(config);

    console.log("成功添加自定义 MCP 工具", { toolName: tool.name });
  }

  /**
   * 批量添加自定义 MCP 工具
   * @param tools 要添加的工具数组
   */
  public async addCustomMCPTools(tools: CustomMCPTool[]): Promise<void> {
    if (!Array.isArray(tools)) {
      throw new Error("工具配置必须是数组");
    }

    if (tools.length === 0) {
      return; // 空数组，无需处理
    }

    const config = this.getMutableConfig();

    // 确保 customMCP 配置存在
    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }

    // 添加新工具，避免重复
    const existingNames = new Set(
      config.customMCP.tools.map((tool) => tool.name)
    );
    const newTools = tools.filter((tool) => !existingNames.has(tool.name));

    if (newTools.length > 0) {
      // 验证新工具配置
      if (!configValidator.validateCustomMCPTools(newTools)) {
        throw new Error("工具配置验证失败");
      }

      // 添加工具
      config.customMCP.tools.push(...newTools);
      configStorage.saveConfig(config);

      // 发射配置更新事件
      configEvents.emit("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      console.log("成功批量添加自定义 MCP 工具", {
        count: newTools.length,
        toolNames: newTools.map((t) => t.name),
      });
    }
  }

  /**
   * 删除自定义 MCP 工具
   * @param toolName 工具名称
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
      (t) => t.name === toolName
    );
    if (toolIndex === -1) {
      throw new Error(`工具 "${toolName}" 不存在`);
    }

    // 删除工具
    config.customMCP.tools.splice(toolIndex, 1);
    configStorage.saveConfig(config);

    console.log("成功删除自定义 MCP 工具", { toolName });
  }

  /**
   * 更新单个自定义 MCP 工具配置
   * @param toolName 工具名称
   * @param updatedTool 更新后的工具配置
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
      (t) => t.name === toolName
    );
    if (toolIndex === -1) {
      throw new Error(`工具 "${toolName}" 不存在`);
    }

    // 验证更新后的工具配置
    if (!configValidator.validateCustomMCPTools([updatedTool])) {
      throw new Error("更新后的工具配置验证失败");
    }

    // 更新工具配置
    config.customMCP.tools[toolIndex] = updatedTool;
    configStorage.saveConfig(config);

    console.log("成功更新自定义 MCP 工具", { toolName });
  }

  /**
   * 更新自定义 MCP 工具配置
   * @param tools CustomMCP 工具数组
   */
  public updateCustomMCPTools(tools: CustomMCPTool[]): void {
    if (!Array.isArray(tools)) {
      throw new Error("工具配置必须是数组");
    }

    // 验证工具配置
    if (!configValidator.validateCustomMCPTools(tools)) {
      throw new Error("工具配置验证失败");
    }

    const config = this.getMutableConfig();

    // 确保 customMCP 配置存在
    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }

    config.customMCP.tools = tools;
    configStorage.saveConfig(config);

    // 发射配置更新事件
    configEvents.emit("config:updated", {
      type: "customMCP",
      timestamp: new Date(),
    });

    console.log("成功更新自定义 MCP 工具配置", { count: tools.length });
  }

  /**
   * 更新 customMCP 中的工具使用统计信息（服务名+工具名版本）
   * @param serverName 服务名称
   * @param toolName 工具名称
   * @param callTime 调用时间（ISO 8601 格式）
   */
  public async updateCustomMCPToolStats(
    serverName: string,
    toolName: string,
    callTime: string
  ): Promise<void>;

  /**
   * 更新 customMCP 中的工具使用统计信息（工具名版本）
   * @param toolName 工具名称（customMCP 工具名称）
   * @param callTime 调用时间（ISO 8601 格式）
   * @param incrementUsageCount 是否增加使用计数，默认为 true
   */
  public async updateCustomMCPToolStats(
    toolName: string,
    callTime: string,
    incrementUsageCount?: boolean
  ): Promise<void>;

  /**
   * 更新 customMCP 工具使用统计信息的实现
   */
  public async updateCustomMCPToolStats(
    arg1: string,
    arg2: string,
    arg3?: string | boolean
  ): Promise<void> {
    try {
      let toolName: string;
      let callTime: string;
      let incrementUsageCount = true;
      let logPrefix: string;

      // 判断参数类型来区分不同的重载
      if (typeof arg3 === "string") {
        // 三个字符串参数的情况：updateCustomMCPToolStats(serverName, toolName, callTime)
        const serverName = arg1;
        toolName = `${serverName}__${arg2}`;
        callTime = arg3;
        logPrefix = `${serverName}/${arg2}`;
      } else {
        // 两个或三个参数的情况：updateCustomMCPToolStats(toolName, callTime, incrementUsageCount?)
        toolName = arg1;
        callTime = arg2;
        incrementUsageCount = (arg3 as boolean) || true;
        logPrefix = toolName;
      }

      const customTools = this.getCustomMCPTools();
      const toolIndex = customTools.findIndex((tool) => tool.name === toolName);

      if (toolIndex === -1) {
        // 如果 customMCP 中没有对应的工具，跳过更新
        return;
      }

      const updatedTools = [...customTools];
      const tool = updatedTools[toolIndex];

      // 确保 stats 对象存在
      if (!tool.stats) {
        tool.stats = {};
      }

      const currentUsageCount = tool.stats.usageCount || 0;
      const currentLastUsedTime = tool.stats.lastUsedTime;

      // 根据参数决定是否更新使用次数
      if (incrementUsageCount) {
        tool.stats.usageCount = currentUsageCount + 1;
      }

      // 时间校验：只有新时间晚于现有时间才更新 lastUsedTime
      if (
        !currentLastUsedTime ||
        new Date(callTime) > new Date(currentLastUsedTime)
      ) {
        tool.stats.lastUsedTime = dayjs(callTime).format("YYYY-MM-DD HH:mm:ss");
      }

      // 保存更新后的工具配置
      await this.updateCustomMCPTools(updatedTools);
    } catch (error) {
      // 根据参数类型决定错误日志的前缀
      if (typeof arg3 === "string") {
        const serverName = arg1;
        const toolName = arg2;
        console.error("更新 customMCP 工具统计信息失败", {
          serverName,
          toolName,
          error,
        });
      } else {
        const toolName = arg1;
        console.error("更新 customMCP 工具统计信息失败", { toolName, error });
      }
      // customMCP 统计更新失败不应该影响主要流程
    }
  }

  /**
   * 获取可修改的配置对象（内部使用）
   * @returns 配置对象
   */
  private getMutableConfig(): AppConfig {
    return configStorage.loadConfig();
  }
}

// 导出单例实例
export const configTools = new ConfigTools();
