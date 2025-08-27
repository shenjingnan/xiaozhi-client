/**
 * 兼容性测试 - 验证废弃选择器仍然正常工作
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import type React from "react";
import {
  useWebSocketConfig,
  useWebSocketStatus,
  useWebSocketMcpEndpoint,
  useWebSocketMcpServers,
  useWebSocketMcpServerConfig,
  useWebSocketRestartStatus,
} from "../stores/websocket";
import { useConfigStore } from "../stores/config";
import { useStatusStore } from "../stores/status";

// 测试组件 - 使用废弃的选择器
const LegacyComponent: React.FC = () => {
  const config = useWebSocketConfig();
  const status = useWebSocketStatus();
  const mcpEndpoint = useWebSocketMcpEndpoint();
  const mcpServers = useWebSocketMcpServers();
  const mcpServerConfig = useWebSocketMcpServerConfig();
  const restartStatus = useWebSocketRestartStatus();

  return (
    <div data-testid="legacy-component">
      <p data-testid="config">{config ? "配置已加载" : "配置未加载"}</p>
      <p data-testid="status">{status?.status || "状态未知"}</p>
      <p data-testid="endpoint">{mcpEndpoint || "端点未设置"}</p>
      <p data-testid="servers">
        服务器数量: {Object.keys(mcpServers || {}).length}
      </p>
      <p data-testid="server-config">
        工具数量: {Object.keys(mcpServerConfig || {}).length}
      </p>
      <p data-testid="restart">{restartStatus?.status || "重启状态未知"}</p>
    </div>
  );
};

// 导入新的选择器
import { useConfig } from "../stores/config";
import { useClientStatus } from "../stores/status";

// 混合使用新旧选择器的组件
const MixedComponent: React.FC = () => {
  // 使用废弃的选择器
  const legacyConfig = useWebSocketConfig();
  const legacyStatus = useWebSocketStatus();

  // 使用新的选择器
  const newConfig = useConfig();
  const newStatus = useClientStatus();

  return (
    <div data-testid="mixed-component">
      <p data-testid="legacy-config">
        {legacyConfig ? "旧配置已加载" : "旧配置未加载"}
      </p>
      <p data-testid="new-config">
        {newConfig ? "新配置已加载" : "新配置未加载"}
      </p>
      <p data-testid="legacy-status">{legacyStatus?.status || "旧状态未知"}</p>
      <p data-testid="new-status">{newStatus?.status || "新状态未知"}</p>
    </div>
  );
};

describe("兼容性验证", () => {
  // 模拟 console.warn 来捕获警告
  const originalWarn = console.warn;
  const mockWarn = vi.fn();

  beforeEach(() => {
    // 重置所有 stores
    useConfigStore.getState().reset();
    useStatusStore.getState().reset();

    // 模拟 console.warn
    console.warn = mockWarn;
    mockWarn.mockClear();
  });

  afterEach(() => {
    // 恢复 console.warn
    console.warn = originalWarn;
  });

  it("应该支持废弃的选择器正常工作", () => {
    const { getByTestId } = render(<LegacyComponent />);

    // 验证组件能够正常渲染
    expect(getByTestId("legacy-component")).toBeDefined();
    expect(getByTestId("config")).toBeDefined();
    expect(getByTestId("status")).toBeDefined();
    expect(getByTestId("endpoint")).toBeDefined();
    expect(getByTestId("servers")).toBeDefined();
    expect(getByTestId("server-config")).toBeDefined();
    expect(getByTestId("restart")).toBeDefined();

    // 验证初始状态
    expect(getByTestId("config").textContent).toBe("配置未加载");
    expect(getByTestId("status").textContent).toBe("状态未知");
    expect(getByTestId("endpoint").textContent).toBe("端点未设置");
    expect(getByTestId("servers").textContent).toBe("服务器数量: 0");
    expect(getByTestId("server-config").textContent).toBe("工具数量: 0");
    expect(getByTestId("restart").textContent).toBe("重启状态未知");
  });

  it("应该显示兼容性警告", () => {
    render(<LegacyComponent />);

    // 验证每个废弃选择器都显示了警告
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("useWebSocketConfig] 此选择器已废弃")
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("useWebSocketStatus] 此选择器已废弃")
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("useWebSocketMcpEndpoint] 此选择器已废弃")
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("useWebSocketMcpServers] 此选择器已废弃")
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("useWebSocketMcpServerConfig] 此选择器已废弃")
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("useWebSocketRestartStatus] 此选择器已废弃")
    );
  });

  it("应该支持新旧选择器混合使用", () => {
    const { getByTestId } = render(<MixedComponent />);

    // 验证组件能够正常渲染
    expect(getByTestId("mixed-component")).toBeDefined();
    expect(getByTestId("legacy-config")).toBeDefined();
    expect(getByTestId("new-config")).toBeDefined();
    expect(getByTestId("legacy-status")).toBeDefined();
    expect(getByTestId("new-status")).toBeDefined();

    // 验证初始状态
    expect(getByTestId("legacy-config").textContent).toBe("旧配置未加载");
    expect(getByTestId("new-config").textContent).toBe("新配置未加载");
    expect(getByTestId("legacy-status").textContent).toBe("旧状态未知");
    expect(getByTestId("new-status").textContent).toBe("新状态未知");
  });

  it("应该确保废弃选择器返回正确的数据", () => {
    // 设置一些测试数据

    const mockConfig = {
      mcpEndpoint: "wss://test.example.com/mcp",
      mcpServers: { test: { command: "test", args: [] } },
      connection: {
        heartbeatInterval: 30000,
        heartbeatTimeout: 10000,
        reconnectInterval: 5000,
      },
      webUI: { port: 9999 },
    };

    const mockStatus = {
      status: "connected" as const,
      mcpEndpoint: "wss://test.example.com/mcp",
      activeMCPServers: ["test-server"],
      lastHeartbeat: Date.now(),
    };

    const mockRestartStatus = {
      status: "completed" as const,
      timestamp: Date.now(),
    };

    useConfigStore.getState().setConfig(mockConfig, "http");
    useStatusStore.getState().setClientStatus(mockStatus, "http");
    useStatusStore.getState().setRestartStatus(mockRestartStatus);

    const { getByTestId } = render(<LegacyComponent />);

    // 验证废弃选择器返回正确的数据
    expect(getByTestId("config").textContent).toBe("配置已加载");
    expect(getByTestId("status").textContent).toBe("connected");
    expect(getByTestId("endpoint").textContent).toBe(
      "wss://test.example.com/mcp"
    );
    expect(getByTestId("servers").textContent).toBe("服务器数量: 1");
    expect(getByTestId("restart").textContent).toBe("completed");
  });

  it("应该确保废弃选择器能够正常获取数据", () => {
    // 设置测试数据
    const mockConfig = {
      mcpEndpoint: "wss://test.example.com/mcp",
      mcpServers: { test: { command: "test", args: [] } },
      connection: {
        heartbeatInterval: 30000,
        heartbeatTimeout: 10000,
        reconnectInterval: 5000,
      },
      webUI: { port: 9999 },
    };

    const mockStatus = {
      status: "connected" as const,
      mcpEndpoint: "wss://test.example.com/mcp",
      activeMCPServers: ["test-server"],
      lastHeartbeat: Date.now(),
    };

    useConfigStore.getState().setConfig(mockConfig, "http");
    useStatusStore.getState().setClientStatus(mockStatus, "http");

    // 创建测试组件来验证废弃选择器
    const TestComponent = () => {
      const legacyConfig = useWebSocketConfig();
      const legacyStatus = useWebSocketStatus();
      const legacyEndpoint = useWebSocketMcpEndpoint();

      return (
        <div>
          <p data-testid="config-equal">{legacyConfig ? "true" : "false"}</p>
          <p data-testid="status-equal">{legacyStatus?.status || "none"}</p>
          <p data-testid="endpoint-equal">{legacyEndpoint || "none"}</p>
        </div>
      );
    };

    const { getByTestId } = render(<TestComponent />);

    // 验证废弃选择器能够正常获取数据
    expect(getByTestId("config-equal").textContent).toBe("true");
    expect(getByTestId("status-equal").textContent).toBe("connected");
    expect(getByTestId("endpoint-equal").textContent).toBe(
      "wss://test.example.com/mcp"
    );
  });
});
