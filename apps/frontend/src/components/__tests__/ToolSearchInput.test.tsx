import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolSearchInput } from "../ToolSearchInput";

describe("ToolSearchInput", () => {
  const mockOnChange = vi.fn();
  const defaultProps = {
    value: "",
    onChange: mockOnChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该渲染输入框和搜索图标", () => {
    render(<ToolSearchInput {...defaultProps} />);

    const input = screen.getByPlaceholderText("搜索服务名、工具名、描述...");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "text");

    // 检查搜索图标
    const searchIcon = document.querySelector(".lucide-search");
    expect(searchIcon).toBeInTheDocument();
  });

  it("应该使用自定义占位符", () => {
    render(<ToolSearchInput {...defaultProps} placeholder="搜索工具..." />);

    const input = screen.getByPlaceholderText("搜索工具...");
    expect(input).toBeInTheDocument();
  });

  it("应该正确显示输入的值", () => {
    render(<ToolSearchInput {...defaultProps} value="test" />);

    const input = screen.getByDisplayValue("test");
    expect(input).toBeInTheDocument();
  });

  it("输入时应该调用 onChange", () => {
    render(<ToolSearchInput {...defaultProps} />);

    const input = screen.getByPlaceholderText("搜索服务名、工具名、描述...");
    fireEvent.change(input, { target: { value: "search term" } });

    expect(mockOnChange).toHaveBeenCalledWith("search term");
  });

  it("有值时应该显示清除按钮", () => {
    render(<ToolSearchInput {...defaultProps} value="test" />);

    // 清除按钮使用 X 图标
    const clearIcon = document.querySelector(".lucide-x");
    expect(clearIcon).toBeInTheDocument();
  });

  it("没有值时不应该显示清除按钮", () => {
    render(<ToolSearchInput {...defaultProps} value="" />);

    const clearIcon = document.querySelector(".lucide-x");
    expect(clearIcon).not.toBeInTheDocument();
  });

  it("点击清除按钮应该清空值", () => {
    render(<ToolSearchInput {...defaultProps} value="test" />);

    const clearButton = screen.getByRole("button", { name: "清除搜索" });
    fireEvent.click(clearButton);

    expect(mockOnChange).toHaveBeenCalledWith("");
  });

  it("应该应用自定义 className", () => {
    const { container } = render(
      <ToolSearchInput {...defaultProps} className="custom-class" />
    );

    const wrapper = container.querySelector(".custom-class");
    expect(wrapper).toBeInTheDocument();
  });

  it("应该有正确的宽度类", () => {
    render(<ToolSearchInput {...defaultProps} />);

    const input = screen.getByPlaceholderText("搜索服务名、工具名、描述...");
    expect(input).toHaveClass("w-64");
  });

  describe("可访问性", () => {
    it("清除按钮应该有正确的 aria-label", () => {
      render(<ToolSearchInput {...defaultProps} value="test" />);

      const clearButton = screen.getByRole("button", { name: "清除搜索" });
      expect(clearButton).toBeInTheDocument();
    });

    it("输入框应该有正确的 placeholder", () => {
      render(<ToolSearchInput {...defaultProps} />);

      const input = screen.getByPlaceholderText("搜索服务名、工具名、描述...");
      expect(input).toBeInTheDocument();
    });
  });

  describe("交互行为", () => {
    it("应该处理空值输入", () => {
      render(<ToolSearchInput {...defaultProps} value="test" />);

      const input = screen.getByDisplayValue("test");
      fireEvent.change(input, { target: { value: "" } });

      expect(mockOnChange).toHaveBeenCalledWith("");
    });

    it("应该处理特殊字符输入", () => {
      render(<ToolSearchInput {...defaultProps} />);

      const input = screen.getByPlaceholderText("搜索服务名、工具名、描述...");
      fireEvent.change(input, { target: { value: "@#$%" } });

      expect(mockOnChange).toHaveBeenCalledWith("@#$%");
    });

    it("连续快速输入应该正确更新值", () => {
      render(<ToolSearchInput {...defaultProps} />);

      const input = screen.getByPlaceholderText("搜索服务名、工具名、描述...");

      fireEvent.change(input, { target: { value: "a" } });
      fireEvent.change(input, { target: { value: "ab" } });
      fireEvent.change(input, { target: { value: "abc" } });

      expect(mockOnChange).toHaveBeenCalledTimes(3);
      expect(mockOnChange).toHaveBeenLastCalledWith("abc");
    });

    it("清除后应该保持焦点在输入框", () => {
      render(<ToolSearchInput {...defaultProps} value="test" />);

      const clearButton = screen.getByRole("button", { name: "清除搜索" });
      fireEvent.click(clearButton);

      const input = screen.getByPlaceholderText("搜索服务名、工具名、描述...");
      expect(input).toHaveFocus();
    });
  });
});
