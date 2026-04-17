/**
 * ToolSortSelector 组件测试
 */

import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolSortSelector } from "../tool-sort-selector";

describe("ToolSortSelector", () => {
  const mockOnChange = vi.fn();
  const defaultProps = {
    value: { field: "name" as const },
    onChange: mockOnChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确渲染排序选择器", () => {
    render(<ToolSortSelector {...defaultProps} />);

    // 应该显示选择器
    const selectTrigger = document.querySelector('[role="combobox"]');
    expect(selectTrigger).toBeInTheDocument();
  });

  it("应该显示所有排序选项", () => {
    render(<ToolSortSelector {...defaultProps} />);

    // 打开下拉菜单
    const selectTrigger = document.querySelector('[role="combobox"]');
    fireEvent.click(selectTrigger!);

    // 验证所有选项都存在 - 查找带有 role="option" 的元素
    const options = document.querySelectorAll('[role="option"]');
    expect(options.length).toBe(4);
  });

  it("选择变更时应该正确调用 onChange", () => {
    render(<ToolSortSelector {...defaultProps} />);

    // 打开下拉菜单
    const selectTrigger = document.querySelector('[role="combobox"]');
    fireEvent.click(selectTrigger!);

    // 点击第二个选项（"按状态排序"）
    const options = document.querySelectorAll('[role="option"]');
    fireEvent.click(options[1]!);

    // 验证 onChange 被正确调用
    expect(mockOnChange).toHaveBeenCalledWith({ field: "enabled" });
  });

  it("应该正确显示默认值", () => {
    render(<ToolSortSelector {...defaultProps} />);

    // 验证默认值显示正确
    const selectTrigger = document.querySelector('[role="combobox"]');
    expect(selectTrigger).toHaveTextContent("按名称排序");
  });

  it("应该正确设置其他默认值", () => {
    render(
      <ToolSortSelector
        value={{ field: "usageCount" }}
        onChange={mockOnChange}
      />
    );

    // 验证默认值显示正确
    const selectTrigger = document.querySelector('[role="combobox"]');
    expect(selectTrigger).toHaveTextContent("按使用次数排序");
  });
});
