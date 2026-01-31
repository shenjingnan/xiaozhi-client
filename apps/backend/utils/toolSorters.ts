/**
 * MCP 工具排序工具模块
 * 提供可扩展的排序策略，支持多种排序方式
 */

import type { EnhancedToolInfo } from "@/lib/mcp";

export type ToolSortField = "name" | "enabled" | "usageCount" | "lastUsedTime";

export interface ToolSortConfig {
  field: ToolSortField;
}

/**
 * 排序函数类型
 */
type SortFn = (a: EnhancedToolInfo, b: EnhancedToolInfo) => number;

/**
 * 工具排序策略
 * 新增排序方式只需在此处添加对应的排序函数
 */
export const toolSorters: Record<ToolSortField, SortFn> = {
  /**
   * 按名称排序（默认排序）
   * 规则：服务名 a-z → 工具名 a-z
   */
  name: (a, b) => {
    // 先按服务名排序
    if (a.serviceName !== b.serviceName) {
      return a.serviceName.localeCompare(b.serviceName, "zh-CN");
    }
    // 服务名相同时，按工具名排序
    return a.originalName.localeCompare(b.originalName, "zh-CN");
  },

  /**
   * 按启用状态排序
   * 规则：已启用在前，已禁用在后；同状态内按名称排序
   */
  enabled: (a, b) => {
    // 先按启用状态排序（已启用在前）
    const enabledCompare = Number(b.enabled) - Number(a.enabled);
    if (enabledCompare !== 0) {
      return enabledCompare;
    }
    // 同状态内按名称排序
    if (a.serviceName !== b.serviceName) {
      return a.serviceName.localeCompare(b.serviceName, "zh-CN");
    }
    return a.originalName.localeCompare(b.originalName, "zh-CN");
  },

  /**
   * 按使用次数排序
   * 规则：使用次数多的在前；同次数时按名称排序
   */
  usageCount: (a, b) => {
    // 按使用次数降序排序（次数多的在前）
    const countCompare = b.usageCount - a.usageCount;
    if (countCompare !== 0) return countCompare;
    // 使用次数相同时，按服务名和工具名排序
    if (a.serviceName !== b.serviceName) {
      return a.serviceName.localeCompare(b.serviceName, "zh-CN");
    }
    return a.originalName.localeCompare(b.originalName, "zh-CN");
  },

  /**
   * 按最近使用时间排序
   * 规则：最近使用的在前；未使用时间的工具排在后面
   */
  lastUsedTime: (a, b) => {
    // 未使用时间的工具排在后面
    if (!a.lastUsedTime) return 1;
    if (!b.lastUsedTime) return -1;
    // 按时间降序排序（最近的在前）
    const timeCompare =
      new Date(b.lastUsedTime).getTime() - new Date(a.lastUsedTime).getTime();
    if (timeCompare !== 0) return timeCompare;
    // 时间相同时，按服务名和工具名排序
    if (a.serviceName !== b.serviceName) {
      return a.serviceName.localeCompare(b.serviceName, "zh-CN");
    }
    return a.originalName.localeCompare(b.originalName, "zh-CN");
  },
};

/**
 * 应用排序到工具列表
 */
export function sortTools(
  tools: EnhancedToolInfo[],
  config: ToolSortConfig
): EnhancedToolInfo[] {
  const sorter = toolSorters[config.field];
  if (!sorter) {
    console.warn(`[sortTools] 未知的排序字段: ${config.field}`);
    return tools;
  }

  return [...tools].sort(sorter);
}
