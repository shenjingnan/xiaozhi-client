import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RestartButton } from "./RestartButton";

// Mock useWebSocketContext hook
const mockUseWebSocketContext = vi.fn();
vi.mock("@/providers/WebSocketProvider", () => ({
  useWebSocketContext: () => mockUseWebSocketContext(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("RestartButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWebSocketContext.mockReturnValue({
      websocket: {
        sendRestartService: vi.fn(),
        getState: vi.fn().mockReturnValue("connected"),
      },
    });
  });

  it("should render correctly", () => {
    render(<RestartButton />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("重启服务");
    expect(button).not.toBeDisabled();
  });

  it("should call websocket.sendRestartService when clicked", () => {
    const mockSendRestartService = vi.fn();
    mockUseWebSocketContext.mockReturnValue({
      websocket: {
        sendRestartService: mockSendRestartService,
        getState: vi.fn().mockReturnValue("connected"),
      },
    });

    render(<RestartButton />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockSendRestartService).toHaveBeenCalledTimes(1);
  });
});
