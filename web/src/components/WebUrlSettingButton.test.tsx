// import type { AppConfig } from "@/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebUrlSettingButton } from "./WebUrlSettingButton";

// Mock the hooks
vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({
    updateConfig: vi.fn(),
  }),
}));

vi.mock("@/stores/websocket", () => ({
  useWebSocketConfig: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("WebUrlSettingButton", () => {
  // const mockConfig: AppConfig = {
  //   mcpEndpoint: "test-endpoint",
  //   mcpServers: {},
  //   webUI: {
  //     port: 8888,
  //     autoRestart: true,
  //   },
  // };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the settings button", () => {
    render(<WebUrlSettingButton />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("opens dialog when button is clicked", async () => {
    render(<WebUrlSettingButton />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("配置服务端")).toBeInTheDocument();
    });
  });
});
