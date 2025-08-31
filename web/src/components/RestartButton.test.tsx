import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { RestartButton, type RestartStatus } from "./RestartButton";

// Mock status store
const mockRestartService = vi.fn();
const mockIsRestarting = { current: false };
const mockRestartPollingStatus = {
  current: {
    enabled: false,
    currentAttempts: 0,
    maxAttempts: 60,
    startTime: null,
  },
};

vi.mock("@/stores/status", () => ({
  useStatusStore: () => ({
    loading: { isRestarting: mockIsRestarting.current },
    restartService: mockRestartService,
  }),
  useRestartPollingStatus: () => mockRestartPollingStatus.current,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("RestartButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRestarting.current = false;
    mockRestartPollingStatus.current = {
      enabled: false,
      currentAttempts: 0,
      maxAttempts: 60,
      startTime: null,
    };
  });

  it("should render with default props", () => {
    render(<RestartButton />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("重启服务");
    expect(button).not.toBeDisabled();

    const icon = button.querySelector("svg");
    expect(icon).toBeInTheDocument();
    expect(icon).not.toHaveClass("animate-spin");
  });

  it("should render with custom text", () => {
    render(
      <RestartButton defaultText="重新启动" restartingText="正在重启..." />
    );

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("重新启动");
  });

  it("should be disabled when disabled prop is true", () => {
    render(<RestartButton disabled={true} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("should call restartService when clicked", async () => {
    render(<RestartButton />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockRestartService).toHaveBeenCalledTimes(1);
  });

  it("should show loading state when restarting", async () => {
    // 模拟重启状态
    mockIsRestarting.current = true;
    mockRestartService.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<RestartButton />);

    const button = screen.getByRole("button");

    // 应该显示加载状态
    expect(button).toHaveTextContent("重启中...");
    expect(button).toBeDisabled();

    const icon = button.querySelector("svg");
    expect(icon).toHaveClass("animate-spin");
  });

  it("should handle restart service errors", async () => {
    mockRestartService.mockRejectedValue(new Error("重启失败"));
    render(<RestartButton />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockRestartService).toHaveBeenCalled();
    });

    // 组件本身不显示错误 toast，错误处理由 store 和通知系统处理
    // 按钮状态由 isRestarting 状态控制
    expect(button).toBeInTheDocument();
  });

  it("should clear loading state when restartStatus becomes completed", () => {
    // 直接传入 restartStatus prop 来测试状态变化
    const restartStatus: RestartStatus = {
      status: "completed",
      timestamp: Date.now(),
    };

    render(<RestartButton restartStatus={restartStatus} />);

    const button = screen.getByRole("button");

    // 应该不是加载状态
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent("重启服务");

    const icon = button.querySelector("svg");
    expect(icon).not.toHaveClass("animate-spin");
  });

  it("should clear loading state when restartStatus becomes failed", () => {
    const { rerender } = render(<RestartButton />);

    const restartStatus: RestartStatus = {
      status: "failed",
      error: "重启失败",
      timestamp: Date.now(),
    };

    rerender(<RestartButton restartStatus={restartStatus} />);

    const button = screen.getByRole("button");
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent("重启服务");

    const icon = button.querySelector("svg");
    expect(icon).not.toHaveClass("animate-spin");
  });

  it("should apply custom className", () => {
    render(<RestartButton className="custom-class" />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("custom-class");
  });

  it("should use different button variants", () => {
    const { rerender } = render(<RestartButton variant="default" />);

    let button = screen.getByRole("button");
    expect(button).toHaveClass("bg-primary"); // default variant class

    rerender(<RestartButton variant="secondary" />);
    button = screen.getByRole("button");
    expect(button).toHaveClass("bg-secondary"); // secondary variant class
  });

  it("should call restartService when no onRestart prop provided", () => {
    render(<RestartButton />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    // 应该调用 restartService
    expect(mockRestartService).toHaveBeenCalled();

    // 按钮应该正常工作
    expect(button).toBeInTheDocument();
  });

  it("should handle async restart service", async () => {
    mockRestartService.mockResolvedValue("success");
    render(<RestartButton />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockRestartService).toHaveBeenCalled();
    });
  });

  it("should handle sync restart service", () => {
    mockRestartService.mockReturnValue(undefined);
    render(<RestartButton />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockRestartService).toHaveBeenCalledTimes(1);
  });
});
