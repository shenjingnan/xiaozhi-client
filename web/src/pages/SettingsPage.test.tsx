import type { AppConfig } from "@/types";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./SettingsPage";

// Mock the hooks and components
vi.mock("@/stores/websocket", () => ({
  useWebSocketConfig: vi.fn(),
}));

vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: vi.fn(),
}));

vi.mock("@/components/AppSidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar">AppSidebar</div>,
}));

vi.mock("@/components/SiteHeder", () => ({
  SiteHeader: ({ title }: { title: string }) => (
    <div data-testid="site-header">{title}</div>
  ),
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-provider">{children}</div>
  ),
  SidebarInset: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-inset">{children}</div>
  ),
}));

vi.mock("@/components/RestartButton", () => ({
  RestartButton: () => <button data-testid="restart-button">重启</button>,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useWebSocket } from "@/hooks/useWebSocket";
import { useWebSocketConfig } from "@/stores/websocket";

const mockUseWebSocketConfig = useWebSocketConfig as ReturnType<typeof vi.fn>;
const mockUseWebSocket = useWebSocket as ReturnType<typeof vi.fn>;

describe("SettingsPage", () => {
  const mockUpdateConfig = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWebSocket.mockReturnValue({
      updateConfig: mockUpdateConfig,
    });
  });

  it("should display default values when config is null", () => {
    mockUseWebSocketConfig.mockReturnValue(null);

    render(<SettingsPage />);

    // 检查表单是否渲染
    expect(screen.getByLabelText("魔搭社区 API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("心跳间隔（毫秒）")).toBeInTheDocument();
    expect(screen.getByLabelText("心跳超时（毫秒）")).toBeInTheDocument();
    expect(screen.getByLabelText("重连间隔（毫秒）")).toBeInTheDocument();
  });

  it("should display config values when config is provided", async () => {
    const mockConfig: AppConfig = {
      mcpEndpoint: "test-endpoint",
      mcpServers: {},
      modelscope: {
        apiKey: "test-api-key",
      },
      connection: {
        heartbeatInterval: 25000,
        heartbeatTimeout: 8000,
        reconnectInterval: 3000,
      },
    };

    mockUseWebSocketConfig.mockReturnValue(mockConfig);

    render(<SettingsPage />);

    // 等待表单更新
    await waitFor(() => {
      const apiKeyInput = screen.getByLabelText(
        "魔搭社区 API Key"
      ) as HTMLInputElement;
      const heartbeatIntervalInput = screen.getByLabelText(
        "心跳间隔（毫秒）"
      ) as HTMLInputElement;
      const heartbeatTimeoutInput = screen.getByLabelText(
        "心跳超时（毫秒）"
      ) as HTMLInputElement;
      const reconnectIntervalInput = screen.getByLabelText(
        "重连间隔（毫秒）"
      ) as HTMLInputElement;

      expect(apiKeyInput.value).toBe("test-api-key");
      expect(heartbeatIntervalInput.value).toBe("25000");
      expect(heartbeatTimeoutInput.value).toBe("8000");
      expect(reconnectIntervalInput.value).toBe("3000");
    });
  });

  it("should use default values when config fields are missing", async () => {
    const mockConfig: AppConfig = {
      mcpEndpoint: "test-endpoint",
      mcpServers: {},
      // modelscope 和 connection 字段缺失
    };

    mockUseWebSocketConfig.mockReturnValue(mockConfig);

    render(<SettingsPage />);

    // 等待表单更新
    await waitFor(() => {
      const apiKeyInput = screen.getByLabelText(
        "魔搭社区 API Key"
      ) as HTMLInputElement;
      const heartbeatIntervalInput = screen.getByLabelText(
        "心跳间隔（毫秒）"
      ) as HTMLInputElement;
      const heartbeatTimeoutInput = screen.getByLabelText(
        "心跳超时（毫秒）"
      ) as HTMLInputElement;
      const reconnectIntervalInput = screen.getByLabelText(
        "重连间隔（毫秒）"
      ) as HTMLInputElement;

      // 应该使用默认值
      expect(apiKeyInput.value).toBe("");
      expect(heartbeatIntervalInput.value).toBe("30000");
      expect(heartbeatTimeoutInput.value).toBe("10000");
      expect(reconnectIntervalInput.value).toBe("5000");
    });
  });

  it("should update form when config changes", async () => {
    // 初始状态：config 为 null
    mockUseWebSocketConfig.mockReturnValue(null);

    const { rerender } = render(<SettingsPage />);

    // 模拟 config 数据加载完成
    const mockConfig: AppConfig = {
      mcpEndpoint: "test-endpoint",
      mcpServers: {},
      modelscope: {
        apiKey: "loaded-api-key",
      },
      connection: {
        heartbeatInterval: 35000,
        heartbeatTimeout: 12000,
        reconnectInterval: 6000,
      },
    };

    mockUseWebSocketConfig.mockReturnValue(mockConfig);
    rerender(<SettingsPage />);

    // 等待表单更新
    await waitFor(() => {
      const apiKeyInput = screen.getByLabelText(
        "魔搭社区 API Key"
      ) as HTMLInputElement;
      const heartbeatIntervalInput = screen.getByLabelText(
        "心跳间隔（毫秒）"
      ) as HTMLInputElement;
      const heartbeatTimeoutInput = screen.getByLabelText(
        "心跳超时（毫秒）"
      ) as HTMLInputElement;
      const reconnectIntervalInput = screen.getByLabelText(
        "重连间隔（毫秒）"
      ) as HTMLInputElement;

      expect(apiKeyInput.value).toBe("loaded-api-key");
      expect(heartbeatIntervalInput.value).toBe("35000");
      expect(heartbeatTimeoutInput.value).toBe("12000");
      expect(reconnectIntervalInput.value).toBe("6000");
    });
  });
});
