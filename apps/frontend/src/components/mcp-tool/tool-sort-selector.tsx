"use client";

import {
  GenericSortSelector,
  type SortConfig,
  type SortOption,
} from "@/components/common/generic-sort-selector";

/** 工具排序字段类型 */
export type ToolSortField = "name" | "enabled" | "usageCount" | "lastUsedTime";

/** 工具排序配置 */
export type ToolSortConfig = SortConfig<ToolSortField>;

/** 工具排序选项配置 */
const TOOL_SORT_OPTIONS: readonly SortOption[] = [
  { value: "name", label: "按名称排序" },
  { value: "enabled", label: "按状态排序" },
  { value: "usageCount", label: "按使用次数排序" },
  { value: "lastUsedTime", label: "按最近使用排序" },
] as const;

interface ToolSortSelectorProps {
  value: ToolSortConfig;
  onChange: (config: ToolSortConfig) => void;
}

/**
 * MCP 工具排序选择器组件
 * 提供按名称、状态、使用次数、最近使用排序功能
 */
export function ToolSortSelector({
  value,
  onChange,
}: ToolSortSelectorProps) {
  return (
    <GenericSortSelector
      value={value}
      onChange={onChange}
      options={TOOL_SORT_OPTIONS}
      ariaLabel="sort-field"
    />
  );
}
