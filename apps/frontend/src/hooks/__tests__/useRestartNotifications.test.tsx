/**
 * 重启通知系统测试
 */

import { render, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
  RestartNotificationProvider,
  useRestartNotifications,
} from "@/hooks/useRestartNotifications";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock status store
const mockRestartStatus = { current: null as any };
const mockRestartPollingStatus = {
  current: {
    enabled: false,
    currentAttempts: 0,
    maxAttempts: 60,
  },
};

vi.mock("@/stores/status", () => ({
  useRestartStatus: () => mockRestartStatus.current,
  useRestartPollingStatus: () => mockRestartPollingStatus.current,
}));

// 测试组件
function TestComponent() {
  useRestartNotifications();
  return <div data-testid="test-component">Test</div>;
}

describe("useRestartNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRestartStatus.current = null;
    mockRestartPollingStatus.current = {
      enabled: false,
      currentAttempts: 0,
      maxAttempts: 60,
    };
  });

  it("should not show notification when restartStatus is null", async () => {
    const { toast } = await import("sonner");
    render(<TestComponent />);

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("should show success notification when restart completes", async () => {
    const { toast } = await import("sonner");
    const { rerender } = render(<TestComponent />);

    // 模拟重启完成
    mockRestartStatus.current = {
      status: "completed",
      timestamp: Date.now(),
    };
    mockRestartPollingStatus.current = {
      enabled: true,
      currentAttempts: 5,
      maxAttempts: 60,
    };

    rerender(<TestComponent />);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "服务重启成功！重连检查完成 (5次检查)",
        expect.objectContaining({
          id: "restart-status-success",
          description: "服务已恢复正常运行",
        })
      );
    });
  });

  it("should show error notification when restart fails", async () => {
    const { toast } = await import("sonner");
    const { rerender } = render(<TestComponent />);

    // 模拟重启失败
    mockRestartStatus.current = {
      status: "failed",
      error: "连接超时",
      timestamp: Date.now(),
    };
    mockRestartPollingStatus.current = {
      enabled: true,
      currentAttempts: 60,
      maxAttempts: 60,
    };

    rerender(<TestComponent />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "连接超时",
        expect.objectContaining({
          id: "restart-status-failed",
          description: "重连检查超时 (60/60次)",
        })
      );
    });
  });

  it("should not show duplicate notifications", async () => {
    const { toast } = await import("sonner");
    const { rerender } = render(<TestComponent />);

    const restartStatus = {
      status: "completed" as const,
      timestamp: Date.now(),
    };

    // 第一次设置状态
    mockRestartStatus.current = restartStatus;
    rerender(<TestComponent />);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledTimes(1);
    });

    // 再次设置相同状态
    mockRestartStatus.current = restartStatus;
    rerender(<TestComponent />);

    // 应该不会再次调用
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("should render RestartNotificationProvider without errors", () => {
    // RestartNotificationProvider 是一个纯逻辑组件，不渲染任何内容
    // 只要不抛出错误就说明渲染成功
    expect(() => {
      render(<RestartNotificationProvider />);
    }).not.toThrow();
  });
});
