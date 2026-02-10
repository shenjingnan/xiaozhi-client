"use client";

import { useEffect, useState } from "react";
import type {
  ServerSortConfig,
  ServerSortField,
} from "@/components/mcp-server/server-sort-selector";

/** localStorage 存储键 */
const STORAGE_KEY = "mcp-server-sort-config";

/** 默认排序配置 */
const DEFAULT_CONFIG: ServerSortConfig = {
  field: "name",
};

/** 有效的排序字段列表 */
const VALID_SORT_FIELDS: ServerSortField[] = [
  "name",
  "communicationType",
  "toolCount",
];

/**
 * 服务器排序配置持久化 Hook
 * 自动将用户选择的排序方式保存到 localStorage
 */
export function useServerSortPersistence() {
  const [sortConfig, setSortConfig] = useState<ServerSortConfig>(() => {
    // 从 localStorage 读取保存的配置
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as ServerSortConfig;
          // 验证 field 是否有效
          if (parsed && VALID_SORT_FIELDS.includes(parsed.field)) {
            return parsed;
          }
          // 无效数据，使用默认配置
          console.warn(
            "[useServerSortPersistence] 无效的排序字段，使用默认配置"
          );
        }
      } catch (error) {
        console.warn("[useServerSortPersistence] 读取排序配置失败:", error);
      }
    }
    return DEFAULT_CONFIG;
  });

  // 当配置变化时，保存到 localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sortConfig));
      } catch (error) {
        console.warn("[useServerSortPersistence] 保存排序配置失败:", error);
      }
    }
  }, [sortConfig]);

  return { sortConfig, setSortConfig };
}
