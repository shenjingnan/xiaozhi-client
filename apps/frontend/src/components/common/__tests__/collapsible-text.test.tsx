/**
 * CollapsibleText 组件测试
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollapsibleText } from "../collapsible-text";

describe("CollapsibleText", () => {
  beforeEach(() => {
    // 清除所有 localStorage mock
    vi.clearAllMocks();
    // 重置 localStorage
    localStorage.clear();
  });

  it("当文本长度小于 maxLength 时，应该完整显示文本且不显示展开按钮", () => {
    const shortText = "这是一段短文本";
    render(<CollapsibleText text={shortText} maxLength={100} />);

    // 应该显示完整文本
    expect(screen.getByText(shortText)).toBeInTheDocument();

    // 不应该显示展开按钮
    expect(screen.queryByText("展开")).not.toBeInTheDocument();
    expect(screen.queryByText("收起")).not.toBeInTheDocument();
  });

  it("当文本长度大于 maxLength 时，默认应该显示折叠状态", () => {
    const longText = "a".repeat(150);
    render(<CollapsibleText text={longText} maxLength={100} />);

    // 应该显示省略号
    const displayedText = screen.getByText((content) => {
      return content.includes("...");
    });
    expect(displayedText).toBeInTheDocument();

    // 应该显示展开按钮
    expect(screen.getByText("展开")).toBeInTheDocument();

    // 不应该显示完整文本
    expect(screen.queryByText(longText)).not.toBeInTheDocument();
  });

  it("点击展开按钮后，应该显示完整文本且按钮变为收起", async () => {
    const user = userEvent.setup();
    const longText = "a".repeat(150);
    render(<CollapsibleText text={longText} maxLength={100} />);

    // 初始状态：显示展开按钮
    const expandButton = screen.getByText("展开");
    expect(expandButton).toBeInTheDocument();

    // 点击展开按钮
    await user.click(expandButton);

    // 应该显示完整文本
    expect(screen.getByText(longText)).toBeInTheDocument();

    // 按钮应该变为收起
    expect(screen.queryByText("展开")).not.toBeInTheDocument();
    expect(screen.getByText("收起")).toBeInTheDocument();
  });

  it("点击收起按钮后，应该恢复折叠状态", async () => {
    const user = userEvent.setup();
    const longText = "a".repeat(150);
    render(
      <CollapsibleText text={longText} maxLength={100} storageKey="test-key" />
    );

    // 先展开
    const expandButton = screen.getByText("展开");
    await user.click(expandButton);

    // 确认已展开
    expect(screen.getByText(longText)).toBeInTheDocument();

    // 点击收起按钮
    const collapseButton = screen.getByText("收起");
    await user.click(collapseButton);

    // 应该显示省略号
    const displayedText = screen.getByText((content) => {
      return content.includes("...");
    });
    expect(displayedText).toBeInTheDocument();

    // 按钮应该变回展开
    expect(screen.getByText("展开")).toBeInTheDocument();
  });

  it("应该使用 localStorage 持久化展开/收起状态", async () => {
    const user = userEvent.setup();
    const storageKey = "collapsible-test-key";
    const longText = "a".repeat(150);

    const { rerender } = render(
      <CollapsibleText
        text={longText}
        maxLength={100}
        storageKey={storageKey}
      />
    );

    // 初始状态：折叠
    expect(screen.getByText("展开")).toBeInTheDocument();

    // 展开文本
    await user.click(screen.getByText("展开"));

    // 确认 localStorage 中保存了展开状态
    expect(localStorage.getItem(storageKey)).toBe("true");

    // 重新渲染组件
    rerender(
      <CollapsibleText
        text={longText}
        maxLength={100}
        storageKey={storageKey}
      />
    );

    // 应该从 localStorage 恢复展开状态
    expect(screen.getByText("收起")).toBeInTheDocument();
    expect(screen.getByText(longText)).toBeInTheDocument();
  });

  it("当没有 storageKey 时，不应该写入 localStorage", async () => {
    const user = userEvent.setup();
    const longText = "a".repeat(150);

    render(<CollapsibleText text={longText} maxLength={100} />);

    // 展开文本
    await user.click(screen.getByText("展开"));

    // 验证 localStorage 没有被写入
    expect(localStorage.length).toBe(0);
  });

  it("当文本为空时，应该显示 '-'", () => {
    render(<CollapsibleText text="" maxLength={100} />);

    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("应该支持自定义 className", () => {
    const customClass = "custom-class";
    const { container } = render(
      <CollapsibleText
        text="测试文本"
        maxLength={100}
        className={customClass}
      />
    );

    expect(container.querySelector(`.${customClass}`)).toBeInTheDocument();
  });

  it("应该支持自定义 maxLength", () => {
    const mediumText = "a".repeat(80);

    // maxLength=50 应该折叠
    const { rerender } = render(
      <CollapsibleText text={mediumText} maxLength={50} />
    );
    expect(screen.getByText("展开")).toBeInTheDocument();

    // maxLength=100 应该不折叠
    rerender(<CollapsibleText text={mediumText} maxLength={100} />);
    expect(screen.queryByText("展开")).not.toBeInTheDocument();
  });

  it("应该正确处理包含换行的文本", async () => {
    const user = userEvent.setup();
    const multilineText = `第一行\n第二行\n第三行${"a".repeat(100)}`;

    render(<CollapsibleText text={multilineText} maxLength={50} />);

    // 应该显示折叠状态
    expect(screen.getByText("展开")).toBeInTheDocument();

    // 展开后应该显示完整文本
    await user.click(screen.getByText("展开"));
    expect(
      screen.getByText((content) => content.includes("第一行"))
    ).toBeInTheDocument();
  });

  it("应该从 localStorage 恢复正确的初始状态", () => {
    const storageKey = "initial-state-test";
    const longText = "a".repeat(150);

    // 先设置 localStorage 为已展开状态
    localStorage.setItem(storageKey, "true");

    render(
      <CollapsibleText
        text={longText}
        maxLength={100}
        storageKey={storageKey}
      />
    );

    // 应该直接显示展开状态
    expect(screen.getByText("收起")).toBeInTheDocument();
    expect(screen.queryByText("展开")).not.toBeInTheDocument();
  });

  it("应该使用默认文字大小 text-sm", () => {
    const { container } = render(
      <CollapsibleText text="测试文本" maxLength={100} />
    );

    const textElement = container.querySelector("p");
    expect(textElement).toHaveClass("text-sm");
  });

  it("应该支持自定义文字大小", () => {
    const { container: containerXs } = render(
      <CollapsibleText text="测试文本" maxLength={100} textSize="text-xs" />
    );
    const { container: containerBase } = render(
      <CollapsibleText text="测试文本" maxLength={100} textSize="text-base" />
    );

    expect(containerXs.querySelector("p")).toHaveClass("text-xs");
    expect(containerBase.querySelector("p")).toHaveClass("text-base");
  });
});
