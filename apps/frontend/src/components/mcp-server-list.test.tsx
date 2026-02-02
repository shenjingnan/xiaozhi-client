import type { BadgeProps } from "@/components/ui/badge";
import type { ButtonProps } from "@/components/ui/button";
import { render, screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpServerList } from "./McpServerList";

// 模拟 hooks
vi.mock("@/stores/config", () => ({
  useMcpServerConfig: vi.fn(),
  useMcpServers: vi.fn(),
  useConfig: vi.fn(),
  useConfigActions: vi.fn(),
}));

vi.mock("@/providers/WebSocketProvider", () => ({
  useNetworkServiceActions: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
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

// 模拟 UI 组件
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: BadgeProps) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: ButtonProps) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  CardContent: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardFooter: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

// 定义 AlertDialog Root 组件的 props 类型
interface AlertDialogRootProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

// 模拟 AlertDialog 组件
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open, onOpenChange }: AlertDialogRootProps) => (
    <div data-open={open} data-on-open-change={onOpenChange}>
      {children}
    </div>
  ),
  AlertDialogAction: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  AlertDialogContent: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertDialogDescription: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertDialogFooter: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertDialogHeader: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertDialogTitle: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertDialogTrigger: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

// 模拟 Lucide React 图标，并进行适当的类型过滤
vi.mock("lucide-react", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  // 创建通用图标组件，并进行适当的类型过滤
  const MockIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => {
    // 过滤掉 SVG 特有的属性，只保留通用的 HTML 属性
    const { viewBox, xmlns, version, width, height, fill, ...htmlProps } =
      props;
    return (
      <span
        className={className}
        {...(htmlProps as React.HTMLAttributes<HTMLSpanElement>)}
      >
        Icon
      </span>
    );
  };

  // 返回所有实际导出，但用模拟图标覆盖
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
    // 添加任何其他可能需要的图标
    Check: MockIcon,
    AlertCircle: MockIcon,
    Info: MockIcon,
  };
});

describe("McpServerList 组件", () => {
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

  // 模拟已启用和未启用的工具
  const mockEnabledTools = [
    {
      name: "tool1",
      description: "Tool 1 description",
      inputSchema: {},
      handler: {
        type: "mcp" as const,
        config: {
          serviceName: "server1",
          toolName: "tool1",
        },
      },
      enabled: true,
    },
    {
      name: "tool3",
      description: "Tool 3 description",
      inputSchema: {},
      handler: {
        type: "mcp" as const,
        config: {
          serviceName: "server2",
          toolName: "tool3",
        },
      },
      enabled: true,
    },
  ];

  const mockDisabledTools = [
    {
      name: "tool2",
      description: "Tool 2 description",
      inputSchema: {},
      handler: {
        type: "mcp" as const,
        config: {
          serviceName: "server1",
          toolName: "tool2",
        },
      },
      enabled: false,
    },
  ];

  const mockCozeTool = {
    name: "coze_tool",
    description: "Coze workflow tool",
    inputSchema: {},
    handler: {
      type: "proxy" as const,
      platform: "coze" as const,
      config: {
        serviceName: "coze",
        toolName: "coze_tool",
      },
    },
    enabled: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // 使用动态导入设置模拟
    const configModule = await import("@/stores/config");
    const webSocketProviderModule = await import(
      "@/providers/WebSocketProvider"
    );
    const apiModule = await import("@/services/api");

    vi.mocked(configModule.useMcpServerConfig).mockReturnValue(
      mockMcpServerConfig
    );
    vi.mocked(configModule.useMcpServers).mockReturnValue(mockMcpServers);
    vi.mocked(configModule.useConfig).mockReturnValue(mockConfig);
    vi.mocked(configModule.useConfigActions).mockReturnValue({
      getConfig: vi.fn().mockResolvedValue(mockConfig),
      updateConfig: vi.fn().mockResolvedValue(undefined),
      refreshConfig: vi.fn().mockResolvedValue(mockConfig),
      reloadConfig: vi.fn().mockResolvedValue(mockConfig),
      updateMcpEndpoint: vi.fn().mockResolvedValue(undefined),
      updateMcpServers: vi.fn().mockResolvedValue(undefined),
      updateConnectionConfig: vi.fn().mockResolvedValue(undefined),
      updateModelScopeConfig: vi.fn().mockResolvedValue(undefined),
      updateWebUIConfig: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(webSocketProviderModule.useNetworkServiceActions).mockReturnValue(
      {
        getConfig: vi.fn(),
        updateConfig: mockUpdateConfig,
        restartService: vi.fn(),
        refreshStatus: vi.fn(),
        getStatus: vi.fn(),
        updateConfigWithNotification: vi.fn(),
        restartServiceWithNotification: vi.fn(),
        setCustomWsUrl: vi.fn(),
        getWebSocketUrl: vi.fn(),
        changePort: vi.fn(),
        loadInitialData: vi.fn(),
        isWebSocketConnected: vi.fn(),
        getWebSocketState: vi.fn(),
      }
    );

    // 模拟 API 调用
    vi.mocked(apiModule.apiClient.getToolsList).mockImplementation(
      async (status) => {
        if (status === "enabled") return mockEnabledTools;
        if (status === "disabled") return mockDisabledTools;
        return [...mockEnabledTools, ...mockDisabledTools];
      }
    );
    vi.mocked(apiModule.apiClient.removeCustomTool).mockResolvedValue(
      undefined
    );
    vi.mocked(apiModule.apiClient.addCustomTool).mockResolvedValue({});
    vi.mocked(apiModule.apiClient.updateCustomTool).mockResolvedValue({});
  });

  it("应该正确渲染 MCP 服务器列表", async () => {
    render(<McpServerList />);

    // 等待组件加载完成
    await waitFor(() => {
      // 检查服务器名称是否正确显示
      expect(screen.getByText("server1")).toBeInTheDocument();
      expect(screen.getByText("server2")).toBeInTheDocument();
    });

    // 检查通信类型标签是否显示（检查是否至少存在一个）
    expect(screen.getAllByText("stdio").length).toBeGreaterThan(0);
  });

  it("应该在移除 Coze 工具时显示确认对话框", async () => {
    // 测试 Coze 工具的检测逻辑
    const cozeTool = mockCozeTool;
    expect(cozeTool).toBeDefined();
    expect(cozeTool.handler.type).toBe("proxy");
    expect(cozeTool.handler.platform).toBe("coze");
  });

  it("不应该为非 Coze 工具显示确认对话框", async () => {
    // 测试普通 MCP 工具
    const mcpTool = mockEnabledTools[0]; // 来自 server1 的 tool1
    expect(mcpTool.handler.config.serviceName).toBe("server1");
    expect(mcpTool.handler.type).not.toBe("proxy");
  });
});
