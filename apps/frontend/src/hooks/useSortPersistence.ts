"use client";

import { useEffect, useState } from "react";

/**
 * 排序持久化 Hook 的配置选项
 */
interface UseSortPersistenceOptions<T extends { field: string }> {
  /** localStorage 存储键 */
  storageKey: string;
  /** 默认排序配置 */
  defaultConfig: T;
  /** 有效的排序字段列表 */
  validFields: string[];
  /** 日志名称，用于调试信息 */
  loggerName: string;
}

/**
 * 通用的排序配置持久化 Hook
 * 自动将用户选择的排序方式保存到 localStorage
 *
 * @param options - 配置选项
 * @returns 排序配置和设置函数
 *
 * @example
 * ```typescript
 * export function useServerSortPersistence() {
 *   return useSortPersistence({
 *     storageKey: "mcp-server-sort-config",
 *     defaultConfig: { field: "name" as const },
 *     validFields: ["name", "communicationType", "toolCount"],
 *     loggerName: "useServerSortPersistence",
 *   });
 * }
 * ```
 */
export function useSortPersistence<T extends { field: string }>(
  options: UseSortPersistenceOptions<T>
) {
  const { storageKey, defaultConfig, validFields, loggerName } = options;

  const [sortConfig, setSortConfig] = useState<T>(() => {
    // 从 localStorage 读取保存的配置
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as T;
          // 验证 field 是否有效
          if (parsed && validFields.includes(parsed.field)) {
            return parsed;
          }
          // 无效数据，使用默认配置
          console.warn(`[${loggerName}] 无效的排序字段，使用默认配置`);
        }
      } catch (error) {
        console.warn(`[${loggerName}] 读取排序配置失败:`, error);
      }
    }
    return defaultConfig;
  });

  // 当配置变化时，保存到 localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(sortConfig));
      } catch (error) {
        console.warn(`[${loggerName}] 保存排序配置失败:`, error);
      }
    }
  }, [sortConfig, storageKey, loggerName]);

  return { sortConfig, setSortConfig };
}
