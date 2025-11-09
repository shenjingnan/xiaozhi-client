import { DashboardStatusCard } from "@/components/DashboardStatusCard";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

// Mock stores
vi.mock("@/stores/config", () => ({
  useMcpEndpoint: vi.fn(() => ["http://localhost:3000"]),
  useMcpServers: vi.fn(() => ({ server1: { command: "test" } })),
}));

vi.mock("@/stores/websocket", () => ({
  useWebSocketConnected: vi.fn(() => true),
  useWebSocketUrl: vi.fn(() => "ws://localhost:3000"),
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

describe("DashboardStatusCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确渲染所有状态卡片", () => {
    render(<DashboardStatusCard />);

    // 检查小智接入点卡片
    expect(screen.getByText("小智接入点")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    // 检查Xiaozhi Client卡片
    expect(screen.getByText("Xiaozhi Client")).toBeInTheDocument();
    expect(screen.getByText("已连接")).toBeInTheDocument();

    // 检查MCP服务卡片
    expect(screen.getByText("MCP服务")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
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
    const { useMcpEndpoint } = require("@/stores/config");
    useMcpEndpoint.mockReturnValue([
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ]);

    render(<DashboardStatusCard />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("应该正确处理未连接状态", () => {
    // Mock未连接状态
    const { useWebSocketConnected } = require("@/stores/websocket");
    useWebSocketConnected.mockReturnValue(false);

    render(<DashboardStatusCard />);

    expect(screen.getByText("未连接")).toBeInTheDocument();
  });

  it("应该正确处理空MCP服务器", () => {
    // Mock空服务器
    const { useMcpServers } = require("@/stores/config");
    useMcpServers.mockReturnValue({});

    render(<DashboardStatusCard />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("共 0 个服务")).toBeInTheDocument();
  });

  it("应该正确处理空MCP端点", () => {
    // Mock空端点
    const { useMcpEndpoint } = require("@/stores/config");
    useMcpEndpoint.mockReturnValue([]);

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
