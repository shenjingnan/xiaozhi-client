"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 排序选项配置 */
export interface SortOption {
  /** 选项值 */
  value: string;
  /** 选项显示标签 */
  label: string;
}

/** 排序配置 */
export interface SortConfig<T extends string> {
  field: T;
}

/** 通用排序选择器属性 */
export interface GenericSortSelectorProps<T extends string> {
  /** 当前排序配置 */
  value: SortConfig<T>;
  /** 排序配置变更回调 */
  onChange: (config: SortConfig<T>) => void;
  /** 排序选项列表 */
  options: readonly SortOption[];
  /** 排序选择器的 aria-label */
  ariaLabel?: string;
}

/**
 * 通用排序选择器组件
 * 支持通过配置参数实现不同的排序场景，避免重复代码
 */
export function GenericSortSelector<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = "sort-field",
}: GenericSortSelectorProps<T>) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={value.field}
        onValueChange={(field) => onChange({ field: field as T })}
      >
        <SelectTrigger id={ariaLabel} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
