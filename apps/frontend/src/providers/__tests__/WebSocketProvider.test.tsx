/**
 * NetworkServiceProvider 组件测试
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  NetworkServiceProvider,
  useNetworkServiceActions,
} from "../WebSocketProvider";

// Mock useNetworkService hook
vi.mock("@/hooks/useNetworkService", () => ({
  useNetworkService: () => ({
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getStatus: vi.fn(),
    refreshStatus: vi.fn(),
    restartService: vi.fn(),
    restartServiceWithNotification: vi.fn(),
    changePort: vi.fn(),
    loadInitialData: vi.fn(),
    getServerUrl: vi.fn(() => "http://localhost:9999"),
  }),
}));

// Mock initializeStores
const mockInitializeStores = vi.fn().mockResolvedValue(undefined);
vi.mock("@/stores/index", () => ({
  initializeStores: () => mockInitializeStores(),
}));

describe("NetworkServiceProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初始渲染应显示加载指示器", () => {
    render(
      <NetworkServiceProvider>
        <div data-testid="child">child content</div>
      </NetworkServiceProvider>
    );

    expect(screen.getByText("正在初始化应用...")).toBeInTheDocument();
  });

  it("stores 初始化成功后应渲染子组件", async () => {
    render(
      <NetworkServiceProvider>
        <div data-testid="child">child content</div>
      </NetworkServiceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    expect(screen.queryByText("正在初始化应用...")).not.toBeInTheDocument();
  });

  it("stores 初始化失败后仍应渲染子组件（容错机制）", async () => {
    mockInitializeStores.mockRejectedValueOnce(new Error("init fail"));

    render(
      <NetworkServiceProvider>
        <div data-testid="child">child content</div>
      </NetworkServiceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });
  });
});

describe("useNetworkServiceActions", () => {
  it("在 Provider 内应返回有效的 context 值", async () => {
    function TestChild() {
      const actions = useNetworkServiceActions();
      const configType = typeof actions.getConfig;
      const portType = typeof actions.changePort;
      const urlType = typeof actions.getServerUrl;
      return (
        <div data-testid="actions">
          {configType}-{portType}-{urlType}
        </div>
      );
    }

    render(
      <NetworkServiceProvider>
        <TestChild />
      </NetworkServiceProvider>
    );

    await waitFor(
      () => {
        expect(screen.getByTestId("actions")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    const text = screen.getByTestId("actions").textContent;
    expect(text).toBe("function-function-function");
  });

  it("在 Provider 外应抛出错误", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    function TestComponent() {
      try {
        useNetworkServiceActions();
        return <div>should not reach</div>;
      } catch (error) {
        return <div>{(error as Error).message}</div>;
      }
    }

    const { container } = render(<TestComponent />);

    expect(container.textContent).toContain(
      "useNetworkServiceActions must be used within a NetworkServiceProvider"
    );

    spy.mockRestore();
  });
});
