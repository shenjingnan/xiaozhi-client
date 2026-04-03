/**
 * MCP 工具排序选择器组件
 *
 * 提供工具列表的排序选项，包括：
 * - 按名称排序
 * - 按状态排序（启用/禁用）
 * - 按使用次数排序
 * - 按最近使用时间排序
 *
 * @module apps/frontend/src/components/mcp-tool/tool-sort-selector
 */

"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * 工具排序字段类型
 */
export type ToolSortField = "name" | "enabled" | "usageCount" | "lastUsedTime";

/**
 * 工具排序配置接口
 */
export interface ToolSortConfig {
  /** 排序字段 */
  field: ToolSortField;
}

interface ToolSortSelectorProps {
  value: ToolSortConfig;
  onChange: (config: ToolSortConfig) => void;
}

const SORT_OPTIONS = [
  { value: "name", label: "按名称排序" },
  { value: "enabled", label: "按状态排序" },
  { value: "usageCount", label: "按使用次数排序" },
  { value: "lastUsedTime", label: "按最近使用排序" },
];

export function ToolSortSelector({ value, onChange }: ToolSortSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={value.field}
        onValueChange={(field) => onChange({ field: field as ToolSortField })}
      >
        <SelectTrigger id="sort-field" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
