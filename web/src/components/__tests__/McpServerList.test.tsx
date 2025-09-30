import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { McpServerList } from "../McpServerList";

// Mock sonner toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock("sonner", () => ({
  toast: mockToast,
}));

// Mock the config store
const mockMcpServerConfig = vi.fn();
const mockMcpServers = vi.fn();
const mockRefreshConfig = vi.fn();
const mockUpdateConfig = vi.fn();

vi.mock("@/stores/config", () => ({
  useMcpServerConfig: () => mockMcpServerConfig(),
  useMcpServers: () => mockMcpServers(),
  useConfigActions: () => ({
    refreshConfig: mockRefreshConfig,
    updateConfig: mockUpdateConfig,
  }),
}));

// Mock the API client
const mockGetToolsList = vi.fn();
vi.mock("@/services/api", () => ({
  apiClient: {
    getToolsList: mockGetToolsList,
  },
}));

// Mock the RemoveMcpServerButton component
vi.mock("../RemoveMcpServerButton", () => ({
  RemoveMcpServerButton: ({ mcpServerName, onRemoveSuccess }: any) => (
    <button
      type="button"
      data-testid={`remove-${mcpServerName}`}
      onClick={onRemoveSuccess}
    >
      Remove {mcpServerName}
    </button>
  ),
}));

describe("McpServerList", () => {
  const serverConfig = {
    "test-server": {
      name: "test-server",
      command: "test-command",
      args: [],
      env: {},
    },
  };

  const servers = {
    "test-server": {
      name: "test-server",
      command: "test-command",
      args: [],
      env: {},
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMcpServerConfig.mockReturnValue(serverConfig);
    mockMcpServers.mockReturnValue(servers);

    // Mock API responses
    mockGetToolsList.mockImplementation((type: string) => {
      if (type === "enabled") {
        return Promise.resolve([
          {
            name: "test-tool",
            description: "Test tool",
            server: "test-server",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    // Mock refresh config to return a promise
    mockRefreshConfig.mockResolvedValue({});
  });

  it("应该正确渲染MCP服务列表", () => {
    render(<McpServerList updateConfig={mockUpdateConfig} />);

    expect(screen.getByText("test-server")).toBeInTheDocument();
    expect(screen.getByText("test-command")).toBeInTheDocument();
  });

  it("应该在没有MCP服务时显示空状态", () => {
    mockMcpServers.mockReturnValue({});
    mockMcpServerConfig.mockReturnValue({});

    render(<McpServerList updateConfig={mockUpdateConfig} />);

    expect(screen.getByText("暂无 MCP 服务")).toBeInTheDocument();
  });

  it("应该正确显示多个MCP服务", () => {
    const multipleServers = {
      server1: {
        name: "server1",
        command: "command1",
        args: [],
        env: {},
      },
      server2: {
        name: "server2",
        command: "command2",
        args: [],
        env: {},
      },
    };

    mockMcpServers.mockReturnValue(multipleServers);
    mockMcpServerConfig.mockReturnValue(multipleServers);

    render(<McpServerList updateConfig={mockUpdateConfig} />);

    expect(screen.getByText("server1")).toBeInTheDocument();
    expect(screen.getByText("server2")).toBeInTheDocument();
    expect(screen.getByText("command1")).toBeInTheDocument();
    expect(screen.getByText("command2")).toBeInTheDocument();
  });

  it("应该在点击删除按钮时触发回调函数", async () => {
    const mockCallback = vi.fn().mockResolvedValue(undefined);

    // Mock the RemoveMcpServerButton to capture the callback
    vi.mock("../RemoveMcpServerButton", () => ({
      RemoveMcpServerButton: ({ mcpServerName, onRemoveSuccess }: any) => (
        <button
          type="button"
          data-testid={`remove-${mcpServerName}`}
          onClick={onRemoveSuccess}
        >
          Remove {mcpServerName}
        </button>
      ),
    }));

    render(<McpServerList updateConfig={mockUpdateConfig} />);

    // 点击删除按钮
    const removeButton = screen.getByTestId("remove-test-server");
    removeButton.click();

    // 等待回调被调用
    await vi.waitFor(() => {
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  it("应该正确处理刷新错误", async () => {
    // Mock refreshConfig to throw error
    mockRefreshConfig.mockRejectedValue(new Error("刷新失败"));

    // Mock the RemoveMcpServerButton to capture the callback
    vi.mock("../RemoveMcpServerButton", () => ({
      RemoveMcpServerButton: ({ mcpServerName, onRemoveSuccess }: any) => (
        <button
          type="button"
          data-testid={`remove-${mcpServerName}`}
          onClick={onRemoveSuccess}
        >
          Remove {mcpServerName}
        </button>
      ),
    }));

    render(<McpServerList updateConfig={mockUpdateConfig} />);

    // 点击删除按钮
    const removeButton = screen.getByTestId("remove-test-server");
    removeButton.click();

    // 等待错误处理
    await vi.waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("刷新数据失败");
    });
  });
});
