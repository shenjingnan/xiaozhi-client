"use client";

/**
 * 工具排序配置持久化 Hook
 *
 * 自动将用户选择的工具排序方式保存到 localStorage，支持按名称、启用状态、使用次数、最后使用时间等字段排序
 */

import type { ToolSortConfig } from "@/components/mcp-tool/tool-sort-selector";
import type { ToolSortField } from "@/components/mcp-tool/tool-sort-selector";
import { useSortPersistence } from "@/hooks/useSortPersistence";

/** 有效的排序字段列表 */
const VALID_SORT_FIELDS: ToolSortField[] = [
  "name",
  "enabled",
  "usageCount",
  "lastUsedTime",
];

/**
 * 工具排序配置持久化 Hook
 * 自动将用户选择的排序方式保存到 localStorage
 */
export function useToolSortPersistence() {
  return useSortPersistence<ToolSortConfig>({
    storageKey: "mcp-tool-sort-config",
    defaultConfig: { field: "name" },
    validFields: VALID_SORT_FIELDS,
    loggerName: "useToolSortPersistence",
  });
}
