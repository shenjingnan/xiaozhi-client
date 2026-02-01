import { DashboardStatusCard } from "@/components/DashboardStatusCard";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock stores with hoisted mocks
const mockUseMcpEndpoint = vi.hoisted(() =>
  vi.fn(() => ["http://localhost:3000"])
);
const mockUseMcpServers = vi.hoisted(() =>
  vi.fn(() => ({ server1: { command: "test" } }))
);
const mockUseConfig = vi.hoisted(() =>
  vi.fn(() => ({
    modelscope: { apiKey: "test-key" },
    platforms: { coze: { token: "test-token" } },
    connection: {
      heartbeatInterval: 30000,
      heartbeatTimeout: 5000,
      reconnectInterval: 5000,
    },
  }))
);
const mockUseWebSocketConnected = vi.hoisted(() => vi.fn(() => true));
const mockUseWebSocketUrl = vi.hoisted(() =>
  vi.fn(() => "ws://localhost:3000")
);

vi.mock("@/stores/config", () => ({
  useMcpEndpoint: mockUseMcpEndpoint,
  useMcpServers: mockUseMcpServers,
  useConfig: mockUseConfig,
}));

vi.mock("@/stores/websocket", () => ({
  useWebSocketConnected: mockUseWebSocketConnected,
  useWebSocketUrl: mockUseWebSocketUrl,
}));

// Mock child components
vi.mock("@/components/McpEndpointSettingButton", () => ({
  McpEndpointSettingButton: () => (
    <div data-testid="mcp-endpoint-setting-button" />
  ),
}));

vi.mock("@/components/WebUrlSettingButton", () => ({
  WebUrlSettingButton: () => <div data-testid="web-url-setting-button" />,
}));

vi.mock("@/components/ToolCallLogsDialog", () => ({
  ToolCallLogsDialog: () => <div data-testid="tool-call-logs-dialog" />,
}));

vi.mock("@/components/SystemSettingDialog", () => ({
  SystemSettingDialog: () => <div data-testid="system-setting-dialog" />,
}));

describe("DashboardStatusCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 恢复默认mock值
    mockUseMcpEndpoint.mockReturnValue(["http://localhost:3000"]);
    mockUseMcpServers.mockReturnValue({ server1: { command: "test" } });
    mockUseConfig.mockReturnValue({
      modelscope: { apiKey: "test-key" },
      platforms: { coze: { token: "test-token" } },
      connection: {
        heartbeatInterval: 30000,
        heartbeatTimeout: 5000,
        reconnectInterval: 5000,
      },
    });
    mockUseWebSocketConnected.mockReturnValue(true);
    mockUseWebSocketUrl.mockReturnValue("ws://localhost:3000");
  });

  it("应该正确渲染所有状态卡片", () => {
    render(<DashboardStatusCard />);

    // 检查小智接入点卡片
    expect(screen.getByText("小智接入点")).toBeInTheDocument();
    // 通过getAllByText来找到所有的"1"，我们期望至少有2个（端点数和服务数）
    const allOnes = screen.getAllByText("1");
    expect(allOnes.length).toBeGreaterThanOrEqual(2);

    // 检查Xiaozhi Client卡片
    expect(screen.getByText("Xiaozhi Client")).toBeInTheDocument();
    expect(screen.getByText("已连接")).toBeInTheDocument();

    // 检查MCP服务卡片
    expect(screen.getByText("MCP服务")).toBeInTheDocument();
    expect(screen.getByText("共 1 个服务")).toBeInTheDocument();
  });

  it("应该正确渲染设置按钮", () => {
    render(<DashboardStatusCard />);

    expect(
      screen.getByTestId("mcp-endpoint-setting-button")
    ).toBeInTheDocument();
    expect(screen.getByTestId("web-url-setting-button")).toBeInTheDocument();
    expect(screen.getByTestId("tool-call-logs-dialog")).toBeInTheDocument();
  });

  it("应该正确显示WebSocket URL", () => {
    render(<DashboardStatusCard />);

    expect(screen.getByText("ws://localhost:3000")).toBeInTheDocument();
  });

  it("应该正确渲染多个MCP端点", () => {
    // Mock多个端点
    mockUseMcpEndpoint.mockReturnValue([
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ]);

    render(<DashboardStatusCard />);

    // 使用getAllByText来获取所有的"3"，确保至少存在一个
    const endpointCounts = screen.getAllByText("3");
    expect(endpointCounts.length).toBeGreaterThanOrEqual(1);
  });

  it("应该正确处理未连接状态", () => {
    // Mock未连接状态
    mockUseWebSocketConnected.mockReturnValue(false);

    render(<DashboardStatusCard />);

    expect(screen.getByText("未连接")).toBeInTheDocument();
  });

  it("应该正确处理空MCP服务器", () => {
    // Mock空服务器
    (mockUseMcpServers as any).mockReturnValue({});

    render(<DashboardStatusCard />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("共 0 个服务")).toBeInTheDocument();
  });

  it("应该正确处理空MCP端点", () => {
    // Mock空端点
    mockUseMcpEndpoint.mockReturnValue([]);

    render(<DashboardStatusCard />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("应该具有正确的响应式类名", () => {
    const { container } = render(<DashboardStatusCard />);

    const gridContainer = container.querySelector(".grid");
    expect(gridContainer).toHaveClass("grid-cols-1", "gap-4", "px-4");
    expect(gridContainer).toHaveClass("@xl/main:grid-cols-2");
    expect(gridContainer).toHaveClass("@5xl/main:grid-cols-4");
  });

  it("应该正确渲染MiniCircularProgress组件", () => {
    const { container } = render(<DashboardStatusCard />);

    // 检查是否有3个进度圆形组件（每个卡片一个）
    const progressCircles = container.querySelectorAll("svg");
    expect(progressCircles.length).toBeGreaterThanOrEqual(3);
  });
});
