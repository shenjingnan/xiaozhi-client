/**
 * ServerSearchInput 组件测试
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ServerSearchInput } from "../server-search-input";

describe("ServerSearchInput", () => {
  it("应该正确渲染搜索输入框", () => {
    const mockOnChange = vi.fn();
    render(
      <ServerSearchInput
        value=""
        onChange={mockOnChange}
        placeholder="搜索..."
      />
    );

    const input = screen.getByPlaceholderText("搜索...");
    expect(input).toBeInTheDocument();
  });

  it("应该显示默认占位符", () => {
    const mockOnChange = vi.fn();
    render(<ServerSearchInput value="" onChange={mockOnChange} />);

    // ToolSearchInput 的默认占位符是 "搜索服务名、工具名、描述..."
    const input = screen.getByPlaceholderText("搜索服务名、工具名、描述...");
    expect(input).toBeInTheDocument();
  });

  it("输入时应该调用 onChange", async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    render(
      <ServerSearchInput
        value=""
        onChange={mockOnChange}
        placeholder="搜索..."
      />
    );

    const input = screen.getByPlaceholderText("搜索...");
    await user.type(input, "t");

    // 验证 onChange 被调用
    expect(mockOnChange).toHaveBeenCalledWith("t");
  });

  it("有值时应该显示清除按钮", () => {
    const mockOnChange = vi.fn();
    render(<ServerSearchInput value="test" onChange={mockOnChange} />);

    const clearButton = screen.getByRole("button", { name: /清除搜索/i });
    expect(clearButton).toBeInTheDocument();
  });

  it("点击清除按钮应该清空输入", async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    render(<ServerSearchInput value="test" onChange={mockOnChange} />);

    const clearButton = screen.getByRole("button", { name: /清除搜索/i });
    await user.click(clearButton);

    expect(mockOnChange).toHaveBeenCalledWith("");
  });
});
