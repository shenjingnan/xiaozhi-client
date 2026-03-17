"use client";

import {
  GenericSortSelector,
  type SortConfig,
  type SortOption,
} from "@/components/common/generic-sort-selector";

/** 服务器排序字段类型 */
export type ServerSortField = "name" | "communicationType" | "toolCount";

/** 服务器排序配置 */
export type ServerSortConfig = SortConfig<ServerSortField>;

/** 服务器排序选项配置 */
const SERVER_SORT_OPTIONS: readonly SortOption[] = [
  { value: "name", label: "按名称排序" },
  { value: "communicationType", label: "按通信类型排序" },
  { value: "toolCount", label: "按工具数量排序" },
] as const;

interface ServerSortSelectorProps {
  value: ServerSortConfig;
  onChange: (config: ServerSortConfig) => void;
}

/**
 * MCP 服务器排序选择器组件
 * 提供按名称、通信类型、工具数量排序功能
 */
export function ServerSortSelector({
  value,
  onChange,
}: ServerSortSelectorProps) {
  return (
    <GenericSortSelector
      value={value}
      onChange={onChange}
      options={SERVER_SORT_OPTIONS}
      ariaLabel="server-sort-field"
    />
  );
}
