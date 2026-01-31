/**
 * MCP 工具排序工具模块
 * 提供可扩展的排序策略，支持多种排序方式
 */

import type { EnhancedToolInfo } from "@/lib/mcp";

export type ToolSortField = "name" | "enabled";
export type SortOrder = "asc" | "desc";

export interface ToolSortConfig {
  field: ToolSortField;
  order: SortOrder;
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

  // 未来扩展：按使用次数排序
  // usageCount: (a, b) => b.usageCount - a.usageCount,

  // 未来扩展：按最近使用时间排序
  // lastUsedTime: (a, b) =>
  //   new Date(b.lastUsedTime).getTime() - new Date(a.lastUsedTime).getTime(),
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

  const sorted = [...tools].sort(sorter);

  // 如果是降序，反转结果
  if (config.order === "desc") {
    sorted.reverse();
  }

  return sorted;
}
