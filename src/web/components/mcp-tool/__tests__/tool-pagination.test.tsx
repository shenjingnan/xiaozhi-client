/**
 * ToolPagination 组件测试
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolPagination } from "../tool-pagination";

describe("ToolPagination", () => {
  const mockSetPage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("单页时不应该显示分页控件", () => {
    render(
      <ToolPagination currentPage={1} totalPages={1} setPage={mockSetPage} />
    );

    // 分页容器应该不存在
    const paginationContainer = document.querySelector(".flex.items-end");
    expect(paginationContainer).not.toBeInTheDocument();
  });

  it("多页时应该正确显示分页控件", () => {
    render(
      <ToolPagination currentPage={1} totalPages={5} setPage={mockSetPage} />
    );

    // 分页容器应该存在
    const paginationContainer = document.querySelector(".flex.items-end");
    expect(paginationContainer).toBeInTheDocument();
  });

  it("点击页码应该正确调用 setPage", () => {
    render(
      <ToolPagination currentPage={1} totalPages={5} setPage={mockSetPage} />
    );

    // 点击第 2 页
    const page2Button = screen.getByText("2");
    fireEvent.click(page2Button);

    expect(mockSetPage).toHaveBeenCalledWith(2);
  });

  it("第一页时上一页按钮应该禁用", () => {
    render(
      <ToolPagination currentPage={1} totalPages={5} setPage={mockSetPage} />
    );

    // 查找上一页按钮（通过类名判断是否禁用）
    const prevButton = document.querySelector(
      'a[aria-label="Go to previous page"]'
    );
    expect(prevButton).toHaveClass("pointer-events-none", "opacity-50");
  });

  it("不是第一页时上一页按钮应该可用", () => {
    render(
      <ToolPagination currentPage={2} totalPages={5} setPage={mockSetPage} />
    );

    // 查找上一页按钮
    const prevButton = document.querySelector(
      'a[aria-label="Go to previous page"]'
    );
    expect(prevButton).not.toHaveClass("pointer-events-none");
  });

  it("最后一页时下一页按钮应该禁用", () => {
    render(
      <ToolPagination currentPage={5} totalPages={5} setPage={mockSetPage} />
    );

    // 查找下一页按钮
    const nextButton = document.querySelector(
      'a[aria-label="Go to next page"]'
    );
    expect(nextButton).toHaveClass("pointer-events-none", "opacity-50");
  });

  it("不是最后一页时下一页按钮应该可用", () => {
    render(
      <ToolPagination currentPage={1} totalPages={5} setPage={mockSetPage} />
    );

    // 查找下一页按钮
    const nextButton = document.querySelector(
      'a[aria-label="Go to next page"]'
    );
    expect(nextButton).not.toHaveClass("pointer-events-none");
  });

  describe("智能省略逻辑", () => {
    it("7页以内应该显示所有页码", () => {
      render(
        <ToolPagination currentPage={3} totalPages={7} setPage={mockSetPage} />
      );

      // 应该显示所有页码 1-7 - 使用 getAllByText 并检查至少有一个
      for (let i = 1; i <= 7; i++) {
        expect(screen.getAllByText(String(i)).length).toBeGreaterThan(0);
      }
    });

    it("中间页应该只显示部分页码（存在省略）", () => {
      render(
        <ToolPagination currentPage={5} totalPages={10} setPage={mockSetPage} />
      );

      // 应该显示第一页和最后一页
      expect(screen.getAllByText("1").length).toBeGreaterThan(0);
      expect(screen.getAllByText("10").length).toBeGreaterThan(0);

      // 2 和 9 不应该显示（因为被省略了）
      expect(screen.queryByText("2")).not.toBeInTheDocument();
      expect(screen.queryByText("9")).not.toBeInTheDocument();
    });

    it("前 4 页应该显示正确的页码序列", () => {
      render(
        <ToolPagination currentPage={3} totalPages={10} setPage={mockSetPage} />
      );

      // 应该显示 1,2,3,4,5,...,10
      expect(screen.getAllByText("1").length).toBeGreaterThan(0);
      expect(screen.getAllByText("2").length).toBeGreaterThan(0);
      expect(screen.getAllByText("3").length).toBeGreaterThan(0);
      expect(screen.getAllByText("4").length).toBeGreaterThan(0);
      expect(screen.getAllByText("5").length).toBeGreaterThan(0);
      expect(screen.getAllByText("10").length).toBeGreaterThan(0);

      // 6-9 不应该显示（因为被省略了）
      expect(screen.queryByText("6")).not.toBeInTheDocument();
      expect(screen.queryByText("7")).not.toBeInTheDocument();
      expect(screen.queryByText("8")).not.toBeInTheDocument();
      expect(screen.queryByText("9")).not.toBeInTheDocument();
    });

    it("后 4 页应该显示正确的页码序列", () => {
      render(
        <ToolPagination currentPage={8} totalPages={10} setPage={mockSetPage} />
      );

      // 应该显示 1,...,7,8,9,...,10
      expect(screen.getAllByText("1").length).toBeGreaterThan(0);
      expect(screen.getAllByText("7").length).toBeGreaterThan(0);
      expect(screen.getAllByText("8").length).toBeGreaterThan(0);
      expect(screen.getAllByText("9").length).toBeGreaterThan(0);
      expect(screen.getAllByText("10").length).toBeGreaterThan(0);

      // 2-6 不应该显示（因为被省略了）
      expect(screen.queryByText("2")).not.toBeInTheDocument();
      expect(screen.queryByText("3")).not.toBeInTheDocument();
      expect(screen.queryByText("4")).not.toBeInTheDocument();
      expect(screen.queryByText("5")).not.toBeInTheDocument();
      expect(screen.queryByText("6")).not.toBeInTheDocument();
    });
  });

  describe("交互行为", () => {
    it("点击上一页按钮应该正确调用 setPage", () => {
      render(
        <ToolPagination currentPage={3} totalPages={5} setPage={mockSetPage} />
      );

      const prevButton = document.querySelector(
        'a[aria-label="Go to previous page"]'
      );
      fireEvent.click(prevButton!);

      expect(mockSetPage).toHaveBeenCalledWith(2);
    });

    it("点击下一页按钮应该正确调用 setPage", () => {
      render(
        <ToolPagination currentPage={2} totalPages={5} setPage={mockSetPage} />
      );

      const nextButton = document.querySelector(
        'a[aria-label="Go to next page"]'
      );
      fireEvent.click(nextButton!);

      expect(mockSetPage).toHaveBeenCalledWith(3);
    });

    it("当前页应该被标记为激活状态", () => {
      render(
        <ToolPagination currentPage={3} totalPages={5} setPage={mockSetPage} />
      );

      // 当前页应该有 aria-current="page" 属性
      const currentPageButton = screen.getByText("3");
      expect(currentPageButton).toHaveAttribute("aria-current", "page");
    });
  });
});
