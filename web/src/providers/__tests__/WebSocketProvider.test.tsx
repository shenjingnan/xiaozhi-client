import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocketContext } from "../WebSocketProvider";

// Mock WebSocketManager
vi.mock("@/services/WebSocketManager", () => ({
  WebSocketManager: {
    getInstance: vi.fn(() => ({
      getState: vi.fn(() => "connected"),
    })),
  },
}));

// Mock Zustand store hooks
vi.mock("@/stores/websocket", () => ({
  useWebSocketConnected: vi.fn(() => true),
  useWebSocketConfig: vi.fn(() => ({ mcpEndpoint: "test" })),
  useWebSocketStatus: vi.fn(() => ({ status: "connected" })),
  useWebSocketRestartStatus: vi.fn(() => undefined),
  useWebSocketPortChangeStatus: vi.fn(() => undefined),
  useWebSocketUrl: vi.fn(() => "ws://localhost:9999"),
  useWebSocketStore: vi.fn(() => ({
    setConnected: vi.fn(),
    setConfig: vi.fn(),
    setStatus: vi.fn(),
    setRestartStatus: vi.fn(),
    setPortChangeStatus: vi.fn(),
    setWsUrl: vi.fn(),
  })),
}));

describe("useWebSocketContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return WebSocketManager instance and state from Zustand store", () => {
    const { result } = renderHook(() => useWebSocketContext());

    expect(result.current).toEqual({
      manager: expect.any(Object),
      websocket: expect.any(Object),
      state: "connected",
      connected: true,
      config: { mcpEndpoint: "test" },
      status: { status: "connected" },
      restartStatus: undefined,
      portChangeStatus: undefined,
      wsUrl: "ws://localhost:9999",
    });
  });

  it("should provide the same WebSocketManager instance for manager and websocket", () => {
    const { result } = renderHook(() => useWebSocketContext());

    expect(result.current.manager).toBe(result.current.websocket);
  });

  it("should get state directly from Zustand store hooks", async () => {
    const { useWebSocketConnected, useWebSocketConfig } = await import(
      "@/stores/websocket"
    );

    renderHook(() => useWebSocketContext());

    expect(useWebSocketConnected).toHaveBeenCalled();
    expect(useWebSocketConfig).toHaveBeenCalled();
  });
});
