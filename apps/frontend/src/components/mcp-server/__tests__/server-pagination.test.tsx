/**
 * ServerPagination 组件测试
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServerPagination } from "../server-pagination";

describe("ServerPagination", () => {
  it("应该正确导出 ToolPagination 作为 ServerPagination", () => {
    // 测试组件是否存在
    expect(ServerPagination).toBeDefined();
  });

  it("总页数为 1 时不显示分页", () => {
    const mockSetPage = vi.fn();
    const { container } = render(
      <ServerPagination currentPage={1} totalPages={1} setPage={mockSetPage} />
    );

    // 分页容器不应该存在
    const paginationContainer = container.querySelector(".flex.items-end");
    expect(paginationContainer).not.toBeInTheDocument();
  });

  it("多页时应该显示分页控件", () => {
    const mockSetPage = vi.fn();
    const { container } = render(
      <ServerPagination currentPage={1} totalPages={3} setPage={mockSetPage} />
    );

    // 分页容器应该存在
    const paginationContainer = container.querySelector(".flex.items-end");
    expect(paginationContainer).toBeInTheDocument();
  });
});
