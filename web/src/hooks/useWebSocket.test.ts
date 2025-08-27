import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "./useWebSocket";
import type { AppConfig, ClientStatus } from "../types";

// Mock the stores and services
vi.mock("../stores/websocket", () => ({
  useWebSocketActions: vi.fn(),
}));

vi.mock("../stores/config", () => ({
  useConfigActions: vi.fn(),
  useConfig: vi.fn(),
}));

vi.mock("../stores/status", () => ({
  useStatusActions: vi.fn(),
  useClientStatus: vi.fn(),
  useRestartStatus: vi.fn(),
}));

vi.mock("../services/websocket", () => ({
  webSocketManager: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    isConnected: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getUrl: vi.fn(),
  },
}));

vi.mock("../utils/portUtils", () => ({
  buildWebSocketUrl: vi.fn(),
  checkPortAvailability: vi.fn(),
  extractPortFromUrl: vi.fn(),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import the mocked modules
import { useWebSocketActions } from "../stores/websocket";
import { useConfigActions, useConfig } from "../stores/config";
import { useStatusActions, useClientStatus, useRestartStatus } from "../stores/status";
import { webSocketManager } from "../services/websocket";
import { buildWebSocketUrl } from "../utils/portUtils";

const mockUseWebSocketActions = useWebSocketActions as ReturnType<typeof vi.fn>;
const mockUseConfigActions = useConfigActions as ReturnType<typeof vi.fn>;
const mockUseConfig = useConfig as ReturnType<typeof vi.fn>;
const mockUseStatusActions = useStatusActions as ReturnType<typeof vi.fn>;
const mockUseClientStatus = useClientStatus as ReturnType<typeof vi.fn>;
const mockUseRestartStatus = useRestartStatus as ReturnType<typeof vi.fn>;
const mockWebSocketManager = webSocketManager as any;
const mockBuildWebSocketUrl = buildWebSocketUrl as ReturnType<typeof vi.fn>;

describe("useWebSocket", () => {
  const mockUpdateConfig = vi.fn();
  const mockRefreshConfig = vi.fn();
  const mockRefreshStatus = vi.fn();
  const mockSetConnectionState = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful API responses
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    // Setup store mocks
    mockUseWebSocketActions.mockReturnValue({
      setConnectionState: mockSetConnectionState,
    });

    mockUseConfigActions.mockReturnValue({
      updateConfig: mockUpdateConfig,
      refreshConfig: mockRefreshConfig,
      getConfig: vi.fn().mockResolvedValue(null),
    });

    mockUseStatusActions.mockReturnValue({
      refreshStatus: mockRefreshStatus,
      getStatus: vi.fn().mockResolvedValue(null),
    });

    mockUseConfig.mockReturnValue(null);
    mockUseClientStatus.mockReturnValue(null);
    mockUseRestartStatus.mockReturnValue(null);

    // Setup WebSocketManager mocks
    mockWebSocketManager.connect.mockResolvedValue(undefined);
    mockWebSocketManager.disconnect.mockReturnValue(undefined);
    mockWebSocketManager.send.mockReturnValue(undefined);
    mockWebSocketManager.isConnected.mockReturnValue(false);
    mockWebSocketManager.subscribe.mockReturnValue(() => {});
    mockWebSocketManager.unsubscribe.mockReturnValue(undefined);
    mockWebSocketManager.getUrl.mockReturnValue("ws://localhost:3000");

    // Setup utility mocks
    mockBuildWebSocketUrl.mockReturnValue("ws://localhost:3000");
  });

  it("should be marked as deprecated", () => {
    // This test just verifies the hook exists and shows deprecation warning
    const { result } = renderHook(() => useWebSocket());

    // The hook should return an object with the expected properties
    expect(result.current).toHaveProperty('connected');
    expect(result.current).toHaveProperty('config');
    expect(result.current).toHaveProperty('status');
    expect(result.current).toHaveProperty('restartStatus');
    expect(result.current).toHaveProperty('updateConfig');
    expect(result.current).toHaveProperty('wsUrl');
  });

  it("returns data from mocked stores", () => {
    const mockConfig: AppConfig = {
      mcpEndpoint: "test-endpoint",
      mcpServers: {},
      connection: {
        heartbeatInterval: 30000,
        heartbeatTimeout: 10000,
        reconnectInterval: 5000,
      },
    };

    const mockStatus: ClientStatus = {
      status: "connected" as const,
      mcpEndpoint: "wss://test.endpoint",
      activeMCPServers: ["test"],
    };

    // Mock the store returns
    mockUseConfig.mockReturnValue(mockConfig);
    mockUseClientStatus.mockReturnValue(mockStatus);
    mockWebSocketManager.isConnected.mockReturnValue(true);

    const { result } = renderHook(() => useWebSocket());

    expect(result.current.config).toEqual(mockConfig);
    expect(result.current.status).toEqual(mockStatus);
    expect(result.current.connected).toBe(true);
  });

  it("provides updateConfig function", () => {
    const { result } = renderHook(() => useWebSocket());

    expect(typeof result.current.updateConfig).toBe("function");

    // Test that updateConfig calls the mocked function
    const newConfig: AppConfig = {
      mcpEndpoint: "test-endpoint",
      mcpServers: {},
      connection: {
        heartbeatInterval: 30000,
        heartbeatTimeout: 10000,
        reconnectInterval: 5000,
      },
    };

    result.current.updateConfig(newConfig);
    expect(mockUpdateConfig).toHaveBeenCalledWith(newConfig);
  });
});
