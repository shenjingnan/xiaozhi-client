import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import McpServicesDisplay from "./mcp-list";

// Mock the hooks
vi.mock("@/stores/websocket", () => ({
  useWebSocketMcpServerConfig: vi.fn(),
  useWebSocketMcpServers: vi.fn(),
  useWebSocketConfig: vi.fn(),
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

// Mock Lucide React icons
vi.mock("lucide-react", () => ({
  CoffeeIcon: () => <span>CoffeeIcon</span>,
  MinusIcon: () => <span>MinusIcon</span>,
  PlusIcon: () => <span>PlusIcon</span>,
  Settings: () => <span>Settings</span>,
  Wrench: () => <span>Wrench</span>,
}));

describe("McpServicesDisplay", () => {
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

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    const {
      useWebSocketMcpServerConfig,
      useWebSocketMcpServers,
      useWebSocketConfig,
    } = require("@/stores/websocket");
    const { useWebSocket } = require("@/hooks/useWebSocket");

    useWebSocketMcpServerConfig.mockReturnValue(mockMcpServerConfig);
    useWebSocketMcpServers.mockReturnValue({});
    useWebSocketConfig.mockReturnValue(mockConfig);
    useWebSocket.mockReturnValue({ updateConfig: mockUpdateConfig });
  });

  it("should render enabled and disabled tools correctly", () => {
    render(<McpServicesDisplay />);

    // Check if enabled tools section shows correct count
    expect(screen.getByText("聚合后的MCP服务 (2)")).toBeInTheDocument();

    // Check if disabled tools section shows correct count
    expect(screen.getByText("可用工具 (1)")).toBeInTheDocument();

    // Check if tool names are displayed
    expect(screen.getByText("tool1")).toBeInTheDocument();
    expect(screen.getByText("tool2")).toBeInTheDocument();
    expect(screen.getByText("tool3")).toBeInTheDocument();
  });

  it("should handle tool toggle correctly", async () => {
    render(<McpServicesDisplay />);

    // Find and click the minus button for an enabled tool (tool1)
    const minusButtons = screen.getAllByText("MinusIcon");
    fireEvent.click(minusButtons[0]);

    await waitFor(() => {
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        ...mockConfig,
        mcpServerConfig: {
          ...mockConfig.mcpServerConfig,
          server1: {
            ...mockConfig.mcpServerConfig["server1"],
            tools: {
              ...mockConfig.mcpServerConfig["server1"].tools,
              tool1: {
                ...mockConfig.mcpServerConfig["server1"].tools["tool1"],
                enable: false,
              },
            },
          },
        },
      });
    });

    expect(toast.success).toHaveBeenCalledWith('工具 "tool1" 已禁用');
  });

  it("should handle enabling a disabled tool", async () => {
    render(<McpServicesDisplay />);

    // Find and click the plus button for a disabled tool (tool2)
    const plusButtons = screen.getAllByText("PlusIcon");
    fireEvent.click(plusButtons[0]);

    await waitFor(() => {
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        ...mockConfig,
        mcpServerConfig: {
          ...mockConfig.mcpServerConfig,
          server1: {
            ...mockConfig.mcpServerConfig["server1"],
            tools: {
              ...mockConfig.mcpServerConfig["server1"].tools,
              tool2: {
                ...mockConfig.mcpServerConfig["server1"].tools["tool2"],
                enable: true,
              },
            },
          },
        },
      });
    });

    expect(toast.success).toHaveBeenCalledWith('工具 "tool2" 已启用');
  });

  it("should show error when config is not loaded", async () => {
    const { useWebSocketConfig } = require("@/stores/websocket");
    useWebSocketConfig.mockReturnValue(null);

    render(<McpServicesDisplay />);

    const minusButtons = screen.getAllByText("MinusIcon");
    fireEvent.click(minusButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("配置数据未加载，请稍后重试");
    });

    expect(mockUpdateConfig).not.toHaveBeenCalled();
  });

  it("should show error when tool is not found", async () => {
    // Mock a scenario where the tool doesn't exist in any server
    const { useWebSocketMcpServerConfig } = require("@/stores/websocket");
    useWebSocketMcpServerConfig.mockReturnValue({
      server1: {
        tools: {
          "other-tool": { enable: true, description: "Other tool" },
        },
      },
    });

    render(<McpServicesDisplay />);

    // Try to toggle a non-existent tool
    const buttons = screen.getAllByRole("button");
    if (buttons.length > 0) {
      fireEvent.click(buttons[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("未找到工具")
        );
      });
    }
  });
});
