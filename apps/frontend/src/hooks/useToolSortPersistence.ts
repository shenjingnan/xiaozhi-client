"use client";

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
    defaultConfig: { field: "name" } as ToolSortConfig,
    validFields: VALID_SORT_FIELDS,
    loggerName: "useToolSortPersistence",
  });
}
