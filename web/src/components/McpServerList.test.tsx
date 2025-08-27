import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpServerList } from "./McpServerList";

// Mock the hooks
vi.mock("@/stores/config", () => ({
  useMcpServerConfig: vi.fn(),
  useMcpServers: vi.fn(),
  useConfig: vi.fn(),
}));

vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock UI components
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  CardFooter: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

// Mock Lucide React icons with a generic approach
vi.mock("lucide-react", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  // Create a generic icon component
  const MockIcon = ({ className, ...props }: any) => (
    <span className={className} {...props}>
      Icon
    </span>
  );

  // Return all actual exports but override with mock icons
  return {
    ...actual,
    CoffeeIcon: MockIcon,
    MinusIcon: MockIcon,
    PlusIcon: MockIcon,
    Settings: MockIcon,
    SettingsIcon: MockIcon,
    Wrench: MockIcon,
    X: MockIcon,
    RefreshCw: MockIcon,
    Trash2: MockIcon,
    Edit: MockIcon,
    // Add any other icons that might be needed
    Check: MockIcon,
    AlertCircle: MockIcon,
    Info: MockIcon,
  };
});

describe("McpServerList", () => {
  const mockUpdateConfig = vi.fn();

  const mockMcpServerConfig = {
    server1: {
      tools: {
        tool1: { enable: true, description: "Tool 1 description" },
        tool2: { enable: false, description: "Tool 2 description" },
      },
    },
    server2: {
      tools: {
        tool3: { enable: true, description: "Tool 3 description" },
      },
    },
  };

  const mockMcpServers = {
    server1: { command: "node", args: ["server1.js"] },
    server2: { command: "node", args: ["server2.js"] },
  };

  const mockConfig = {
    mcpEndpoint: "ws://localhost:8080",
    mcpServers: mockMcpServers,
    connection: {
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      reconnectInterval: 5000,
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mocks using dynamic imports
    const configModule = await import("@/stores/config");
    const useWebSocketModule = await import("@/hooks/useWebSocket");

    vi.mocked(configModule.useMcpServerConfig).mockReturnValue(
      mockMcpServerConfig
    );
    vi.mocked(configModule.useMcpServers).mockReturnValue(mockMcpServers);
    vi.mocked(configModule.useConfig).mockReturnValue(mockConfig);
    vi.mocked(useWebSocketModule.useWebSocket).mockReturnValue({
      updateConfig: mockUpdateConfig,
      restartService: vi.fn(),
      refreshStatus: vi.fn(),
      wsUrl: "ws://localhost:9999",
      setCustomWsUrl: vi.fn(),
      changePort: vi.fn(),
      connected: false,
      config: null,
      status: null,
    });
  });

  it("should render enabled and disabled tools correctly", () => {
    render(<McpServerList updateConfig={mockUpdateConfig} />);

    // Check if enabled tools section shows correct count
    expect(screen.getByText("使用中的工具 (2)")).toBeInTheDocument();

    // Check if disabled tools section shows correct count
    expect(screen.getByText("未使用的工具 (1)")).toBeInTheDocument();

    // Check if tool names are displayed
    expect(screen.getByText("tool1")).toBeInTheDocument();
    expect(screen.getByText("tool2")).toBeInTheDocument();
    expect(screen.getByText("tool3")).toBeInTheDocument();
  });

  it("should handle tool toggle correctly", async () => {
    render(<McpServerList updateConfig={mockUpdateConfig} />);

    // Find and click the minus button for an enabled tool (tool1)
    // The minus buttons are rendered as generic "Icon" spans with hover:bg-red-500 class
    const minusButtons = screen
      .getAllByRole("button")
      .filter((button) => button.className.includes("hover:bg-red-500"));
    fireEvent.click(minusButtons[0]);

    await waitFor(() => {
      expect(mockUpdateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpEndpoint: "ws://localhost:8080",
          mcpServers: mockMcpServers,
          mcpServerConfig: expect.objectContaining({
            server1: expect.objectContaining({
              tools: expect.objectContaining({
                tool1: expect.objectContaining({
                  enable: false,
                }),
              }),
            }),
          }),
        })
      );
    });

    expect(toast.success).toHaveBeenCalledWith("禁用工具 tool1 成功");
  });

  it("should handle enabling a disabled tool", async () => {
    render(<McpServerList updateConfig={mockUpdateConfig} />);

    // Find and click the plus button for a disabled tool (tool2)
    // The plus buttons are rendered as generic "Icon" spans with hover:bg-green-500 class
    const plusButtons = screen
      .getAllByRole("button")
      .filter((button) => button.className.includes("hover:bg-green-500"));
    fireEvent.click(plusButtons[0]);

    await waitFor(() => {
      expect(mockUpdateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpEndpoint: "ws://localhost:8080",
          mcpServers: mockMcpServers,
          mcpServerConfig: expect.objectContaining({
            server1: expect.objectContaining({
              tools: expect.objectContaining({
                tool2: expect.objectContaining({
                  enable: true,
                }),
              }),
            }),
          }),
        })
      );
    });

    expect(toast.success).toHaveBeenCalledWith("启用工具 tool2 成功");
  });

  it("should show error when config is not loaded", async () => {
    const configModule = await import("@/stores/config");
    vi.mocked(configModule.useConfig).mockReturnValue(null);

    render(<McpServerList updateConfig={mockUpdateConfig} />);

    const minusButtons = screen
      .getAllByRole("button")
      .filter((button) => button.className.includes("hover:bg-red-500"));
    fireEvent.click(minusButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("配置未加载");
    });

    expect(mockUpdateConfig).not.toHaveBeenCalled();
  });

  it("should show error when updateConfig is not provided", async () => {
    // Mock a scenario where updateConfig is not provided
    const configModule = await import("@/stores/config");
    const useWebSocketModule = await import("@/hooks/useWebSocket");

    vi.mocked(configModule.useMcpServerConfig).mockReturnValue({
      server1: {
        tools: {
          "other-tool": { enable: true, description: "Other tool" },
        },
      },
    });

    // Mock useWebSocket to return undefined updateConfig
    vi.mocked(useWebSocketModule.useWebSocket).mockReturnValue({
      updateConfig: undefined as any,
      restartService: vi.fn(),
      refreshStatus: vi.fn(),
      wsUrl: "ws://localhost:9999",
      setCustomWsUrl: vi.fn(),
      changePort: vi.fn(),
      connected: false,
      config: null,
      status: null,
    });

    render(<McpServerList />); // No updateConfig prop to test the error case

    // Try to toggle a tool
    const buttons = screen.getAllByRole("button");
    const toggleButtons = buttons.filter((button) =>
      button.className.includes("hover:bg-red-500") ||
      button.className.includes("hover:bg-green-500")
    );

    if (toggleButtons.length > 0) {
      fireEvent.click(toggleButtons[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("updateConfig 方法未提供")
        );
      });
    }
  });
});
