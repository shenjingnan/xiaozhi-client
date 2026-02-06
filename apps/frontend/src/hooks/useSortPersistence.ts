"use client";

import { useEffect, useState } from "react";

/**
 * 排序持久化选项配置
 */
interface SortPersistenceOptions<T extends { field: F }, F extends string> {
  /** localStorage 存储键 */
  storageKey: string;
  /** 默认排序配置 */
  defaultConfig: T;
  /** 有效的排序字段列表 */
  validFields: F[];
  /** 日志前缀 */
  logPrefix: string;
}

/**
 * 通用的排序配置持久化 Hook
 * 自动将用户选择的排序方式保存到 localStorage
 *
 * @param options - 排序持久化配置选项
 * @returns 包含 sortConfig 和 setSortConfig 的对象
 */
export function useSortPersistence<T extends { field: F }, F extends string>(
  options: SortPersistenceOptions<T, F>
) {
  const { storageKey, defaultConfig, validFields, logPrefix } = options;

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
          console.warn(`[${logPrefix}] 无效的排序字段，使用默认配置`);
        }
      } catch (error) {
        console.warn(`[${logPrefix}] 读取排序配置失败:`, error);
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
        console.warn(`[${logPrefix}] 保存排序配置失败:`, error);
      }
    }
  }, [sortConfig, storageKey, logPrefix]);

  return { sortConfig, setSortConfig };
}
