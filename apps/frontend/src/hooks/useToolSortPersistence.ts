"use client";

import type { ToolSortConfig } from "@/components/mcp-tool/tool-sort-selector";
import { useEffect, useState } from "react";

const STORAGE_KEY = "mcp-tool-sort-config";

const DEFAULT_CONFIG: ToolSortConfig = {
  field: "name",
};

/**
 * 排序配置持久化 Hook
 * 自动将用户选择的排序方式保存到 localStorage
 */
export function useToolSortPersistence() {
  const [sortConfig, setSortConfig] = useState<ToolSortConfig>(() => {
    // 从 localStorage 读取保存的配置
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          return JSON.parse(saved) as ToolSortConfig;
        }
      } catch (error) {
        console.warn("[useToolSortPersistence] 读取排序配置失败:", error);
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
        console.warn("[useToolSortPersistence] 保存排序配置失败:", error);
      }
    }
  }, [sortConfig]);

  return { sortConfig, setSortConfig };
}
