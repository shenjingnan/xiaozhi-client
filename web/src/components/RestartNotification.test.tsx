import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RestartNotification } from "./RestartNotification";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("RestartNotification", () => {
  it("should render nothing when no restart status", () => {
    const { container } = render(<RestartNotification />);
    expect(container.firstChild).toBeNull();
  });

  it("should render nothing when restart is completed", () => {
    const { container } = render(
      <RestartNotification
        restartStatus={{
          status: "completed",
          timestamp: Date.now(),
        }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should show restarting notification", () => {
    render(
      <RestartNotification
        restartStatus={{
          status: "restarting",
          timestamp: Date.now(),
        }}
      />
    );

    expect(screen.getByText("正在重启服务")).toBeInTheDocument();
    expect(
      screen.getByText("正在应用新的配置，服务将在几秒钟内重新启动...")
    ).toBeInTheDocument();
  });

  it("should show failed notification with error message", () => {
    const errorMessage = "无法连接到服务";
    render(
      <RestartNotification
        restartStatus={{
          status: "failed",
          error: errorMessage,
          timestamp: Date.now(),
        }}
      />
    );

    expect(screen.getByText("重启失败")).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("should show default error message when no error provided", () => {
    render(
      <RestartNotification
        restartStatus={{
          status: "failed",
          timestamp: Date.now(),
        }}
      />
    );

    expect(screen.getByText("重启失败")).toBeInTheDocument();
    expect(
      screen.getByText("服务重启过程中发生错误，请检查日志")
    ).toBeInTheDocument();
  });

  it("should trigger toast notifications", async () => {
    const { toast } = await import("sonner");
    const { rerender } = render(<RestartNotification />);

    // Test restarting toast
    rerender(
      <RestartNotification
        restartStatus={{
          status: "restarting",
          timestamp: Date.now(),
        }}
      />
    );

    await waitFor(() => {
      expect(toast.loading).toHaveBeenCalledWith(
        "正在重启 MCP 服务...",
        expect.objectContaining({
          id: "restart-notification",
          description: "服务重启中，请稍候片刻",
        })
      );
    });

    // Test completed toast
    rerender(
      <RestartNotification
        restartStatus={{
          status: "completed",
          timestamp: Date.now(),
        }}
      />
    );

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "MCP 服务重启成功",
        expect.objectContaining({
          id: "restart-notification",
          description: "配置已更新并成功应用",
        })
      );
    });

    // Test failed toast
    rerender(
      <RestartNotification
        restartStatus={{
          status: "failed",
          error: "测试错误",
          timestamp: Date.now(),
        }}
      />
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "MCP 服务重启失败",
        expect.objectContaining({
          id: "restart-notification",
          description: "测试错误",
        })
      );
    });
  });
});
