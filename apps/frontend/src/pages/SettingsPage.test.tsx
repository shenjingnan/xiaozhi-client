import { NetworkServiceProvider } from "@/providers/WebSocketProvider";
import { render, screen, waitFor } from "@testing-library/react";
import type { AppConfig } from "@xiaozhi/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./SettingsPage";

// Mock the hooks and components
vi.mock("@/stores/config", () => ({
  useConfig: vi.fn(),
}));

vi.mock("@/stores", () => ({
  initializeStores: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/useNetworkService", () => ({
  useNetworkService: vi.fn(),
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
  RestartButton: () => (
    <button type="button" data-testid="restart-button">
      重启
    </button>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useNetworkService } from "@/hooks/useNetworkService";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useConfig } from "@/stores/config";

const mockUseConfig = useConfig as ReturnType<typeof vi.fn>;
const mockUseWebSocket = useWebSocket as ReturnType<typeof vi.fn>;
const mockUseNetworkService = useNetworkService as ReturnType<typeof vi.fn>;

describe("SettingsPage", () => {
  const mockUpdateConfig = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useNetworkService
    mockUseNetworkService.mockReturnValue({
      getConfig: vi.fn(),
      updateConfig: mockUpdateConfig,
      getStatus: vi.fn(),
      refreshStatus: vi.fn(),
      restartService: vi.fn(),
      updateConfigWithNotification: vi.fn(),
      restartServiceWithNotification: vi.fn(),
      setCustomWsUrl: vi.fn(),
      getWebSocketUrl: vi.fn(),
      changePort: vi.fn(),
      loadInitialData: vi.fn(),
      isWebSocketConnected: vi.fn(),
      getWebSocketState: vi.fn(),
    });

    mockUseWebSocket.mockReturnValue({
      updateConfig: mockUpdateConfig,
    });
  });

  it("should display default values when config is null", async () => {
    mockUseConfig.mockReturnValue(null);

    render(
      <NetworkServiceProvider>
        <SettingsPage />
      </NetworkServiceProvider>
    );

    // 等待初始化完成
    await waitFor(() => {
      expect(screen.queryByText("正在初始化应用...")).not.toBeInTheDocument();
    });

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

    mockUseConfig.mockReturnValue(mockConfig);

    render(
      <NetworkServiceProvider>
        <SettingsPage />
      </NetworkServiceProvider>
    );

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

    mockUseConfig.mockReturnValue(mockConfig);

    render(
      <NetworkServiceProvider>
        <SettingsPage />
      </NetworkServiceProvider>
    );

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
    mockUseConfig.mockReturnValue(null);

    const { rerender } = render(
      <NetworkServiceProvider>
        <SettingsPage />
      </NetworkServiceProvider>
    );

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

    mockUseConfig.mockReturnValue(mockConfig);
    rerender(
      <NetworkServiceProvider>
        <SettingsPage />
      </NetworkServiceProvider>
    );

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
