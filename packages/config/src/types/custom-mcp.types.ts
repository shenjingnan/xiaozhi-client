/**
 * CustomMCP 相关类型定义
 *
 * 包含自定义 MCP 工具的配置类型
 *
 * TODO: 注意：CustomMCPTool 定义应与 @xiaozhi-client/shared-types 中的 CustomMCPToolConfig 保持一致
 * 未来将迁移到从 shared-types 导入
 */

import type { HandlerConfig } from "./handler.types.js";

/**
 * CustomMCP 工具接口
 */
export interface CustomMCPTool {
  // 确保必填字段
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: HandlerConfig;

  // 使用统计信息（可选）
  stats?: {
    usageCount?: number; // 工具使用次数
    lastUsedTime?: string; // 最后使用时间（ISO 8601格式）
  };
}

/**
 * CustomMCP 配置接口
 */
export interface CustomMCPConfig {
  tools: CustomMCPTool[];
}
