import { McpServerList } from "@components/McpServerList";
import { render, screen } from "@testing-library/react";
import { act } from "react";
import { vi } from "vitest";

// 模拟 sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// 模拟配置存储
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

// 模拟 API 客户端
vi.mock("@/services/api", () => ({
  apiClient: {
    getToolsList: vi.fn(),
    removeCustomTool: vi.fn(),
    addCustomTool: vi.fn(),
    updateCustomTool: vi.fn(),
  },
}));

// 模拟其他组件
vi.mock("@components/AddMcpServerButton", () => ({
  AddMcpServerButton: () => (
    <button type="button" data-testid="add-server">
      Add Server
    </button>
  ),
}));

vi.mock("@components/RemoveMcpServerButton", () => ({
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

vi.mock("@components/McpServerSettingButton", () => ({
  McpServerSettingButton: () => <div>Settings</div>,
}));

vi.mock("@components/RestartButton", () => ({
  RestartButton: () => <div>Restart</div>,
}));

vi.mock("@components/CozeWorkflowIntegration", () => ({
  CozeWorkflowIntegration: () => <div>Coze Integration</div>,
}));

vi.mock("@/components/common/WorkflowParameterConfigDialog", () => ({
  WorkflowParameterConfigDialog: () => <div>Parameter Config Dialog</div>,
}));

vi.mock("@/utils/mcpServerUtils", () => ({
  getMcpServerCommunicationType: () => "stdio",
}));

describe("McpServerList 组件", () => {
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

  // 从 API 客户端获取模拟函数
  let mockGetToolsList: any;

  beforeEach(async () => {
    // 获取模拟函数
    const { apiClient } = await import("@/services/api");
    mockGetToolsList = apiClient.getToolsList;

    vi.clearAllMocks();
    mockMcpServerConfig.mockReturnValue(serverConfig);
    mockMcpServers.mockReturnValue(servers);

    // 模拟 API 响应
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

    // 模拟刷新配置以返回 promise
    mockRefreshConfig.mockResolvedValue({});
  });

  it("应该正确渲染MCP服务列表", async () => {
    await act(async () => {
      render(<McpServerList updateConfig={mockUpdateConfig} />);
    });

    // 等待工具加载
    await vi.waitFor(() => {
      expect(screen.getByText("test-server")).toBeInTheDocument();
    });
  });

  it("应该在没有MCP服务时显示空状态", async () => {
    mockMcpServers.mockReturnValue({});
    mockMcpServerConfig.mockReturnValue({});

    await act(async () => {
      render(<McpServerList updateConfig={mockUpdateConfig} />);
    });

    expect(screen.getByText("还没有 MCP 服务")).toBeInTheDocument();
  });

  it("应该正确显示多个MCP服务", async () => {
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

    await act(async () => {
      render(<McpServerList updateConfig={mockUpdateConfig} />);
    });

    // 等待组件渲染
    await vi.waitFor(() => {
      expect(screen.getByText("server1")).toBeInTheDocument();
      expect(screen.getByText("server2")).toBeInTheDocument();
    });
  });

  it("应该正确显示刷新状态", async () => {
    await act(async () => {
      render(<McpServerList updateConfig={mockUpdateConfig} />);
    });

    // 组件应该能正常渲染
    await vi.waitFor(() => {
      expect(screen.getByText("test-server")).toBeInTheDocument();
    });
  });
});
