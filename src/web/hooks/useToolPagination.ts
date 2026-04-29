/**
 * 通用分页 Hook
 *
 * 提供列表数据的分页功能，自动计算分页状态和当前页数据
 */

import { useCallback, useMemo, useState } from "react";

interface UseToolPaginationResult<T> {
  /** 当前页码 */
  currentPage: number;
  /** 每页显示数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 当前页的数据列表 */
  paginatedTools: T[];
  /** 设置页码 */
  setPage: (page: number) => void;
  /** 设置每页显示数量 */
  setPageSize: (size: number) => void;
  /** 重置到第一页 */
  resetPage: () => void;
}

/**
 * 通用分页状态管理 Hook
 * 提供客户端分页功能
 *
 * @param items - 数据列表
 * @param initialPageSize - 初始每页显示数量，默认为 10
 */
export function useToolPagination<T>(
  items: T[],
  initialPageSize = 10
): UseToolPaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // 确保数据是有效数组
  const safeItems = Array.isArray(items) ? items : [];

  // 计算总页数
  const totalPages = useMemo(
    () => Math.ceil(safeItems.length / pageSize) || 1,
    [safeItems.length, pageSize]
  );

  // 计算当前页的数据
  const paginatedTools = useMemo(() => {
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
    paginatedTools,
    setPage,
    setPageSize: handleSetPageSize,
    resetPage,
  };
}
