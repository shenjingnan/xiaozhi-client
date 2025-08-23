import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpServerList } from "./McpServerList";

// Mock the hooks
vi.mock("@/stores/websocket", () => ({
  useWebSocketMcpServerConfig: vi.fn(),
  useWebSocketMcpServers: vi.fn(),
  useWebSocketConfig: vi.fn(),
}));

// Mock all child components that use WebSocketProvider
vi.mock("@/components/AddMcpServerButton", () => ({
  AddMcpServerButton: () => (
    <div data-testid="add-mcp-server-button">Add MCP Server</div>
  ),
}));

vi.mock("@/components/RestartButton", () => ({
  RestartButton: () => <div data-testid="restart-button">Restart</div>,
}));

vi.mock("@/components/McpServerSettingButton", () => ({
  McpServerSettingButton: () => (
    <div data-testid="mcp-server-setting-button">Settings</div>
  ),
}));

vi.mock("@/components/RemoveMcpServerButton", () => ({
  RemoveMcpServerButton: () => (
    <div data-testid="remove-mcp-server-button">Remove</div>
  ),
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

  const mockConfig = {
    mcpEndpoint: "ws://localhost:8080",
    mcpServers: {},
    mcpServerConfig: mockMcpServerConfig,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mocks using dynamic imports
    const websocketModule = await import("@/stores/websocket");

    vi.mocked(websocketModule.useWebSocketMcpServerConfig).mockReturnValue(
      mockMcpServerConfig
    );
    vi.mocked(websocketModule.useWebSocketMcpServers).mockReturnValue({
      server1: { command: "node", args: ["server1.js"] },
      server2: { command: "node", args: ["server2.js"] },
    });
    vi.mocked(websocketModule.useWebSocketConfig).mockReturnValue(mockConfig);
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
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        ...mockConfig,
        mcpServerConfig: {
          ...mockConfig.mcpServerConfig,
          server1: {
            ...mockConfig.mcpServerConfig.server1,
            tools: {
              ...mockConfig.mcpServerConfig.server1.tools,
              tool1: {
                ...mockConfig.mcpServerConfig.server1.tools.tool1,
                enable: false,
              },
            },
          },
        },
      });
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
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        ...mockConfig,
        mcpServerConfig: {
          ...mockConfig.mcpServerConfig,
          server1: {
            ...mockConfig.mcpServerConfig.server1,
            tools: {
              ...mockConfig.mcpServerConfig.server1.tools,
              tool2: {
                ...mockConfig.mcpServerConfig.server1.tools.tool2,
                enable: true,
              },
            },
          },
        },
      });
    });

    expect(toast.success).toHaveBeenCalledWith("启用工具 tool2 成功");
  });

  it("should show error when config is not loaded", async () => {
    const websocketModule = await import("@/stores/websocket");
    vi.mocked(websocketModule.useWebSocketConfig).mockReturnValue(null);

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

  it("should show error when tool is not found", async () => {
    // Mock a scenario where updateConfig is not provided
    const websocketModule = await import("@/stores/websocket");

    vi.mocked(websocketModule.useWebSocketMcpServerConfig).mockReturnValue({
      server1: {
        tools: {
          "other-tool": { enable: true, description: "Other tool" },
        },
      },
    });

    render(<McpServerList />); // No updateConfig prop to test the error case

    // Try to toggle a non-existent tool
    const buttons = screen.getAllByRole("button");
    if (buttons.length > 0) {
      fireEvent.click(buttons[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("updateConfig 方法未提供")
        );
      });
    }
  });
});
