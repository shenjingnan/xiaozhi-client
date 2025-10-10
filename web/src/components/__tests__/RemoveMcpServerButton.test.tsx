import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { vi } from "vitest";
import { RemoveMcpServerButton } from "../RemoveMcpServerButton";

// Mock lucide-react to avoid icon loading issues
vi.mock("lucide-react", () => ({
  TrashIcon: () => null,
}));

// Mock the services/api module
const { mcpServerApi } = await import("@/services/api");
const mockRemoveServer = vi.fn();
mcpServerApi.removeServer = mockRemoveServer;

// Mock sonner
const { toast } = await import("sonner");
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
toast.success = mockToastSuccess;
toast.error = mockToastError;

// Mock console.error to avoid noise in tests
vi.spyOn(console, "error").mockImplementation(() => {});

describe("RemoveMcpServerButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确渲染删除按钮", () => {
    render(<RemoveMcpServerButton mcpServerName="test-server" />);

    const button = screen.getByRole("button", { name: "" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("size-8");
  });

  it("应该显示确认对话框", async () => {
    render(<RemoveMcpServerButton mcpServerName="test-server" />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    // 等待对话框出现
    await waitFor(() => {
      expect(
        screen.getByText(/确定要删除这个\(test-server\)MCP服务吗？/)
      ).toBeInTheDocument();
    });
  });

  it("应该成功删除MCP服务并调用回调", async () => {
    const mockCallback = vi.fn();
    mockRemoveServer.mockResolvedValue(true);

    render(
      <RemoveMcpServerButton
        mcpServerName="test-server"
        onRemoveSuccess={mockCallback}
      />
    );

    // 点击删除按钮
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // 点击确认按钮
    const confirmButton = await screen.findByRole("button", { name: "确定" });
    fireEvent.click(confirmButton);

    // 验证API调用
    await waitFor(() => {
      expect(mockRemoveServer).toHaveBeenCalledWith("test-server");
    });

    // 验证成功提示
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'MCP 服务 "test-server" 已删除'
    );

    // 验证回调被调用
    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  it("应该在删除失败时不调用回调", async () => {
    const mockCallback = vi.fn();
    mockRemoveServer.mockResolvedValue(false);

    render(
      <RemoveMcpServerButton
        mcpServerName="test-server"
        onRemoveSuccess={mockCallback}
      />
    );

    // 点击删除按钮
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // 点击确认按钮
    const confirmButton = await screen.findByRole("button", { name: "确定" });

    // 使用 act 包裹异步操作
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    // 验证错误提示
    expect(mockToastError).toHaveBeenCalledWith(
      "删除 MCP 服务失败: 删除服务器失败"
    );

    // 验证回调没有被调用
    expect(mockCallback).not.toHaveBeenCalled();
  });

  it("应该在API抛出异常时不调用回调", async () => {
    const mockCallback = vi.fn();
    mockRemoveServer.mockRejectedValue(new Error("网络错误"));

    render(
      <RemoveMcpServerButton
        mcpServerName="test-server"
        onRemoveSuccess={mockCallback}
      />
    );

    // 点击删除按钮
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // 点击确认按钮
    const confirmButton = await screen.findByRole("button", { name: "确定" });

    // 使用 act 包裹异步操作
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    // 验证错误提示
    expect(mockToastError).toHaveBeenCalledWith("删除 MCP 服务失败: 网络错误");

    // 验证回调没有被调用
    expect(mockCallback).not.toHaveBeenCalled();
  });

  it("应该在没有回调时正常工作", async () => {
    mockRemoveServer.mockResolvedValue(true);

    render(<RemoveMcpServerButton mcpServerName="test-server" />);

    // 点击删除按钮
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // 点击确认按钮
    const confirmButton = await screen.findByRole("button", { name: "确定" });

    // 使用 act 包裹异步操作
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    // 验证成功提示
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'MCP 服务 "test-server" 已删除'
    );

    // 验证API调用
    expect(mockRemoveServer).toHaveBeenCalledWith("test-server");
  });

  it("应该显示加载状态", async () => {
    mockRemoveServer.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(true), 100);
      });
    });

    render(<RemoveMcpServerButton mcpServerName="test-server" />);

    // 点击删除按钮
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // 点击确认按钮
    const confirmButton = await screen.findByRole("button", { name: "确定" });

    // 使用 act 包裹异步操作并检查加载状态
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    // 等待操作完成
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });

  it("应该能够取消删除操作", async () => {
    const mockCallback = vi.fn();

    render(
      <RemoveMcpServerButton
        mcpServerName="test-server"
        onRemoveSuccess={mockCallback}
      />
    );

    // 点击删除按钮
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // 点击取消按钮
    const cancelButton = await screen.findByRole("button", { name: "取消" });
    fireEvent.click(cancelButton);

    // 验证API没有被调用
    expect(mockRemoveServer).not.toHaveBeenCalled();

    // 验证回调没有被调用
    expect(mockCallback).not.toHaveBeenCalled();
  });
});
