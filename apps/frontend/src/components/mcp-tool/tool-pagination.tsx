"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

export interface ToolPaginationProps {
  currentPage: number;
  totalPages: number;
  setPage: (page: number) => void;
}

/**
 * 生成页码数组，使用智能省略逻辑
 * @param currentPage 当前页码
 * @param totalPages 总页数
 * @returns 页码数组，-1 表示前省略号，-2 表示后省略号
 */
function getPageNumbers(
  currentPage: number,
  totalPages: number
): Array<number | -1 | -2> {
  const pageNumbers: Array<number | -1 | -2> = [];
  const maxVisible = 7;

  if (totalPages <= maxVisible) {
    // 总页数 ≤ 7：显示所有页码
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  } else if (currentPage <= 4) {
    // 前 4 页：显示 1,2,3,4,5,...,last
    for (let i = 1; i <= 5; i++) {
      pageNumbers.push(i);
    }
    pageNumbers.push(-2, totalPages);
  } else if (currentPage >= totalPages - 3) {
    // 后 4 页：显示 1,...,last-3,last-2,last-1,last
    pageNumbers.push(1, -1);
    for (let i = totalPages - 3; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    // 中间页：显示 1,...,cur-1,cur,cur+1,...,last
    pageNumbers.push(
      1,
      -1,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      -2,
      totalPages
    );
  }

  return pageNumbers;
}

/**
 * 工具表格分页组件
 * 提供智能省略的分页导航 UI
 */
export function ToolPagination({
  currentPage,
  totalPages,
  setPage,
}: ToolPaginationProps) {
  // 当数据量不超过一页时，不显示分页控件
  const shouldShowPagination = totalPages > 1;

  if (!shouldShowPagination) {
    return null;
  }

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="flex items-end justify-start py-4">
      <Pagination>
        <PaginationContent>
          {/* 上一页按钮 */}
          <PaginationItem>
            <PaginationPrevious
              onClick={() => setPage(currentPage - 1)}
              className={cn(
                "cursor-pointer",
                currentPage === 1 && "pointer-events-none opacity-50"
              )}
            />
          </PaginationItem>

          {/* 页码生成 */}
          {pageNumbers.map((pageNum) => {
            // 前省略号
            if (pageNum === -1) {
              return (
                <PaginationItem key="ellipsis-start">
                  <PaginationEllipsis />
                </PaginationItem>
              );
            }

            // 后省略号
            if (pageNum === -2) {
              return (
                <PaginationItem key="ellipsis-end">
                  <PaginationEllipsis />
                </PaginationItem>
              );
            }

            // 正常页码
            return (
              <PaginationItem key={`page-${pageNum}`}>
                <PaginationLink
                  onClick={() => setPage(pageNum)}
                  isActive={currentPage === pageNum}
                  className="cursor-pointer"
                >
                  {pageNum}
                </PaginationLink>
              </PaginationItem>
            );
          })}

          {/* 下一页按钮 */}
          <PaginationItem>
            <PaginationNext
              onClick={() => setPage(currentPage + 1)}
              className={cn(
                "cursor-pointer",
                currentPage === totalPages && "pointer-events-none opacity-50"
              )}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
