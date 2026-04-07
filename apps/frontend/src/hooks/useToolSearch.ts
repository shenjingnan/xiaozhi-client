/**
 * 工具搜索 Hook
 *
 * 提供工具列表搜索和筛选功能，支持根据服务名、工具名、描述进行筛选
 */

import { useCallback, useMemo, useState } from "react";
import type { ToolRowData } from "@/components/mcp-tool/mcp-tool-table";

interface UseToolSearchResult {
  /** 搜索关键词 */
  searchValue: string;
  /** 设置搜索关键词 */
  setSearchValue: (value: string) => void;
  /** 筛选后的工具列表 */
  filteredTools: ToolRowData[];
  /** 清除搜索 */
  clearSearch: () => void;
}

/**
 * 工具搜索状态管理 Hook
 * 提供搜索功能，支持根据服务名、工具名、描述进行筛选
 */
export function useToolSearch(tools: ToolRowData[]): UseToolSearchResult {
  const [searchValue, setSearchValue] = useState("");

  // 确保 tools 是有效数组
  const safeTools = Array.isArray(tools) ? tools : [];

  // 筛选匹配的工具
  const filteredTools = useMemo(() => {
    if (!searchValue.trim()) return safeTools;
    const keyword = searchValue.toLowerCase();
    return safeTools.filter(
      (tool) =>
        (tool?.serverName?.toLowerCase() || "").includes(keyword) ||
        (tool?.toolName?.toLowerCase() || "").includes(keyword) ||
        (tool?.description?.toLowerCase() || "").includes(keyword)
    );
  }, [safeTools, searchValue]);

  const clearSearch = useCallback(() => {
    setSearchValue("");
  }, []);

  return {
    searchValue,
    setSearchValue,
    filteredTools,
    clearSearch,
  };
}
