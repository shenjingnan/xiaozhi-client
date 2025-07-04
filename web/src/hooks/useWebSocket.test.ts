import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "./useWebSocket";

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.(new Event("open"));
    }, 0);
  }

  send(_data: string) {
    // Mock send
  }

  close() {
    this.readyState = 3;
    this.onclose?.(new CloseEvent("close"));
  }
}

global.WebSocket = MockWebSocket as any;

// Mock instances tracking
let mockInstances: MockWebSocket[] = [];
(global.WebSocket as any).mock = {
  instances: mockInstances,
};

// Override constructor to track instances
const OriginalMockWebSocket = MockWebSocket;
global.WebSocket = class extends OriginalMockWebSocket {
  constructor(url: string) {
    super(url);
    mockInstances.push(this);
  }
} as any;
(global.WebSocket as any).mock = {
  instances: mockInstances,
};

describe("useWebSocket", () => {
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInstances = [];
    (global.WebSocket as any).mock.instances = mockInstances;
    // Clear localStorage
    localStorage.clear();
    // Reset window.location
    Object.defineProperty(window, "location", {
      value: {
        protocol: "http:",
        hostname: "localhost",
        port: "",
      },
      writable: true,
    });
  });

  it("initializes with disconnected state", () => {
    const { result } = renderHook(() => useWebSocket());

    expect(result.current.connected).toBe(false);
    expect(result.current.config).toBe(null);
    expect(result.current.status).toBe(null);
  });

  it("connects and requests initial data", async () => {
    const { result } = renderHook(() => useWebSocket());

    // Wait for connection
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.connected).toBe(true);
  });

  it("handles config message", async () => {
    const { result } = renderHook(() => useWebSocket());

    // Wait for connection
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Get the WebSocket instance
    mockWebSocket = (global as any).WebSocket.mock.instances[0];

    // Simulate config message
    const configData = {
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {},
    };

    act(() => {
      mockWebSocket.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "config", data: configData }),
        })
      );
    });

    expect(result.current.config).toEqual(configData);
  });

  it("handles status message", async () => {
    const { result } = renderHook(() => useWebSocket());

    // Wait for connection
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Get the WebSocket instance
    mockWebSocket = (global as any).WebSocket.mock.instances[0];

    // Simulate status message
    const statusData = {
      status: "connected" as const,
      mcpEndpoint: "wss://test.endpoint",
      activeMCPServers: ["test"],
    };

    act(() => {
      mockWebSocket.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "status", data: statusData }),
        })
      );
    });

    expect(result.current.status).toEqual(statusData);
  });

  it("handles disconnect", async () => {
    const { result } = renderHook(() => useWebSocket());

    // Wait for connection
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Get the WebSocket instance
    mockWebSocket = (global as any).WebSocket.mock.instances[0];

    // Simulate disconnect
    act(() => {
      mockWebSocket.close();
    });

    expect(result.current.connected).toBe(false);
  });

  describe("WebSocket URL generation", () => {
    it("uses current page port when available", () => {
      // Set window location with port
      Object.defineProperty(window, "location", {
        value: {
          protocol: "http:",
          hostname: "localhost",
          port: "8080",
        },
        writable: true,
      });

      renderHook(() => useWebSocket());

      // Get the WebSocket instance
      const ws = (global as any).WebSocket.mock.instances[0];
      expect(ws.url).toBe("ws://localhost:8080");
    });

    it("uses no port for standard HTTP port", () => {
      // Set window location without port (standard HTTP)
      Object.defineProperty(window, "location", {
        value: {
          protocol: "http:",
          hostname: "localhost",
          port: "",
        },
        writable: true,
      });

      renderHook(() => useWebSocket());

      // Get the WebSocket instance
      const ws = (global as any).WebSocket.mock.instances[0];
      expect(ws.url).toBe("ws://localhost");
    });

    it("uses wss protocol for https pages", () => {
      // Set window location with HTTPS
      Object.defineProperty(window, "location", {
        value: {
          protocol: "https:",
          hostname: "localhost",
          port: "8443",
        },
        writable: true,
      });

      renderHook(() => useWebSocket());

      // Get the WebSocket instance
      const ws = (global as any).WebSocket.mock.instances[0];
      expect(ws.url).toBe("wss://localhost:8443");
    });

    it("uses saved URL from localStorage when available", () => {
      // Set a custom URL in localStorage
      localStorage.setItem("xiaozhi-ws-url", "ws://custom.host:9999");

      renderHook(() => useWebSocket());

      // Get the WebSocket instance
      const ws = (global as any).WebSocket.mock.instances[0];
      expect(ws.url).toBe("ws://custom.host:9999");
    });

    it("uses custom port 8088", () => {
      // Set window location with custom port 8088
      Object.defineProperty(window, "location", {
        value: {
          protocol: "http:",
          hostname: "localhost",
          port: "8088",
        },
        writable: true,
      });

      renderHook(() => useWebSocket());

      // Get the WebSocket instance
      const ws = (global as any).WebSocket.mock.instances[0];
      expect(ws.url).toBe("ws://localhost:8088");
    });
  });
});
