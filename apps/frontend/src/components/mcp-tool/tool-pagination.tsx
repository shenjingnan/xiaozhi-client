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

          {/* 页码生成 - 使用智能省略逻辑 */}
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number | -1 | -2;

            if (totalPages <= 7) {
              // 总页数 ≤ 7：显示所有页码
              pageNum = i + 1;
            } else if (currentPage <= 4) {
              // 前 4 页：显示 1,2,3,4,5,...,last
              pageNum = i < 5 ? i + 1 : i === 5 ? -2 : totalPages;
            } else if (currentPage >= totalPages - 3) {
              // 后 4 页：显示 1,...,last-4,last-3,last-2,last-1,last
              pageNum = i < 1 ? i + 1 : i === 1 ? -1 : totalPages - 5 + i;
            } else {
              // 中间页：显示 1,...,cur-1,cur,cur+1,...,last
              pageNum =
                i === 0
                  ? 1
                  : i === 1
                    ? -1
                    : i === 5
                      ? -2
                      : i === 6
                        ? totalPages
                        : currentPage - 2 + i;
            }

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
