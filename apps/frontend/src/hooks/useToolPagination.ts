import type { ToolRowData } from "@/components/mcp-tool/mcp-tool-table";
import { useCallback, useMemo, useState } from "react";

/** 分页结果接口 */
interface UsePaginationResult<T> {
  /** 当前页码 */
  currentPage: number;
  /** 每页显示数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 当前页的数据列表 */
  paginatedItems: T[];
  /** 设置页码 */
  setPage: (page: number) => void;
  /** 设置每页显示数量 */
  setPageSize: (size: number) => void;
  /** 重置到第一页 */
  resetPage: () => void;
}

/**
 * 分页状态管理 Hook
 * 提供客户端分页功能
 *
 * @param items - 数据列表
 * @param initialPageSize - 初始每页显示数量，默认为 10
 */
export function usePagination<T>(
  items: T[],
  initialPageSize = 10
): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // 确保 items 是有效数组
  const safeItems = Array.isArray(items) ? items : [];

  // 计算总页数
  const totalPages = useMemo(
    () => Math.ceil(safeItems.length / pageSize) || 1,
    [safeItems.length, pageSize]
  );

  // 计算当前页的数据
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return safeItems.slice(startIndex, endIndex);
  }, [safeItems, currentPage, pageSize]);

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
    paginatedItems,
    setPage,
    setPageSize: handleSetPageSize,
    resetPage,
  };
}

/** 工具分页结果接口（向后兼容） */
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
 * @deprecated 使用 {@link usePagination} 代替
 * @param tools - 工具列表数据
 * @param initialPageSize - 初始每页显示数量，默认为 10
 */
export function useToolPagination(
  tools: ToolRowData[],
  initialPageSize = 10
): UseToolPaginationResult {
  const result = usePagination(tools, initialPageSize);
  return {
    ...result,
    paginatedTools: result.paginatedItems,
  };
}
