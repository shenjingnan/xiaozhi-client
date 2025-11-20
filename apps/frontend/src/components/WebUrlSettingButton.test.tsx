import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebUrlSettingButton } from "./WebUrlSettingButton";

// Mock react-hook-form
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    control: {},
    handleSubmit: vi.fn((fn) => fn),
    reset: vi.fn(),
    formState: { errors: {} },
  }),
  FormProvider: ({ children }: { children: React.ReactNode }) => children,
  Controller: ({ render }: { render: any }) =>
    render({ field: {}, fieldState: {}, formState: {} }),
  useFormContext: () => ({
    getFieldState: vi.fn(() => ({})),
    formState: { errors: {} },
  }),
}));

// Mock the hooks
vi.mock("@/providers/WebSocketProvider", () => ({
  useNetworkServiceActions: () => ({
    updateConfig: vi.fn(),
    changePort: vi.fn(),
  }),
}));

vi.mock("@/stores/websocket", () => ({
  useWebSocketConfig: vi.fn(() => ({
    webUI: {
      port: 9999,
      autoRestart: true,
    },
    mcpEndpoint: "test-endpoint",
    mcpServers: {},
  })),
  useWebSocketConnected: vi.fn(() => false),
  useWebSocketPortChangeStatus: vi.fn(() => undefined),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("WebUrlSettingButton", () => {
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
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("displays dialog title and description", async () => {
    render(<WebUrlSettingButton />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("配置服务端端口")).toBeInTheDocument();
      expect(
        screen.getByText("请输入服务端端口号，系统将尝试连接。")
      ).toBeInTheDocument();
    });
  });
});
