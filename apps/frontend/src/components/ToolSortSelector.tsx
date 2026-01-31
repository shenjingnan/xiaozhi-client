"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ToolSortField = "name" | "enabled";

export interface ToolSortConfig {
  field: ToolSortField;
}

interface ToolSortSelectorProps {
  value: ToolSortConfig;
  onChange: (config: ToolSortConfig) => void;
}

const SORT_OPTIONS = [
  { value: "name", label: "按名称排序" },
  { value: "enabled", label: "按状态排序" },
];

export function ToolSortSelector({ value, onChange }: ToolSortSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={value.field}
        onValueChange={(field) => onChange({ field: field as ToolSortField })}
      >
        <SelectTrigger id="sort-field" className="w-32">
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
