/**
 * MiniCircularProgress 组件测试
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MiniCircularProgress } from "../mini-circular-progress";

describe("MiniCircularProgress", () => {
  it("应该渲染默认属性的进度条", () => {
    render(<MiniCircularProgress />);
    expect(screen.getByText("0%")).toBeDefined();
  });

  it("应该显示指定的数值", () => {
    render(<MiniCircularProgress value={75} maxValue={100} />);
    expect(screen.getByText("75%")).toBeDefined();
  });

  it("应该支持自定义符号", () => {
    render(<MiniCircularProgress value={5} maxValue={10} symbol="/" />);
    expect(screen.getByText("5/")).toBeDefined();
  });

  it("应该支持隐藏数值", () => {
    render(<MiniCircularProgress value={50} showValue={false} />);
    expect(screen.queryByText("50%")).toBeNull();
  });

  it("应该在 maxValue 为 0 时避免除零错误", () => {
    render(<MiniCircularProgress value={0} maxValue={0} />);
    expect(screen.getByText("0%")).toBeDefined();
  });
});
