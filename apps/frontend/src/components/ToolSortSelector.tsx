"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ToolSortField = "name" | "enabled";
export type SortOrder = "asc" | "desc";

export interface ToolSortConfig {
  field: ToolSortField;
  order: SortOrder;
}

interface ToolSortSelectorProps {
  value: ToolSortConfig;
  onChange: (config: ToolSortConfig) => void;
}

const SORT_OPTIONS = [
  { value: "name", label: "按名称排序（服务名 + 工具名）" },
  { value: "enabled", label: "按状态排序（已启用优先）" },
];

const ORDER_OPTIONS = [
  { value: "asc", label: "升序 (A→Z)" },
  { value: "desc", label: "降序 (Z→A)" },
];

export function ToolSortSelector({ value, onChange }: ToolSortSelectorProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Label htmlFor="sort-field">排序方式</Label>
        <Select
          value={value.field}
          onValueChange={(field) =>
            onChange({ ...value, field: field as ToolSortField })
          }
        >
          <SelectTrigger id="sort-field" className="w-64">
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

      <div className="flex items-center gap-2">
        <Label htmlFor="sort-order">顺序</Label>
        <Select
          value={value.order}
          onValueChange={(order) =>
            onChange({ ...value, order: order as SortOrder })
          }
        >
          <SelectTrigger id="sort-order" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
