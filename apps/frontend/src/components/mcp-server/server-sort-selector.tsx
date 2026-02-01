"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 排序字段类型 */
export type ServerSortField = "name" | "communicationType" | "toolCount";

/** 排序配置 */
export interface ServerSortConfig {
  field: ServerSortField;
}

interface ServerSortSelectorProps {
  value: ServerSortConfig;
  onChange: (config: ServerSortConfig) => void;
}

/** 排序选项配置 */
const SORT_OPTIONS = [
  { value: "name", label: "按名称排序" },
  { value: "communicationType", label: "按通信类型排序" },
  { value: "toolCount", label: "按工具数量排序" },
] as const;

/**
 * MCP 服务器排序选择器组件
 * 提供按名称、通信类型、工具数量排序功能
 */
export function ServerSortSelector({
  value,
  onChange,
}: ServerSortSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={value.field}
        onValueChange={(field) =>
          onChange({ field: field as ServerSortField })
        }
      >
        <SelectTrigger id="server-sort-field" className="w-40">
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
