import { useCallback, useMemo, useState } from "react";
import type { ToolRowData } from "@/components/mcp-tool/mcp-tool-table";

interface UseToolPaginationResult {
  /** 当前页码 */
  currentPage: number;
  /** 每页显示数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 当前页的工具列表 */
  paginatedTools: ToolRowData[];
  /** 设置页码 */
  setPage: (page: number) => void;
  /** 设置每页显示数量 */
  setPageSize: (size: number) => void;
  /** 重置到第一页 */
  resetPage: () => void;
}

/**
 * 工具分页状态管理 Hook
 * 提供客户端分页功能
 *
 * @param tools - 工具列表数据
 * @param initialPageSize - 初始每页显示数量，默认为 10
 */
export function useToolPagination(
  tools: ToolRowData[],
  initialPageSize = 10
): UseToolPaginationResult {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // 确保 tools 是有效数组
  const safeTools = Array.isArray(tools) ? tools : [];

  // 计算总页数
  const totalPages = useMemo(
    () => Math.ceil(safeTools.length / pageSize) || 1,
    [safeTools.length, pageSize]
  );

  // 计算当前页的数据
  const paginatedTools = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return safeTools.slice(startIndex, endIndex);
  }, [safeTools, currentPage, pageSize]);

  // 设置页码，带边界检查
  const setPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages]
  );

  // 设置每页显示数量，并重置到第一页
  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  // 重置到第一页
  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    pageSize,
    totalPages,
    paginatedTools,
    setPage,
    setPageSize: handleSetPageSize,
    resetPage,
  };
}
