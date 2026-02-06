"use client";

import type { ToolSortConfig } from "@/components/mcp-tool/tool-sort-selector";
import type { ToolSortField } from "@/components/mcp-tool/tool-sort-selector";
import { useSortPersistence } from "./useSortPersistence";

/**
 * 排序配置持久化 Hook
 * 自动将用户选择的排序方式保存到 localStorage
 */
export function useToolSortPersistence() {
  return useSortPersistence<ToolSortConfig, ToolSortField>({
    storageKey: "mcp-tool-sort-config",
    defaultConfig: { field: "name" },
    validFields: ["name", "enabled", "usageCount", "lastUsedTime"],
    logPrefix: "useToolSortPersistence",
  });
}
